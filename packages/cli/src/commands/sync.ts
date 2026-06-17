// SPDX-License-Identifier: Apache-2.0
import { resolve } from "node:path";
import { getAdapter, DEFAULT_ADAPTERS, type Adapter } from "@iris/adapters";
import { loadLibrary } from "../library.js";

export interface SyncOptions {
  library?: string;
  adapter?: string;
  target?: string;
}

/** `iris sync` — write skills + the Tier-1 index into agent surfaces. */
export async function syncCommand(opts: SyncOptions): Promise<void> {
  const lib = await loadLibrary(opts.library);
  const skills = lib.skills();
  if (skills.length === 0) {
    process.stdout.write("No skills to sync. Try `iris add ./path/to/skill` first.\n");
    return;
  }
  const index = lib.buildTier1Index();
  const targetDir = resolve(opts.target ?? process.cwd());

  const names = (opts.adapter ? opts.adapter.split(",") : DEFAULT_ADAPTERS).map((n) => n.trim());
  const adapters: Adapter[] = [];
  for (const name of names) {
    const adapter = getAdapter(name);
    if (!adapter) throw new Error(`Unknown adapter "${name}". Known: claude-code, codex, chat.`);
    adapters.push(adapter);
  }

  for (const adapter of adapters) {
    const ctx = { targetDir };
    const written = await adapter.writeSkills(skills, ctx);
    const indexFile = await adapter.writeIndex(index, ctx);
    const loc = adapter.location(ctx);
    process.stdout.write(
      `[${adapter.name}] wrote ${written.length} skills → ${loc.skillsDir}\n` +
        `[${adapter.name}] injected Tier-1 index → ${indexFile}` +
        (adapter.supportsScripts ? "\n" : " (instructions only, scripts omitted)\n"),
    );
  }
  process.stdout.write(`\nSynced ${skills.length} skills to ${adapters.length} surface(s).\n`);
}
