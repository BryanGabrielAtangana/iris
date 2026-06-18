// SPDX-License-Identifier: Apache-2.0
import { resolve } from "node:path";
import { readManifest, readManifestFile, resolveLoadout, writeLockfile } from "@iris-sylvia/core";
import { loadLibrary, resolveLibraryRoot } from "../library.js";

export interface LockOptions {
  library?: string;
  manifest?: string;
}

/**
 * `iris lock` — resolve the `iris.json` loadout against the library and write a
 * pinned `iris.lock` (Mode B reproducibility).
 */
export async function lockCommand(opts: LockOptions): Promise<void> {
  const root = resolveLibraryRoot(opts.library);
  const manifest = opts.manifest
    ? await readManifestFile(resolve(opts.manifest))
    : await readManifest(root);

  if (!manifest) {
    throw new Error(
      `No loadout manifest found. Create an iris.json in ${root}, or pass --manifest <path>.`,
    );
  }

  const lib = await loadLibrary(root);
  const resolved = await resolveLoadout(manifest, lib.skills(), root);
  await writeLockfile(root, resolved.lock);

  process.stdout.write(
    `Locked loadout${manifest.name ? ` "${manifest.name}"` : ""}: ${resolved.ids.length} skill(s) pinned in iris.lock.\n`,
  );
  for (const id of resolved.ids) process.stdout.write(`  • ${id}\n`);
  if (resolved.errors.length > 0) {
    process.stdout.write(`\n${resolved.errors.length} unresolved:\n`);
    for (const e of resolved.errors) process.stdout.write(`  ✗ ${e.id} — ${e.reason}\n`);
    process.exitCode = 1;
  }
}
