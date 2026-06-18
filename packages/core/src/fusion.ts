// SPDX-License-Identifier: Apache-2.0
import { rrfFuse, RRF_K } from "./ranking.js";

/** Per-skill raw signals for one query: dense cosine and sparse BM25, both ~[0,1]. */
export interface Signal {
  id: string;
  semantic: number;
  lexical: number;
}

/**
 * How the two signals are combined into a final ranking score:
 *  - `semantic` / `bm25`  — one signal only.
 *  - `blend`              — convex combo of the raw scores (the incumbent). Uses
 *                           magnitude, but cosine and BM25 live on different scales.
 *  - `znorm` / `minmax`   — convex combo after per-query normalization, so it is
 *                           magnitude-aware *and* scale-free (the fix the RRF
 *                           experiment was reaching for, without discarding score).
 *  - `rrf`                — Reciprocal Rank Fusion (rank-only).
 */
export type RetrievalStrategy = "semantic" | "bm25" | "blend" | "znorm" | "minmax" | "rrf";

export interface FusionConfig {
  strategy: RetrievalStrategy;
  /** Lexical weight in [0,1] for the convex-combo strategies. Default 0.4. */
  lexicalWeight?: number;
  /** RRF constant. Default {@link RRF_K}. */
  rrfK?: number;
}

export const DEFAULT_LEXICAL_WEIGHT = 0.4;

function meanStd(xs: number[]): { mean: number; std: number } {
  const n = xs.length || 1;
  const mean = xs.reduce((s, x) => s + x, 0) / n;
  const variance = xs.reduce((s, x) => s + (x - mean) ** 2, 0) / n;
  return { mean, std: Math.sqrt(variance) };
}

/** Combine per-skill signals into a final score map according to `cfg`. */
export function fuse(signals: Signal[], cfg: FusionConfig): Map<string, number> {
  const w = cfg.lexicalWeight ?? DEFAULT_LEXICAL_WEIGHT;
  const out = new Map<string, number>();

  switch (cfg.strategy) {
    case "semantic":
      for (const s of signals) out.set(s.id, s.semantic);
      return out;
    case "bm25":
      for (const s of signals) out.set(s.id, s.lexical);
      return out;
    case "blend":
      for (const s of signals) out.set(s.id, (1 - w) * s.semantic + w * s.lexical);
      return out;
    case "rrf": {
      const sem = signals.map((s) => ({ id: s.id, score: s.semantic }));
      const lex = signals.map((s) => ({ id: s.id, score: s.lexical }));
      return rrfFuse([sem, lex], cfg.rrfK ?? RRF_K);
    }
    case "znorm": {
      const sem = meanStd(signals.map((s) => s.semantic));
      const lex = meanStd(signals.map((s) => s.lexical));
      const z = (x: number, m: { mean: number; std: number }) =>
        m.std > 0 ? (x - m.mean) / m.std : 0;
      for (const s of signals) {
        out.set(s.id, (1 - w) * z(s.semantic, sem) + w * z(s.lexical, lex));
      }
      return out;
    }
    case "minmax": {
      const norm = (xs: number[]): ((x: number) => number) => {
        const lo = Math.min(...xs);
        const hi = Math.max(...xs);
        const range = hi - lo;
        return (x) => (range > 0 ? (x - lo) / range : 0);
      };
      const ns = norm(signals.map((s) => s.semantic));
      const nl = norm(signals.map((s) => s.lexical));
      for (const s of signals) out.set(s.id, (1 - w) * ns(s.semantic) + w * nl(s.lexical));
      return out;
    }
  }
}

/**
 * Provisional default. The production default is chosen empirically by the
 * fusion bench-off (`evals benchoff`); until that lands it stays on the proven
 * dense engine, whose scores are already on the [0,1] scale the gates assume.
 */
export const DEFAULT_STRATEGY: RetrievalStrategy = "semantic";
