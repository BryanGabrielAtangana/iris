// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { Bm25Index, skillTriggerText, scanLibrary } from "@iris-sylvia/core";
import { createEmbeddingProvider } from "@iris-sylvia/embeddings";
import { runAccuracy, DEFAULT_SKILLS_DIR } from "./accuracy.js";
import { matchesExpected } from "./dataset.js";
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

  it("BM25 (token-level lexical) also scores ≤ 40% on the semantic-only subset", async () => {
    // The subset was hardened against the char-n-gram hashing engine; BM25 is a
    // different (token-level, IDF) lexical path. Guard it independently so a case
    // that shares a content word with its skill can't quietly leak in.
    const { skills } = await scanLibrary(DEFAULT_SKILLS_DIR);
    const bm25 = new Bm25Index(
      skills.map((s) => ({ id: s.id, text: skillTriggerText(s), name: s.metadata.name })),
    );
    let hits = 0;
    for (const c of SEMANTIC_ONLY) {
      const top = skills
        .map((s) => ({ id: s.id, score: bm25.score(c.query, s.id) }))
        .sort((a, b) => b.score - a.score)[0];
      if (top && matchesExpected(c.expected, top.id)) hits++;
    }
    expect(hits / SEMANTIC_ONLY.length).toBeLessThanOrEqual(0.4);
  });

  it("produces an abstention curve with a usable operating point", async () => {
    const report = await runAccuracy(createEmbeddingProvider({ kind: "local" }));
    expect(report.curve.length).toBeGreaterThan(5);
    expect(report.bestF1.f1).toBeGreaterThan(0.5);
    expect(report.bestF1.threshold).toBeGreaterThan(0);
  }, 30_000);
});
