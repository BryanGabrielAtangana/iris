// SPDX-License-Identifier: Apache-2.0
import { mkdir, rm, cp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Skill } from "@iris/protocol";

/**
 * Copy a skill folder into `<skillsDir>/<id>`, optionally omitting `scripts/`
 * (used when the target surface cannot execute scripts).
 */
export async function copySkill(
  skill: Skill,
  skillsDir: string,
  opts: { includeScripts: boolean },
): Promise<string> {
  const dest = join(skillsDir, skill.id);
  await rm(dest, { recursive: true, force: true });
  await mkdir(dest, { recursive: true });
  await cp(skill.dir, dest, {
    recursive: true,
    filter: (src) => {
      if (!opts.includeScripts && /[/\\]scripts([/\\]|$)/.test(src)) return false;
      if (/[/\\]\.iris([/\\]|$)/.test(src)) return false;
      return true;
    },
  });
  return dest;
}

/** Read a file or return an empty string if it does not exist. */
export async function readOrEmpty(path: string): Promise<string> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return "";
  }
}

export async function writeFileEnsured(path: string, content: string): Promise<void> {
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, content, "utf8");
}
