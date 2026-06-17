// SPDX-License-Identifier: Apache-2.0
import { zodToJsonSchema } from "zod-to-json-schema";
import { SkillMetadata } from "./skill.js";
import { Lockfile } from "./lockfile.js";

/**
 * Generate a JSON Schema for skill metadata so non-TypeScript consumers can
 * validate `SKILL.md` frontmatter without importing zod.
 */
export function generateJsonSchema(): Record<string, unknown> {
  return zodToJsonSchema(SkillMetadata, {
    name: "SkillMetadata",
    $refStrategy: "none",
  }) as Record<string, unknown>;
}

/** JSON Schema for `iris.lock`. */
export function generateLockfileJsonSchema(): Record<string, unknown> {
  return zodToJsonSchema(Lockfile, {
    name: "IrisLockfile",
    $refStrategy: "none",
  }) as Record<string, unknown>;
}
