// SPDX-License-Identifier: Apache-2.0
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { readdir, stat } from "node:fs/promises";
import { Lockfile, EMPTY_LOCKFILE, type Skill, type LockEntry } from "@iris/protocol";

export const LOCKFILE_NAME = "iris.lock";

/** Read and validate `iris.lock` from a library root; returns empty if absent. */
export async function readLockfile(root: string): Promise<Lockfile> {
  try {
    const raw = await readFile(join(root, LOCKFILE_NAME), "utf8");
    return Lockfile.parse(JSON.parse(raw));
  } catch {
    return { ...EMPTY_LOCKFILE };
  }
}

/** Write `iris.lock` to a library root (pretty-printed, trailing newline). */
export async function writeLockfile(root: string, lock: Lockfile): Promise<void> {
  const validated = Lockfile.parse(lock);
  validated.skills.sort((a, b) => a.id.localeCompare(b.id));
  await writeFile(join(root, LOCKFILE_NAME), JSON.stringify(validated, null, 2) + "\n", "utf8");
}

/** Compute a stable sha256 over a skill directory's file contents. */
export async function hashSkillDir(dir: string): Promise<string> {
  const hash = createHash("sha256");
  const walk = async (d: string): Promise<void> => {
    const entries = (await readdir(d, { withFileTypes: true })).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    for (const e of entries) {
      const full = join(d, e.name);
      if (e.isDirectory()) {
        await walk(full);
      } else if (e.isFile()) {
        hash.update(e.name);
        hash.update(await readFile(full));
      }
    }
  };
  await walk(dir);
  return `sha256:${hash.digest("hex")}`;
}

/** Build a lockfile pinning the given skills against their sources. */
export async function buildLockfile(skills: Skill[], root: string): Promise<Lockfile> {
  const entries: LockEntry[] = [];
  for (const skill of skills) {
    let integrity: string | undefined;
    try {
      const s = await stat(skill.dir);
      if (s.isDirectory()) integrity = await hashSkillDir(skill.dir);
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
  return { lockfileVersion: 1, skills: entries };
}

function relativeSource(dir: string, root: string): string {
  if (dir.startsWith(root)) {
    const rel = dir.slice(root.length).replace(/^[/\\]+/, "");
    return rel ? `./${rel}` : ".";
  }
  return dir;
}
