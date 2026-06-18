// SPDX-License-Identifier: Apache-2.0
import { resolve } from "node:path";
import { IrisLibrary } from "@iris-sylvia/core";
import { resolveDefaultProvider } from "@iris-sylvia/embeddings";

/** Resolve the library root from an explicit option, env, or cwd. */
export function resolveLibraryRoot(explicit?: string): string {
  return resolve(explicit ?? process.env.IRIS_LIBRARY ?? process.cwd());
}

/**
 * Load a library from the resolved root, using the semantic embedding provider
 * by default (falling back to the fast lexical engine offline). Set
 * `IRIS_EMBEDDINGS=local` to force the lexical engine.
 */
export async function loadLibrary(explicit?: string): Promise<IrisLibrary> {
  const root = resolveLibraryRoot(explicit);
  const provider = await resolveDefaultProvider({
    onFallback: (reason) => process.stderr.write(`iris: ${reason}\n`),
  });
  const lib = new IrisLibrary({ root, provider });
  await lib.load();
  return lib;
}
