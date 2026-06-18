// SPDX-License-Identifier: Apache-2.0
import { readdir } from "node:fs/promises";
import { join, basename } from "node:path";
import type { Skill } from "@iris-sylvia/protocol";
import { parseSkillFile } from "./parse-skill.js";

const IGNORED_DIRS = new Set(["node_modules", ".git", ".turbo", "dist", ".iris"]);
const MAX_DEPTH = 6;

/**
 * Recursively find every `SKILL.md` under `root`, skipping noise directories.
 * A skill is a folder containing a `SKILL.md`.
 */
export async function findSkillFiles(root: string, depth = 0): Promise<string[]> {
  if (depth > MAX_DEPTH) return [];
  let entries: import("node:fs").Dirent[];
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }

  const found: string[] = [];
  const subdirs: string[] = [];
  for (const entry of entries) {
    if (entry.isFile() && entry.name === "SKILL.md") {
      found.push(join(root, entry.name));
    } else if (entry.isDirectory() && !IGNORED_DIRS.has(entry.name)) {
      subdirs.push(join(root, entry.name));
    }
  }
  const nested = await Promise.all(subdirs.map((d) => findSkillFiles(d, depth + 1)));
  for (const list of nested) found.push(...list);
  return found;
}

export interface ScanResult {
  skills: Skill[];
  errors: { path: string; error: string }[];
}

/**
 * Scan a library root into parsed skills. Parse failures are collected rather
 * than thrown so one malformed skill does not break the whole library.
 * Duplicate ids are disambiguated by suffixing the parent directory name.
 */
export async function scanLibrary(root: string): Promise<ScanResult> {
  const files = await findSkillFiles(root);
  const skills: Skill[] = [];
  const errors: { path: string; error: string }[] = [];
  const seen = new Map<string, number>();

  for (const file of files.sort()) {
    try {
      const skill = await parseSkillFile(file);
      const count = seen.get(skill.id) ?? 0;
      if (count > 0) {
        skill.id = `${skill.id}-${basename(skill.dir)}-${count}`;
      }
      seen.set(skill.id, 1);
      skills.push(skill);
    } catch (err) {
      errors.push({ path: file, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return { skills, errors };
}
