<!-- SPDX-License-Identifier: Apache-2.0 -->

# Releasing Iris

Iris is a pnpm + Turborepo monorepo released with [Changesets](https://github.com/changesets/changesets).
Published packages:

| npm package             | bin        | notes                           |
| ----------------------- | ---------- | ------------------------------- |
| `@iris/protocol`        | —          |                                 |
| `@iris/embeddings`      | —          |                                 |
| `@iris/core`            | —          |                                 |
| `@iris/adapters`        | —          |                                 |
| `@iris/mcp`             | `iris-mcp` | the MCP server                  |
| `@iris/cli`             | `iris`     | unscoped `iris` is taken on npm |
| `@iris/registry-client` | —          | stub                            |

`evals/`, `apps/registry`, and `apps/docs` are private and never published.

## 0. Naming / scope (do this once)

The `@iris/*` names are currently free, but **you must own the `@iris`
organization on npm** to publish under that scope (npmjs.com → _Add
Organization_). If `@iris` is unavailable, pick a scope you own and
find-and-replace it across the repo:

```bash
# example: publish under @your-scope instead of @iris
grep -rl '@iris/' packages | xargs sed -i 's#@iris/#@your-scope/#g'
# also update workspace dependency names and imports accordingly
```

The unscoped `iris` package name is already taken, which is why the CLI ships as
`@iris/cli` (its binary is still `iris`). Users run it via `npx @iris/cli` or,
once installed, the `iris` command.

## 1. Prerequisites

- An npm account with access to the scope, and 2FA configured.
- A granular **automation token** stored as the `NPM_TOKEN` repo secret
  (Settings → Secrets → Actions) for CI publishing.

## 2. Add a changeset for every change

```bash
pnpm changeset
```

Pick the packages and bump types; write a human-readable summary. Commit the
generated `.changeset/*.md` with your PR.

## 3a. Release via CI (recommended)

`.github/workflows/release.yml` runs on every push to `main`:

1. If there are pending changesets, it opens/updates a **"Version Packages"**
   PR that bumps versions and writes changelogs.
2. When you merge that PR, the workflow runs `pnpm release`
   (`turbo run build && changeset publish`) and publishes to npm.

Just merge PRs with changesets; the bot does the rest.

## 3b. Release manually

```bash
npm login                 # or rely on NPM_TOKEN in the environment
pnpm changeset version    # consume changesets → bump versions + changelogs
pnpm install              # refresh the lockfile
git commit -am "chore: version packages"
pnpm release              # turbo run build && changeset publish
git push --follow-tags
```

`changeset publish` rewrites internal `workspace:*` dependencies to real
version ranges and publishes in dependency order.

## 4. Verify before publishing

```bash
pnpm -r exec npm pack --dry-run   # inspect exactly what each tarball includes
```

Each publishable tarball should contain `dist/`, `package.json`, `README.md`,
and `LICENSE` — and nothing else (sources, tests, and configs are excluded via
the `files` whitelist).
