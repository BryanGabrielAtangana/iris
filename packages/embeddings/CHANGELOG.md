# @iris-sylvia/embeddings

## 0.3.0

### Minor Changes

- fb80a14: Make on-device **semantic** embeddings the default for search accuracy.

  - New `TransformersEmbeddingProvider` (transformers.js / `@huggingface/transformers`, `Xenova/all-MiniLM-L6-v2`): real semantic matching, no API key, offline after a one-time model download (~23MB cached). Added as an optional dependency.
  - `resolveDefaultProvider()` warms the model and **falls back to the fast lexical engine** when it can't load (offline/firewalled), so Iris is accurate by default and never broken offline. Force the lexical engine with `IRIS_EMBEDDINGS=local`.
  - The CLI and MCP server now use the semantic provider by default (the MCP server logs the active engine on startup).

## 0.2.0

### Minor Changes

- 6de35c5: Initial Iris scaffold: protocol schemas, local embeddings + vector store, and core scanning/indexing/retrieval.
