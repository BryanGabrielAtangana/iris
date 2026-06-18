// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { confidence, assessTop1, scoreStats, DEFAULT_CONFIDENCE } from "../src/index.js";

describe("confidence", () => {
  it("rises with a higher top score, a wider margin, and a higher z", () => {
    const low = confidence(0.3, 0.02, 0.5);
    const high = confidence(0.8, 0.3, 3);
    expect(high).toBeGreaterThan(low);
    expect(high).toBeLessThanOrEqual(1);
    expect(low).toBeGreaterThanOrEqual(0);
  });

  it("rewards a standout winner over a near-tie at the same top score", () => {
    const standout = confidence(0.6, 0.4, 3);
    const nearTie = confidence(0.6, 0.0, 0.2);
    expect(standout).toBeGreaterThan(nearTie);
  });
});

describe("assessTop1", () => {
  it("flags noStrongMatch on an empty candidate set", () => {
    expect(assessTop1([]).noStrongMatch).toBe(true);
  });

  it("does not flag a clear standout winner", () => {
    const a = assessTop1([0.82, 0.18, 0.12, 0.09]);
    expect(a.noStrongMatch).toBe(false);
    expect(a.confidence).toBeGreaterThan(DEFAULT_CONFIDENCE.threshold);
  });

  it("flags a flat distribution where nothing stands out", () => {
    const a = assessTop1([0.22, 0.2, 0.19, 0.18]);
    expect(a.noStrongMatch).toBe(true);
  });
});

describe("scoreStats", () => {
  it("computes mean and std", () => {
    const { mean, std } = scoreStats([1, 1, 1]);
    expect(mean).toBe(1);
    expect(std).toBe(0);
  });
});
