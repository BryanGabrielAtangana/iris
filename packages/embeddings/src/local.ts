// SPDX-License-Identifier: Apache-2.0
import { type EmbeddingProvider, normalize } from "./provider.js";

const DEFAULT_DIMENSIONS = 1024;

/** Tokenize to lowercase alphanumeric word tokens. */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

/** FNV-1a 32-bit hash, used for feature hashing. */
function fnv1a(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * A fully local, deterministic, zero-dependency embedding provider.
 *
 * It uses feature hashing over word unigrams and bigrams with sublinear term
 * weighting, projected into a fixed-dimension L2-normalized vector. There is
 * no model download and no network access, so it works completely offline and
 * is fast enough for CI. It is intentionally simple — the heavier, more
 * semantic {@link FastEmbedProvider} can be swapped in behind the same
 * interface for production-grade retrieval.
 */
export class LocalHashingProvider implements EmbeddingProvider {
  readonly name = "local-hashing";
  readonly dimensions: number;

  constructor(dimensions: number = DEFAULT_DIMENSIONS) {
    this.dimensions = dimensions;
  }

  private embedOne(text: string): number[] {
    const tokens = tokenize(text);
    const vec = new Array<number>(this.dimensions).fill(0);
    const counts = new Map<string, number>();

    const features: string[] = [];
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i] as string;
      features.push(tok);
      if (i + 1 < tokens.length) features.push(`${tok}_${tokens[i + 1]}`);
      // Character n-grams (with word boundaries) add many overlapping features
      // so that no single hash collision dominates the similarity, and they
      // capture morphological overlap (pdf/pdfs, form/forms).
      const padded = `#${tok}#`;
      for (let n = 3; n <= 4; n++) {
        for (let j = 0; j + n <= padded.length; j++) {
          features.push(`c:${padded.slice(j, j + n)}`);
        }
      }
    }
    for (const f of features) counts.set(f, (counts.get(f) ?? 0) + 1);

    for (const [feature, count] of counts) {
      const idx = fnv1a(feature) % this.dimensions;
      // Sublinear term weighting damps repeated tokens. Features are added
      // with a positive weight so that genuine token overlap between two texts
      // always increases their similarity (collisions only add minor noise in
      // the high-dimensional space).
      const weight = 1 + Math.log(count);
      vec[idx] = (vec[idx] as number) + weight;
    }
    return normalize(vec);
  }

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((t) => this.embedOne(t));
  }
}
