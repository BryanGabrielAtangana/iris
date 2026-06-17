// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { parseSkillRef, NotImplementedRegistryClient } from "./index.js";

describe("parseSkillRef", () => {
  it("parses namespace, name and optional version", () => {
    expect(parseSkillRef("@acme/pdf-forms")).toEqual({
      namespace: "acme",
      name: "pdf-forms",
      version: undefined,
    });
    expect(parseSkillRef("@acme/pdf-forms@1.2.0")).toEqual({
      namespace: "acme",
      name: "pdf-forms",
      version: "1.2.0",
    });
  });

  it("rejects malformed references", () => {
    expect(() => parseSkillRef("pdf-forms")).toThrow();
  });

  it("fetch/publish are explicitly deferred", async () => {
    const client = new NotImplementedRegistryClient();
    await expect(client.fetch("@a/b", "/tmp")).rejects.toThrow(/not implemented/);
  });
});
