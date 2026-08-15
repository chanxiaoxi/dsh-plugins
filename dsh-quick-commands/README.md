# dsh-quick-commands

DSH Web GUI 客户端插件：在聊天**输入框上方**加一排 Cursor 风格的快捷命令 chips。点击某个 chip 会把对应命令写入输入框并**直接发送**。

首批命令（英文原文，来自会话历史里的最高频 git 工作流指令）：

- `create new branch & commit & push pr`
- `create new branch & commit`
- `commit`

## 工作原理

- 挂载点：`conversation.input.dock` slot —— DSH 官方定义的「composer card 上方一整行」的 list slot。
- 点击行为：`inputActions.setDraft(cmd)` 写入草稿，然后 `inputActions.submit()` 直接提交。
- 插件只在浏览器侧运行（`dsh.client`），host 侧 `apply` 为空。

## 目录结构

```
dsh-quick-commands/
├── package.json          # dsh.client + dsh.bundle.patch 声明
├── cordis.patch.yml      # 注册 dsh.client row（patch 层）
├── lib/
│   ├── index.js          # host 侧空 apply（纯 ESM）
│   └── client.js         # 浏览器插件（window.__ModuleLoader__ 注册）
└── README.md
```

`lib/client.js` 是手写的模块加载器产物（`window.__ModuleLoader__.load({ id, factory })`），
不依赖构建工具即可被 DSH 加载；`id` 必须等于包名 `dsh-quick-commands`。

## 安装

本插件需要安装进你想用的 profile，并加入该 profile 的 bundle 列表。

### 方式 A：发布到 npm 后安装

```bash
# 1. 发布（在可写环境）
npm publish

# 2. 安装进 web profile
dsh plugin --profile web add dsh-quick-commands
```

`dsh plugin add` 会识别 `dsh.bundle.patch`，并把 `dsh-quick-commands` 追加到
`dsh.profile.bundles`，然后 profile 启动时自动合并 `cordis.patch.yml`。

### 方式 B：本地 file 依赖（不发布）

在**可写的 profile 目录**（`$DSH_HOME/profiles/web/`）里执行：

```bash
cd "$DSH_HOME/profiles/web"
pnpm add file:/path/to/dsh-quick-commands
```

然后手动把 `dsh-quick-commands` 加进 `package.json` 的
`dsh.profile.bundles` 数组：

```json
{
  "dsh": {
    "profile": {
      "bundles": [
        "@deepseek-ai/dsh-base",
        "@deepseek-ai/dsh-web-app",
        "dsh-better-sidebar",
        "dsh-quick-commands"
      ]
    }
  }
}
```

### 方式 C：手动部署（完全离线）

1. 把本目录复制到 profile 的 node_modules：
   ```bash
   cp -r dsh-quick-commands "$DSH_HOME/profiles/web/node_modules/"
   ```
2. `package.json` 加 `dsh-quick-commands` 到 `dsh.profile.bundles`（同上）。
3. 若 profile 用了 `dsh-better-sidebar` 那种独立 `cordis.patch.yml` 挂载，也可在其
   profile 的 `cordis.patch.yml` 手动 insert：
   ```yaml
   - insert:
       - id: quick-commands
         name: 'dsh-quick-commands'
   ```
   注意避免与 bundle 通道重复挂载（否则会重复起 host 半份）。

## 生效

重启 web profile：

```bash
dsh web   # 即 --profile web
```

浏览器刷新后，输入框上方会出现三个 chips。

## 自定义命令

编辑 `lib/client.js` 顶部的 `COMMANDS` 数组即可增删（`id` 唯一，`label` 即发送文本）：

```js
const COMMANDS = [
  { id: "branch-commit-pr", label: "create new branch & commit & push pr" },
  { id: "branch-commit",   label: "create new branch & commit" },
  { id: "commit",          label: "commit" },
];
```

## 依赖说明

- host 侧：`@deepseek-ai/cordis`（peer）。
- 浏览器侧：`react` / `react/jsx-runtime`（由 `dsh-client-web` 的静态模块表提供，
  无需自行打包）；`slots` 服务由 `@deepseek-ai/dsh-client-ui-slots` 提供，
  经 `@deepseek-ai/dsh-client-ui-conversation` 传递。

## License

MIT
