// SPDX-License-Identifier: Apache-2.0
import { loadLibrary } from "../library.js";

export interface SearchOptions {
  library?: string;
  k?: string;
}

/** `iris search <query>` — Tier-2 retrieval against the library. */
export async function searchCommand(query: string, opts: SearchOptions): Promise<void> {
  const lib = await loadLibrary(opts.library);
  if (lib.skills().length === 0) {
    process.stdout.write("No skills in this library yet. Try `iris add ./path/to/skill`.\n");
    return;
  }
  const k = Math.max(1, Number.parseInt(opts.k ?? "5", 10) || 5);
  const results = await lib.find(query, k);

  process.stdout.write(`Top ${results.length} skills for: "${query}"\n\n`);
  for (const r of results) {
    const pct = (r.score * 100).toFixed(0).padStart(3);
    process.stdout.write(`  ${pct}%  ${r.name}  (${r.id})\n`);
    if (r.when_to_use) process.stdout.write(`        ${r.when_to_use}\n`);
  }
}
