# dsh-github

DSH Web GUI 客户端插件：为**当前工作区关联的 GitHub 仓库**提供一个 issues / pull requests 侧边面板。

- 浏览仓库的 **Issues** 与 **Pull Requests**（默认 open，可切 closed）。
- 操作 Issue：**关闭 / 重新打开 / 引用到对话框**。
- 操作 PR：**合并 / 关闭**。
- 「引用到对话框」会把 `#number 标题` 加 GitHub 链接写入当前会话输入框（不自动发送）。

> 源码托管于 [chanxiaoxi/dsh-plugins](https://github.com/chanxiaoxi/dsh-plugins) 插件仓库，本插件位于仓库的 `dsh-github/` 目录。

## 面板位置（Sider 策略）

面板按以下规则选择挂载点：

1. **已安装 `dsh-better-sidebar`**：通过其服务化 API `ctx.betterSidebar.registerTab(...)`
   注册成一个右侧栏 tab（`dsh-github:github`），出现在 better-sidebar 的 `+` 菜单里。
2. **未安装 better-sidebar**：退化为「独立 Sider」——侧边栏底部的 GitHub 按钮
   （`sidebar.footer.action`）＋ 一个停靠在右侧的抽屉（`shell.overlay`）。

无论哪种挂载方式，面板主体（`GitHubPanel`）完全相同。

## 仓库识别与鉴权

- **仓库识别**（host 侧）：读取当前会话工作目录的 `git remote get-url origin`
  （回退 `git config remote.origin.url`），解析出 `owner/repo`。仅支持 github.com
  （含 `git@` / `ssh://` 形式）；非 GitHub 远程会提示「未找到仓库」。
- **鉴权顺序**：
  1. 已安装且**已登录**的 `gh` CLI（`gh auth login` 后即可直接用）；
  2. 环境变量 `GITHUB_TOKEN`（或 `GH_TOKEN`）→ Bearer 请求（没有可用的 `gh` 时）；
  3. 匿名（仅公开仓库的只读浏览；写操作会明确报错）。
- 面板头部会显示当前鉴权通道：`token` / `gh` / `read-only`（匿名）。

所有 GitHub 调用都经 host 侧 `/github/*` 路由代理，浏览器不直接访问 api.github.com。

## 工作原理

- host 侧（`lib/index.js`）：注册 `/github/repo`、`/github/issues`、`/github/pulls`
  （GET）与 `/github/issue`、`/github/pull`（POST）路由；内部用 `gh api` 或
  `fetch` 调用 GitHub REST API。
- 浏览器侧（`lib/client.js`）：
  - `ctx.inject(['betterSidebar'], ...)` 在 better-sidebar 存在时注册 tab（不阻塞、不报错）；
  - `ctx.get('betterSidebar')` 为 `undefined` 时，注册独立 Sider
    （`sidebar.footer.action` 按钮 + `shell.overlay` 抽屉）；
  - 「引用到对话框」通过 `ctx.sessions.scope(sessionId)` → `ctx.conversation.input.for(actx).setDraft(...)` 写入输入框。

## 目录结构

```
dsh-github/
├── package.json          # dsh.client + dsh.bundle.patch 声明
├── cordis.patch.yml      # 注册 dsh.client row（patch 层）
├── lib/
│   ├── index.js          # host 侧：GitHub API 代理路由
│   └── client.js         # 浏览器侧：面板 UI + Sider 挂载
└── README.md
```

`lib/client.js` 是手写的模块加载器产物（`window.__ModuleLoader__.load({ id, factory })`），
不依赖构建工具；`id` 必须等于包名 `dsh-github`。

## 安装

### 方式 A：从 GitHub 克隆安装（推荐）

```bash
git clone https://github.com/chanxiaoxi/dsh-plugins.git
cd "$DSH_HOME/profiles/web"
pnpm add file:/path/to/dsh-plugins/dsh-github
```

然后在 profile 的 `package.json` 里把 `dsh-github` 加入 `dsh.profile.bundles`：

```json
{
  "dsh": {
    "profile": {
      "bundles": [
        "@deepseek-ai/dsh-base",
        "@deepseek-ai/dsh-web-app",
        "dsh-better-sidebar",
        "dsh-github"
      ]
    }
  }
}
```

### 方式 B：发布到 npm 后安装

```bash
npm publish
dsh plugin --profile web add dsh-github
```

### 方式 C：手动部署（完全离线）

1. 把本目录复制到 profile 的 node_modules：
   ```bash
   cp -r dsh-github "$DSH_HOME/profiles/web/node_modules/"
   ```
2. `package.json` 加 `dsh-github` 到 `dsh.profile.bundles`（同方式 A）。
3. 或在 profile 的 `cordis.patch.yml` 手动 insert（避免与 bundle 通道重复挂载）：
   ```yaml
   - insert:
       - id: github
         name: 'dsh-github'
   ```

## 生效

重启 web profile（`dsh web`）并**硬刷新浏览器**。随后：

- 若装了 better-sidebar：在右侧栏 `+` 菜单打开「GitHub」tab；
- 否则：点侧边栏底部的 GitHub 按钮，右侧弹出独立面板。

## 鉴权提示

- **首选**：本地 `gh auth login` 后即可直接使用（`gh auth status` 会被用来探测登录态）。
- 没有 `gh`（或未登录）时：设置 `GITHUB_TOKEN`：`export GITHUB_TOKEN=ghp_...`
  （host 侧进程需能读到）。
- 无鉴权时只能浏览公开仓库的 open/closed 列表，无法执行写操作。

## 依赖说明

- host 侧：`@deepseek-ai/cordis`（peer）。
- 浏览器侧：`react` / `react/jsx-runtime`（由 `dsh-client-web` 静态模块表提供）；
  `slots` 服务由 `@deepseek-ai/dsh-client-ui-slots` 提供，经
  `@deepseek-ai/dsh-client-ui-conversation` 传递。
- 可选：`dsh-better-sidebar`（peer，optional）——存在时接入其右侧栏 tab。

## License

MIT
