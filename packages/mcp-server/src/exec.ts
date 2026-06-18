// SPDX-License-Identifier: Apache-2.0
import { execFile } from "node:child_process";
import { join, extname } from "node:path";
import type { Skill } from "@iris-sylvia/protocol";

export type ExecResult = { ok: true; output: string } | { ok: false; message: string };

const INTERPRETERS: Record<string, string> = {
  ".py": "python3",
  ".sh": "bash",
  ".js": "node",
  ".mjs": "node",
};

/**
 * Run a script bundled with a skill, guarded so only scripts the skill
 * actually declares can run, and only from inside the skill directory.
 */
export async function runSkillScript(
  skill: Skill,
  script: string,
  args: string[],
): Promise<ExecResult> {
  const normalized = script.replace(/^[./\\]+/, "");
  if (!skill.scripts.includes(normalized)) {
    return {
      ok: false,
      message: `Skill "${skill.id}" has no bundled script "${normalized}". Known scripts: ${
        skill.scripts.join(", ") || "(none)"
      }`,
    };
  }
  const abs = join(skill.dir, normalized);
  const interpreter = INTERPRETERS[extname(normalized).toLowerCase()];
  if (!interpreter) {
    return { ok: false, message: `Unsupported script type for "${normalized}".` };
  }

  return new Promise<ExecResult>((resolve) => {
    execFile(
      interpreter,
      [abs, ...args],
      { cwd: skill.dir, timeout: 30_000, maxBuffer: 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          resolve({
            ok: false,
            message: `Script failed: ${error.message}\n${stderr}`.trim(),
          });
          return;
        }
        resolve({ ok: true, output: stdout || stderr || "(no output)" });
      },
    );
  });
}
