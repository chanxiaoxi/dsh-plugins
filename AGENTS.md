# AGENTS.md

Guidance for AI coding agents working in this repository.

## Repository layout

A collection of DSH Web GUI plugins. Each top-level directory is a
self-contained plugin with its own `package.json`, `cordis.patch.yml`, and
`README.md`. See `README.md` / `README.zh-CN.md`.

## Branch policy — ALWAYS follow

- **Never commit directly to `main` (or `master`).**
- Every change must go through a pull request:

  1. `git checkout -b <branch-name>` (short, descriptive kebab-case)
  2. commit on that branch
  3. `git push -u origin <branch-name>`
  4. open a PR: `gh pr create --title "..." --body "..."`

- `main` only receives changes through merged PRs. Do not bypass this rule.

This rule is enforced locally by a `pre-commit` hook (see below).

## Git hooks

Enable the repo's hooks once (they live in `.githooks/`):

```sh
git config core.hooksPath .githooks
```

- `pre-commit` refuses to commit while on `main`/`master`, forcing the PR
  workflow above.
