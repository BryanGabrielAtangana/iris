// SPDX-License-Identifier: Apache-2.0
import { clamp01 } from "./ranking.js";

/**
 * Calibrated abstention. A single absolute score is a weak "is this a real
 * match?" signal — off-topic queries can still produce a middling top score. We
 * combine three complementary signals, all computed over the *full* candidate
 * distribution for a query:
 *
 *  - **top1**   — the winner's absolute score.
 *  - **margin** — top1 − top2: does the winner actually stand out, or is it a
 *                 near-tie (a hallmark of "nothing really fits")?
 *  - **z**      — how many standard deviations the winner sits above the mean
 *                 candidate score: a scale-free "does one skill pop?" signal.
 *
 * The weights/scales/threshold below are set by the calibration harness
 * (`evals abstain`) on the production ranker's score distribution.
 */
export interface ConfidenceParams {
  /** Relative weight on the absolute top-1 score. */
  wTop1: number;
  /** Relative weight on the top1→top2 margin. */
  wMargin: number;
  /** Relative weight on the background z-score. */
  wZ: number;
  /** Margin that maps to a full (1.0) margin signal. */
  marginScale: number;
  /** z-score that maps to a full (1.0) z signal. */
  zScale: number;
  /** confidence below this ⇒ `noStrongMatch`. */
  threshold: number;
}

/**
 * Calibrated on the blend@.3 ranker (MiniLM) by the abstain harness
 * (`evals abstain`). The harness swept top1 / margin / z combinations against
 * the full + near-miss-negative slices, and the data was unambiguous: **top-1
 * alone is the best rejector** — every formula that mixed in margin or z scored
 * *lower* (they dilute a strong top-1 with noise). So the weights are top1-only
 * and `confidence` reduces to the calibrated top-1 score.
 *
 * Operating point: the highest-precision threshold (rejects 61.5% of off-topic
 * queries at 97% precision — only ~1/107 good queries wrongly abstained). For an
 * agent tool a false "no strong match" on a real query is worse than letting a
 * weak match through, so we bias to precision. NB: ≥90% rejection @ ≥95%
 * precision is **not reachable** with score-based confidence on this benchmark —
 * the hard near-miss negatives overlap real positives by design; closing that
 * gap needs a heavier signal (cross-encoder / judge). See the strategy report.
 */
export const DEFAULT_CONFIDENCE: ConfidenceParams = {
  wTop1: 1,
  wMargin: 0,
  wZ: 0,
  marginScale: 0.25,
  zScale: 2.5,
  threshold: 0.18,
};

/** Background stats (mean/std) of a candidate score distribution. */
export function scoreStats(scores: number[]): { mean: number; std: number } {
  const n = scores.length || 1;
  const mean = scores.reduce((s, x) => s + x, 0) / n;
  const std = Math.sqrt(scores.reduce((s, x) => s + (x - mean) ** 2, 0) / n);
  return { mean, std };
}

/**
 * Confidence in [0,1] that the candidate scoring `score` is a genuine match,
 * given its `margin` to the next candidate and its `z` over the distribution.
 */
export function confidence(
  score: number,
  margin: number,
  z: number,
  p: ConfidenceParams = DEFAULT_CONFIDENCE,
): number {
  const marginN = clamp01(margin / p.marginScale);
  const zN = clamp01(z / p.zScale);
  const total = p.wTop1 + p.wMargin + p.wZ || 1;
  return clamp01((p.wTop1 * clamp01(score) + p.wMargin * marginN + p.wZ * zN) / total);
}

export interface Assessment {
  confidence: number;
  noStrongMatch: boolean;
}

/**
 * Assess the top-1 of a *full* (unsliced) candidate score list: its confidence
 * and whether the library should report that nothing strong matched.
 */
export function assessTop1(scores: number[], p: ConfidenceParams = DEFAULT_CONFIDENCE): Assessment {
  if (scores.length === 0) return { confidence: 0, noStrongMatch: true };
  const sorted = [...scores].sort((a, b) => b - a);
  const top1 = sorted[0] ?? 0;
  const top2 = sorted[1] ?? 0;
  const { mean, std } = scoreStats(scores);
  const z = std > 0 ? (top1 - mean) / std : 0;
  const c = confidence(top1, top1 - top2, z, p);
  return { confidence: c, noStrongMatch: c < p.threshold };
}
