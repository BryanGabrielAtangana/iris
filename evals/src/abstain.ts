// SPDX-License-Identifier: Apache-2.0
//
// Abstention calibration: find the confidence formula + threshold that rejects
// the most off-topic queries while almost never flagging a correct answer.
// "Rejection" = flagging `noStrongMatch`. Target (spec): rejection-recall ≥ 90%
// at precision ≥ 95% on the full + near-miss-negative slices.
import { resolve } from "node:path";
import { IrisLibrary, confidence, scoreStats, type ConfidenceParams } from "@iris-sylvia/core";
import { resolveDefaultProvider } from "@iris-sylvia/embeddings";
import { matchesExpected, type EvalCase } from "./dataset.js";
import { DEFAULT_SKILLS_DIR } from "./accuracy.js";
import { POSITIVES, AMBIGUOUS, NEGATIVES_OOD, NEGATIVES_NEARMISS } from "./v3.js";

const ALL_POSITIVES: EvalCase[] = [...POSITIVES, ...AMBIGUOUS];
const ALL_NEGATIVES: string[] = [...NEGATIVES_OOD, ...NEGATIVES_NEARMISS];

interface Features {
  top1: number;
  margin: number;
  z: number;
}

const SCALES = { marginScale: 0.25, zScale: 2.5 };

/** Confidence formulas under test (which signals, how weighted). */
const FORMULAS: { name: string; w: Pick<ConfidenceParams, "wTop1" | "wMargin" | "wZ"> }[] = [
  { name: "top1-only", w: { wTop1: 1, wMargin: 0, wZ: 0 } },
  { name: "top1+margin", w: { wTop1: 0.6, wMargin: 0.4, wZ: 0 } },
  { name: "top1+z", w: { wTop1: 0.6, wMargin: 0, wZ: 0.4 } },
  { name: "margin+z", w: { wTop1: 0, wMargin: 0.5, wZ: 0.5 } },
  { name: "even", w: { wTop1: 0.5, wMargin: 0.25, wZ: 0.25 } },
  { name: "z-heavy", w: { wTop1: 0.4, wMargin: 0.2, wZ: 0.4 } },
];

function featuresOf(scores: number[]): Features {
  const sorted = [...scores].sort((a, b) => b - a);
  const top1 = sorted[0] ?? 0;
  const top2 = sorted[1] ?? 0;
  const { mean, std } = scoreStats(scores);
  return { top1, margin: top1 - top2, z: std > 0 ? (top1 - mean) / std : 0 };
}

interface OperatingPoint {
  recall: number;
  precision: number;
  threshold: number;
  posFlagged: number;
}

/**
 * Best rejection recall at precision ≥ target. `accept` = correct positives
 * (must NOT be flagged); `reject` = negatives (should be flagged). Flag when
 * confidence < τ.
 */
function bestOperatingPoint(
  acceptConf: number[],
  rejectConf: number[],
  minPrecision: number,
): OperatingPoint {
  const all = [...acceptConf, ...rejectConf].sort((a, b) => a - b);
  let best: OperatingPoint = { recall: 0, precision: 1, threshold: 0, posFlagged: 0 };
  // Try every threshold = a candidate confidence value (plus a hair above).
  for (const c of all) {
    const t = c + 1e-9;
    const negFlagged = rejectConf.filter((x) => x < t).length;
    const posFlagged = acceptConf.filter((x) => x < t).length;
    const flagged = negFlagged + posFlagged;
    const precision = flagged ? negFlagged / flagged : 1;
    const recall = negFlagged / (rejectConf.length || 1);
    if (precision >= minPrecision && recall > best.recall) {
      best = { recall, precision, threshold: t, posFlagged };
    }
  }
  return best;
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const pad = (s: string, n: number) => s.padEnd(n);

async function main(): Promise<void> {
  const dir = process.argv[2] ? resolve(process.argv[2]) : DEFAULT_SKILLS_DIR;
  process.stdout.write(`Iris abstention calibration (v0.3 dataset)\nLibrary: ${dir}\n`);

  const provider = await resolveDefaultProvider({
    onFallback: (r) => process.stderr.write(`[abstain] ${r}\n`),
    retries: process.env.CI ? 4 : 0,
    retryDelayMs: 2000,
  });
  const isLexicalFallback = !provider.name.startsWith("transformers");
  if (isLexicalFallback) process.stderr.write(`[abstain] using lexical fallback — numbers are rough.\n`);

  const lib = new IrisLibrary({ root: dir, provider });
  await lib.load();

  // Features for correct positives (accept) and negatives (reject).
  const acceptFeat: Features[] = [];
  for (const c of ALL_POSITIVES) {
    const r = await lib.find(c.query, 999);
    if (r[0] && matchesExpected(c.expected, r[0].id)) acceptFeat.push(featuresOf(r.map((x) => x.score)));
  }
  const rejectFeat: Features[] = [];
  for (const q of ALL_NEGATIVES) {
    const r = await lib.find(q, 999);
    rejectFeat.push(featuresOf(r.map((x) => x.score)));
  }

  process.stdout.write(`\nModel: ${provider.name}   (accept ${acceptFeat.length}, reject ${rejectFeat.length})\n`);
  process.stdout.write(
    `${pad("formula", 13)} ${pad("rej-recall", 11)} ${pad("precision", 10)} ${pad("threshold", 10)} pos-flagged\n`,
  );
  process.stdout.write(`${"-".repeat(58)}\n`);

  let winner: { name: string; w: (typeof FORMULAS)[number]["w"]; op: OperatingPoint } | undefined;
  for (const f of FORMULAS) {
    const params: ConfidenceParams = { ...f.w, ...SCALES, threshold: 0.5 };
    const acc = acceptFeat.map((x) => confidence(x.top1, x.margin, x.z, params));
    const rej = rejectFeat.map((x) => confidence(x.top1, x.margin, x.z, params));
    const op = bestOperatingPoint(acc, rej, 0.95);
    process.stdout.write(
      `${pad(f.name, 13)} ${pad(pct(op.recall), 11)} ${pad(pct(op.precision), 10)} ${pad(op.threshold.toFixed(3), 10)} ${op.posFlagged}/${acceptFeat.length}\n`,
    );
    if (!winner || op.recall > winner.op.recall) winner = { name: f.name, w: f.w, op };
  }

  if (winner) {
    process.stdout.write(
      `\nWinner: ${winner.name} — rejection-recall ${pct(winner.op.recall)} @ precision ${pct(winner.op.precision)}, threshold ${winner.op.threshold.toFixed(3)}\n`,
    );
    process.stdout.write(
      `Set DEFAULT_CONFIDENCE: { wTop1: ${winner.w.wTop1}, wMargin: ${winner.w.wMargin}, wZ: ${winner.w.wZ}, marginScale: ${SCALES.marginScale}, zScale: ${SCALES.zScale}, threshold: ${winner.op.threshold.toFixed(3)} }\n`,
    );
  }

  // Gate (real model only): the calibrated point must clear the spec target.
  if (!isLexicalFallback && winner && winner.op.recall < 0.9) {
    process.stderr.write(`\n[abstain] FAIL: best rejection-recall ${pct(winner.op.recall)} < 90% @ P≥95%.\n`);
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    process.stderr.write(`${err instanceof Error ? err.stack : String(err)}\n`);
    process.exit(1);
  });
}
