# @iris-sylvia/cli

## 0.3.0

### Minor Changes

- 5c7b95c: Add the scope/loadout layer (Mode B): an `iris.json` loadout manifest, version-pinned resolution into `iris.lock`, and bounded `find_skill` discovery.

  - `@iris-sylvia/protocol`: `LoadoutManifest` schema (skills with optional semver ranges, `policy.allowBroaden`).
  - `@iris-sylvia/core`: `resolveLoadout()` (semver-checked, builds a pinned lockfile) and scope-aware `find()` / `buildTier1Index()` with optional broaden.
  - `@iris-sylvia/mcp`: scope option; `IRIS_MANIFEST=<path>` or an `iris.json` in the library root bounds `find_skill`, the embedded Tier-1 index, resources and prompts.
  - `@iris-sylvia/cli`: `iris lock` pins the loadout into `iris.lock`; `iris search --scope`/`--manifest` runs bounded retrieval.

- fb80a14: Make on-device **semantic** embeddings the default for search accuracy.

  - New `TransformersEmbeddingProvider` (transformers.js / `@huggingface/transformers`, `Xenova/all-MiniLM-L6-v2`): real semantic matching, no API key, offline after a one-time model download (~23MB cached). Added as an optional dependency.
  - `resolveDefaultProvider()` warms the model and **falls back to the fast lexical engine** when it can't load (offline/firewalled), so Iris is accurate by default and never broken offline. Force the lexical engine with `IRIS_EMBEDDINGS=local`.
  - The CLI and MCP server now use the semantic provider by default (the MCP server logs the active engine on startup).

### Patch Changes

- Updated dependencies [5c7b95c]
- Updated dependencies [fb80a14]
  - @iris-sylvia/protocol@0.3.0
  - @iris-sylvia/core@0.3.0
  - @iris-sylvia/embeddings@0.3.0
  - @iris-sylvia/adapters@0.2.1

## 0.2.1

### Patch Changes

- 4470c91: Fix the `iris` CLI producing no output when run via `npx`/an installed bin. The
  entrypoint used an `import.meta.url === argv[1]` guard that silently no-op'd when
  invoked through npm's `.bin` symlink (argv[1] is the symlink path). The bin now
  runs unconditionally; tests import `buildProgram` from `./program.js`.

## 0.2.0

### Minor Changes

- 680fa77: Add the Iris MCP server (find/load/exec, resources, prompts, hot reload), the `iris` CLI (init/add/remove/search/sync/doctor), surface adapters (claude-code, codex, chat), and the registry-client stub.

### Patch Changes

- b83e914: Add a Cursor adapter and inject a behavioral awareness directive into every always-loaded surface.

  - New `cursor` adapter writes an `alwaysApply` rule at `.cursor/rules/iris.mdc` so Iris skills are discovered automatically in Cursor, matching the Claude Code and Codex adapters.
  - All adapters now prepend a directive instructing the agent to call `find_skill` before improvising (not just the Tier-1 inventory), making skill discovery plug-and-play instead of opt-in.

- Updated dependencies [b83e914]
- Updated dependencies [6de35c5]
- Updated dependencies [680fa77]
- Updated dependencies [55f91b1]
  - @iris-sylvia/adapters@0.2.0
  - @iris-sylvia/protocol@0.2.0
  - @iris-sylvia/core@0.2.0
