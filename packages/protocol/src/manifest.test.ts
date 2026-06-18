// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { LoadoutManifest, normalizeManifestSkill } from "./index.js";

describe("LoadoutManifest", () => {
  it("parses a manifest with string and object skill entries + defaults", () => {
    const m = LoadoutManifest.parse({
      name: "mail-agent",
      skills: ["git-commit-message", { id: "pdf-forms", version: "^1.0.0" }],
    });
    expect(m.manifestVersion).toBe(1);
    expect(m.policy.allowBroaden).toBe(false);
    expect(m.skills).toHaveLength(2);
  });

  it("normalizes entries to { id, version }", () => {
    expect(normalizeManifestSkill("a")).toEqual({ id: "a", version: "*" });
    expect(normalizeManifestSkill({ id: "b", version: "1.2.3" })).toEqual({
      id: "b",
      version: "1.2.3",
    });
  });

  it("defaults an empty manifest", () => {
    const m = LoadoutManifest.parse({});
    expect(m.skills).toEqual([]);
    expect(m.policy.allowBroaden).toBe(false);
  });
});
