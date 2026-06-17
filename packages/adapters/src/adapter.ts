// SPDX-License-Identifier: Apache-2.0
import type { Skill } from "@iris/protocol";

export interface AdapterContext {
  /**
   * Base directory the adapter writes into. For project scope this is the
   * project root; for user scope, the agent's home config dir. The adapter
   * derives its own conventional sub-paths from here.
   */
  targetDir: string;
}

export interface AdapterLocation {
  /** Directory skills are written to. */
  skillsDir: string;
  /** File the Tier-1 index is injected into (the always-loaded surface). */
  indexFile: string;
}

/**
 * A surface adapter knows how to land Iris skills + the Tier-1 awareness index
 * in a specific agent's expected location. Adapters degrade gracefully: on
 * chat-only surfaces (`supportsScripts === false`) scripts are omitted and only
 * instructions are written.
 */
export interface Adapter {
  readonly name: string;
  /** Whether this surface can run bundled scripts. */
  readonly supportsScripts: boolean;
  /** Resolve the concrete write locations for a context. */
  location(ctx: AdapterContext): AdapterLocation;
  /** Write the skills; returns the list of written skill directories. */
  writeSkills(skills: Skill[], ctx: AdapterContext): Promise<string[]>;
  /** Inject the Tier-1 index into the always-loaded surface; returns its path. */
  writeIndex(index: string, ctx: AdapterContext): Promise<string>;
}

export const IRIS_BLOCK_BEGIN = "<!-- IRIS:BEGIN (managed by `iris sync` — do not edit) -->";
export const IRIS_BLOCK_END = "<!-- IRIS:END -->";

/**
 * Insert or replace the Iris-managed block inside an existing document,
 * preserving everything the user has written around it.
 */
export function upsertManagedBlock(existing: string, index: string): string {
  const block = `${IRIS_BLOCK_BEGIN}\n${index}\n${IRIS_BLOCK_END}`;
  const begin = existing.indexOf(IRIS_BLOCK_BEGIN);
  const end = existing.indexOf(IRIS_BLOCK_END);
  if (begin !== -1 && end !== -1 && end > begin) {
    const before = existing.slice(0, begin).replace(/\s+$/, "");
    const after = existing.slice(end + IRIS_BLOCK_END.length).replace(/^\s+/, "");
    return [before, block, after].filter((s) => s.length > 0).join("\n\n") + "\n";
  }
  const trimmed = existing.trim();
  return (trimmed.length > 0 ? `${trimmed}\n\n${block}` : block) + "\n";
}
