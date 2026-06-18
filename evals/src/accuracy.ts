// SPDX-License-Identifier: Apache-2.0
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { IrisLibrary } from "@iris-sylvia/core";
import {
  createEmbeddingProvider,
  resolveDefaultProvider,
  type EmbeddingProvider,
} from "@iris-sylvia/embeddings";
import { evaluate, type Metrics } from "./runner.js";
import { matchesExpected, type EvalCase } from "./dataset.js";
import {
  POSITIVES,
  AMBIGUOUS,
  SEMANTIC_ONLY,
  NEGATIVES_OOD,
  NEGATIVES_NEARMISS,
} from "./v3.js";

const here = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_SKILLS_DIR = resolve(join(here, "..", "..", "skills"));

const ALL_POSITIVES: EvalCase[] = [...POSITIVES, ...AMBIGUOUS];
const ALL_NEGATIVES: string[] = [...NEGATIVES_OOD, ...NEGATIVES_NEARMISS];

export interface AbstentionPoint {
  threshold: number;
  precision: number;
  recall: number;
  f1: number;
}

export interface AccuracyReport {
  provider: string;
  /** Metrics over all positives (incl. ambiguous, any-of accepted). */
  positives: Metrics;
  /** Strict acc@1 over single-gold positives only (no any-of inflation). */
  strictTop1: number;
  /** acc@1 over the semantic-only subset (the gate metric). */
  semanticOnlyTop1: number;
  /** Mean top score on positives whose top-1 is correct. */
  positiveMeanScore: number;
  /** Mean top score on negatives (lower is better). */
  negativeMeanScore: number;
  /** Fraction of negatives whose top score is below `threshold`. */
  negativeRejectionRate: number;
  threshold: number;
  /** Abstention precision/recall sweep over the top-1 score. */
  curve: AbstentionPoint[];
  /** Operating point with the best F1 from the sweep. */
  bestF1: AbstentionPoint;
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

  const positives = await evaluate(lib, ALL_POSITIVES);
  const strict = await evaluate(lib, POSITIVES); // single-gold only
  const semanticOnly = await evaluate(lib, SEMANTIC_ONLY);

  // Collect top-1 (id, score, correct) for positives, and top score for negatives.
  const posTop: { score: number; correct: boolean }[] = [];
  const latencies: number[] = [];
  for (const c of ALL_POSITIVES) {
    const t0 = performance.now();
    const r = await lib.find(c.query, 5);
    latencies.push(performance.now() - t0);
    const top = r[0];
    posTop.push({ score: top?.score ?? 0, correct: !!top && matchesExpected(c.expected, top.id) });
  }
  const negTop: number[] = [];
  for (const q of ALL_NEGATIVES) {
    const r = await lib.find(q, 5);
    negTop.push(r[0]?.score ?? 0);
  }

  const correctScores = posTop.filter((x) => x.correct).map((x) => x.score);
  const positiveMeanScore = correctScores.reduce((s, x) => s + x, 0) / (correctScores.length || 1);
  const negativeMeanScore = negTop.reduce((s, x) => s + x, 0) / (negTop.length || 1);
  const negativeRejectionRate = negTop.filter((x) => x < threshold).length / (negTop.length || 1);

  // Abstention curve: fire when top score >= t. A "fire" is good only when the
  // query is a positive AND its top-1 is correct; firing on a negative or a
  // wrong positive is a false positive.
  const curve: AbstentionPoint[] = [];
  for (let t = 0; t <= 0.8001; t += 0.05) {
    let tp = 0; // fired & correct positive
    let fp = 0; // fired but negative or wrong
    for (const x of posTop) {
      if (x.score >= t) {
        if (x.correct) tp++;
        else fp++;
      }
    }
    for (const s of negTop) if (s >= t) fp++;
    const fired = tp + fp;
    const precision = fired ? tp / fired : 1;
    const recall = tp / ALL_POSITIVES.length;
    const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
    curve.push({ threshold: round(t), precision, recall, f1 });
  }
  const bestF1 = curve.reduce((a, b) => (b.f1 > a.f1 ? b : a), curve[0]!);

  latencies.sort((a, b) => a - b);
  return {
    provider: p.name,
    positives,
    strictTop1: strict.top1,
    semanticOnlyTop1: semanticOnly.top1,
    positiveMeanScore,
    negativeMeanScore,
    negativeRejectionRate,
    threshold,
    curve,
    bestF1,
    medianLatencyMs: latencies[Math.floor(latencies.length / 2)] ?? 0,
  };
}

const round = (x: number) => Math.round(x * 100) / 100;
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

export function formatReport(r: AccuracyReport): string {
  return [
    `Provider: ${r.provider}`,
    `Positives (${ALL_POSITIVES.length}):  acc@1 ${pct(r.positives.top1)}   acc@3 ${pct(r.positives.top3)}   MRR ${r.positives.mrr.toFixed(3)}`,
    `  strict acc@1 (${POSITIVES.length} single-gold): ${pct(r.strictTop1)}   (${AMBIGUOUS.length}/${ALL_POSITIVES.length} positives are ambiguous/any-of)`,
    `Semantic-only (${SEMANTIC_ONLY.length}):  acc@1 ${pct(r.semanticOnlyTop1)}   ← gate: lexical must be ≤ 40%`,
    `Negatives (${ALL_NEGATIVES.length}):  rejection@${r.threshold} ${pct(r.negativeRejectionRate)}   mean top ${r.negativeMeanScore.toFixed(3)}   (pos mean ${r.positiveMeanScore.toFixed(3)})`,
    `Best abstention F1: ${r.bestF1.f1.toFixed(3)} at t=${r.bestF1.threshold} (P ${pct(r.bestF1.precision)} / R ${pct(r.bestF1.recall)})`,
    `Latency: median find() ${r.medianLatencyMs.toFixed(2)} ms`,
  ].join("\n");
}

async function main(): Promise<void> {
  const dir = process.argv[2] ? resolve(process.argv[2]) : DEFAULT_SKILLS_DIR;
  process.stdout.write(`Iris search-accuracy report (v0.3 dataset)\nLibrary: ${dir}\n\n`);

  const lexical = await runAccuracy(createEmbeddingProvider({ kind: "local" }), dir);
  process.stdout.write(formatReport(lexical) + "\n\n");

  const semanticProvider = await resolveDefaultProvider({
    onFallback: (r) => process.stderr.write(`[accuracy] ${r}\n`),
  });
  const semantic = await runAccuracy(semanticProvider, dir);
  process.stdout.write(formatReport(semantic) + "\n");

  if (semantic.provider !== lexical.provider) {
    const d = (a: number, b: number) => `${((a - b) * 100).toFixed(1)} pts`;
    process.stdout.write(
      `\nSemantic vs lexical:` +
        `  semantic-only acc@1 ${d(semantic.semanticOnlyTop1, lexical.semanticOnlyTop1)},` +
        `  overall acc@1 ${d(semantic.positives.top1, lexical.positives.top1)},` +
        `  negative rejection ${d(semantic.negativeRejectionRate, lexical.negativeRejectionRate)}.\n`,
    );

    // Semantic floor: guard against an embedding/representation regression that
    // tanks semantic while the lexical-only gate stays green. Only enforced when
    // the real model actually loaded (e.g. in CI, where HF is reachable).
    const SEMANTIC_FLOOR = 0.7;
    if (semantic.provider.startsWith("transformers") && semantic.semanticOnlyTop1 < SEMANTIC_FLOOR) {
      process.stderr.write(
        `\n[accuracy] FAIL: semantic-only acc@1 ${pct(semantic.semanticOnlyTop1)} < floor ${pct(SEMANTIC_FLOOR)}.\n`,
      );
      process.exitCode = 1;
    }
  } else {
    process.stderr.write(
      `\n[accuracy] semantic engine unavailable here — both rows are the lexical fallback.\n`,
    );
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    process.stderr.write(`${err instanceof Error ? err.stack : String(err)}\n`);
    process.exit(1);
  });
}
