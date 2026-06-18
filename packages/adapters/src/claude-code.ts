// SPDX-License-Identifier: Apache-2.0
import { join } from "node:path";
import type { Skill } from "@iris/protocol";
import {
  type Adapter,
  type AdapterContext,
  upsertManagedBlock,
  renderAwareness,
} from "./adapter.js";
import { copySkill, readOrEmpty, writeFileEnsured } from "./fs-utils.js";

/**
 * Claude Code adapter.
 *
 * Skills are written to `<targetDir>/.claude/skills/<id>` and the Tier-1
 * awareness index is injected into `<targetDir>/CLAUDE.md` — the surface Claude
 * Code always loads — inside a managed block so the rest of the file is left
 * untouched. Claude Code supports code execution, so scripts are included.
 */
export class ClaudeCodeAdapter implements Adapter {
  readonly name = "claude-code";
  readonly supportsScripts = true;

  location(ctx: AdapterContext) {
    return {
      skillsDir: join(ctx.targetDir, ".claude", "skills"),
      indexFile: join(ctx.targetDir, "CLAUDE.md"),
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
