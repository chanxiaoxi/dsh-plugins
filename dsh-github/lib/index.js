// Host (node) half of dsh-github.
//
// The browser panel never talks to api.github.com directly. This half owns
// every GitHub interaction: it resolves the current session's git working
// directory, derives the `owner/repo` from the `origin` remote, and proxies
// list/mutation calls to the GitHub REST API. Authentication order is:
//
//   1. the `gh` CLI when it is installed AND logged in (`gh auth login`)
//   2. GITHUB_TOKEN / GH_TOKEN environment variable (Bearer)
//   3. anonymous (public repositories, read-only — mutations fail loudly)
//
// Routes (all JSON, all HTTP 200 with an `ok` envelope):
//   GET  /github/repo?sessionId=..          -> { ok, owner, repo, auth }
//   GET  /github/issues?sessionId=..&state=  -> { ok, auth, items }
//   GET  /github/pulls?sessionId=..&state=   -> { ok, auth, items }
//   POST /github/issue  { sessionId, number, action: "close" | "open" }
//   POST /github/pull   { sessionId, number, action: "close" | "merge" }

import { spawn } from "node:child_process";
import { URL } from "node:url";

const name = "dsh-github";
const inject = ["webServer", "sessions"];

const GITHUB_API = "https://api.github.com";
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
const MAX_BODY_BYTES = 1_000_000;

/**
 * Run a process and capture stdout/stderr. Never rejects: every outcome folds
 * into `{ ok, code, stdout, stderr, error }`.
 */
function runProcess(file, args, opts = {}) {
	return new Promise((resolve) => {
		let settled = false;
		let stdout = "";
		let stderr = "";
		let child;
		const done = (result) => {
			if (settled) return;
			settled = true;
			resolve(result);
		};

		try {
			child = spawn(file, args, {
				stdio: ["pipe", "pipe", "pipe"],
				env: { ...process.env, NO_COLOR: "1", GH_FORCE_TTY: "0" },
				...opts,
			});
		} catch (err) {
			done({ ok: false, error: String(err) });
			return;
		}

		const timer = setTimeout(() => {
			try {
				child.kill("SIGKILL");
			} catch {
				/* already gone */
			}
			done({ ok: false, error: "timed out" });
		}, opts.timeout ?? 20000);

		if (opts.input !== undefined) child.stdin.end(opts.input);
		else child.stdin.end();
		child.stdout?.on("data", (chunk) => {
			stdout += chunk.toString("utf8");
		});
		child.stderr?.on("data", (chunk) => {
			stderr += chunk.toString("utf8");
		});
		child.on("error", (err) => {
			clearTimeout(timer);
			done({ ok: false, error: String(err) });
		});
		child.on("close", (code) => {
			clearTimeout(timer);
			done({ ok: code === 0, code, stdout, stderr });
		});
	});
}

/** Cached one-shot probe: is the `gh` CLI installed AND logged in? */
let ghAuthPromise = null;
function ghAuthed() {
	if (ghAuthPromise === null) {
		// `gh auth status` exits 0 when authenticated, non-zero otherwise, and
		// never prompts — a safe, fast "is gh ready to use" check.
		ghAuthPromise = runProcess("gh", ["auth", "status"], { timeout: 4000 }).then(
			(r) => r.ok,
		);
	}
	return ghAuthPromise;
}

/**
 * Resolve the origin remote of a git working tree. Returns the first non-empty
 * URL from `git remote get-url origin`, then `git config remote.origin.url`.
 * Any failure folds to `null`.
 */
async function gitOrigin(cwd) {
	if (!cwd) return null;
	const attempts = [
		["-C", cwd, "--no-pager", "remote", "get-url", "origin"],
		["-C", cwd, "--no-pager", "config", "--get", "remote.origin.url"],
	];
	for (const args of attempts) {
		const r = await runProcess("git", args, { timeout: 5000 });
		const url = (r.stdout || "").trim();
		if (r.ok && url) return url;
	}
	return null;
}

/**
 * Parse a git remote URL into `{ owner, repo }` for GitHub (dot-com and
 * `ssh://`/`git@` forms). Returns `null` when it is not a GitHub URL.
 */
function parseGithubUrl(url) {
	const cleaned = String(url || "")
		.trim()
		.replace(/\.git$/i, "")
		.replace(/\/+$/, "");
	if (!cleaned) return null;

	// https://github.com/owner/repo   or   http://github.com/owner/repo
	let m = cleaned.match(/^(?:https?:\/\/)?(?:www\.)?github\.com[:\/]([^/\s]+)\/([^/\s]+)$/i);
	if (m) return { owner: m[1], repo: m[2] };

	// git@github.com:owner/repo   or   ssh://git@github.com/owner/repo
	m = cleaned.match(/^(?:git@github\.com:|ssh:\/\/git@github\.com\/)([^/\s]+)\/([^/\s]+)$/i);
	if (m) return { owner: m[1], repo: m[2] };

	return null;
}

/** Resolve `{ owner, repo } | null` for a session working directory. */
async function resolveRepo(cwd) {
	const url = await gitOrigin(cwd);
	return url ? parseGithubUrl(url) : null;
}

/** Report which auth channel is currently active. */
async function authMode() {
	if (await ghAuthed()) return "gh";
	if (TOKEN) return "token";
	return "anonymous";
}

/** GitHub REST call through the `gh` CLI (stdin carries the JSON body). */
async function ghApi(method, path, body) {
	const args = ["api", path, "--method", method];
	if (body !== undefined) args.push("--input", "-");
	const r = await runProcess("gh", args, {
		input: body === undefined ? undefined : JSON.stringify(body),
		timeout: 30000,
	});
	if (!r.ok) {
		const stderr = (r.stderr || "").trim();
		const last = stderr.split("\n").filter(Boolean).pop();
		throw new Error(last || `gh exit ${r.code}`);
	}
	const text = (r.stdout || "").trim();
	if (!text) return null;
	try {
		return JSON.parse(text);
	} catch {
		return text;
	}
}

/** GitHub REST call through `fetch` with an optional bearer token. */
async function fetchApi(method, path, body, token) {
	const headers = {
		accept: "application/vnd.github+json",
		"user-agent": "dsh-github",
		"x-github-api-version": "2022-11-28",
	};
	if (token) headers.authorization = `Bearer ${token}`;
	const res = await fetch(GITHUB_API + path, {
		method,
		headers,
		body: body === undefined ? undefined : JSON.stringify(body),
	});
	if (res.status === 204) return null;
	const text = await res.text();
	let data = null;
	try {
		data = text ? JSON.parse(text) : null;
	} catch {
		data = text;
	}
	if (!res.ok) {
		const msg =
			data && typeof data === "object" && data.message
				? data.message
				: `GitHub API ${res.status}`;
		const err = new Error(msg);
		err.status = res.status;
		throw err;
	}
	return data;
}

/**
 * Single GitHub request entrypoint: logged-in `gh` first, then token env,
 * then anonymous (read-only). Mutations without any auth fail with a clear
 * error.
 */
async function githubRequest(method, path, body) {
	if (await ghAuthed()) return ghApi(method, path, body);
	if (TOKEN) return fetchApi(method, path, body, TOKEN);
	if (method === "GET") return fetchApi(method, path, body, undefined);
	throw new Error(
		"Write operations need authentication: run `gh auth login` or set GITHUB_TOKEN (or GH_TOKEN)",
	);
}

/** Read a JSON request body (bounded). */
function readBody(req) {
	return new Promise((resolve) => {
		let body = "";
		req.on("data", (chunk) => {
			body += chunk.toString("utf8");
			if (body.length > MAX_BODY_BYTES) req.destroy();
		});
		req.on("end", () => {
			try {
				resolve(body ? JSON.parse(body) : {});
			} catch {
				resolve({});
			}
		});
		req.on("error", () => resolve({}));
	});
}

function sendJson(res, status, payload) {
	res.writeHead(status, {
		"content-type": "application/json; charset=utf-8",
		"cache-control": "no-cache",
	});
	res.end(JSON.stringify(payload));
}

function apply(ctx) {
	ctx.effect(
		() =>
			ctx.webServer.register({
				kind: "prefix",
				path: "/github",
				handler: async (req, res) => {
					try {
						const url = new URL(req.url ?? "/", "http://dsh.internal");
						const sub = url.pathname.slice("/github/".length).replace(/\/+$/, "");
						const sessionId = url.searchParams.get("sessionId");
						const cwd =
							sessionId === null || sessionId === ""
								? ""
								: ctx.sessions.get(sessionId)?.header?.cwd ?? "";

						const repo = await resolveRepo(cwd);
						if (!repo) {
							sendJson(res, 200, {
								ok: false,
								error: "No GitHub repository found for this workspace (no `origin` remote).",
							});
							return;
						}
						const { owner, repo: repoName } = repo;
						const base = `/repos/${owner}/${repoName}`;

						if (req.method === "GET" && sub === "repo") {
							const auth = await authMode();
							sendJson(res, 200, { ok: true, owner, repo: repoName, auth });
							return;
						}

						if (req.method === "GET" && sub === "issues") {
							const state = url.searchParams.get("state") === "closed" ? "closed" : "open";
							const data = await githubRequest(
								"GET",
								`${base}/issues?state=${state}&per_page=100&sort=updated`,
							);
							const items = (Array.isArray(data) ? data : []).filter(
								(item) => !item.pull_request,
							);
							const auth = await authMode();
							sendJson(res, 200, { ok: true, auth, items });
							return;
						}

						if (req.method === "GET" && sub === "pulls") {
							const state = url.searchParams.get("state") === "closed" ? "closed" : "open";
							const data = await githubRequest(
								"GET",
								`${base}/pulls?state=${state}&per_page=100&sort=updated`,
							);
							const auth = await authMode();
							sendJson(res, 200, { ok: true, auth, items: Array.isArray(data) ? data : [] });
							return;
						}

						if (req.method === "POST" && (sub === "issue" || sub === "pull")) {
							const body = await readBody(req);
							const number = Number(body.number);
							if (!Number.isInteger(number) || number < 1) {
								sendJson(res, 200, { ok: false, error: "Invalid item number." });
								return;
							}

							if (sub === "issue") {
								const action = body.action;
								const state =
									action === "close" ? "closed" : action === "open" ? "open" : null;
								if (state === null) {
									sendJson(res, 200, { ok: false, error: "Unknown issue action." });
									return;
								}
								const item = await githubRequest("PATCH", `${base}/issues/${number}`, {
									state,
								});
								sendJson(res, 200, { ok: true, item });
								return;
							}

							// pull
							if (body.action === "close") {
								const item = await githubRequest("PATCH", `${base}/pulls/${number}`, {
									state: "closed",
								});
								sendJson(res, 200, { ok: true, item });
								return;
							}
							if (body.action === "merge") {
								const item = await githubRequest(
									"PUT",
									`${base}/pulls/${number}/merge`,
									{ merge_method: "merge" },
								);
								sendJson(res, 200, { ok: true, item });
								return;
							}
							sendJson(res, 200, { ok: false, error: "Unknown pull action." });
							return;
						}

						sendJson(res, 200, { ok: false, error: "Unknown route." });
					} catch (err) {
						sendJson(res, 200, { ok: false, error: err?.message || String(err) });
					}
				},
			}),
		"dsh-github: /github/ routes",
	);
}

export { apply, inject, name };
