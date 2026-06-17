// SPDX-License-Identifier: Apache-2.0
import { z } from "zod";

/**
 * Skill metadata parsed from `SKILL.md` YAML frontmatter.
 *
 * The first two fields (`name`, `description`) are the Anthropic skill-format
 * requirements. Everything else is an Iris extension that exists to make
 * two-tier discovery reliable. All extensions are optional so that plain
 * Anthropic skills load unchanged, but the index is far better when they are
 * present.
 */
export const SkillRequires = z
  .object({
    /** MCP servers this skill expects to be connected. */
    mcp_servers: z.array(z.string()).default([]),
    /** Package dependencies the skill's scripts assume. */
    packages: z.array(z.string()).default([]),
    /** True when the skill needs a filesystem/exec-capable surface. */
    code_execution: z.boolean().default(false),
  })
  .default({});

export type SkillRequires = z.infer<typeof SkillRequires>;

export const SkillMetadata = z
  .object({
    name: z.string().min(1).max(64), // required (Anthropic spec)
    description: z.string().min(1).max(1024), // required (Anthropic spec)

    // --- Iris extensions for reliable discovery (optional; the index uses them) ---
    /** Drives the Tier-1 one-liner. Short, imperative "Use when…" guidance. */
    when_to_use: z.string().max(280).optional(),
    /** Negative guidance that keeps the skill from over-firing. */
    when_not_to_use: z.string().max(280).optional(),
    /** Example user intents that should trigger this skill. */
    examples: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
    version: z.string().default("0.0.0"), // semver
    license: z.string().optional(),
    requires: SkillRequires,
  })
  .passthrough(); // tolerate unknown frontmatter keys

export type SkillMetadata = z.infer<typeof SkillMetadata>;

/**
 * A fully-resolved skill: parsed metadata plus locations and body.
 * `id` is the stable identifier used across the MCP surface (`skill://<id>`).
 */
export const Skill = z.object({
  id: z.string().min(1),
  metadata: SkillMetadata,
  /** Absolute path to the skill directory. */
  dir: z.string(),
  /** Absolute path to the SKILL.md file. */
  path: z.string(),
  /** Markdown body (everything after the frontmatter). */
  body: z.string(),
  /** Relative paths to reference files, scripts and assets, if present. */
  references: z.array(z.string()).default([]),
  scripts: z.array(z.string()).default([]),
  assets: z.array(z.string()).default([]),
});

export type Skill = z.infer<typeof Skill>;
