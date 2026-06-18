// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { createEmbeddingProvider } from "@iris-sylvia/embeddings";
import { runAccuracy } from "./accuracy.js";
import { POSITIVES, AMBIGUOUS, SEMANTIC_ONLY, NEGATIVES_OOD, NEGATIVES_NEARMISS } from "./v3.js";

describe("v0.3 dataset shape", () => {
  it("has ≥ 100 positives and ≥ 50 negatives", () => {
    expect(POSITIVES.length + AMBIGUOUS.length).toBeGreaterThanOrEqual(100);
    expect(NEGATIVES_OOD.length + NEGATIVES_NEARMISS.length).toBeGreaterThanOrEqual(50);
  });

  it("has a meaningful semantic-only subset and near-miss negatives", () => {
    expect(SEMANTIC_ONLY.length).toBeGreaterThanOrEqual(15);
    expect(NEGATIVES_NEARMISS.length).toBeGreaterThanOrEqual(10);
  });
});

describe("Task-0 gate: the eval isolates meaning", () => {
  it("lexical engine scores ≤ 40% acc@1 on the semantic-only subset", async () => {
    // If this regresses above 40%, the semantic-only cases have started leaking
    // surface form — rewrite them, do not relax the gate.
    const report = await runAccuracy(createEmbeddingProvider({ kind: "local" }));
    expect(report.semanticOnlyTop1).toBeLessThanOrEqual(0.4);
  }, 30_000);

  it("produces an abstention curve with a usable operating point", async () => {
    const report = await runAccuracy(createEmbeddingProvider({ kind: "local" }));
    expect(report.curve.length).toBeGreaterThan(5);
    expect(report.bestF1.f1).toBeGreaterThan(0.5);
    expect(report.bestF1.threshold).toBeGreaterThan(0);
  }, 30_000);
});
