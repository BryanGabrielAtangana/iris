// SPDX-License-Identifier: Apache-2.0
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import semver from "semver";
import {
  LoadoutManifest,
  normalizeManifestSkill,
  type Lockfile,
  type LockEntry,
  type Skill,
} from "@iris-sylvia/protocol";
import { hashSkillDir } from "./lockfile-io.js";

export const MANIFEST_NAME = "iris.json";

/** Read and validate an `iris.json` loadout manifest from a path. */
export async function readManifestFile(path: string): Promise<LoadoutManifest> {
  const raw = await readFile(path, "utf8");
  return LoadoutManifest.parse(JSON.parse(raw));
}

/** Read `iris.json` from a directory; returns undefined if absent. */
export async function readManifest(dir: string): Promise<LoadoutManifest | undefined> {
  try {
    return await readManifestFile(join(dir, MANIFEST_NAME));
  } catch {
    return undefined;
  }
}

export interface LoadoutResolution {
  /** Skills selected by the loadout, in manifest order. */
  skills: Skill[];
  /** The scoped id set (for bounded retrieval). */
  ids: string[];
  /** Lockfile pinning the resolved skills (version + integrity). */
  lock: Lockfile;
  /** Whether scoped discovery may broaden to the full library. */
  allowBroaden: boolean;
  /** Problems: a declared skill missing, or a version range not satisfied. */
  errors: { id: string; reason: string }[];
}

/**
 * Resolve a loadout manifest against a library's parsed skills: select the
 * declared subset, check version ranges, and produce an `iris.lock` that pins
 * the resolved versions for reproducibility (Mode B).
 */
export async function resolveLoadout(
  manifest: LoadoutManifest,
  available: Skill[],
  root: string,
): Promise<LoadoutResolution> {
  const byId = new Map(available.map((s) => [s.id, s]));
  const skills: Skill[] = [];
  const errors: { id: string; reason: string }[] = [];
  const seen = new Set<string>();

  for (const entry of manifest.skills) {
    const { id, version } = normalizeManifestSkill(entry);
    if (seen.has(id)) continue;
    seen.add(id);

    const skill = byId.get(id);
    if (!skill) {
      errors.push({ id, reason: `not found in library` });
      continue;
    }
    if (version !== "*" && !satisfies(skill.metadata.version, version)) {
      errors.push({
        id,
        reason: `library has ${skill.metadata.version}, manifest requires ${version}`,
      });
      continue;
    }
    skills.push(skill);
  }

  const entries: LockEntry[] = [];
  for (const skill of skills) {
    let integrity: string | undefined;
    try {
      integrity = await hashSkillDir(skill.dir);
    } catch {
      integrity = undefined;
    }
    entries.push({
      id: skill.id,
      version: skill.metadata.version,
      source: relativeSource(skill.dir, root),
      integrity,
    });
  }
  entries.sort((a, b) => a.id.localeCompare(b.id));

  return {
    skills,
    ids: skills.map((s) => s.id),
    lock: { lockfileVersion: 1, skills: entries },
    allowBroaden: manifest.policy.allowBroaden,
    errors,
  };
}

/** Tolerant semver satisfaction: ranges, exact, or a `0.0.0`-style fallback. */
function satisfies(version: string, range: string): boolean {
  const v = semver.coerce(version);
  if (!v) return version === range;
  return semver.satisfies(v, range, { includePrerelease: true }) || version === range;
}

function relativeSource(dir: string, root: string): string {
  if (dir.startsWith(root)) {
    const rel = dir.slice(root.length).replace(/^[/\\]+/, "");
    return rel ? `./${rel}` : ".";
  }
  return dir;
}
