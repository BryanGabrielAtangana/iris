// SPDX-License-Identifier: Apache-2.0
import { z } from "zod";

/**
 * A single pinned skill entry in `iris.lock`.
 */
export const LockEntry = z.object({
  /** Stable skill id (folder-derived or `@namespace/skill`). */
  id: z.string().min(1),
  /** Resolved semver version at pin time. */
  version: z.string().default("0.0.0"),
  /** Source of the skill: a local path or a registry/git ref. */
  source: z.string(),
  /** Content hash (sha256) of the skill directory for integrity. */
  integrity: z.string().optional(),
});

export type LockEntry = z.infer<typeof LockEntry>;

/**
 * `iris.lock` — JSON, the only persisted manifest of a library's pinned
 * skills. There is intentionally no database here beyond the vector index.
 */
export const Lockfile = z.object({
  lockfileVersion: z.literal(1).default(1),
  skills: z.array(LockEntry).default([]),
});

export type Lockfile = z.infer<typeof Lockfile>;

export const EMPTY_LOCKFILE: Lockfile = { lockfileVersion: 1, skills: [] };
