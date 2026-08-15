# DSH Plugins / DSH 插件仓库

A monorepo of plugins for the DSH Web GUI. Each top-level directory is a self-contained
DSH plugin with its own `package.json`, `cordis.patch.yml`, and `README.md`.

这是一个存放 DSH Web GUI 插件的仓库。每个顶层目录都是一个自包含的 DSH 插件，
拥有独立的 `package.json`、`cordis.patch.yml` 和 `README.md`。

## Plugins / 插件列表

| Plugin 插件 | Description 说明 | Link 链接 |
| --- | --- | --- |
| `dsh-quick-commands` | Cursor-style quick-command chips above the composer; clicking a chip writes the command into the input and submits it directly. 在输入框上方显示 Cursor 风格快捷命令 chips，点击即写入输入框并直接发送。 | [dsh-quick-commands](./dsh-quick-commands) |

### dsh-quick-commands

- **What it does 功能**：Adds a "Quick commands" dropdown above the composer. It only appears when
  the current session's working directory has uncommitted git changes, and offers one-click
  git workflow commands.
  在输入框上方添加「Quick commands」下拉菜单。仅当当前会话工作目录存在未提交的 git 改动时显示，
  提供一键式 git 工作流命令。
- **Built-in commands 内置命令**：
  - `create new branch & commit & push pr`
  - `create new branch & commit`
  - `commit`
- **Platform 运行平台**：Web (`dsh.client`)
- **Details 详细信息**：[dsh-quick-commands/README.md](./dsh-quick-commands/README.md)

## Installing a plugin / 安装插件

Each plugin ships its own installation instructions; see its `README.md`.
In general, install into the target profile and add it to that profile's bundle list:

每个插件都有自己的安装说明，请查看对应目录下的 `README.md`。通常需要安装进目标 profile，
并把它加入该 profile 的 bundle 列表：

```bash
# Publish first, then install / 先发布再安装
npm publish
dsh plugin --profile web add <plugin-name>

# Or add it manually to the profile's dsh.profile.bundles
# 或手动加入 profile 的 dsh.profile.bundles
```

## Adding a plugin / 添加新插件

1. Create a new top-level directory named after the package, e.g. `my-dsh-plugin/`.
   新建一个以包名命名的顶层目录，例如 `my-dsh-plugin/`。
2. Add its `package.json` (with the `dsh.bundle.patch` / `dsh.client` declarations),
   `cordis.patch.yml`, `lib/` sources, and a `README.md`.
   加入 `package.json`（含 `dsh.bundle.patch` / `dsh.client` 声明）、`cordis.patch.yml`、
   `lib/` 源码和 `README.md`。
3. Add a row to the plugin table above.
   在上方插件列表中新增一行。

## License

Each plugin is licensed independently (see its `package.json`). Unless noted otherwise, MIT.
各插件独立授权（见其 `package.json`），如无特别说明均为 MIT。
