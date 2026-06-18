// SPDX-License-Identifier: Apache-2.0
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { IrisLibrary } from "@iris-sylvia/core";
import { createEmbeddingProvider, type EmbeddingProvider } from "@iris-sylvia/embeddings";
import { evaluate, type Metrics } from "./runner.js";
import { HARD_CASES, NEGATIVE_QUERIES } from "./hard.js";

const here = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_SKILLS_DIR = resolve(join(here, "..", "..", "skills"));

export interface AccuracyReport {
  provider: string;
  hard: Metrics;
  /** Mean top-1 score on correct positives (confidence on the right answer). */
  positiveMeanScore: number;
  /** Mean top score on out-of-domain queries (lower is better). */
  negativeMeanScore: number;
  /** Fraction of negatives whose top score is below `threshold` (correctly quiet). */
  negativeRejectionRate: number;
  /** Fraction of hard positives that are top-1 AND above `threshold`. */
  confidentTop1: number;
  threshold: number;
  /** Median find() latency in ms. */
  medianLatencyMs: number;
}

export async function runAccuracy(
  provider?: EmbeddingProvider,
  skillsDir = DEFAULT_SKILLS_DIR,
  threshold = 0.2,
): Promise<AccuracyReport> {
  const p = provider ?? createEmbeddingProvider();
  const lib = new IrisLibrary({ root: skillsDir, provider: p });
  await lib.load();

  const hard = await evaluate(lib, HARD_CASES);

  // Confidence on positives + latency.
  const latencies: number[] = [];
  let posScoreSum = 0;
  let confident = 0;
  for (const c of HARD_CASES) {
    const t0 = performance.now();
    const results = await lib.find(c.query, 5);
    latencies.push(performance.now() - t0);
    const top = results[0];
    if (top?.id === c.expected) {
      posScoreSum += top.score;
      if (top.score >= threshold) confident++;
    }
  }

  // Negatives: top score should be low.
  let negScoreSum = 0;
  let rejected = 0;
  for (const q of NEGATIVE_QUERIES) {
    const results = await lib.find(q, 5);
    const top = results[0]?.score ?? 0;
    negScoreSum += top;
    if (top < threshold) rejected++;
  }

  latencies.sort((a, b) => a - b);
  const median = latencies[Math.floor(latencies.length / 2)] ?? 0;

  return {
    provider: p.name,
    hard,
    positiveMeanScore: posScoreSum / HARD_CASES.length,
    negativeMeanScore: negScoreSum / NEGATIVE_QUERIES.length,
    negativeRejectionRate: rejected / NEGATIVE_QUERIES.length,
    confidentTop1: confident / HARD_CASES.length,
    threshold,
    medianLatencyMs: median,
  };
}

export function formatReport(r: AccuracyReport): string {
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  return [
    `Provider: ${r.provider}`,
    `HARD set (${HARD_CASES.length} paraphrased queries):`,
    `  acc@1 ${pct(r.hard.top1)}   acc@3 ${pct(r.hard.top3)}   MRR ${r.hard.mrr.toFixed(3)}`,
    `  confident top-1 (≥ ${r.threshold}) ${pct(r.confidentTop1)}   mean correct score ${r.positiveMeanScore.toFixed(3)}`,
    `Negatives (${NEGATIVE_QUERIES.length} out-of-domain):`,
    `  rejection rate (top < ${r.threshold}) ${pct(r.negativeRejectionRate)}   mean top score ${r.negativeMeanScore.toFixed(3)}`,
    `Latency: median find() ${r.medianLatencyMs.toFixed(2)} ms`,
  ].join("\n");
}

async function main(): Promise<void> {
  const dir = process.argv[2] ? resolve(process.argv[2]) : DEFAULT_SKILLS_DIR;
  const report = await runAccuracy(undefined, dir);
  process.stdout.write(`Iris search-accuracy report\nLibrary: ${dir}\n\n`);
  process.stdout.write(formatReport(report) + "\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    process.stderr.write(`${err instanceof Error ? err.stack : String(err)}\n`);
    process.exit(1);
  });
}
