# @iris-sylvia/adapters

## 0.2.0

### Minor Changes

- b83e914: Add a Cursor adapter and inject a behavioral awareness directive into every always-loaded surface.

  - New `cursor` adapter writes an `alwaysApply` rule at `.cursor/rules/iris.mdc` so Iris skills are discovered automatically in Cursor, matching the Claude Code and Codex adapters.
  - All adapters now prepend a directive instructing the agent to call `find_skill` before improvising (not just the Tier-1 inventory), making skill discovery plug-and-play instead of opt-in.

- 680fa77: Add the Iris MCP server (find/load/exec, resources, prompts, hot reload), the `iris` CLI (init/add/remove/search/sync/doctor), surface adapters (claude-code, codex, chat), and the registry-client stub.

### Patch Changes

- 55f91b1: Rename the MCP tools to verb-first names so agents auto-select them reliably: `iris_find → find_skill`, `iris_load → load_skill`, `iris_execute_script → run_skill_script`. The "Iris" brand stays for the server, CLI, `skill://` resources and `iris:` prompts. The always-loaded directive now instructs agents to call `find_skill` by name before improvising.
- Updated dependencies [6de35c5]
- Updated dependencies [55f91b1]
  - @iris-sylvia/protocol@0.2.0
  - @iris-sylvia/core@0.2.0
