// SPDX-License-Identifier: Apache-2.0
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { writeLockfile, readLockfile } from "@iris-sylvia/core";
import { resolveLibraryRoot } from "../library.js";

export interface InitOptions {
  library?: string;
}

/** `iris init [dir]` — create or point at a skill library. */
export async function initCommand(dir: string | undefined, opts: InitOptions): Promise<void> {
  const root = resolveLibraryRoot(dir ?? opts.library);
  await mkdir(root, { recursive: true });
  await mkdir(join(root, ".iris"), { recursive: true });

  const existing = await readLockfile(root);
  await writeLockfile(root, existing); // creates iris.lock if missing, idempotent otherwise

  process.stdout.write(`Initialized Iris library at ${root}\n`);
  process.stdout.write(`  • iris.lock created\n`);
  process.stdout.write(
    `\nNext:\n  iris add ./path/to/skill\n  iris search "your task"\n  iris sync\n`,
  );
}
