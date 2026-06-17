// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeAll } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, readFile } from "node:fs/promises";
import {
  IrisLibrary,
  scanLibrary,
  buildTier1Index,
  estimateTokens,
  readLockfile,
} from "../src/index.js";
import { TIER1_TOKEN_BUDGET } from "@iris/protocol";

const here = dirname(fileURLToPath(import.meta.url));
const LIB = join(here, "fixtures", "lib");

describe("scanLibrary", () => {
  it("parses every well-formed skill and collects errors for malformed ones", async () => {
    const { skills, errors } = await scanLibrary(LIB);
    expect(skills.length).toBe(10); // 10 valid + 1 broken
    expect(errors.length).toBe(1);
    expect(errors[0]?.path).toContain("broken-skill");
    expect(errors[0]?.error).toContain("description");
  });

  it("derives ids and discovers bundled scripts", async () => {
    const { skills } = await scanLibrary(LIB);
    const pdf = skills.find((s) => s.id === "pdf-forms");
    expect(pdf).toBeDefined();
    expect(pdf?.metadata.requires.code_execution).toBe(true);
    expect(pdf?.scripts).toContain("scripts/fill.py");
  });
});

describe("buildTier1Index", () => {
  it("emits one deterministic line per skill within the token budget", async () => {
    const { skills } = await scanLibrary(LIB);
    const index = buildTier1Index(skills);
    expect(estimateTokens(index)).toBeLessThanOrEqual(TIER1_TOKEN_BUDGET);
    expect(index).toContain("- pdf-forms — Use when");
    expect(index).toContain("- git-commit — Use when");
    // deterministic: sorted by name, pdf-forms before sql-migrate
    expect(index.indexOf("git-commit")).toBeLessThan(index.indexOf("pdf-forms"));
  });

  it("summarises when over a tight budget rather than dropping awareness", async () => {
    const { skills } = await scanLibrary(LIB);
    const index = buildTier1Index(skills, { budget: 60 });
    expect(estimateTokens(index)).toBeLessThanOrEqual(60);
    expect(index).toMatch(/more skills/);
  });
});

describe("IrisLibrary.find (Tier-2 retrieval)", () => {
  let lib: IrisLibrary;
  beforeAll(async () => {
    lib = new IrisLibrary({ root: LIB, indexPath: join(await mkdtemp(join(tmpdir(), "iris-")), "i.json") });
    await lib.load();
  });

  it("loads all valid skills offline", () => {
    expect(lib.skills().length).toBe(10);
  });

  const cases: [string, string][] = [
    ["I need to fill out a PDF form", "pdf-forms"],
    ["write me a commit message for my staged changes", "git-commit"],
    ["add a migration to alter the database schema", "sql-migrate"],
    ["scrape the prices from this website", "web-scrape"],
    ["remove duplicate rows from my csv file", "csv-clean"],
    ["resize these images into thumbnails", "image-resize"],
    ["help me build a regex for email addresses", "regex-build"],
    ["spin up a postgres and redis container stack", "docker-compose"],
  ];

  it.each(cases)("ranks the right skill first for: %s", async (query, expected) => {
    const results = await lib.find(query, 3);
    expect(results[0]?.id).toBe(expected);
    expect(results[0]?.score).toBeGreaterThan(0);
  });

  it("returns scores in descending order, capped at k", async () => {
    const results = await lib.find("pdf form", 3);
    expect(results.length).toBeLessThanOrEqual(3);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1]!.score).toBeGreaterThanOrEqual(results[i]!.score);
    }
  });
});

describe("lockfile + tier-3 load", () => {
  it("writes and reads back iris.lock with integrity hashes", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "iris-lock-"));
    // point a library at the fixtures but write the lock into tmp root
    const lib = new IrisLibrary({ root: LIB, indexPath: join(tmp, "i.json") });
    await lib.load();
    const lock = await import("../src/lockfile-io.js");
    const built = await lock.buildLockfile(lib.skills(), LIB);
    await lock.writeLockfile(tmp, built);
    const readBack = await readLockfile(tmp);
    expect(readBack.skills.length).toBe(10);
    expect(readBack.skills[0]?.integrity).toMatch(/^sha256:/);
    const raw = await readFile(join(tmp, "iris.lock"), "utf8");
    expect(raw.endsWith("\n")).toBe(true);
  });

  it("loads a full skill body on demand (tier-3)", async () => {
    const lib = new IrisLibrary({ root: LIB });
    await lib.load();
    const body = await lib.loadBody("pdf-forms");
    expect(body).toContain("# pdf-forms");
    expect(body).toContain("## Steps");
  });
});
