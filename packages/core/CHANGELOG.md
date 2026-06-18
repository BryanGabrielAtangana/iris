# @iris-sylvia/core

## 0.3.0

### Minor Changes

- 5c7b95c: Add the scope/loadout layer (Mode B): an `iris.json` loadout manifest, version-pinned resolution into `iris.lock`, and bounded `find_skill` discovery.

  - `@iris-sylvia/protocol`: `LoadoutManifest` schema (skills with optional semver ranges, `policy.allowBroaden`).
  - `@iris-sylvia/core`: `resolveLoadout()` (semver-checked, builds a pinned lockfile) and scope-aware `find()` / `buildTier1Index()` with optional broaden.
  - `@iris-sylvia/mcp`: scope option; `IRIS_MANIFEST=<path>` or an `iris.json` in the library root bounds `find_skill`, the embedded Tier-1 index, resources and prompts.
  - `@iris-sylvia/cli`: `iris lock` pins the loadout into `iris.lock`; `iris search --scope`/`--manifest` runs bounded retrieval.

### Patch Changes

- Updated dependencies [5c7b95c]
- Updated dependencies [fb80a14]
  - @iris-sylvia/protocol@0.3.0
  - @iris-sylvia/embeddings@0.3.0

## 0.2.0

### Minor Changes

- 6de35c5: Initial Iris scaffold: protocol schemas, local embeddings + vector store, and core scanning/indexing/retrieval.

### Patch Changes

- 55f91b1: Rename the MCP tools to verb-first names so agents auto-select them reliably: `iris_find → find_skill`, `iris_load → load_skill`, `iris_execute_script → run_skill_script`. The "Iris" brand stays for the server, CLI, `skill://` resources and `iris:` prompts. The always-loaded directive now instructs agents to call `find_skill` by name before improvising.
- Updated dependencies [6de35c5]
  - @iris-sylvia/protocol@0.2.0
  - @iris-sylvia/embeddings@0.2.0
