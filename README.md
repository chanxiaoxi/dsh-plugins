# DSH Plugins

A collection of plugins for the DSH Web GUI. Each top-level directory is a self-contained
DSH plugin with its own `package.json`, `cordis.patch.yml`, and `README.md`.

[中文文档](./README.zh-CN.md)

## Plugins

| Plugin | Description | Link |
| --- | --- | --- |
| `dsh-quick-commands` | Cursor-style quick-command chips above the composer; clicking a chip writes the command into the input and submits it directly. | [dsh-quick-commands](./dsh-quick-commands) |

### dsh-quick-commands

- **What it does**: Adds a "Quick commands" dropdown above the composer. It only appears when
  the current session's working directory has uncommitted git changes, and offers one-click
  git workflow commands.
- **Built-in commands**:
  - `create new branch & commit & push pr`
  - `create new branch & commit`
  - `commit`
- **Platform**: Web (`dsh.client`)
- **Details**: [dsh-quick-commands/README.md](./dsh-quick-commands/README.md)

## Installing a plugin

Each plugin ships its own installation instructions; see its `README.md`.
In general, install into the target profile and add it to that profile's bundle list:

```bash
# Publish first, then install
npm publish
dsh plugin --profile web add <plugin-name>

# Or add it manually to the profile's dsh.profile.bundles
```

## Adding a plugin

1. Create a new top-level directory named after the package, e.g. `my-dsh-plugin/`.
2. Add its `package.json` (with the `dsh.bundle.patch` / `dsh.client` declarations),
   `cordis.patch.yml`, `lib/` sources, and a `README.md`.
3. Add a row to the plugin table above.

## License

Each plugin is licensed independently (see its `package.json`). Unless noted otherwise, MIT.
