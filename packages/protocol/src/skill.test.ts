// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import {
  parseSkillMetadata,
  safeParseSkillMetadata,
  SkillValidationError,
  generateJsonSchema,
} from "./index.js";

describe("parseSkillMetadata", () => {
  it("parses a minimal valid skill into a typed object with defaults", () => {
    const meta = parseSkillMetadata({
      name: "pdf-forms",
      description: "Fill, extract, or merge PDF documents and forms.",
    });
    expect(meta.name).toBe("pdf-forms");
    expect(meta.version).toBe("0.0.0");
    expect(meta.examples).toEqual([]);
    expect(meta.tags).toEqual([]);
    expect(meta.requires.code_execution).toBe(false);
    expect(meta.requires.mcp_servers).toEqual([]);
  });

  it("retains Iris extension fields", () => {
    const meta = parseSkillMetadata({
      name: "git-commit",
      description: "Write commit messages from staged changes.",
      when_to_use: "Use when writing commit messages from staged changes.",
      when_not_to_use: "Do not use for rebasing or history rewrites.",
      examples: ["commit my changes", "write a commit message"],
      tags: ["git", "vcs"],
      version: "1.2.3",
      requires: { code_execution: true },
    });
    expect(meta.when_to_use).toContain("commit");
    expect(meta.examples).toHaveLength(2);
    expect(meta.version).toBe("1.2.3");
    expect(meta.requires.code_execution).toBe(true);
  });

  it("tolerates unknown frontmatter keys (passthrough)", () => {
    const meta = parseSkillMetadata({
      name: "x",
      description: "y",
      author: "someone",
      "x-custom": 42,
    }) as Record<string, unknown>;
    expect(meta.author).toBe("someone");
    expect(meta["x-custom"]).toBe(42);
  });

  it("throws SkillValidationError with a useful message on missing name", () => {
    try {
      parseSkillMetadata({ description: "no name here" });
      throw new Error("expected to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(SkillValidationError);
      expect((err as SkillValidationError).message).toContain("name");
    }
  });

  it("rejects an over-long name", () => {
    const res = safeParseSkillMetadata({
      name: "a".repeat(65),
      description: "valid description",
    });
    expect(res.ok).toBe(false);
  });

  it("rejects a missing description", () => {
    const res = safeParseSkillMetadata({ name: "valid-name" });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.message).toContain("description");
    }
  });
});

describe("generateJsonSchema", () => {
  it("produces a JSON Schema object describing skill metadata", () => {
    const schema = generateJsonSchema();
    expect(schema).toHaveProperty("$schema");
    const json = JSON.stringify(schema);
    expect(json).toContain("name");
    expect(json).toContain("description");
    expect(json).toContain("when_to_use");
  });
});
