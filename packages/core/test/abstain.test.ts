// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { confidence, assessTop1, scoreStats, DEFAULT_CONFIDENCE } from "../src/index.js";

// Exercises the confidence() math with explicit weights. The shipped default is
// top1-only (margin/z weights 0) because calibration showed they hurt; these
// verify the function still combines all three when asked.
const W = { wTop1: 0.5, wMargin: 0.25, wZ: 0.25, marginScale: 0.25, zScale: 2.5, threshold: 0.5 };

describe("confidence", () => {
  it("rises with a higher top score, a wider margin, and a higher z", () => {
    const low = confidence(0.3, 0.02, 0.5, W);
    const high = confidence(0.8, 0.3, 3, W);
    expect(high).toBeGreaterThan(low);
    expect(high).toBeLessThanOrEqual(1);
    expect(low).toBeGreaterThanOrEqual(0);
  });

  it("rewards a standout winner over a near-tie at the same top score", () => {
    const standout = confidence(0.6, 0.4, 3, W);
    const nearTie = confidence(0.6, 0.0, 0.2, W);
    expect(standout).toBeGreaterThan(nearTie);
  });

  it("is top-1 only under the shipped default (margin/z ignored)", () => {
    expect(confidence(0.6, 0.4, 3)).toBeCloseTo(confidence(0.6, 0, 0));
  });
});

describe("assessTop1 (calibrated default is top1-only)", () => {
  it("flags noStrongMatch on an empty candidate set", () => {
    expect(assessTop1([]).noStrongMatch).toBe(true);
  });

  it("does not flag a confident top score", () => {
    const a = assessTop1([0.62, 0.18, 0.12, 0.09]);
    expect(a.noStrongMatch).toBe(false);
    expect(a.confidence).toBeGreaterThan(DEFAULT_CONFIDENCE.threshold);
  });

  it("flags when the best candidate scores below the threshold", () => {
    const a = assessTop1([0.12, 0.1, 0.09, 0.08]);
    expect(a.noStrongMatch).toBe(true);
    expect(a.confidence).toBeLessThan(DEFAULT_CONFIDENCE.threshold);
  });
});

describe("scoreStats", () => {
  it("computes mean and std", () => {
    const { mean, std } = scoreStats([1, 1, 1]);
    expect(mean).toBe(1);
    expect(std).toBe(0);
  });
});
