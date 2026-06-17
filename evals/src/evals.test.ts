// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { runBenchmark } from "./run.js";

describe("discovery benchmark", () => {
  it("Iris meaningfully beats the naive flat-description baseline (the core claim)", async () => {
    const { iris, baseline } = await runBenchmark();
    // Sanity: the benchmark actually ran over the labeled set.
    expect(iris.total).toBeGreaterThanOrEqual(20);
    // The product claim: richer metadata + hybrid ranking wins.
    expect(iris.top1).toBeGreaterThan(baseline.top1);
    expect(iris.mrr).toBeGreaterThan(baseline.mrr);
    // Iris should be strong in absolute terms too.
    expect(iris.top1).toBeGreaterThanOrEqual(0.8);
  }, 30_000);
});
