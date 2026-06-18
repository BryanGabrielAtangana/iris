# @iris-sylvia/mcp

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

## 0.2.0

### Minor Changes

- 680fa77: Add the Iris MCP server (find/load/exec, resources, prompts, hot reload), the `iris` CLI (init/add/remove/search/sync/doctor), surface adapters (claude-code, codex, chat), and the registry-client stub.
- 55f91b1: Rename the MCP tools to verb-first names so agents auto-select them reliably: `iris_find → find_skill`, `iris_load → load_skill`, `iris_execute_script → run_skill_script`. The "Iris" brand stays for the server, CLI, `skill://` resources and `iris:` prompts. The always-loaded directive now instructs agents to call `find_skill` by name before improvising.

### Patch Changes

- Updated dependencies [6de35c5]
- Updated dependencies [55f91b1]
  - @iris-sylvia/protocol@0.2.0
  - @iris-sylvia/core@0.2.0
