// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { IrisLibrary } from "@iris/core";
import {
  ClaudeCodeAdapter,
  ChatAdapter,
  CursorAdapter,
  getAdapter,
  adapterNames,
  upsertManagedBlock,
  renderAwareness,
  IRIS_BLOCK_BEGIN,
} from "../src/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const LIB = join(here, "..", "..", "core", "test", "fixtures", "lib");

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

describe("upsertManagedBlock", () => {
  it("appends a managed block, preserving user content", () => {
    const out = upsertManagedBlock("# My project\n\nHello.", "INDEX");
    expect(out).toContain("# My project");
    expect(out).toContain(IRIS_BLOCK_BEGIN);
    expect(out).toContain("INDEX");
  });

  it("replaces an existing block idempotently", () => {
    const first = upsertManagedBlock("# Doc", "ONE");
    const second = upsertManagedBlock(first, "TWO");
    expect(second).toContain("TWO");
    expect(second).not.toContain("ONE");
    expect(second.split(IRIS_BLOCK_BEGIN).length - 1).toBe(1);
    expect(second).toContain("# Doc");
  });
});

describe("ClaudeCodeAdapter (exec-capable)", () => {
  it("writes skills with scripts and injects the index into CLAUDE.md", async () => {
    const target = await mkdtemp(join(tmpdir(), "iris-cc-"));
    const lib = new IrisLibrary({ root: LIB });
    await lib.load();
    const adapter = new ClaudeCodeAdapter();
    const ctx = { targetDir: target };

    await adapter.writeSkills(lib.skills(), ctx);
    const indexFile = await adapter.writeIndex(lib.buildTier1Index(), ctx);

    const { skillsDir } = adapter.location(ctx);
    expect(await exists(join(skillsDir, "pdf-forms", "SKILL.md"))).toBe(true);
    expect(await exists(join(skillsDir, "pdf-forms", "scripts", "fill.py"))).toBe(true);

    const claudeMd = await readFile(indexFile, "utf8");
    expect(claudeMd).toContain("- pdf-forms — Use when");
    // The behavioral directive must ride along so skills fire automatically.
    expect(claudeMd).toContain("call `iris_find`");
    expect(indexFile.endsWith("CLAUDE.md")).toBe(true);
  });

  it("preserves pre-existing CLAUDE.md content on sync", async () => {
    const target = await mkdtemp(join(tmpdir(), "iris-cc2-"));
    await writeFile(join(target, "CLAUDE.md"), "# Existing rules\n\nBe nice.\n", "utf8");
    const lib = new IrisLibrary({ root: LIB });
    await lib.load();
    const adapter = new ClaudeCodeAdapter();
    const ctx = { targetDir: target };
    await adapter.writeIndex(lib.buildTier1Index(), ctx);
    const claudeMd = await readFile(join(target, "CLAUDE.md"), "utf8");
    expect(claudeMd).toContain("# Existing rules");
    expect(claudeMd).toContain(IRIS_BLOCK_BEGIN);
  });
});

describe("ChatAdapter (graceful degradation)", () => {
  it("omits scripts on chat-only surfaces", async () => {
    const target = await mkdtemp(join(tmpdir(), "iris-chat-"));
    const lib = new IrisLibrary({ root: LIB });
    await lib.load();
    const adapter = new ChatAdapter();
    const ctx = { targetDir: target };
    await adapter.writeSkills(lib.skills(), ctx);
    const { skillsDir } = adapter.location(ctx);
    expect(await exists(join(skillsDir, "pdf-forms", "SKILL.md"))).toBe(true);
    expect(await exists(join(skillsDir, "pdf-forms", "scripts", "fill.py"))).toBe(false);
  });
});

describe("CursorAdapter (always-applied rule)", () => {
  it("writes an alwaysApply .mdc rule carrying the directive and Tier-1 index", async () => {
    const target = await mkdtemp(join(tmpdir(), "iris-cursor-"));
    const lib = new IrisLibrary({ root: LIB });
    await lib.load();
    const adapter = new CursorAdapter();
    const ctx = { targetDir: target };

    await adapter.writeSkills(lib.skills(), ctx);
    const indexFile = await adapter.writeIndex(lib.buildTier1Index(), ctx);

    expect(indexFile).toBe(join(target, ".cursor", "rules", "iris.mdc"));
    const mdc = await readFile(indexFile, "utf8");
    expect(mdc).toContain("alwaysApply: true");
    expect(mdc).toContain("call `iris_find`");
    expect(mdc).toContain("- pdf-forms — Use when");
    // skills are also copied for non-MCP reference
    expect(await exists(join(target, ".cursor", "skills", "pdf-forms", "SKILL.md"))).toBe(true);
  });

  it("regenerates the rule wholesale on re-sync (idempotent, single frontmatter)", async () => {
    const target = await mkdtemp(join(tmpdir(), "iris-cursor2-"));
    const lib = new IrisLibrary({ root: LIB });
    await lib.load();
    const adapter = new CursorAdapter();
    const ctx = { targetDir: target };
    await adapter.writeIndex(lib.buildTier1Index(), ctx);
    const file = await adapter.writeIndex(lib.buildTier1Index(), ctx);
    const mdc = await readFile(file, "utf8");
    expect(mdc.split("alwaysApply: true").length - 1).toBe(1);
  });
});

describe("renderAwareness", () => {
  it("prefixes the index with the behavioral directive", () => {
    const out = renderAwareness("- foo — bar");
    expect(out).toContain("call `iris_find`");
    expect(out).toContain("- foo — bar");
    expect(out.indexOf("iris_find")).toBeLessThan(out.indexOf("- foo — bar"));
  });
});

describe("getAdapter", () => {
  it("resolves built-in adapters by name", () => {
    expect(getAdapter("claude-code")?.name).toBe("claude-code");
    expect(getAdapter("codex")?.name).toBe("codex");
    expect(getAdapter("cursor")?.name).toBe("cursor");
    expect(getAdapter("nope")).toBeUndefined();
  });

  it("lists all built-in adapter names", () => {
    expect(adapterNames()).toEqual(
      expect.arrayContaining(["claude-code", "codex", "cursor", "chat"]),
    );
  });
});
