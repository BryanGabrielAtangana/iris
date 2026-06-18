// SPDX-License-Identifier: Apache-2.0
import { z } from "zod";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RegisteredTool, RegisteredPrompt } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IrisLibrary } from "@iris/core";
import { runSkillScript } from "./exec.js";

export const IRIS_SERVER_NAME = "Iris";
export const IRIS_SERVER_VERSION = "0.1.0";

export interface CreateServerOptions {
  /** Allow `iris_execute_script` to run bundled scripts. Default: true. */
  allowExec?: boolean;
  /** Default number of candidates returned by iris_find. */
  defaultK?: number;
}

/** Compose the find-tool description so the Tier-1 awareness index is embedded. */
function findDescription(lib: IrisLibrary): string {
  const index = lib.buildTier1Index();
  return [
    "Search the user's Iris skill library and return the most relevant skills for a task.",
    "Call this whenever a request might be handled by one of the skills below, then use",
    "`load_skill` to open the winning skill's full instructions.",
    "",
    "The always-current skill index (name — when to use):",
    "",
    index,
  ].join("\n");
}

function text(value: unknown): { content: { type: "text"; text: string }[] } {
  const t = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return { content: [{ type: "text" as const, text: t }] };
}

function errorText(message: string): {
  content: { type: "text"; text: string }[];
  isError: true;
} {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

export interface IrisMcpServer {
  server: McpServer;
  /** Re-sync dynamic state (tool description, prompts) after a library reload. */
  refresh(): void;
}

/**
 * Build the Iris MCP server around a loaded {@link IrisLibrary}.
 *
 * Exposes the full two-tier surface:
 *  - Tier-1 awareness is embedded in the `iris_find` tool description.
 *  - Tier-2 retrieval via `iris_find`.
 *  - Tier-3 load via `iris_load`, plus `skill://` resources and `/iris:` prompts.
 */
export function createIrisMcpServer(
  lib: IrisLibrary,
  opts: CreateServerOptions = {},
): IrisMcpServer {
  const allowExec = opts.allowExec ?? true;
  const defaultK = opts.defaultK ?? 5;

  const server = new McpServer(
    { name: IRIS_SERVER_NAME, version: IRIS_SERVER_VERSION },
    {
      capabilities: {
        tools: { listChanged: true },
        resources: { listChanged: true, subscribe: true },
        prompts: { listChanged: true },
      },
      instructions:
        "Iris knows every capability you own and hands the right one to whatever agent " +
        "you're working with, exactly when it's needed. Use find_skill to discover skills " +
        "and load_skill to open them.",
    },
  );

  // --- Tier 2: iris_find (description carries the Tier-1 awareness index) ---
  const findTool: RegisteredTool = server.registerTool(
    "find_skill",
    {
      title: "Find Iris skills",
      description: findDescription(lib),
      inputSchema: {
        query: z.string().describe("The user's task or intent to find a skill for."),
        k: z.number().int().positive().max(25).optional().describe("Max results (default 5)."),
      },
    },
    async ({ query, k }) => {
      const results = await lib.find(query, k ?? defaultK);
      return text(results);
    },
  );

  // --- Tier 3: iris_load ---
  server.registerTool(
    "load_skill",
    {
      title: "Load an Iris skill",
      description: "Return the full SKILL.md body for a skill id (from find_skill results).",
      inputSchema: { id: z.string().describe("The skill id to load.") },
    },
    async ({ id }) => {
      const body = await lib.loadBody(id);
      if (body === undefined) return errorText(`No skill found with id "${id}".`);
      return text(body);
    },
  );

  // --- Optional execution: iris_execute_script ---
  server.registerTool(
    "run_skill_script",
    {
      title: "Run an Iris skill script",
      description:
        "Run a script bundled with a skill. Only available on filesystem/exec-capable surfaces.",
      inputSchema: {
        id: z.string().describe("The skill id that owns the script."),
        script: z.string().describe("Script path relative to the skill (e.g. scripts/fill.py)."),
        args: z.array(z.string()).optional().describe("Arguments passed to the script."),
      },
    },
    async ({ id, script, args }) => {
      if (!allowExec) {
        return errorText(
          "Script execution is not supported on this surface. Load the skill with load_skill and follow its instructions manually.",
        );
      }
      const skill = lib.getSkill(id);
      if (!skill) return errorText(`No skill found with id "${id}".`);
      const result = await runSkillScript(skill, script, args ?? []);
      if (!result.ok) return errorText(result.message);
      return text(result.output);
    },
  );

  // --- Resources: skill body + references ---
  server.registerResource(
    "skill",
    new ResourceTemplate("skill://{id}", {
      list: () => ({
        resources: lib.skills().map((s) => ({
          uri: `skill://${s.id}`,
          name: s.metadata.name,
          description: s.metadata.when_to_use ?? s.metadata.description,
          mimeType: "text/markdown",
        })),
      }),
    }),
    { title: "Skill body", description: "The full SKILL.md body for a skill." },
    async (uri, variables) => {
      const id = String(variables.id);
      const body = await lib.loadBody(id);
      if (body === undefined) throw new Error(`No skill found with id "${id}".`);
      return { contents: [{ uri: uri.href, mimeType: "text/markdown", text: body }] };
    },
  );

  server.registerResource(
    "skill-reference",
    new ResourceTemplate("skill://{id}/{+ref}", { list: undefined }),
    {
      title: "Skill reference",
      description: "A reference/script/asset file bundled with a skill.",
    },
    async (uri, variables) => {
      const id = String(variables.id);
      const ref = Array.isArray(variables.ref) ? variables.ref.join("/") : String(variables.ref);
      const content = await lib.loadReference(id, ref);
      if (content === undefined) throw new Error(`No reference "${ref}" for skill "${id}".`);
      return { contents: [{ uri: uri.href, text: content }] };
    },
  );

  // --- Prompts: /iris:<skill-name> for explicit invocation ---
  const prompts = new Map<string, RegisteredPrompt>();
  const syncPrompts = (): void => {
    const liveIds = new Set(lib.skills().map((s) => s.id));
    for (const [id, prompt] of prompts) {
      if (!liveIds.has(id)) {
        prompt.remove();
        prompts.delete(id);
      }
    }
    for (const skill of lib.skills()) {
      if (prompts.has(skill.id)) continue;
      const registered = server.registerPrompt(
        `iris:${skill.metadata.name}`,
        {
          title: skill.metadata.name,
          description: skill.metadata.when_to_use ?? skill.metadata.description,
        },
        () => ({
          messages: [
            {
              role: "user" as const,
              content: {
                type: "text" as const,
                text: `Use the "${skill.metadata.name}" skill.\n\n${skill.body}`,
              },
            },
          ],
        }),
      );
      prompts.set(skill.id, registered);
    }
  };
  syncPrompts();

  const refresh = (): void => {
    findTool.update({ description: findDescription(lib) });
    syncPrompts();
  };

  return { server, refresh };
}
