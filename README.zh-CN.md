# DSH Plugins

一个存放 DSH Web GUI 插件的仓库。每个顶层目录都是一个自包含的 DSH 插件，
拥有独立的 `package.json`、`cordis.patch.yml` 和 `README.md`。

[English](./README.md)

## 插件列表

| 插件 | 说明 | 链接 |
| --- | --- | --- |
| `dsh-quick-commands` | 在输入框上方显示 Cursor 风格快捷命令 chips，点击即写入输入框并直接发送。 | [dsh-quick-commands](./dsh-quick-commands) |
| `dsh-github` | GitHub issues / PR 侧边面板（关闭/重开 issue、合并/关闭 PR、引用到对话框）；存在 `dsh-better-sidebar` 时接入其 tab，否则渲染独立 Sider。 | [dsh-github](./dsh-github) |

### dsh-quick-commands

- **功能**：在输入框上方添加「Quick commands」下拉菜单。仅当当前会话工作目录存在未提交的
  git 改动时显示，提供一键式 git 工作流命令。
- **内置命令**：
  - `create new branch & commit & push pr`
  - `create new branch & commit`
  - `commit`
- **运行平台**：Web（`dsh.client`）
- **详细信息**：[dsh-quick-commands/README.md](./dsh-quick-commands/README.md)

### dsh-github

- **功能**：为当前工作区 git `origin` 指向的仓库提供 GitHub 侧边面板。列出 issues 与
  PR，支持关闭/重开 issue、合并/关闭 PR、把条目引用到输入框。
- **面板位置**：已安装 `dsh-better-sidebar` 时注册为其 tab；否则渲染独立 Sider
  （侧边栏底部按钮 + 右侧抽屉）。
- **运行平台**：Web（`dsh.client`）；host 半代理 GitHub REST API。
- **详细信息**：[dsh-github/README.md](./dsh-github/README.md)

## 安装插件

每个插件都有自己的安装说明，请查看对应目录下的 `README.md`。通常需要安装进目标 profile，
并把它加入该 profile 的 bundle 列表：

```bash
# 先发布再安装
npm publish
dsh plugin --profile web add <plugin-name>

# 或手动加入 profile 的 dsh.profile.bundles
```

## 添加新插件

1. 新建一个以包名命名的顶层目录，例如 `my-dsh-plugin/`。
2. 加入 `package.json`（含 `dsh.bundle.patch` / `dsh.client` 声明）、`cordis.patch.yml`、
   `lib/` 源码和 `README.md`。
3. 在上方插件列表中新增一行。

## License

各插件独立授权（见其 `package.json`），如无特别说明均为 MIT。
