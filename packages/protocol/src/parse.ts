// SPDX-License-Identifier: Apache-2.0
import { z } from "zod";
import { SkillMetadata } from "./skill.js";

export class SkillValidationError extends Error {
  readonly issues: z.ZodIssue[];
  constructor(message: string, issues: z.ZodIssue[]) {
    super(message);
    this.name = "SkillValidationError";
    this.issues = issues;
  }
}

/**
 * Validate an already-parsed frontmatter object against {@link SkillMetadata}.
 * Throws {@link SkillValidationError} with a readable, field-pointed message
 * when validation fails.
 */
export function parseSkillMetadata(frontmatter: unknown): SkillMetadata {
  const result = SkillMetadata.safeParse(frontmatter);
  if (!result.success) {
    const detail = result.error.issues
      .map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
      .join("; ");
    throw new SkillValidationError(`Invalid skill metadata: ${detail}`, result.error.issues);
  }
  return result.data;
}

/** Non-throwing variant returning a discriminated result. */
export function safeParseSkillMetadata(
  frontmatter: unknown,
): { ok: true; data: SkillMetadata } | { ok: false; error: SkillValidationError } {
  try {
    return { ok: true, data: parseSkillMetadata(frontmatter) };
  } catch (error) {
    return { ok: false, error: error as SkillValidationError };
  }
}
