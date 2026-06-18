// SPDX-License-Identifier: Apache-2.0
import type { EmbeddingProvider } from "./provider.js";
import { LocalHashingProvider } from "./local.js";
import { FastEmbedProvider } from "./fastembed.js";
import { TransformersEmbeddingProvider } from "./transformers.js";
import { MemoryVectorStore, type VectorStore } from "./store.js";

export type ProviderKind = "local" | "transformers" | "fastembed";

export interface CreateProviderOptions {
  kind?: ProviderKind;
  dimensions?: number;
  /** Model name for the transformers/fastembed providers. */
  model?: string;
}

/**
 * Create an embedding provider synchronously. The default is the zero-dependency
 * local lexical provider — use {@link resolveDefaultProvider} to get the
 * semantic default (which must load a model asynchronously).
 */
export function createEmbeddingProvider(opts: CreateProviderOptions = {}): EmbeddingProvider {
  switch (opts.kind ?? "local") {
    case "transformers":
      return new TransformersEmbeddingProvider({ model: opts.model, dimensions: opts.dimensions });
    case "fastembed":
      return new FastEmbedProvider({ model: opts.model, dimensions: opts.dimensions });
    case "local":
    default:
      return new LocalHashingProvider(opts.dimensions);
  }
}

export interface ResolveProviderOptions extends CreateProviderOptions {
  /** Called with a human-readable note when the semantic model can't load. */
  onFallback?: (reason: string) => void;
  /**
   * Extra attempts to load the model before falling back. Default 0 (runtime
   * callers want a fast, single try). CI sets this so a transient Hugging Face
   * blip (429 / "fetch failed") doesn't silently drop the semantic measurement.
   */
  retries?: number;
  /** Base delay between retries in ms (exponential backoff). Default 1000. */
  retryDelayMs?: number;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Resolve the runtime default embedding provider for accuracy.
 *
 * Tries the on-device **semantic** model (transformers.js) and warms it so the
 * decision is made before indexing; if the model can't be loaded (offline,
 * firewalled, or `IRIS_EMBEDDINGS=local`), it falls back to the fast lexical
 * {@link LocalHashingProvider}. This keeps Iris accurate by default and still
 * fully functional offline.
 */
export async function resolveDefaultProvider(
  opts: ResolveProviderOptions = {},
): Promise<EmbeddingProvider> {
  const kind =
    opts.kind ?? (process.env.IRIS_EMBEDDINGS as ProviderKind | undefined) ?? "transformers";
  if (kind === "local") return new LocalHashingProvider(opts.dimensions);

  const model = opts.model ?? process.env.IRIS_EMBEDDINGS_MODEL;
  const provider =
    kind === "fastembed"
      ? new FastEmbedProvider({ model, dimensions: opts.dimensions })
      : new TransformersEmbeddingProvider({ model, dimensions: opts.dimensions });

  const attempts = Math.max(0, opts.retries ?? 0);
  const baseDelay = opts.retryDelayMs ?? 1000;
  for (let attempt = 0; ; attempt++) {
    try {
      // Warm so failures surface now (and the vector store gets the right dims).
      if ("warm" in provider && typeof provider.warm === "function") await provider.warm();
      else await provider.embed(["warmup"]);
      return provider;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      if (attempt < attempts) {
        await sleep(baseDelay * 2 ** attempt);
        continue;
      }
      opts.onFallback?.(`${provider.name} unavailable (${reason}); using local lexical embeddings`);
      return new LocalHashingProvider(opts.dimensions);
    }
  }
}

export interface CreateStoreOptions {
  dimensions: number;
  path?: string;
}

export function createVectorStore(opts: CreateStoreOptions): VectorStore {
  return new MemoryVectorStore(opts);
}
