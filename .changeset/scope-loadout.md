---
"@iris-sylvia/protocol": minor
"@iris-sylvia/core": minor
"@iris-sylvia/mcp": minor
"@iris-sylvia/cli": minor
---

Add the scope/loadout layer (Mode B): an `iris.json` loadout manifest, version-pinned resolution into `iris.lock`, and bounded `find_skill` discovery.

- `@iris-sylvia/protocol`: `LoadoutManifest` schema (skills with optional semver ranges, `policy.allowBroaden`).
- `@iris-sylvia/core`: `resolveLoadout()` (semver-checked, builds a pinned lockfile) and scope-aware `find()` / `buildTier1Index()` with optional broaden.
- `@iris-sylvia/mcp`: scope option; `IRIS_MANIFEST=<path>` or an `iris.json` in the library root bounds `find_skill`, the embedded Tier-1 index, resources and prompts.
- `@iris-sylvia/cli`: `iris lock` pins the loadout into `iris.lock`; `iris search --scope`/`--manifest` runs bounded retrieval.
