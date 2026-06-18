// SPDX-License-Identifier: Apache-2.0

/**
 * @iris-sylvia/embeddings — the pluggable embedding + vector-store layer.
 *
 * Sits between @iris-sylvia/protocol and @iris-sylvia/core. The default provider is local,
 * deterministic and offline so retrieval works with zero setup; production
 * deployments can swap in FastEmbed or a hosted provider behind the same
 * {@link EmbeddingProvider} interface.
 */
export * from "./provider.js";
export * from "./local.js";
export * from "./transformers.js";
export * from "./fastembed.js";
export * from "./store.js";
export * from "./factory.js";
