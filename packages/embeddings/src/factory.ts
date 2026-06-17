// SPDX-License-Identifier: Apache-2.0
import type { EmbeddingProvider } from "./provider.js";
import { LocalHashingProvider } from "./local.js";
import { FastEmbedProvider } from "./fastembed.js";
import { MemoryVectorStore, type VectorStore } from "./store.js";

export type ProviderKind = "local" | "fastembed";

export interface CreateProviderOptions {
  kind?: ProviderKind;
  dimensions?: number;
  /** fastembed model name when kind === "fastembed". */
  model?: string;
}

/**
 * Create the default embedding provider. The default is fully local and
 * offline (no API key, no data leaves the machine).
 */
export function createEmbeddingProvider(opts: CreateProviderOptions = {}): EmbeddingProvider {
  switch (opts.kind ?? "local") {
    case "fastembed":
      return new FastEmbedProvider({ model: opts.model, dimensions: opts.dimensions });
    case "local":
    default:
      return new LocalHashingProvider(opts.dimensions);
  }
}

export interface CreateStoreOptions {
  dimensions: number;
  path?: string;
}

export function createVectorStore(opts: CreateStoreOptions): VectorStore {
  return new MemoryVectorStore(opts);
}
