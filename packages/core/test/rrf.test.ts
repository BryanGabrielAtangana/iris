// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { rrfFuse } from "../src/index.js";

describe("rrfFuse", () => {
  it("rewards an item present in both rankings over a single-list leader", () => {
    // A tops dense only; B tops sparse only; C and D appear in both lists.
    const dense = [
      { id: "A", score: 0.9 },
      { id: "C", score: 0.7 },
      { id: "D", score: 0.5 },
    ];
    const sparse = [
      { id: "B", score: 5 },
      { id: "C", score: 4 },
      { id: "D", score: 1 },
    ];
    const fused = rrfFuse([dense, sparse]);
    const ranked = [...fused.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
    // C is #2 in both → clear winner; A and B each top one list but are absent
    // from the other, so they trail both two-list items.
    expect(ranked[0]).toBe("C");
    expect(ranked.indexOf("A")).toBeGreaterThan(ranked.indexOf("D"));
    expect(ranked.indexOf("B")).toBeGreaterThan(ranked.indexOf("D"));
  });

  it("is scale-free: multiplying one list's raw scores doesn't change the fusion", () => {
    const dense = [
      { id: "A", score: 0.9 },
      { id: "B", score: 0.1 },
    ];
    const sparse = [
      { id: "B", score: 2 },
      { id: "A", score: 1 },
    ];
    const a = rrfFuse([dense, sparse]);
    const b = rrfFuse([dense.map((x) => ({ ...x, score: x.score * 1000 })), sparse]);
    expect(a.get("A")).toBeCloseTo(b.get("A")!);
    expect(a.get("B")).toBeCloseTo(b.get("B")!);
  });

  it("falls back to a single ranking when only one list is given", () => {
    const only = [
      { id: "X", score: 0.5 },
      { id: "Y", score: 0.4 },
    ];
    const fused = rrfFuse([only]);
    expect(fused.get("X")).toBeGreaterThan(fused.get("Y")!);
  });
});
