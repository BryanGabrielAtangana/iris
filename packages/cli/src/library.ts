// SPDX-License-Identifier: Apache-2.0
import { resolve } from "node:path";
import { IrisLibrary } from "@iris/core";

/** Resolve the library root from an explicit option, env, or cwd. */
export function resolveLibraryRoot(explicit?: string): string {
  return resolve(explicit ?? process.env.IRIS_LIBRARY ?? process.cwd());
}

/** Load a library from the resolved root. */
export async function loadLibrary(explicit?: string): Promise<IrisLibrary> {
  const root = resolveLibraryRoot(explicit);
  const lib = new IrisLibrary({ root });
  await lib.load();
  return lib;
}
