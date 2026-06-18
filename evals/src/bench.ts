// SPDX-License-Identifier: Apache-2.0
//
// Task 3 bench-off: for the resolved embedding model, run all three retrieval
// strategies (semantic / bm25 / hybrid-RRF) and report acc@1 · acc@3 · MRR per
// subset (full positives, semantic-only, exact-vocabulary) plus negative
// rejection and the best abstention F1. The production default is chosen from
// this table by data — not assumption.
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";
import { IrisLibrary } from "@iris-sylvia/core";
import type { RetrievalStrategy } from "@iris-sylvia/core";
import { resolveDefaultProvider, type EmbeddingProvider } from "@iris-sylvia/embeddings";
import { evaluate } from "./runner.js";
import { matchesExpected, type EvalCase } from "./dataset.js";
import { DEFAULT_SKILLS_DIR } from "./accuracy.js";
import {
  POSITIVES,
  AMBIGUOUS,
  SEMANTIC_ONLY,
  EXACT_VOCABULARY,
  NEGATIVES_OOD,
  NEGATIVES_NEARMISS,
} from "./v3.js";

const STRATEGIES: RetrievalStrategy[] = ["semantic", "bm25", "hybrid"];
const ALL_POSITIVES: EvalCase[] = [...POSITIVES, ...AMBIGUOUS];
const ALL_NEGATIVES: string[] = [...NEGATIVES_OOD, ...NEGATIVES_NEARMISS];

interface SubsetRow {
  name: string;
  n: number;
  top1: number;
  top3: number;
  mrr: number;
}

interface StrategyReport {
  strategy: RetrievalStrategy;
  provider: string;
  subsets: SubsetRow[];
  /** Fraction of negatives correctly rejected at the best-F1 threshold. */
  negRejection: number;
  bestF1: number;
  bestF1Threshold: number;
  medianLatencyMs: number;
}

async function benchStrategy(
  strategy: RetrievalStrategy,
  provider: EmbeddingProvider,
  skillsDir: string,
): Promise<StrategyReport> {
  const lib = new IrisLibrary({ root: skillsDir, provider, strategy });
  await lib.load();

  const subsetDefs: { name: string; cases: EvalCase[] }[] = [
    { name: "full", cases: ALL_POSITIVES },
    { name: "semantic-only", cases: SEMANTIC_ONLY },
    { name: "exact-vocab", cases: EXACT_VOCABULARY },
  ];
  const subsets: SubsetRow[] = [];
  for (const { name, cases } of subsetDefs) {
    const m = await evaluate(lib, cases);
    subsets.push({ name, n: cases.length, top1: m.top1, top3: m.top3, mrr: m.mrr });
  }

  // Abstention / rejection: collect top-1 score + correctness on positives and
  // the top score on negatives, then sweep thresholds adaptively (RRF and cosine
  // live on very different scales).
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

  const STEPS = 50;
  const maxTop = Math.max(0, ...posTop.map((x) => x.score), ...negTop);
  let best = { f1: 0, threshold: 0, rejection: 1 };
  for (let i = 0; i <= STEPS; i++) {
    const t = (maxTop * i) / STEPS;
    let tp = 0;
    let fp = 0;
    for (const x of posTop) {
      if (x.score >= t) {
        if (x.correct) tp++;
        else fp++;
      }
    }
    let firedNeg = 0;
    for (const s of negTop) if (s >= t) firedNeg++;
    fp += firedNeg;
    const fired = tp + fp;
    const precision = fired ? tp / fired : 1;
    const recall = tp / ALL_POSITIVES.length;
    const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
    if (f1 > best.f1) {
      best = { f1, threshold: t, rejection: (negTop.length - firedNeg) / (negTop.length || 1) };
    }
  }

  latencies.sort((a, b) => a - b);
  return {
    strategy,
    provider: provider.name,
    subsets,
    negRejection: best.rejection,
    bestF1: best.f1,
    bestF1Threshold: best.threshold,
    medianLatencyMs: latencies[Math.floor(latencies.length / 2)] ?? 0,
  };
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const pad = (s: string, n: number) => s.padEnd(n);

function printTable(reports: StrategyReport[]): void {
  process.stdout.write(`\nModel: ${reports[0]?.provider ?? "?"}\n`);
  process.stdout.write(
    `${pad("strategy", 10)} ${pad("subset", 20)} ${pad("acc@1", 8)} ${pad("acc@3", 8)} ${pad("MRR", 7)}\n`,
  );
  process.stdout.write(`${"-".repeat(55)}\n`);
  for (const r of reports) {
    for (const s of r.subsets) {
      process.stdout.write(
        `${pad(r.strategy, 10)} ${pad(`${s.name} (${s.n})`, 20)} ${pad(pct(s.top1), 8)} ${pad(pct(s.top3), 8)} ${s.mrr.toFixed(3)}\n`,
      );
    }
  }
  process.stdout.write(`\n${pad("strategy", 10)} ${pad("neg-reject", 12)} ${pad("absF1", 8)} latency\n`);
  process.stdout.write(`${"-".repeat(40)}\n`);
  for (const r of reports) {
    process.stdout.write(
      `${pad(r.strategy, 10)} ${pad(pct(r.negRejection), 12)} ${pad(r.bestF1.toFixed(3), 8)} ${r.medianLatencyMs.toFixed(2)}ms\n`,
    );
  }
}

/** Pick the default: hybrid only earns it by leading on full-set acc@1 (ties → semantic). */
function recommend(reports: StrategyReport[]): { winner: RetrievalStrategy; note: string } {
  const full = (s: RetrievalStrategy) =>
    reports.find((r) => r.strategy === s)?.subsets.find((x) => x.name === "full");
  const sem = full("semantic")!;
  const bm25 = full("bm25")!;
  const hyb = full("hybrid")!;
  const beatsBoth = hyb.top1 > sem.top1 && hyb.top1 > bm25.top1;
  if (beatsBoth) {
    return { winner: "hybrid", note: "hybrid leads full-set acc@1 over both pure strategies" };
  }
  // Stop-and-report condition from the spec: fusion didn't earn its complexity.
  const winner: RetrievalStrategy = sem.top1 >= bm25.top1 ? "semantic" : "bm25";
  return {
    winner,
    note: `hybrid did NOT beat both pure strategies (sem ${pct(sem.top1)}, bm25 ${pct(bm25.top1)}, hybrid ${pct(hyb.top1)}) — keep ${winner}`,
  };
}

async function main(): Promise<void> {
  const dir = process.argv[2] ? resolve(process.argv[2]) : DEFAULT_SKILLS_DIR;
  process.stdout.write(`Iris strategy bench-off (v0.3 dataset)\nLibrary: ${dir}\n`);

  const provider = await resolveDefaultProvider({
    onFallback: (r) => process.stderr.write(`[bench] ${r}\n`),
    retries: process.env.CI ? 4 : 0,
    retryDelayMs: 2000,
  });
  const isLexicalFallback = !provider.name.startsWith("transformers");
  if (isLexicalFallback) {
    process.stderr.write(
      `[bench] semantic model unavailable — 'semantic'/'hybrid' rows use the lexical fallback embedding.\n`,
    );
  }

  const reports: StrategyReport[] = [];
  for (const strategy of STRATEGIES) reports.push(await benchStrategy(strategy, provider, dir));
  printTable(reports);

  const { winner, note } = recommend(reports);
  process.stdout.write(`\nRecommended default: ${winner} — ${note}\n`);

  // Only assert when the real model ran (the decision must be made on semantic
  // numbers, not the lexical fallback).
  if (!isLexicalFallback) {
    const hyb = reports.find((r) => r.strategy === "hybrid")!;
    const full = hyb.subsets.find((s) => s.name === "full")!;
    if (full.top1 < 0.93) {
      process.stderr.write(`\n[bench] FAIL: hybrid full-set acc@1 ${pct(full.top1)} < 93%.\n`);
      process.exitCode = 1;
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    process.stderr.write(`${err instanceof Error ? err.stack : String(err)}\n`);
    process.exit(1);
  });
}
