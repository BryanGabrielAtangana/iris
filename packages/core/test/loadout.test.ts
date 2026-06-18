// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeAll } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { LoadoutManifest } from "@iris-sylvia/protocol";
import { IrisLibrary, resolveLoadout } from "../src/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const LIB = join(here, "fixtures", "lib");

describe("resolveLoadout", () => {
  let lib: IrisLibrary;
  beforeAll(async () => {
    lib = new IrisLibrary({ root: LIB });
    await lib.load();
  });

  it("selects the declared subset and pins it into a lockfile", async () => {
    const manifest = LoadoutManifest.parse({
      name: "subset",
      skills: ["pdf-forms", "git-commit"],
    });
    const res = await resolveLoadout(manifest, lib.skills(), LIB);
    expect(res.ids.sort()).toEqual(["git-commit", "pdf-forms"]);
    expect(res.errors).toHaveLength(0);
    expect(res.lock.skills.map((s) => s.id).sort()).toEqual(["git-commit", "pdf-forms"]);
    expect(res.lock.skills[0]?.integrity).toMatch(/^sha256:/);
  });

  it("reports declared skills missing from the library", async () => {
    const manifest = LoadoutManifest.parse({ skills: ["pdf-forms", "does-not-exist"] });
    const res = await resolveLoadout(manifest, lib.skills(), LIB);
    expect(res.ids).toEqual(["pdf-forms"]);
    expect(res.errors).toEqual([{ id: "does-not-exist", reason: "not found in library" }]);
  });

  it("rejects an unsatisfied version range", async () => {
    // fixtures are at version 1.0.0; require >=2 to force a mismatch.
    const manifest = LoadoutManifest.parse({
      skills: [{ id: "pdf-forms", version: ">=2.0.0" }],
    });
    const res = await resolveLoadout(manifest, lib.skills(), LIB);
    expect(res.ids).toEqual([]);
    expect(res.errors[0]?.reason).toContain("requires >=2.0.0");
  });

  it("accepts a satisfied version range", async () => {
    const manifest = LoadoutManifest.parse({
      skills: [{ id: "pdf-forms", version: "^1.0.0" }],
    });
    const res = await resolveLoadout(manifest, lib.skills(), LIB);
    expect(res.ids).toEqual(["pdf-forms"]);
  });
});

describe("scoped find (Mode B)", () => {
  let lib: IrisLibrary;
  beforeAll(async () => {
    lib = new IrisLibrary({ root: LIB });
    await lib.load();
  });

  it("bounds discovery to the loadout", async () => {
    // Query clearly matches sql-migrate, but scope excludes it.
    const scopeIds = ["pdf-forms", "git-commit"];
    const results = await lib.find("add a column to the database table", 5, { scopeIds });
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) expect(scopeIds).toContain(r.id);
  });

  it("broadens to the full library only when allowed", async () => {
    // A query whose best match is out of scope, with an empty-ish in-scope set.
    const scopeIds: string[] = [];
    const bounded = await lib.find("resize an image", 3, { scopeIds, allowBroaden: false });
    expect(bounded).toEqual([]);
    const broadened = await lib.find("resize an image", 3, { scopeIds, allowBroaden: true });
    expect(broadened[0]?.id).toBe("image-resize");
  });

  it("scopes the Tier-1 index", async () => {
    const index = lib.buildTier1Index({ scopeIds: ["pdf-forms"] });
    expect(index).toContain("- pdf-forms — Use when");
    expect(index).not.toContain("git-commit —");
  });
});
