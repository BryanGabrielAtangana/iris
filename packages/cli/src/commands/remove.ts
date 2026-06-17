// SPDX-License-Identifier: Apache-2.0
import { rm } from "node:fs/promises";
import { loadLibrary, resolveLibraryRoot } from "../library.js";

export interface RemoveOptions {
  library?: string;
}

/** `iris remove <id>` — delete a skill from the library and re-pin the lock. */
export async function removeCommand(id: string, opts: RemoveOptions): Promise<void> {
  const root = resolveLibraryRoot(opts.library);
  const lib = await loadLibrary(root);
  const skill = lib.getSkill(id);
  if (!skill) {
    throw new Error(`No skill with id "${id}" in ${root}.`);
  }
  await rm(skill.dir, { recursive: true, force: true });
  process.stdout.write(`Removed skill "${id}".\n`);

  const reloaded = await loadLibrary(root);
  await reloaded.writeLock();
  process.stdout.write(`Updated iris.lock (${reloaded.skills().length} skills).\n`);
}
