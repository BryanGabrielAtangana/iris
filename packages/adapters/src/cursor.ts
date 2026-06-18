// SPDX-License-Identifier: Apache-2.0
import { join } from "node:path";
import type { Skill } from "@iris-sylvia/protocol";
import { type Adapter, type AdapterContext, renderAwareness } from "./adapter.js";
import { copySkill, writeFileEnsured } from "./fs-utils.js";

/**
 * Cursor adapter.
 *
 * Cursor's always-loaded surface is its project rules directory. This adapter
 * writes an Iris-owned rule at `<targetDir>/.cursor/rules/iris.mdc` with
 * `alwaysApply: true`, so the awareness directive + Tier-1 index are always in
 * the agent's context and skills fire automatically — the same plug-and-play
 * behavior the Claude Code and Codex adapters provide. Skills themselves are
 * served on demand through the Iris MCP server (`load_skill`); copies are also
 * written to `.cursor/skills/<id>` for non-MCP reference. Cursor can execute,
 * so scripts are included.
 */
export class CursorAdapter implements Adapter {
  readonly name = "cursor";
  readonly supportsScripts = true;

  location(ctx: AdapterContext) {
    return {
      skillsDir: join(ctx.targetDir, ".cursor", "skills"),
      indexFile: join(ctx.targetDir, ".cursor", "rules", "iris.mdc"),
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
    // The .mdc rule file is fully Iris-owned, so it is regenerated wholesale.
    // `alwaysApply: true` keeps it permanently in Cursor's context.
    const frontmatter = [
      "---",
      "description: Iris skill library — discover and use the right skill before acting",
      "alwaysApply: true",
      "---",
    ].join("\n");
    await writeFileEnsured(indexFile, `${frontmatter}\n\n${renderAwareness(index)}\n`);
    return indexFile;
  }
}
