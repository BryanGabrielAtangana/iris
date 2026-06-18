// SPDX-License-Identifier: Apache-2.0
import { resolve } from "node:path";
import { readManifest, readManifestFile, resolveLoadout } from "@iris-sylvia/core";
import { loadLibrary, resolveLibraryRoot } from "../library.js";

export interface SearchOptions {
  library?: string;
  k?: string;
  /** Bound the search to the loadout (uses library iris.json unless --manifest). */
  scope?: boolean;
  manifest?: string;
}

/** `iris search <query>` — Tier-2 retrieval against the library (or a loadout). */
export async function searchCommand(query: string, opts: SearchOptions): Promise<void> {
  const root = resolveLibraryRoot(opts.library);
  const lib = await loadLibrary(root);
  if (lib.skills().length === 0) {
    process.stdout.write("No skills in this library yet. Try `iris add ./path/to/skill`.\n");
    return;
  }
  const k = Math.max(1, Number.parseInt(opts.k ?? "5", 10) || 5);

  // Scope to a loadout when requested or when a manifest is provided.
  let scopeIds: string[] | undefined;
  let allowBroaden = false;
  if (opts.scope || opts.manifest) {
    const manifest = opts.manifest
      ? await readManifestFile(resolve(opts.manifest))
      : await readManifest(root);
    if (manifest) {
      const resolved = await resolveLoadout(manifest, lib.skills(), root);
      scopeIds = resolved.ids;
      allowBroaden = resolved.allowBroaden;
    }
  }

  const results = await lib.find(query, k, scopeIds ? { scopeIds, allowBroaden } : undefined);

  const label = scopeIds ? ` (loadout: ${scopeIds.length} skills)` : "";
  process.stdout.write(`Top ${results.length} skills for: "${query}"${label}\n\n`);
  for (const r of results) {
    const pct = (r.score * 100).toFixed(0).padStart(3);
    process.stdout.write(`  ${pct}%  ${r.name}  (${r.id})\n`);
    if (r.when_to_use) process.stdout.write(`        ${r.when_to_use}\n`);
  }
}
