// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, stat, readFile, cp, mkdir } from "node:fs/promises";
import { buildProgram } from "../src/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PDF = join(here, "..", "..", "core", "test", "fixtures", "lib", "pdf-forms");
const FIXTURE_GIT = join(here, "..", "..", "core", "test", "fixtures", "lib", "git-commit");

let out = "";
let libRoot = "";
let prevEnv: string | undefined;

async function run(...args: string[]): Promise<void> {
  await buildProgram().parseAsync(["node", "iris", ...args]);
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

beforeEach(async () => {
  out = "";
  vi.spyOn(process.stdout, "write").mockImplementation((chunk: string | Uint8Array) => {
    out += chunk.toString();
    return true;
  });
  libRoot = await mkdtemp(join(tmpdir(), "iris-cli-"));
  prevEnv = process.env.IRIS_LIBRARY;
  process.env.IRIS_LIBRARY = libRoot;
});

afterEach(() => {
  vi.restoreAllMocks();
  if (prevEnv === undefined) delete process.env.IRIS_LIBRARY;
  else process.env.IRIS_LIBRARY = prevEnv;
  process.exitCode = 0;
});

describe("iris CLI end-to-end", () => {
  it("init creates iris.lock", async () => {
    await run("init");
    expect(await exists(join(libRoot, "iris.lock"))).toBe(true);
    expect(out).toContain("Initialized Iris library");
  });

  it("add imports and validates a skill, search ranks it, sync writes surfaces", async () => {
    await run("init");

    // Stage skill sources outside the library so `add` copies them in.
    const stage = await mkdtemp(join(tmpdir(), "iris-src-"));
    await cp(FIXTURE_PDF, join(stage, "pdf-forms"), { recursive: true });
    await cp(FIXTURE_GIT, join(stage, "git-commit"), { recursive: true });

    out = "";
    await run("add", join(stage, "pdf-forms"));
    expect(out).toContain("Added skill");
    expect(await exists(join(libRoot, "pdf-forms", "SKILL.md"))).toBe(true);
    await run("add", join(stage, "git-commit"));

    out = "";
    await run("search", "fill", "out", "a", "pdf", "form");
    expect(out).toMatch(/pdf-forms/);
    expect(out.indexOf("pdf-forms")).toBeGreaterThan(-1);

    // sync into a separate project target
    const target = await mkdtemp(join(tmpdir(), "iris-target-"));
    out = "";
    await run("sync", "--target", target);
    expect(out).toContain("[claude-code]");
    expect(await exists(join(target, ".claude", "skills", "pdf-forms", "SKILL.md"))).toBe(true);
    const claudeMd = await readFile(join(target, "CLAUDE.md"), "utf8");
    expect(claudeMd).toContain("- pdf-forms — Use when");
  });

  it("sync supports multiple adapters and degrades on chat-only surfaces", async () => {
    await mkdir(join(libRoot, "pdf-forms"), { recursive: true });
    await cp(FIXTURE_PDF, join(libRoot, "pdf-forms"), { recursive: true });
    const target = await mkdtemp(join(tmpdir(), "iris-target2-"));
    out = "";
    await run("sync", "--adapter", "codex,chat", "--target", target);
    expect(await exists(join(target, "AGENTS.md"))).toBe(true);
    expect(await exists(join(target, "IRIS.md"))).toBe(true);
    // chat adapter omits scripts
    expect(await exists(join(target, "iris-skills", "pdf-forms", "scripts", "fill.py"))).toBe(
      false,
    );
    expect(out).toContain("instructions only");
  });

  it("doctor reports a healthy library", async () => {
    await cp(FIXTURE_PDF, join(libRoot, "pdf-forms"), { recursive: true });
    out = "";
    await run("doctor");
    expect(out).toContain("Iris doctor");
    expect(out).toContain("skill(s) indexed");
    expect(out).toContain("Tier-1 index");
  });

  it("remove deletes a skill and re-pins the lock", async () => {
    await cp(FIXTURE_PDF, join(libRoot, "pdf-forms"), { recursive: true });
    await run("remove", "pdf-forms");
    expect(await exists(join(libRoot, "pdf-forms"))).toBe(false);
  });
});
