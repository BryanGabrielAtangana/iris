// SPDX-License-Identifier: Apache-2.0
import { type EmbeddingProvider, normalize } from "./provider.js";

/** Quantization for the ONNX weights. transformers.js `dtype`. */
export type Quantization = "fp32" | "fp16" | "q8" | "q4";

export interface TransformersOptions {
  /** Hugging Face model id. Default: a small, fast sentence-embedding model. */
  model?: string;
  /** Output dimensionality (must match the model, or {@link truncateDim}). */
  dimensions?: number;
  /**
   * Prefix prepended to *query* texts (asymmetric models). Empty for symmetric
   * models like MiniLM. E.g. e5 uses `"query: "`, bge an instruction sentence.
   */
  queryPrefix?: string;
  /** Prefix prepended to *document* texts. E.g. e5 `"passage: "`. */
  documentPrefix?: string;
  /**
   * Matryoshka truncation: keep the first N dims and re-normalize. For MRL
   * models (nomic, EmbeddingGemma) this shrinks the stored vector without a
   * separate model. Leave unset to use the model's native dim.
   */
  truncateDim?: number;
  /** ONNX weight precision. Default q8 (small + fast). */
  dtype?: Quantization;
}

const DEFAULT_MODEL = "Xenova/all-MiniLM-L6-v2";

/**
 * On-device semantic embeddings via transformers.js (`@huggingface/transformers`).
 *
 * Runs a sentence-embedding model locally — no API key, and after the one-time
 * model download (cached) it works fully offline. This is the accuracy default;
 * {@link LocalHashingProvider} remains the zero-dependency fallback when the
 * model cannot be fetched (firewalled / offline).
 *
 * Supports asymmetric models (query/document prefixes) and Matryoshka
 * truncation, so the model-evaluation sweep can compare engines fairly — getting
 * a model's prefix scheme wrong silently invalidates the comparison.
 */
export class TransformersEmbeddingProvider implements EmbeddingProvider {
  readonly name: string;
  readonly dimensions: number;
  private readonly model: string;
  private readonly queryPrefix: string;
  private readonly documentPrefix: string;
  private readonly truncateDim?: number;
  private readonly dtype: Quantization;
  // Lazily-initialized feature-extraction pipeline.
  private extractor:
    | ((texts: string[], opts: object) => Promise<{ tolist(): number[][] }>)
    | undefined;

  constructor(opts: TransformersOptions = {}) {
    this.model = opts.model ?? DEFAULT_MODEL;
    this.queryPrefix = opts.queryPrefix ?? "";
    this.documentPrefix = opts.documentPrefix ?? "";
    this.truncateDim = opts.truncateDim;
    this.dtype = opts.dtype ?? "q8";
    this.dimensions = opts.truncateDim ?? opts.dimensions ?? 384;
    this.name = `transformers:${this.model}`;
  }

  private async ensure(): Promise<NonNullable<typeof this.extractor>> {
    if (this.extractor) return this.extractor;
    // Optional/lazy: only loaded when semantic embeddings are actually used.
    const spec = "@huggingface/transformers";
    const mod = (await import(/* @vite-ignore */ spec)) as {
      pipeline: (task: string, model: string, opts?: object) => Promise<unknown>;
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
    this.extractor = (await mod.pipeline("feature-extraction", this.model, {
      dtype: this.dtype,
    })) as NonNullable<typeof this.extractor>;
    return this.extractor;
  }

  /** Force the model to load (used to decide fallback before indexing). */
  async warm(): Promise<void> {
    const extractor = await this.ensure();
    await extractor(["warmup"], { pooling: "mean", normalize: true });
  }

  private async run(texts: string[], prefix: string): Promise<number[][]> {
    if (texts.length === 0) return [];
    const extractor = await this.ensure();
    const input = prefix ? texts.map((t) => prefix + t) : texts;
    const output = await extractor(input, { pooling: "mean", normalize: true });
    return output.tolist().map((v) => {
      const arr = Array.from(v);
      // Re-normalize defensively so cosine == dot product downstream; for MRL
      // models, truncate first then re-normalize the shorter vector.
      return normalize(this.truncateDim ? arr.slice(0, this.truncateDim) : arr);
    });
  }

  /** Embed documents (skill index text) — uses the document prefix. */
  async embed(texts: string[]): Promise<number[][]> {
    return this.run(texts, this.documentPrefix);
  }

  /** Embed queries — uses the query prefix (differs for asymmetric models). */
  async embedQuery(texts: string[]): Promise<number[][]> {
    return this.run(texts, this.queryPrefix);
  }
}
