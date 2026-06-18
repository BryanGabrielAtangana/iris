# @iris-sylvia/mcp

## 0.2.0

### Minor Changes

- 680fa77: Add the Iris MCP server (find/load/exec, resources, prompts, hot reload), the `iris` CLI (init/add/remove/search/sync/doctor), surface adapters (claude-code, codex, chat), and the registry-client stub.
- 55f91b1: Rename the MCP tools to verb-first names so agents auto-select them reliably: `iris_find → find_skill`, `iris_load → load_skill`, `iris_execute_script → run_skill_script`. The "Iris" brand stays for the server, CLI, `skill://` resources and `iris:` prompts. The always-loaded directive now instructs agents to call `find_skill` by name before improvising.

### Patch Changes

- Updated dependencies [6de35c5]
- Updated dependencies [55f91b1]
  - @iris-sylvia/protocol@0.2.0
  - @iris-sylvia/core@0.2.0
