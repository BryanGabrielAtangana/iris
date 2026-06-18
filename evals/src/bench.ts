// SPDX-License-Identifier: Apache-2.0
//
// Fusion bench-off: for the resolved embedding model, sweep many ways of
// combining the dense (cosine) and sparse (BM25) signals and report acc@1 /
// acc@3 / MRR per subset (full, semantic-only, exact-vocabulary) plus negative
// rejection and best abstention F1. The production default is chosen from this
// table by data. One embedding pass per query feeds every fusion variant.
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";
import { IrisLibrary, fuse, type FusionConfig, type Signal } from "@iris-sylvia/core";
import { resolveDefaultProvider } from "@iris-sylvia/embeddings";
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

const ALL_POSITIVES: EvalCase[] = [...POSITIVES, ...AMBIGUOUS];
const ALL_NEGATIVES: string[] = [...NEGATIVES_OOD, ...NEGATIVES_NEARMISS];

/** The fusion variants under test. Names are the table row labels. */
const CANDIDATES: { name: string; cfg: FusionConfig }[] = [
  { name: "semantic", cfg: { strategy: "semantic" } },
  { name: "bm25", cfg: { strategy: "bm25" } },
  { name: "blend@.3", cfg: { strategy: "blend", lexicalWeight: 0.3 } },
  { name: "blend@.4", cfg: { strategy: "blend", lexicalWeight: 0.4 } },
  { name: "blend@.5", cfg: { strategy: "blend", lexicalWeight: 0.5 } },
  { name: "znorm@.4", cfg: { strategy: "znorm", lexicalWeight: 0.4 } },
  { name: "znorm@.5", cfg: { strategy: "znorm", lexicalWeight: 0.5 } },
  { name: "minmax@.4", cfg: { strategy: "minmax", lexicalWeight: 0.4 } },
  { name: "rrf", cfg: { strategy: "rrf" } },
];

interface SubsetRow {
  name: string;
  n: number;
  top1: number;
  top3: number;
  mrr: number;
}
interface CandidateReport {
  name: string;
  subsets: SubsetRow[];
  negRejection: number;
  bestF1: number;
}

function rankFor(signals: Signal[], cfg: FusionConfig): { id: string; score: number }[] {
  return [...fuse(signals, cfg)]
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score);
}

function subsetMetrics(
  cases: EvalCase[],
  sig: Map<string, Signal[]>,
  cfg: FusionConfig,
  name: string,
): SubsetRow {
  let top1 = 0;
  let top3 = 0;
  let mrr = 0;
  for (const c of cases) {
    const ranked = rankFor(sig.get(c.query) ?? [], cfg);
    const idx = ranked.findIndex((x) => matchesExpected(c.expected, x.id));
    if (idx === 0) top1++;
    if (idx >= 0 && idx < 3) top3++;
    if (idx >= 0) mrr += 1 / (idx + 1);
  }
  const n = cases.length || 1;
  return { name, n: cases.length, top1: top1 / n, top3: top3 / n, mrr: mrr / n };
}

function abstention(
  sig: Map<string, Signal[]>,
  cfg: FusionConfig,
): { negRejection: number; bestF1: number } {
  const posTop = ALL_POSITIVES.map((c) => {
    const r = rankFor(sig.get(c.query) ?? [], cfg)[0];
    return { score: r?.score ?? 0, correct: !!r && matchesExpected(c.expected, r.id) };
  });
  const negTop = ALL_NEGATIVES.map((q) => rankFor(sig.get(q) ?? [], cfg)[0]?.score ?? 0);

  // Adaptive sweep: fusion scores live on very different scales (RRF ~0.03,
  // z-norm can be negative), so sweep across the observed range.
  const lo = Math.min(0, ...posTop.map((x) => x.score), ...negTop);
  const hi = Math.max(0, ...posTop.map((x) => x.score), ...negTop);
  const STEPS = 60;
  let best = { f1: 0, rejection: 1 };
  for (let i = 0; i <= STEPS; i++) {
    const t = lo + ((hi - lo) * i) / STEPS;
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
    if (f1 > best.f1) best = { f1, rejection: (negTop.length - firedNeg) / (negTop.length || 1) };
  }
  return { negRejection: best.rejection, bestF1: best.f1 };
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const pad = (s: string, n: number) => s.padEnd(n);

function printTable(reports: CandidateReport[], model: string): void {
  process.stdout.write(`\nModel: ${model}\n`);
  process.stdout.write(
    `${pad("fusion", 11)} ${pad("full", 8)} ${pad("sem-only", 9)} ${pad("exact", 8)} ${pad("neg-rej", 8)} absF1\n`,
  );
  process.stdout.write(`${"-".repeat(52)}\n`);
  for (const r of reports) {
    const full = r.subsets.find((s) => s.name === "full")!;
    const sem = r.subsets.find((s) => s.name === "semantic-only")!;
    const ex = r.subsets.find((s) => s.name === "exact-vocab")!;
    process.stdout.write(
      `${pad(r.name, 11)} ${pad(pct(full.top1), 8)} ${pad(pct(sem.top1), 9)} ${pad(pct(ex.top1), 8)} ${pad(pct(r.negRejection), 8)} ${r.bestF1.toFixed(3)}\n`,
    );
  }
}

async function main(): Promise<void> {
  const dir = process.argv[2] ? resolve(process.argv[2]) : DEFAULT_SKILLS_DIR;
  process.stdout.write(`Iris fusion bench-off (v0.3 dataset)\nLibrary: ${dir}\n`);

  const provider = await resolveDefaultProvider({
    onFallback: (r) => process.stderr.write(`[bench] ${r}\n`),
    retries: process.env.CI ? 4 : 0,
    retryDelayMs: 2000,
  });
  const isLexicalFallback = !provider.name.startsWith("transformers");
  if (isLexicalFallback) {
    process.stderr.write(`[bench] semantic model unavailable — rows use the lexical fallback.\n`);
  }

  const lib = new IrisLibrary({ root: dir, provider });
  await lib.load();

  // One embedding pass per unique query, shared across all fusion variants.
  // EXACT_VOCABULARY is a measurement-only slice (not part of ALL_POSITIVES), so
  // include it explicitly or its rows score 0.
  const queries = [
    ...new Set([
      ...ALL_POSITIVES.map((c) => c.query),
      ...EXACT_VOCABULARY.map((c) => c.query),
      ...ALL_NEGATIVES,
    ]),
  ];
  const sig = new Map<string, Signal[]>();
  const t0 = performance.now();
  for (const q of queries) sig.set(q, await lib.signals(q));
  const embedMs = (performance.now() - t0) / queries.length;

  const subsetDefs: { name: string; cases: EvalCase[] }[] = [
    { name: "full", cases: ALL_POSITIVES },
    { name: "semantic-only", cases: SEMANTIC_ONLY },
    { name: "exact-vocab", cases: EXACT_VOCABULARY },
  ];
  const reports: CandidateReport[] = CANDIDATES.map(({ name, cfg }) => ({
    name,
    subsets: subsetDefs.map((d) => subsetMetrics(d.cases, sig, cfg, d.name)),
    ...abstention(sig, cfg),
  }));

  printTable(reports, provider.name);
  process.stdout.write(`\nMean embed/query: ${embedMs.toFixed(2)} ms\n`);

  // Winner = best full-set acc@1, tie-break by semantic-only then abstention F1.
  const fullTop1 = (r: CandidateReport) => r.subsets.find((s) => s.name === "full")!.top1;
  const semOnly = (r: CandidateReport) => r.subsets.find((s) => s.name === "semantic-only")!.top1;
  const winner = [...reports].sort(
    (a, b) => fullTop1(b) - fullTop1(a) || semOnly(b) - semOnly(a) || b.bestF1 - a.bestF1,
  )[0]!;
  process.stdout.write(
    `\nWinner: ${winner.name} — full acc@1 ${pct(fullTop1(winner))}, sem-only ${pct(semOnly(winner))}, absF1 ${winner.bestF1.toFixed(3)}\n`,
  );

  // Guard only when the real model ran: the chosen ranker must clear the
  // recorded full-set baseline. Decision is made on semantic numbers, not the
  // lexical fallback.
  if (!isLexicalFallback && fullTop1(winner) < 0.93) {
    process.stderr.write(`\n[bench] FAIL: winner full-set acc@1 ${pct(fullTop1(winner))} < 93%.\n`);
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    process.stderr.write(`${err instanceof Error ? err.stack : String(err)}\n`);
    process.exit(1);
  });
}
