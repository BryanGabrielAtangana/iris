# @iris-sylvia/protocol

## 0.3.0

### Minor Changes

- 5c7b95c: Add the scope/loadout layer (Mode B): an `iris.json` loadout manifest, version-pinned resolution into `iris.lock`, and bounded `find_skill` discovery.

  - `@iris-sylvia/protocol`: `LoadoutManifest` schema (skills with optional semver ranges, `policy.allowBroaden`).
  - `@iris-sylvia/core`: `resolveLoadout()` (semver-checked, builds a pinned lockfile) and scope-aware `find()` / `buildTier1Index()` with optional broaden.
  - `@iris-sylvia/mcp`: scope option; `IRIS_MANIFEST=<path>` or an `iris.json` in the library root bounds `find_skill`, the embedded Tier-1 index, resources and prompts.
  - `@iris-sylvia/cli`: `iris lock` pins the loadout into `iris.lock`; `iris search --scope`/`--manifest` runs bounded retrieval.

## 0.2.0

### Minor Changes

- 6de35c5: Initial Iris scaffold: protocol schemas, local embeddings + vector store, and core scanning/indexing/retrieval.
