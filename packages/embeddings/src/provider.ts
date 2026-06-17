// SPDX-License-Identifier: Apache-2.0

/**
 * Pluggable embedding provider. The default is local/on-device (no API key,
 * no network, nothing leaves the machine). Hosted providers (Voyage, OpenAI,
 * Cohere) can implement the same interface behind an adapter.
 */
export interface EmbeddingProvider {
  /** Stable provider identifier, e.g. "local-hashing" or "fastembed:bge-small". */
  readonly name: string;
  /** Output vector dimensionality. Stable for a given provider instance. */
  readonly dimensions: number;
  /** Embed a batch of texts into unit-normalized vectors. */
  embed(texts: string[]): Promise<number[][]>;
}

/** Cosine similarity of two equal-length vectors. Assumes finite values. */
export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < len; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    dot += av * bv;
    na += av * av;
    nb += bv * bv;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** L2-normalize a vector in place and return it. */
export function normalize(vector: number[]): number[] {
  let norm = 0;
  for (const v of vector) norm += v * v;
  norm = Math.sqrt(norm);
  if (norm === 0) return vector;
  for (let i = 0; i < vector.length; i++) vector[i] = (vector[i] ?? 0) / norm;
  return vector;
}
