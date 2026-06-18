// SPDX-License-Identifier: Apache-2.0
import type { FindResult } from "@iris-sylvia/core";
import { DATASET, type EvalCase } from "./dataset.js";

export interface Metrics {
  total: number;
  top1: number; // accuracy @1
  top3: number; // accuracy @3
  mrr: number; // mean reciprocal rank
}

export interface Retriever {
  find(query: string, k: number): Promise<FindResult[]>;
}

/** Evaluate a retriever over the labeled dataset. */
export async function evaluate(
  retriever: Retriever,
  cases: EvalCase[] = DATASET,
): Promise<Metrics> {
  let top1 = 0;
  let top3 = 0;
  let rrSum = 0;
  for (const c of cases) {
    const results = await retriever.find(c.query, 5);
    const rank = results.findIndex((r) => r.id === c.expected); // 0-based, -1 if absent
    if (rank === 0) top1++;
    if (rank >= 0 && rank < 3) top3++;
    if (rank >= 0) rrSum += 1 / (rank + 1);
  }
  const total = cases.length;
  return {
    total,
    top1: top1 / total,
    top3: top3 / total,
    mrr: rrSum / total,
  };
}

export function formatMetrics(label: string, m: Metrics): string {
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  return `${label.padEnd(10)}  acc@1 ${pct(m.top1).padStart(6)}   acc@3 ${pct(m.top3).padStart(6)}   MRR ${m.mrr.toFixed(3)}`;
}
