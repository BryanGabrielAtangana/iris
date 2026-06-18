# @iris-sylvia/core

## 0.2.0

### Minor Changes

- 6de35c5: Initial Iris scaffold: protocol schemas, local embeddings + vector store, and core scanning/indexing/retrieval.

### Patch Changes

- 55f91b1: Rename the MCP tools to verb-first names so agents auto-select them reliably: `iris_find → find_skill`, `iris_load → load_skill`, `iris_execute_script → run_skill_script`. The "Iris" brand stays for the server, CLI, `skill://` resources and `iris:` prompts. The always-loaded directive now instructs agents to call `find_skill` by name before improvising.
- Updated dependencies [6de35c5]
  - @iris-sylvia/protocol@0.2.0
  - @iris-sylvia/embeddings@0.2.0
