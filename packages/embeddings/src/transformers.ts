// SPDX-License-Identifier: Apache-2.0
import { type EmbeddingProvider, normalize } from "./provider.js";

export interface TransformersOptions {
  /** Hugging Face model id. Default: a small, fast sentence-embedding model. */
  model?: string;
  /** Output dimensionality (must match the model). Default 384 (MiniLM/BGE-small). */
  dimensions?: number;
}

const DEFAULT_MODEL = "Xenova/all-MiniLM-L6-v2";

/**
 * On-device semantic embeddings via transformers.js (`@huggingface/transformers`).
 *
 * Runs a small sentence-embedding model locally — no API key, and after the
 * one-time model download (~23MB, cached) it works fully offline. This is the
 * accuracy default; {@link LocalHashingProvider} remains the zero-dependency
 * fallback when the model cannot be fetched (firewalled / offline).
 */
export class TransformersEmbeddingProvider implements EmbeddingProvider {
  readonly name: string;
  readonly dimensions: number;
  private readonly model: string;
  // Lazily-initialized feature-extraction pipeline.
  private extractor:
    | ((texts: string[], opts: object) => Promise<{ tolist(): number[][] }>)
    | undefined;

  constructor(opts: TransformersOptions = {}) {
    this.model = opts.model ?? DEFAULT_MODEL;
    this.dimensions = opts.dimensions ?? 384;
    this.name = `transformers:${this.model}`;
  }

  private async ensure(): Promise<NonNullable<typeof this.extractor>> {
    if (this.extractor) return this.extractor;
    // Optional/lazy: only loaded when semantic embeddings are actually used.
    const spec = "@huggingface/transformers";
    const mod = (await import(/* @vite-ignore */ spec)) as {
      pipeline: (task: string, model: string) => Promise<unknown>;
      env: { cacheDir?: string };
    };
    // Pin transformers.js's model cache to a stable, controllable directory.
    // Its default cache location is opaque (relative to cwd / package dir),
    // which made CI cache the wrong path and re-download the model every run
    // (hitting Hugging Face 429 rate limits). `IRIS_MODEL_CACHE` lets CI point
    // the cache action at exactly where the weights land so the download
    // happens at most once.
    const cacheDir = process.env.IRIS_MODEL_CACHE;
    if (cacheDir) mod.env.cacheDir = cacheDir;
    this.extractor = (await mod.pipeline("feature-extraction", this.model)) as NonNullable<
      typeof this.extractor
    >;
    return this.extractor;
  }

  /** Force the model to load (used to decide fallback before indexing). */
  async warm(): Promise<void> {
    const extractor = await this.ensure();
    await extractor(["warmup"], { pooling: "mean", normalize: true });
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const extractor = await this.ensure();
    const output = await extractor(texts, { pooling: "mean", normalize: true });
    // Re-normalize defensively so cosine == dot product downstream.
    return output.tolist().map((v) => normalize(Array.from(v)));
  }
}
