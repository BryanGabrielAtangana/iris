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
 * Generic chat-only adapter for surfaces that cannot execute code. Skills are
 * written as instructions only (the `scripts/` folder is omitted) and the
 * Tier-1 index is injected into a plain `IRIS.md` instructions file. This is
 * the graceful-degradation path for chat-only agents.
 */
export class ChatAdapter implements Adapter {
  readonly name = "chat";
  readonly supportsScripts = false;

  location(ctx: AdapterContext) {
    return {
      skillsDir: join(ctx.targetDir, "iris-skills"),
      indexFile: join(ctx.targetDir, "IRIS.md"),
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
