// Host (node) half of dsh-quick-commands.
//
// The dropdown only renders while the current session's working directory has
// uncommitted git changes. This half answers that question: it registers a
// `/quickcommands/status` route that resolves a session's cwd and runs
// `git status --porcelain` (via the system git binary, no state, no library),
// returning `{ repo, dirty }`. The browser half polls this route.

import { spawn } from "node:child_process";
import { URL } from "node:url";

const name = "dsh-quick-commands";
const inject = ["webServer", "sessions"];

/**
 * Whether `cwd` is a git work tree with uncommitted changes.
 * Never throws: any failure (not a repo, git missing, timeout) folds to
 * `{ repo: false, dirty: false }`, which hides the dropdown.
 */
function gitStatus(cwd) {
	return new Promise((resolve) => {
		let settled = false;
		const done = (repo, dirty) => {
			if (settled) return;
			settled = true;
			resolve({ repo, dirty });
		};

		let child;
		try {
			child = spawn(
				"git",
				[
					"-C",
					cwd,
					"--no-pager",
					"-c",
					"color.ui=false",
					"status",
					"--porcelain=v1",
					"--untracked-files=normal",
				],
				{
					stdio: ["ignore", "pipe", "pipe"],
					env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
				},
			);
		} catch {
			done(false, false);
			return;
		}

		const timer = setTimeout(() => {
			try {
				child.kill("SIGKILL");
			} catch {
				/* already gone */
			}
			done(false, false);
		}, 10000);

		let stdout = "";
		child.stdout.on("data", (chunk) => {
			stdout += chunk.toString("utf8");
		});
		child.on("error", () => {
			clearTimeout(timer);
			done(false, false);
		});
		child.on("close", (code) => {
			clearTimeout(timer);
			if (code !== 0) {
				done(false, false);
				return;
			}
			done(true, stdout.trim().length > 0);
		});
	});
}

function apply(ctx) {
	ctx.effect(
		() =>
			ctx.webServer.register({
				kind: "prefix",
				path: "/quickcommands/status",
				handler: async (req, res) => {
					let status;
					try {
						const url = new URL(req.url ?? "/", "http://dsh.internal");
						const sessionId = url.searchParams.get("sessionId");
						const cwd =
							sessionId === null
								? undefined
								: ctx.sessions.get(sessionId)?.header?.cwd;
						status =
							cwd === undefined || cwd === ""
								? { repo: false, dirty: false }
								: await gitStatus(cwd);
					} catch {
						status = { repo: false, dirty: false };
					}
					res.writeHead(200, {
						"content-type": "application/json; charset=utf-8",
						"cache-control": "no-cache",
					});
					res.end(JSON.stringify(status));
				},
			}),
		"dsh-quick-commands: /quickcommands/status",
	);
}

export { apply, inject, name };
