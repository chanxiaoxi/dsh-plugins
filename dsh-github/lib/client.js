window.__ModuleLoader__.load({
	id: "dsh-github",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let React = require("react");

		/**
		 * dsh-github client half: a GitHub issues & pull-requests side panel.
		 *
		 * Placement strategy (mirrors the "sider" requirement):
		 *   - If `dsh-better-sidebar` is installed, register this panel as one of
		 *     its sidebar tabs through `ctx.betterSidebar.registerTab(...)`.
		 *   - Otherwise, render our own standalone Sider: a toggle button in the
		 *     sidebar footer (`sidebar.footer.action`) plus a right-docked drawer
		 *     in `shell.overlay`.
		 */

		/* ------------------------------------------------------------------ */
		/* Shared panel-open store (standalone Sider only)                     */
		/* ------------------------------------------------------------------ */

		let panelOpen = false;
		const panelListeners = new Set();
		const panelStore = {
			getSnapshot: () => panelOpen,
			subscribe: (fn) => {
				panelListeners.add(fn);
				return () => panelListeners.delete(fn);
			},
			set: (next) => {
				if (panelOpen === next) return;
				panelOpen = next;
				for (const fn of panelListeners) fn();
			},
			toggle: () => panelStore.set(!panelOpen),
		};

		function usePanelOpen() {
			const [open, setOpen] = React.useState(panelStore.getSnapshot());
			React.useEffect(
				() => panelStore.subscribe(() => setOpen(panelStore.getSnapshot())),
				[],
			);
			return open;
		}

		/* ------------------------------------------------------------------ */
		/* Theme variables                                                     */
		/* ------------------------------------------------------------------ */

		const T = {
			bg: "var(--dsw-alias-bg-overlay, #141419)",
			bgPanel: "var(--dsw-alias-bg-layer-1, #1a1a21)",
			bgPanel2: "var(--dsw-alias-bg-layer-2, #23232c)",
			border: "var(--dsw-alias-border-l1, rgba(140,142,152,0.28))",
			borderL2: "var(--dsw-alias-border-l2, rgba(140,142,152,0.16))",
			textPrimary: "var(--dsw-alias-label-primary, #e8e8f0)",
			textSecondary: "var(--dsw-alias-label-secondary, #8c8e98)",
			brand: "var(--dsw-alias-brand-primary, #4d6bfe)",
			hover: "var(--dsw-alias-interactive-bg-hover, rgba(140,142,152,0.12))",
			success: "var(--dsw-alias-state-success-primary, #35c48d)",
			error: "var(--dsw-alias-state-error-primary, #e5534b)",
			warn: "var(--dsw-alias-state-warn-primary, #e0a32e)",
		};

		/* ------------------------------------------------------------------ */
		/* Small presentational helpers                                        */
		/* ------------------------------------------------------------------ */

		function GithubIcon({ size = 16 }) {
			return React.createElement(
				"svg",
				{
					viewBox: "0 0 24 24",
					width: size,
					height: size,
					fill: "none",
					"aria-hidden": true,
					stroke: "currentColor",
					strokeWidth: 1.7,
					strokeLinecap: "round",
					strokeLinejoin: "round",
				},
				React.createElement("circle", { cx: 6, cy: 5, r: 2.4 }),
				React.createElement("circle", { cx: 6, cy: 19, r: 2.4 }),
				React.createElement("circle", { cx: 18, cy: 8, r: 2.4 }),
				React.createElement("path", { d: "M6 7.4v9.2" }),
				React.createElement("path", { d: "M18 10.4c0 3.2-3 4.6-8 4.6" }),
			);
		}

		function StateBadge({ kind, children }) {
			const color = kind === "open" ? T.success : kind === "merged" ? T.brand : T.textSecondary;
			return React.createElement(
				"span",
				{
					style: {
						display: "inline-flex",
						alignItems: "center",
						height: "18px",
						padding: "0 7px",
						borderRadius: "999px",
						fontSize: "11px",
						lineHeight: "18px",
						fontWeight: 600,
						color,
						background: "color-mix(in srgb, currentColor 14%, transparent)",
						flex: "none",
					},
				},
				children,
			);
		}

		function ActionButton({ onClick, disabled, children, danger, primary, title }) {
			return React.createElement(
				"button",
				{
					type: "button",
					title: title,
					disabled: disabled,
					onClick: onClick,
					style: {
						boxSizing: "border-box",
						height: "26px",
						padding: "0 10px",
						border: `1px solid ${primary ? T.brand : danger ? "rgba(229,83,75,0.4)" : T.border}`,
						borderRadius: "6px",
						background: primary ? T.brand : "transparent",
						color: primary ? "#fff" : danger ? T.error : T.textPrimary,
						fontSize: "12px",
						lineHeight: "24px",
						fontWeight: 500,
						cursor: disabled ? "not-allowed" : "pointer",
						opacity: disabled ? 0.5 : 1,
						whiteSpace: "nowrap",
					},
				},
				children,
			);
		}

		/** Write a reference into the current session's composer (no submit). */
		function quoteToComposer(ctx, sessionId, text) {
			try {
				const sessions = ctx.get("sessions");
				const conversation = ctx.get("conversation");
				if (!sessions || !conversation || !conversation.input) return false;
				const actx = sessions.scope(sessionId);
				if (!actx) return false;
				const input = conversation.input.for(actx);
				if (!input || typeof input.setDraft !== "function") return false;
				const cur =
					input.state && typeof input.state.getSnapshot === "function"
						? input.state.getSnapshot().draft
						: "";
				input.setDraft(cur ? `${cur}\n${text}` : text);
				return true;
			} catch {
				return false;
			}
		}

		async function getJson(url) {
			const res = await fetch(url);
			return res.json();
		}

		function postJson(url, payload) {
			return fetch(url, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(payload),
			}).then((res) => res.json());
		}

		/* ------------------------------------------------------------------ */
		/* GitHubPanel — shared by both placements                             */
		/* ------------------------------------------------------------------ */

		function GitHubPanel({ ctx, sessionId, onClose }) {
			const [repo, setRepo] = React.useState(null); // { owner, repo }
			const [auth, setAuth] = React.useState(null);
			const [status, setStatus] = React.useState("loading"); // loading | ready | error
			const [statusError, setStatusError] = React.useState(null);
			const [tab, setTab] = React.useState("issues"); // issues | pulls
			const [stateFilter, setStateFilter] = React.useState("open"); // open | closed
			const [issues, setIssues] = React.useState([]);
			const [pulls, setPulls] = React.useState([]);
			const [busy, setBusy] = React.useState({});

			const refresh = React.useCallback(async () => {
				if (!sessionId) {
					setStatus("error");
					setStatusError("No active session — select a workspace first.");
					setRepo(null);
					setIssues([]);
					setPulls([]);
					return;
				}
				setStatus("loading");
				setStatusError(null);
				try {
					const repoRes = await getJson(
						`/github/repo?sessionId=${encodeURIComponent(sessionId)}`,
					);
					if (!repoRes.ok) {
						setStatus("error");
						setStatusError(repoRes.error || "No GitHub repository found.");
						setRepo(null);
						setIssues([]);
						setPulls([]);
						return;
					}
					setRepo({ owner: repoRes.owner, repo: repoRes.repo });
					setAuth(repoRes.auth);

					const qs = `sessionId=${encodeURIComponent(sessionId)}&state=${stateFilter}`;
					const [issRes, prRes] = await Promise.all([
						getJson(`/github/issues?${qs}`),
						getJson(`/github/pulls?${qs}`),
					]);
					setIssues(issRes.ok ? issRes.items : []);
					setPulls(prRes.ok ? prRes.items : []);
					setStatus("ready");
					if (!issRes.ok && issRes.error) setStatusError(issRes.error);
					else if (!prRes.ok && prRes.error) setStatusError(prRes.error);
				} catch (err) {
					setStatus("error");
					setStatusError(String((err && err.message) || err));
				}
			}, [sessionId, stateFilter]);

			React.useEffect(() => {
				refresh();
			}, [refresh]);

			const doAction = React.useCallback(
				async (kind, number, action) => {
					const key = `${kind}:${number}:${action}`;
					setBusy((b) => ({ ...b, [key]: true }));
					setStatusError(null);
					try {
						const data = await postJson(`/github/${kind}`, {
							sessionId,
							number,
							action,
						});
						if (!data.ok) {
							setStatusError(data.error || "Operation failed.");
						} else {
							await refresh();
						}
					} catch (err) {
						setStatusError(String((err && err.message) || err));
					} finally {
						setBusy((b) => {
							const next = { ...b };
							delete next[key];
							return next;
						});
					}
				},
				[sessionId, refresh],
			);

			const quoteItem = React.useCallback(
				(kind, number, title, htmlUrl) => {
					const ok = quoteToComposer(ctx, sessionId, `#${number} ${title}\n${htmlUrl}`);
					setStatusError(ok ? null : "Could not write to the composer.");
				},
				[ctx, sessionId],
			);

			/* ----- rendering ----- */

			if (status === "loading") {
				return React.createElement(
					"div",
					{ style: { padding: "16px", color: T.textSecondary, fontSize: "13px" } },
					"Loading GitHub…",
				);
			}

			const header = React.createElement(
				"div",
				{
					style: {
						display: "flex",
						alignItems: "center",
						gap: "8px",
						padding: "12px 14px",
						borderBottom: `1px solid ${T.borderL2}`,
					},
				},
				React.createElement(
					"span",
					{ style: { color: T.textSecondary, display: "inline-flex" } },
					React.createElement(GithubIcon, { size: 16 }),
				),
				React.createElement(
					"span",
					{
						style: {
							color: T.textPrimary,
							fontSize: "13px",
							fontWeight: 600,
							flex: "1 1 auto",
							minWidth: 0,
							overflow: "hidden",
							textOverflow: "ellipsis",
							whiteSpace: "nowrap",
						},
						title: repo ? `${repo.owner}/${repo.repo}` : undefined,
					},
					repo ? `${repo.owner}/${repo.repo}` : "GitHub",
				),
				auth
					? React.createElement(
							"span",
							{
								title:
									auth === "anonymous"
										? "Read-only (no token / gh)"
										: `Auth: ${auth}`,
								style: {
									fontSize: "11px",
									color: auth === "anonymous" ? T.warn : T.textSecondary,
									background: T.bgPanel2,
									borderRadius: "4px",
									padding: "1px 6px",
									flex: "none",
								},
							},
							auth === "anonymous" ? "read-only" : auth,
					  )
					: null,
				React.createElement(
					"button",
					{
						type: "button",
						title: "Refresh",
						onClick: refresh,
						style: {
							border: "none",
							background: "transparent",
							color: T.textSecondary,
							cursor: "pointer",
							padding: "4px",
							borderRadius: "6px",
							display: "inline-flex",
						},
					},
					React.createElement(
						"svg",
						{
							viewBox: "0 0 24 24",
							width: 15,
							height: 15,
							fill: "none",
							stroke: "currentColor",
							strokeWidth: 1.8,
							strokeLinecap: "round",
							strokeLinejoin: "round",
						},
						React.createElement("path", { d: "M20 12a8 8 0 1 1-2.34-5.66" }),
						React.createElement("path", { d: "M20 4v4h-4" }),
					),
				),
				onClose
					? React.createElement(
							"button",
							{
								type: "button",
								title: "Close",
								onClick: onClose,
								style: {
									border: "none",
									background: "transparent",
									color: T.textSecondary,
									cursor: "pointer",
									padding: "4px",
									borderRadius: "6px",
									display: "inline-flex",
								},
							},
							"×",
					  )
					: null,
			);

			// error banner
			const errorBanner = statusError
				? React.createElement(
						"div",
						{
							style: {
								margin: "10px 14px",
								padding: "8px 10px",
								borderRadius: "8px",
								background: "rgba(229,83,75,0.12)",
								color: T.error,
								fontSize: "12px",
								lineHeight: "18px",
							},
						},
						statusError,
				  )
				: null;

			// state filter + tabs
			const stateToggle = React.createElement(
				"div",
				{
					style: {
						display: "flex",
						gap: "6px",
						alignItems: "center",
						padding: "0 14px 0 0",
					},
				},
				["open", "closed"].map((s) =>
					React.createElement(
						"button",
						{
							key: s,
							type: "button",
							onClick: () => setStateFilter(s),
							style: {
								height: "24px",
								padding: "0 10px",
								borderRadius: "6px",
								border: `1px solid ${stateFilter === s ? T.brand : T.border}`,
								background: stateFilter === s ? T.brand : "transparent",
								color: stateFilter === s ? "#fff" : T.textSecondary,
								fontSize: "11px",
								cursor: "pointer",
							},
						},
						s === "open" ? "Open" : "Closed",
					),
				),
			);

			const tabBtn = (id, label, count) =>
				React.createElement(
					"button",
					{
						key: id,
						type: "button",
						onClick: () => setTab(id),
						style: {
							flex: "1 1 0",
							height: "32px",
							border: "none",
							borderBottom: `2px solid ${tab === id ? T.brand : "transparent"}`,
							background: "transparent",
							color: tab === id ? T.textPrimary : T.textSecondary,
							fontSize: "13px",
							fontWeight: tab === id ? 600 : 500,
							cursor: "pointer",
						},
					},
					label,
					" ",
					React.createElement(
						"span",
						{ style: { fontSize: "11px", color: T.textSecondary, fontWeight: 400 } },
						count,
					),
				);

			const tabs = React.createElement(
				"div",
				{
					style: {
						display: "flex",
						alignItems: "center",
						padding: "0 14px",
						borderBottom: `1px solid ${T.borderL2}`,
						gap: "4px",
					},
				},
				tabBtn("issues", "Issues", issues.length),
				tabBtn("pulls", "Pull requests", pulls.length),
				stateToggle,
			);

			// item list
			const items = tab === "issues" ? issues : pulls;
			const list = React.createElement(
				"div",
				{ style: { flex: "1 1 auto", overflowY: "auto", padding: "6px 0" } },
				items.length === 0
					? React.createElement(
							"div",
							{ style: { padding: "20px 16px", color: T.textSecondary, fontSize: "13px" } },
							status === "error" ? "Load failed." : "Nothing here.",
					  )
					: items.map((item) => renderItem(item, tab, busy, doAction, quoteItem)),
			);

			return React.createElement(
				"div",
				{ style: { display: "flex", flexDirection: "column", height: "100%", minHeight: 0 } },
				header,
				errorBanner,
				tabs,
				list,
			);
		}

		function renderItem(item, tab, busy, doAction, quoteItem) {
			const kind = tab === "issues" ? "issue" : "pull";
			const isOpen = item.state === "open";
			const isMerged = item.merged === true;
			const key = `${kind}:${item.number}`;

			const badge = isMerged
				? React.createElement(StateBadge, { kind: "merged" }, "Merged")
				: React.createElement(
						StateBadge,
						{ kind: isOpen ? "open" : "closed" },
						isOpen ? "Open" : "Closed",
				  );

			const actions = [];
			actions.push(
				React.createElement(
					ActionButton,
					{
						key: "quote",
						title: "Reference this in the composer",
						onClick: () => quoteItem(kind, item.number, item.title, item.html_url),
					},
					"Quote",
				),
			);

			if (kind === "issue") {
				actions.push(
					React.createElement(
						ActionButton,
						{
							key: "toggle",
							danger: isOpen,
							title: isOpen ? "Close this issue" : "Reopen this issue",
							disabled: !!busy[`issue:${item.number}:${isOpen ? "close" : "open"}`],
							onClick: () => doAction("issue", item.number, isOpen ? "close" : "open"),
						},
						isOpen ? "Close" : "Reopen",
					),
				);
			} else {
				if (isOpen) {
					actions.push(
						React.createElement(
							ActionButton,
							{
								key: "merge",
								primary: true,
								title: "Merge this pull request",
								disabled: !!busy[`pull:${item.number}:merge`],
								onClick: () => doAction("pull", item.number, "merge"),
							},
							"Merge",
						),
						React.createElement(
							ActionButton,
							{
								key: "close",
								danger: true,
								title: "Close this pull request",
								disabled: !!busy[`pull:${item.number}:close`],
								onClick: () => doAction("pull", item.number, "close"),
							},
							"Close",
						),
					);
				}
			}

			return React.createElement(
				"div",
				{
					key,
					style: {
						display: "flex",
						alignItems: "flex-start",
						gap: "10px",
						padding: "10px 14px",
						borderBottom: `1px solid ${T.borderL2}`,
					},
				},
				React.createElement(
					"div",
					{ style: { flex: "1 1 auto", minWidth: 0 } },
					React.createElement(
						"a",
						{
							href: item.html_url,
							target: "_blank",
							rel: "noreferrer noopener",
							style: {
								display: "block",
								color: T.textPrimary,
								fontSize: "13px",
								lineHeight: "18px",
								fontWeight: 600,
								textDecoration: "none",
								overflow: "hidden",
								textOverflow: "ellipsis",
								whiteSpace: "nowrap",
								marginBottom: "5px",
							},
							title: item.title,
						},
						`#${item.number} ${item.title}`,
					),
					React.createElement(
						"div",
						{
							style: {
								display: "flex",
								alignItems: "center",
								gap: "8px",
								color: T.textSecondary,
								fontSize: "11px",
							},
						},
						badge,
						item.user && item.user.login
							? React.createElement("span", null, item.user.login)
							: null,
					),
				),
				React.createElement(
					"div",
					{ style: { display: "flex", gap: "6px", flex: "none" } },
					...actions,
				),
			);
		}

		/* ------------------------------------------------------------------ */
		/* Standalone Sider: footer toggle + right-docked drawer               */
		/* ------------------------------------------------------------------ */

		function GithubFooterToggle({ ctx, wide, useSessions }) {
			return React.createElement(
				"button",
				{
					type: "button",
					title: "GitHub issues & pull requests",
					onClick: () => panelStore.toggle(),
					style: {
						display: "inline-flex",
						alignItems: "center",
						justifyContent: "center",
						gap: "8px",
						height: "32px",
						padding: wide ? "0 10px" : "0",
						width: wide ? "auto" : "32px",
						border: "1px solid transparent",
						borderRadius: "8px",
						background: "transparent",
						color: T.textSecondary,
						fontSize: "12px",
						cursor: "pointer",
					},
				},
				React.createElement(GithubIcon, { size: 16 }),
				wide ? "GitHub" : null,
			);
		}

		function GithubStandaloneSider({ ctx, useSessions }) {
			const open = usePanelOpen();
			const list = typeof useSessions === "function" ? useSessions() : undefined;
			const sessionId = list ? list.current : undefined;

			if (!open) return null;

			return React.createElement(
				"div",
				{
					style: {
						position: "fixed",
						top: 0,
						right: 0,
						bottom: 0,
						width: "min(360px, 100vw)",
						background: T.bg,
						borderLeft: `1px solid ${T.border}`,
						boxShadow: "-16px 0 48px rgba(0,0,0,0.35)",
						zIndex: 1000,
						pointerEvents: "auto",
						display: "flex",
						flexDirection: "column",
					},
				},
				React.createElement(GitHubPanel, {
					ctx,
					sessionId,
					onClose: () => panelStore.set(false),
				}),
			);
		}

		/* ------------------------------------------------------------------ */
		/* Plugin wiring                                                        */
		/* ------------------------------------------------------------------ */

		const inject = ["slots"];

		function apply(ctx) {
			const slots = ctx.get("slots");
			if (slots === undefined) return;

			// 1) better-sidebar integration (when that plugin is present). The
			//    sub-fiber activates as soon as `betterSidebar` is provided, and
			//    never blocks us when it is absent.
			ctx.inject(["betterSidebar"], (innerCtx) => {
				const bs = innerCtx.get("betterSidebar");
				if (bs === undefined || typeof bs.registerTab !== "function") return;
				innerCtx.effect(() =>
					bs.registerTab({
						id: "dsh-github:github",
						title: "GitHub",
						icon: React.createElement(GithubIcon, { size: 16 }),
						order: 55,
						single: true,
						component: (props) =>
							React.createElement(GitHubPanel, {
								ctx,
								sessionId: props && props.scope ? props.scope.sessionId : undefined,
								onClose: null,
							}),
					}),
				);
			});

			// 2) Standalone Sider fallback — only when better-sidebar is absent
			//    at activation time.
			if (ctx.get("betterSidebar") !== undefined) return;

			slots.inject(
				"sidebar.footer.action",
				() =>
					slots.register(
						{
							name: "sidebar.footer.action",
							id: "github",
							order: 0,
							registrant: "dsh-github",
						},
						(props) => React.createElement(GithubFooterToggle, { ...props, ctx }),
					),
			);

			slots.inject(
				"shell.overlay",
				() =>
					slots.register(
						{
							name: "shell.overlay",
							id: "github",
							order: 100,
							registrant: "dsh-github",
						},
						(props) => React.createElement(GithubStandaloneSider, { ...props, ctx }),
					),
			);
		}

		exports.GitHubPanel = GitHubPanel;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	},
});
