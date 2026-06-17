// SPDX-License-Identifier: Apache-2.0
import { resolve, join } from "node:path";
import { stat, mkdir, rm, cp } from "node:fs/promises";
import { parseSkillFile } from "@iris/core";
import { loadLibrary, resolveLibraryRoot } from "../library.js";

export interface AddOptions {
  library?: string;
}

/** `iris add <path>` — validate a skill folder and copy it into the library. */
export async function addCommand(skillPath: string, opts: AddOptions): Promise<void> {
  const src = resolve(skillPath);
  const s = await stat(src).catch(() => undefined);
  if (!s?.isDirectory()) {
    throw new Error(`Not a directory: ${src}. Point at a folder containing a SKILL.md.`);
  }

  // Validate the skill before importing it.
  const skill = await parseSkillFile(join(src, "SKILL.md"));

  const root = resolveLibraryRoot(opts.library);
  const dest = join(root, skill.id);
  if (resolve(dest) === src) {
    process.stdout.write(`Skill "${skill.id}" is already in the library.\n`);
  } else {
    await mkdir(root, { recursive: true });
    await rm(dest, { recursive: true, force: true });
    await cp(src, dest, { recursive: true });
    process.stdout.write(`Added skill "${skill.metadata.name}" (${skill.id}).\n`);
  }

  // Re-pin the lockfile against the updated library.
  const lib = await loadLibrary(root);
  await lib.writeLock();
  process.stdout.write(`Updated iris.lock (${lib.skills().length} skills).\n`);
}
