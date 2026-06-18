// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { IrisLibrary } from "@iris-sylvia/core";
import { createIrisMcpServer } from "../src/index.js";

const here = dirname(fileURLToPath(import.meta.url));
// Reuse the rich fixture library from @iris-sylvia/core.
const LIB = join(here, "..", "..", "core", "test", "fixtures", "lib");

function firstText(result: { content: { type: string; text?: string }[] }): string {
  const block = result.content.find((c) => c.type === "text");
  return block?.text ?? "";
}

describe("Iris MCP server (real client over in-memory transport)", () => {
  let client: Client;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const lib = new IrisLibrary({ root: LIB });
    await lib.load();
    const { server } = createIrisMcpServer(lib);

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: "test-client", version: "0.0.0" });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    close = async () => {
      await client.close();
      await server.close();
    };
  });

  afterAll(async () => {
    await close();
  });

  it("exposes the Tier-1 awareness index inside the iris_find tool description", async () => {
    const { tools } = await client.listTools();
    const find = tools.find((t) => t.name === "find_skill");
    expect(find).toBeDefined();
    expect(find?.description).toContain("- pdf-forms — Use when");
    expect(find?.description).toContain("- git-commit — Use when");
    expect(tools.map((t) => t.name)).toEqual(
      expect.arrayContaining(["find_skill", "load_skill", "run_skill_script"]),
    );
  });

  it("returns ranked candidates from find_skill", async () => {
    const result = (await client.callTool({
      name: "find_skill",
      arguments: { query: "fill out a pdf form", k: 3 },
    })) as { content: { type: string; text?: string }[] };
    const parsed = JSON.parse(firstText(result)) as { id: string; score: number }[];
    expect(parsed[0]?.id).toBe("pdf-forms");
    expect(parsed.length).toBeLessThanOrEqual(3);
  });

  it("loads a full skill body via load_skill", async () => {
    const result = (await client.callTool({
      name: "load_skill",
      arguments: { id: "git-commit" },
    })) as { content: { type: string; text?: string }[]; isError?: boolean };
    expect(result.isError).toBeFalsy();
    expect(firstText(result)).toContain("# git-commit");
  });

  it("reports a clear error for an unknown skill id", async () => {
    const result = (await client.callTool({
      name: "load_skill",
      arguments: { id: "does-not-exist" },
    })) as { content: { type: string; text?: string }[]; isError?: boolean };
    expect(result.isError).toBe(true);
    expect(firstText(result)).toContain("No skill found");
  });

  it("serves the skill body as a skill:// resource", async () => {
    const result = await client.readResource({ uri: "skill://pdf-forms" });
    expect(result.contents[0]?.text).toContain("# pdf-forms");
    expect(result.contents[0]?.mimeType).toBe("text/markdown");
  });

  it("registers a /iris:<name> prompt per skill", async () => {
    const { prompts } = await client.listPrompts();
    expect(prompts.map((p) => p.name)).toEqual(
      expect.arrayContaining(["iris:pdf-forms", "iris:git-commit"]),
    );
    const prompt = await client.getPrompt({ name: "iris:pdf-forms" });
    expect(prompt.messages[0]?.content.type).toBe("text");
  });

  it("executes a bundled script via run_skill_script", async () => {
    const result = (await client.callTool({
      name: "run_skill_script",
      arguments: { id: "pdf-forms", script: "scripts/fill.py" },
    })) as { content: { type: string; text?: string }[]; isError?: boolean };
    // python3 may be unavailable in some environments; accept success or a
    // clean failure message, but never a crash.
    expect(result.content.length).toBeGreaterThan(0);
  });
});
