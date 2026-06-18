<!-- SPDX-License-Identifier: Apache-2.0 -->

# Iris

**An open protocol + reference implementation that lets any agent reliably
discover and invoke the right skill at the right time, from a portable
personal/team skill library.**

> Iris knows every capability you own and hands the right one to whatever agent
> you're working with, exactly when it's needed.

Iris is part of the Sylvia portfolio. Everything in this repository is open
source under **Apache-2.0**.

---

## Why Iris

Agents today load every skill's `name + ~200-char description` into context and
pick by raw model judgment over that flat list. It scales badly and fires
inconsistently. Iris fixes this with **two-tier discovery**:

| Tier  | Name          | What it is                                                                                                                                                                   |
| ----- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1** | **Awareness** | A tiny (~1k token) always-present mini-index — one line per skill (`name — when_to_use`). Injected into a surface the agent already loads, so it _knows the library exists_. |
| **2** | **Retrieval** | Semantic search over rich skill metadata, returning ranked candidates with relevance scores.                                                                                 |
| **3** | **Load**      | The full `SKILL.md` body on demand; references/scripts only when needed. Progressive disclosure done right.                                                                  |

Iris is delivered primarily as an **MCP server** (so it works across Claude
Code, Codex, Cursor, Gemini CLI, … without modifying those agents), plus a
**CLI** and **surface adapters**. Skills are Anthropic-format folders.

## Architecture

```
                ┌──────────────────────────────────────────────┐
   any agent ──▶│  @iris/mcp   (MCP server: find / load / exec) │
  (Claude Code, │     tools · resources · prompts · notify      │
   Codex, …)    └───────────────────────┬──────────────────────┘
                                         │
   you ────────▶  iris (CLI)             │   @iris/adapters
                  init/add/search/sync   │   claude-code · codex · cursor · chat
                  /doctor                 \  (write skills + Tier-1 index)
                                          │
                                ┌─────────▼─────────┐
                                │     @iris/core     │  scan · parse · Tier-1
                                │  index · retrieve  │  index · rank · lock · watch
                                └────┬──────────┬────┘
                                     │          │
                        ┌────────────▼───┐  ┌───▼──────────────┐
                        │ @iris/protocol │  │ @iris/embeddings │
                        │  zod schemas   │  │ local provider + │
                        │  JSON Schema   │  │  vector store    │
                        └────────────────┘  └──────────────────┘
```

**Dependency rule:** imports only ever point _down_ the chain
`protocol → embeddings → core → { mcp · cli · adapters · registry-client }`.
`protocol` has zero internal dependencies. Nothing imports upward, and there is
no cloud code anywhere in this repo.

> Note: the original design sketch listed `embeddings` as a sibling of the leaf
> packages, but `core`'s Tier-2 retrieval depends on it, so `embeddings` sits
> between `protocol` and `core`. It carries no internal dependencies of its own.

## Packages

| Package                                             | Status | Description                                                                                                                                                      |
| --------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`@iris/protocol`](packages/protocol)               | MVP    | Zod schemas + generated JSON Schema. Zero runtime deps.                                                                                                          |
| [`@iris/embeddings`](packages/embeddings)           | MVP    | Pluggable embedding provider (offline local default) + embedded vector store.                                                                                    |
| [`@iris/core`](packages/core)                       | MVP    | Scan, parse, Tier-1 index, Tier-2 retrieval/ranking, `iris.lock`, watcher.                                                                                       |
| [`@iris/mcp`](packages/mcp-server)                  | MVP    | MCP gateway: `find_skill` / `load_skill` / `run_skill_script`, resources, prompts.                                                                               |
| [`iris`](packages/cli)                              | MVP    | CLI: `init`, `add`, `remove`, `search`, `sync`, `doctor`.                                                                                                        |
| [`@iris/adapters`](packages/adapters)               | MVP    | Per-surface write logic: `claude-code`, `codex`, `cursor`, `chat`. Injects an always-loaded awareness directive + the Tier-1 index so skills fire automatically. |
| [`@iris/registry-client`](packages/registry-client) | stub   | `@namespace/skill` resolution, fetch/publish (deferred).                                                                                                         |
| [`evals/`](evals)                                   | MVP    | Discovery-accuracy benchmark vs a naive baseline.                                                                                                                |

## Quickstart

Requires **Node 20+** and **pnpm** (via corepack).

```bash
corepack enable
pnpm install
pnpm build
```

Use the bundled starter skills as your library and search them:

```bash
export IRIS_LIBRARY="$PWD/skills"
node packages/cli/dist/index.js search "write a commit message for my staged changes"
```

```
Top 5 skills for: "write a commit message for my staged changes"

   81%  git-commit-message  (git-commit-message)
        Use when writing or improving a git commit message for staged changes.
   ...
```

Sync skills + the Tier-1 awareness index into a project for Claude Code:

```bash
node packages/cli/dist/index.js sync --target /path/to/your/project
# → /path/to/your/project/.claude/skills/<id>/…
# → Tier-1 index injected into /path/to/your/project/CLAUDE.md (managed block)
```

Run the Iris MCP server (stdio) against your library:

```bash
IRIS_LIBRARY="$PWD/skills" node packages/mcp-server/dist/cli.js
```

Add it to an MCP client (e.g. Claude Code) as a server named `iris`:

```json
{
  "mcpServers": {
    "iris": {
      "command": "node",
      "args": ["/abs/path/to/iris/packages/mcp-server/dist/cli.js"],
      "env": { "IRIS_LIBRARY": "/abs/path/to/your/skills" }
    }
  }
}
```

A full clone-to-firing walkthrough is in
[`examples/quickstart`](examples/quickstart).

## Does it actually work better? (evals)

The `evals/` harness compares Iris's two-tier retrieval against the naive
baseline (flat `name + description` matching) over a labeled query→skill set:

```bash
pnpm --filter @iris/evals bench
```

```
Iris discovery benchmark — 30 labeled queries
Library: …/iris/skills

Baseline    acc@1  73.3%   acc@3  86.7%   MRR 0.808
Iris        acc@1 100.0%   acc@3 100.0%   MRR 1.000

Iris beats the naive baseline by 26.7 points on acc@1.
```

## Development

```bash
pnpm build       # build all packages (turbo)
pnpm test        # vitest across the monorepo
pnpm typecheck   # tsc --noEmit per package
pnpm lint        # eslint
pnpm format      # prettier --write
```

CI runs lint + typecheck + build + test on Node 20 and 22.

## Open-core boundary

Everything here is open source. Cloud features — hosted sync, private
registries, billing, security scanning at scale — are explicitly **out of
scope** and live in a separate private repository.

## License

[Apache-2.0](LICENSE) © The Iris Authors.
