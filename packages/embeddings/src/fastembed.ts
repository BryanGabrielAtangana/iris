// SPDX-License-Identifier: Apache-2.0
import { type EmbeddingProvider, normalize } from "./provider.js";

/**
 * Optional on-device embedding provider backed by `fastembed` (ONNX small
 * models). It produces genuinely semantic embeddings while still running
 * locally with no API key. The dependency is optional: it is only required if
 * you explicitly select this provider, and the first run downloads the model.
 *
 * Kept behind the same {@link EmbeddingProvider} interface so swapping it in is
 * a one-line change. Hosted providers (Voyage/OpenAI/Cohere) would follow the
 * same shape.
 */
export interface FastEmbedOptions {
  /** fastembed model enum value, e.g. "BGESmallENV15". */
  model?: string;
  dimensions?: number;
}

export class FastEmbedProvider implements EmbeddingProvider {
  readonly name: string;
  readonly dimensions: number;
  private readonly modelName: string;
  // Lazily-initialized fastembed embedding handle.
  private embedder: unknown;

  constructor(opts: FastEmbedOptions = {}) {
    this.modelName = opts.model ?? "BGESmallENV15";
    this.dimensions = opts.dimensions ?? 384;
    this.name = `fastembed:${this.modelName}`;
  }

  private async ensureEmbedder(): Promise<{
    embed(texts: string[]): AsyncGenerator<number[][]> | Promise<number[][]>;
  }> {
    if (this.embedder) {
      return this.embedder as {
        embed(texts: string[]): AsyncGenerator<number[][]> | Promise<number[][]>;
      };
    }
    let mod: Record<string, unknown>;
    // Non-literal specifier so the optional dependency is not statically
    // resolved at build/typecheck time when it is not installed.
    const spec = "fastembed";
    try {
      // Optional dependency: imported only when this provider is used.
      mod = (await import(/* @vite-ignore */ spec)) as Record<string, unknown>;
    } catch {
      throw new Error(
        "FastEmbedProvider requires the optional 'fastembed' package. " +
          "Install it with `pnpm add fastembed`, or use the default LocalHashingProvider.",
      );
    }
    const EmbeddingModel = mod.EmbeddingModel as Record<string, string> | undefined;
    const FlagEmbedding = mod.FlagEmbedding as
      | { init(opts: { model: string }): Promise<unknown> }
      | undefined;
    if (!FlagEmbedding || !EmbeddingModel) {
      throw new Error("Unexpected 'fastembed' API shape; please report this to Iris.");
    }
    this.embedder = await FlagEmbedding.init({
      model: EmbeddingModel[this.modelName] ?? this.modelName,
    });
    return this.embedder as {
      embed(texts: string[]): AsyncGenerator<number[][]> | Promise<number[][]>;
    };
  }

  async embed(texts: string[]): Promise<number[][]> {
    const embedder = await this.ensureEmbedder();
    const out: number[][] = [];
    const result = embedder.embed(texts);
    if (Symbol.asyncIterator in (result as object)) {
      for await (const batch of result as AsyncGenerator<number[][]>) {
        for (const v of batch) out.push(normalize(Array.from(v)));
      }
    } else {
      for (const v of await (result as Promise<number[][]>)) out.push(normalize(Array.from(v)));
    }
    return out;
  }
}
