// SPDX-License-Identifier: Apache-2.0
import { join } from "node:path";
import type { Skill } from "@iris-sylvia/protocol";
import {
  type Adapter,
  type AdapterContext,
  upsertManagedBlock,
  renderAwareness,
} from "./adapter.js";
import { copySkill, readOrEmpty, writeFileEnsured } from "./fs-utils.js";

/**
 * Codex adapter.
 *
 * Skills are written to `<targetDir>/.codex/skills/<id>` and the Tier-1 index
 * is injected into `<targetDir>/AGENTS.md` — the surface Codex always loads.
 * Codex can execute, so scripts are included.
 */
export class CodexAdapter implements Adapter {
  readonly name = "codex";
  readonly supportsScripts = true;

  location(ctx: AdapterContext) {
    return {
      skillsDir: join(ctx.targetDir, ".codex", "skills"),
      indexFile: join(ctx.targetDir, "AGENTS.md"),
    };
  }

  async writeSkills(skills: Skill[], ctx: AdapterContext): Promise<string[]> {
    const { skillsDir } = this.location(ctx);
    const written: string[] = [];
    for (const skill of skills) {
      written.push(await copySkill(skill, skillsDir, { includeScripts: this.supportsScripts }));
    }
    return written;
  }

  async writeIndex(index: string, ctx: AdapterContext): Promise<string> {
    const { indexFile } = this.location(ctx);
    const existing = await readOrEmpty(indexFile);
    await writeFileEnsured(indexFile, upsertManagedBlock(existing, renderAwareness(index)));
    return indexFile;
  }
}
