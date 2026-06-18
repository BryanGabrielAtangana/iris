// SPDX-License-Identifier: Apache-2.0
import { z } from "zod";

/**
 * A single entry in a loadout: either a bare skill id (any version) or an id
 * with a semver range. Namespace globs (e.g. `@acme/*`) are accepted as ids for
 * forward-compatibility with the registry; they resolve to nothing against a
 * purely local library today.
 */
export const ManifestSkill = z.union([
  z.string().min(1),
  z.object({
    id: z.string().min(1),
    version: z.string().default("*"),
  }),
]);

export type ManifestSkill = z.infer<typeof ManifestSkill>;

/**
 * `iris.json` — a developer-authored **loadout**: the declared, version-pinned
 * subset of skills an agent is scoped to (Mode B). This is the package.json of
 * skills: explicit, reproducible, focused.
 */
export const LoadoutManifest = z.object({
  manifestVersion: z.literal(1).default(1),
  /** Optional human label for the loadout. */
  name: z.string().optional(),
  /** The declared skills (ids, optionally with version ranges). */
  skills: z.array(ManifestSkill).default([]),
  policy: z
    .object({
      /**
       * When true, scoped `find_skill` may fall back to the full library if
       * nothing in the loadout matches. Defaults to false (bounded discovery).
       */
      allowBroaden: z.boolean().default(false),
    })
    .default({}),
});

export type LoadoutManifest = z.infer<typeof LoadoutManifest>;

/** Normalize a manifest skill entry to `{ id, version }`. */
export function normalizeManifestSkill(entry: ManifestSkill): { id: string; version: string } {
  return typeof entry === "string"
    ? { id: entry, version: "*" }
    : { id: entry.id, version: entry.version };
}
