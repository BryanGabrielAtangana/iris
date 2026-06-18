---
"@iris/mcp": minor
"@iris/core": patch
"@iris/adapters": patch
---

Rename the MCP tools to verb-first names so agents auto-select them reliably: `iris_find → find_skill`, `iris_load → load_skill`, `iris_execute_script → run_skill_script`. The "Iris" brand stays for the server, CLI, `skill://` resources and `iris:` prompts. The always-loaded directive now instructs agents to call `find_skill` by name before improvising.
