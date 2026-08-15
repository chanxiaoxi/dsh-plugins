window.__ModuleLoader__.load({
	id: "dsh-quick-commands",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let React = require("react");

		/**
		 * Cursor-style quick-command dropdown shown above the composer.
		 * A single trigger button expands a menu of high-frequency git
		 * workflow commands; picking one writes it to the draft and submits.
		 */

		/** Ordered quick-command roster: label shown in the menu === the text sent. */
		const COMMANDS = [
			{ id: "branch-commit-pr", label: "create new branch & commit & push pr" },
			{ id: "branch-commit", label: "create new branch & commit" },
			{ id: "commit", label: "commit" },
		];

		/**
		 * Dock alignment: same width as the Goal / Todo dock rows — slightly
		 * narrower than the composer card — centered, so this row shares their
		 * hierarchy. The capsule inside sits left-aligned within this row.
		 */
		const DOCK_STYLE = {
			boxSizing: "border-box",
			width:
				"calc(100% - var(--dsh-composer-side-clearance, 16px) - var(--dsh-composer-side-clearance, 16px) - var(--dsh-composer-dock-inset, 8px) - var(--dsh-composer-dock-inset, 8px))",
			maxWidth:
				"calc(var(--dsh-composer-card-max-width, 780px) - var(--dsh-composer-dock-inset, 8px) - var(--dsh-composer-dock-inset, 8px))",
			margin: "0 auto",
			padding: "0 var(--dsh-composer-dock-inset, 8px)",
			flex: "none",
			position: "relative",
		};

		/** Compact capsule (content width, left-aligned inside the dock row). */
		const PANEL_STYLE = {
			boxSizing: "border-box",
			display: "inline-flex",
			flexDirection: "column",
			border: "1px solid var(--dsw-alias-border-l1, rgba(140,142,152,0.28))",
			background: "var(--dsw-specific-tip, #17171c)",
			borderRadius: "999px",
			overflow: "hidden",
			margin: "0 0 4px",
			width: "max-content",
			maxWidth: "100%",
		};

		const TRIGGER_STYLE = {
			boxSizing: "border-box",
			display: "flex",
			alignItems: "center",
			gap: "8px",
			width: "100%",
			height: "32px",
			padding: "0 12px",
			border: "none",
			background: "transparent",
			color: "var(--dsw-alias-label-secondary, #8c8e98)",
			fontSize: "12px",
			lineHeight: "20px",
			fontWeight: 500,
			cursor: "pointer",
			textAlign: "left",
			userSelect: "none",
		};

		const TRIGGER_LABEL_STYLE = {
			flex: "1 1 auto",
			minWidth: 0,
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap",
		};

		const CHEVRON_STYLE = {
			flex: "none",
			display: "inline-flex",
			width: "12px",
			height: "12px",
			transition: "transform 120ms ease",
			transform: "rotate(0deg)",
		};

		const CHEVRON_OPEN_STYLE = {
			...CHEVRON_STYLE,
			transform: "rotate(180deg)",
		};

		const MENU_STYLE = {
			boxSizing: "border-box",
			listStyle: "none",
			margin: 0,
			padding: "2px 0",
			maxHeight: "200px",
			overflowY: "auto",
		};

		const ITEM_STYLE = {
			boxSizing: "border-box",
			display: "block",
			width: "100%",
			height: "34px",
			padding: "0 12px",
			border: "none",
			background: "transparent",
			color: "var(--dsw-alias-label-primary, #e8e8f0)",
			fontSize: "13px",
			lineHeight: "20px",
			textAlign: "left",
			cursor: "pointer",
			whiteSpace: "nowrap",
			overflow: "hidden",
			textOverflow: "ellipsis",
		};

		const ITEM_HOVER_STYLE = {
			background: "var(--dsw-alias-interactive-bg-hover, rgba(140,142,152,0.12))",
		};

		/** Chevron glyph (pure inline SVG, mirrors the composer's select arrow). */
		function Chevron({ open }) {
			return React.createElement(
				"svg",
				{
					viewBox: "0 0 12 12",
					width: "12",
					height: "12",
					fill: "none",
					"aria-hidden": true,
					style: open ? CHEVRON_OPEN_STYLE : CHEVRON_STYLE,
				},
				React.createElement("path", {
					d: "M3 4.5L6 7.5L9 4.5",
					stroke: "currentColor",
					strokeWidth: "1.5",
					strokeLinecap: "round",
					strokeLinejoin: "round",
				}),
			);
		}

		/** Poll interval for the git status probe (ms). */
		const POLL_INTERVAL_MS = 3000;

		/**
		 * Dock entry component. The framework supplies the conversation
		 * standard kit (`inputActions`, `sessionId`) because this is a
		 * session-scope slot declared by ui-conversation.
		 *
		 * Renders nothing unless the session's working directory has
		 * uncommitted git changes (`dirty === true`), so the dropdown only
		 * appears when there is code to commit.
		 */
		function QuickCommands({ inputActions, sessionId }) {
			const [open, setOpen] = React.useState(false);
			const [hovered, setHovered] = React.useState(null);
			const [dirty, setDirty] = React.useState(false);
			const rootRef = React.useRef(null);

			// Poll the git status route while this session is mounted.
			React.useEffect(() => {
				if (sessionId === undefined) {
					setDirty(false);
					return;
				}
				let disposed = false;
				const probe = async () => {
					try {
						const res = await fetch(
							`/quickcommands/status?sessionId=${encodeURIComponent(sessionId)}`,
						);
						if (!res.ok) {
							if (!disposed) setDirty(false);
							return;
						}
						const data = await res.json();
						if (!disposed) setDirty(data.dirty === true);
					} catch {
						if (!disposed) setDirty(false);
					}
				};
				probe();
				const timer = setInterval(probe, POLL_INTERVAL_MS);
				return () => {
					disposed = true;
					clearInterval(timer);
				};
			}, [sessionId]);

			// Close on outside click.
			React.useEffect(() => {
				if (!open) return;
				const onDocClick = (event) => {
					if (rootRef.current && !rootRef.current.contains(event.target)) {
						setOpen(false);
					}
				};
				document.addEventListener("mousedown", onDocClick);
				return () => document.removeEventListener("mousedown", onDocClick);
			}, [open]);

			const pick = (label) => {
				setOpen(false);
				if (inputActions === void 0) return;
				inputActions.setDraft(label);
				inputActions.submit();
			};

			const panelStyle = open
				? { ...PANEL_STYLE, borderRadius: "12px" }
				: PANEL_STYLE;

			const trigger = React.createElement(
				"div",
				{ style: panelStyle },
				React.createElement(
					"button",
					{
						type: "button",
						"aria-haspopup": "menu",
						"aria-expanded": open ? "true" : "false",
						style: TRIGGER_STYLE,
						onClick: () => setOpen((cur) => !cur),
					},
					React.createElement("span", { style: TRIGGER_LABEL_STYLE }, "Quick commands"),
					React.createElement(Chevron, { open }),
				),
				open
					? React.createElement(
							"ul",
							{ role: "menu", style: MENU_STYLE },
							COMMANDS.map((cmd) =>
								React.createElement(
									"li",
									{ key: cmd.id, role: "none" },
									React.createElement(
										"button",
										{
											type: "button",
											role: "menuitem",
											title: cmd.label,
											style:
												hovered === cmd.id
													? { ...ITEM_STYLE, ...ITEM_HOVER_STYLE }
													: ITEM_STYLE,
											onMouseEnter: () => setHovered(cmd.id),
											onMouseLeave: () =>
												setHovered((cur) => (cur === cmd.id ? null : cur)),
											onClick: () => pick(cmd.label),
										},
										cmd.label,
									),
								),
							),
					  )
					: null,
			);

			// Hidden unless there are uncommitted changes to commit.
			if (!dirty) return null;

			return React.createElement("div", { ref: rootRef, style: DOCK_STYLE }, trigger);
		}

		/** Required services: the slot registry. */
		const inject = ["slots"];

		/**
		 * Client plugin body: register the quick-command dropdown into the
		 * `conversation.input.dock` list slot (a full-width row above the
		 * composer card). `slots.inject` waits for the declaration.
		 */
		function apply(ctx) {
			ctx.slots.inject(
				"conversation.input.dock",
				() =>
					ctx.slots.register(
						{
							name: "conversation.input.dock",
							id: "quick-commands",
							order: 0,
							registrant: "dsh-quick-commands",
						},
						QuickCommands,
					),
			);
		}

		exports.QuickCommands = QuickCommands;
		exports.COMMANDS = COMMANDS;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	},
});
