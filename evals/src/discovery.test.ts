// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { PROBES, matchesProbe } from "./discovery-probes.js";

describe("discovery probe set", () => {
  it("has ~30 probes across all four categories", () => {
    expect(PROBES.length).toBeGreaterThanOrEqual(25);
    for (const c of ["obvious", "paraphrase", "near-miss", "ambiguous"] as const) {
      expect(PROBES.filter((p) => p.category === c).length).toBeGreaterThan(0);
    }
  });

  it("has unique ids and never names a skill in the prompt", () => {
    const ids = new Set<string>();
    for (const p of PROBES) {
      expect(ids.has(p.id)).toBe(false);
      ids.add(p.id);
      // A blind probe must not contain the target skill id verbatim.
      const targets = p.expect === null ? [] : Array.isArray(p.expect) ? p.expect : [p.expect];
      for (const t of targets) expect(p.prompt.toLowerCase()).not.toContain(t);
    }
  });

  it("matchesProbe handles single, any-of, and near-miss (null) expectations", () => {
    expect(matchesProbe("git-commit-message", "git-commit-message")).toBe(true);
    expect(matchesProbe(["a", "b"], "b")).toBe(true);
    expect(matchesProbe(["a", "b"], "c")).toBe(false);
    expect(matchesProbe(null, "anything")).toBe(false);
  });
});
