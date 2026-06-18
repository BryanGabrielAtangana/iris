// SPDX-License-Identifier: Apache-2.0
import type { Skill } from "@iris-sylvia/protocol";

/** Tokenize to lowercase alphanumeric tokens (shared with retrieval). */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

/**
 * High-frequency function words carry no discriminative signal and, without IDF
 * down-weighting, let a query like "the file" match everything. BM25's IDF
 * already discounts them, but dropping them outright keeps the length
 * normalization honest and the index small.
 */
const STOPWORDS = new Set([
  "the", "and", "for", "are", "but", "not", "you", "all", "any", "can", "her",
  "was", "one", "our", "out", "use", "with", "this", "that", "from", "your",
  "have", "into", "want", "need", "when", "what", "which", "how", "via", "per",
  "its", "their", "them", "then", "than", "they", "will", "would", "should",
  "could", "about", "over", "some", "such", "only", "also", "been", "being",
  "does", "doing", "done", "get", "got", "let", "make", "made",
]);

/** Content tokens for lexical indexing: tokenized minus stopwords. */
export function contentTokens(text: string): string[] {
  return tokenize(text).filter((t) => !STOPWORDS.has(t));
}

/**
 * The text that represents a skill for Tier-2 embedding. Discovery-relevant
 * fields (name, when_to_use, examples) are weighted by repetition so that the
 * embedding leans on intent signals rather than prose.
 */
export function skillIndexText(skill: Skill): string {
  const m = skill.metadata;
  const parts: string[] = [
    m.name,
    m.name, // weight the name
    m.description,
  ];
  if (m.when_to_use) parts.push(m.when_to_use, m.when_to_use);
  for (const ex of m.examples) parts.push(ex);
  if (m.tags.length) parts.push(m.tags.join(" "));
  return parts.join("\n");
}

/** The concise "trigger text" used for the lexical half of the score. */
export function skillTriggerText(skill: Skill): string {
  const m = skill.metadata;
  return [m.name, m.when_to_use ?? "", m.examples.join(" "), m.tags.join(" "), m.description]
    .join(" ")
    .trim();
}

export interface Bm25Params {
  /** Term-frequency saturation. Higher → tf matters more. */
  k1: number;
  /** Length normalization. 0 → off, 1 → full. */
  b: number;
  /** Extra weight applied to a skill's name tokens (folds in the old name bonus). */
  nameBoost: number;
  /**
   * Saturation constant for mapping a raw BM25 sum into [0, 1] via `s/(s+sat)`.
   * Keeps a no-overlap query at exactly 0 (good for rejection) while bounding
   * strong matches below 1 — unlike per-query max-normalization, which would
   * inflate a lone weak match on an off-topic query to 1.0.
   */
  sat: number;
}

export const BM25_DEFAULTS: Bm25Params = { k1: 1.5, b: 0.75, nameBoost: 2, sat: 6 };

interface Bm25Doc {
  tf: Map<string, number>;
  length: number;
}

/**
 * BM25 lexical retrieval over the skill library. Unlike raw token-coverage, this
 * is corpus-aware: rare terms (skill jargon like `kubernetes`, `regex`) are
 * up-weighted by IDF while common words are discounted, and long skills are
 * length-normalized so verbose metadata doesn't win by sheer token count.
 *
 * Built once per library load (it needs corpus statistics), then queried per
 * skill. The name signal — previously a separate bonus — is folded in by
 * counting name tokens `nameBoost`× when building each document.
 */
export class Bm25Index {
  private readonly docs = new Map<string, Bm25Doc>();
  private readonly df = new Map<string, number>();
  private readonly idf = new Map<string, number>();
  private readonly n: number;
  private readonly avgdl: number;
  private readonly params: Bm25Params;

  constructor(entries: { id: string; text: string; name?: string }[], params?: Partial<Bm25Params>) {
    this.params = { ...BM25_DEFAULTS, ...params };
    let totalLen = 0;
    for (const { id, text, name } of entries) {
      const tokens = contentTokens(text);
      // Repeat name tokens to bias toward the skill's own name (old name bonus).
      if (name) {
        for (const t of contentTokens(name)) {
          for (let i = 1; i < this.params.nameBoost; i++) tokens.push(t);
        }
      }
      const tf = new Map<string, number>();
      for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
      this.docs.set(id, { tf, length: tokens.length });
      totalLen += tokens.length;
      for (const t of tf.keys()) this.df.set(t, (this.df.get(t) ?? 0) + 1);
    }
    this.n = this.docs.size;
    this.avgdl = this.n > 0 ? totalLen / this.n : 0;
    // Probabilistic IDF with the +1 smoothing of BM25+, so every term stays
    // non-negative even when it appears in more than half the corpus.
    for (const [t, df] of this.df) {
      this.idf.set(t, Math.log(1 + (this.n - df + 0.5) / (df + 0.5)));
    }
  }

  /** Raw BM25 score of `query` against the document with `id` (0 if unknown). */
  raw(query: string, id: string): number {
    const doc = this.docs.get(id);
    if (!doc) return 0;
    const { k1, b } = this.params;
    const norm = this.avgdl > 0 ? 1 - b + (b * doc.length) / this.avgdl : 1;
    let score = 0;
    for (const t of new Set(contentTokens(query))) {
      const f = doc.tf.get(t);
      if (!f) continue;
      const idf = this.idf.get(t) ?? 0;
      score += (idf * (f * (k1 + 1))) / (f + k1 * norm);
    }
    return score;
  }

  /** BM25 score squashed into [0, 1] for blending; 0 means no lexical overlap. */
  score(query: string, id: string): number {
    const s = this.raw(query, id);
    return s <= 0 ? 0 : s / (s + this.params.sat);
  }
}

/** @deprecated The cross-scale linear blend; superseded by {@link rrfFuse}. */
export interface CombineWeights {
  embedding: number;
  lexical: number;
}

/** @deprecated Weights for the retired linear blend. */
export const DEFAULT_WEIGHTS: CombineWeights = { embedding: 0.6, lexical: 0.4 };

/**
 * @deprecated Linear cosine+lexical blend, retired in favor of {@link rrfFuse}
 * (rank fusion) because cosine and BM25 live on different scales. Kept for the
 * bench-off baseline only.
 */
export function combineScores(
  embeddingScore: number,
  lexical: number,
  weights: CombineWeights = DEFAULT_WEIGHTS,
): number {
  const total = weights.embedding + weights.lexical;
  const e = clamp01(embeddingScore);
  return clamp01((weights.embedding * e + weights.lexical * lexical) / total);
}

export function clamp01(x: number): number {
  if (Number.isNaN(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

/** Retrieval strategy: dense only, sparse only, or their rank fusion. */
export type RetrievalStrategy = "semantic" | "bm25" | "hybrid";

/**
 * Provisional default. The production default is chosen empirically by the
 * strategy×model×subset bench-off (Task 3); until that lands it stays on the
 * proven dense engine, whose scores are already on the [0,1] scale the
 * abstention/floor gates assume.
 */
export const DEFAULT_STRATEGY: RetrievalStrategy = "semantic";

/** Constant in the RRF denominator. 60 is the standard value from the literature. */
export const RRF_K = 60;

export interface Scored {
  id: string;
  score: number;
}

/**
 * Reciprocal Rank Fusion: combine several rankings by **rank, not raw score**
 * (`Σ 1/(k + rank)`). Scale-free, so it sidesteps the core flaw of the old
 * `0.6·cosine + 0.4·lexical` blend — cosine and BM25 live on different scales,
 * and a fixed linear mix lets whichever has the larger numbers dominate. RRF
 * only cares about position, so a skill ranked #1 by either signal is rewarded
 * and one ranked highly by *both* wins.
 */
export function rrfFuse(rankings: Scored[][], k = RRF_K): Map<string, number> {
  const fused = new Map<string, number>();
  for (const ranking of rankings) {
    const ordered = [...ranking].sort((a, b) => b.score - a.score);
    ordered.forEach((item, i) => {
      fused.set(item.id, (fused.get(item.id) ?? 0) + 1 / (k + i + 1));
    });
  }
  return fused;
}
