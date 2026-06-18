// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { embedQueries, MODEL_SLATE, modelByKey, type EmbeddingProvider } from "../src/index.js";

describe("embedQueries", () => {
  it("uses embedQuery when the provider distinguishes queries", async () => {
    const calls: string[] = [];
    const provider: EmbeddingProvider = {
      name: "fake",
      dimensions: 2,
      embed: async (t) => {
        calls.push(`doc:${t[0]}`);
        return t.map(() => [1, 0]);
      },
      embedQuery: async (t) => {
        calls.push(`query:${t[0]}`);
        return t.map(() => [0, 1]);
      },
    };
    await embedQueries(provider, ["hello"]);
    expect(calls).toEqual(["query:hello"]);
  });

  it("falls back to embed for symmetric providers", async () => {
    const calls: string[] = [];
    const provider: EmbeddingProvider = {
      name: "sym",
      dimensions: 2,
      embed: async (t) => {
        calls.push(`doc:${t[0]}`);
        return t.map(() => [1, 0]);
      },
    };
    await embedQueries(provider, ["hi"]);
    expect(calls).toEqual(["doc:hi"]);
  });
});

describe("MODEL_SLATE", () => {
  it("has a unique key, a positive dim, and a model id per candidate", () => {
    const keys = new Set<string>();
    for (const m of MODEL_SLATE) {
      expect(m.key).toBeTruthy();
      expect(keys.has(m.key)).toBe(false);
      keys.add(m.key);
      expect(m.model).toContain("/");
      expect(m.nativeDim).toBeGreaterThan(0);
    }
  });

  it("gives asymmetric models distinct query/document prefixes", () => {
    for (const key of ["bge-small", "e5-small", "nomic", "embeddinggemma"]) {
      const m = modelByKey(key)!;
      expect(m.queryPrefix).not.toBe(m.documentPrefix);
      expect((m.queryPrefix ?? "").length).toBeGreaterThan(0);
    }
  });

  it("truncates MRL models below their native dim", () => {
    for (const key of ["nomic", "embeddinggemma"]) {
      const m = modelByKey(key)!;
      expect(m.truncateDim).toBeDefined();
      expect(m.truncateDim!).toBeLessThan(m.nativeDim);
    }
  });

  it("keeps the baseline symmetric", () => {
    const minilm = modelByKey("minilm")!;
    expect(minilm.queryPrefix).toBe("");
    expect(minilm.documentPrefix).toBe("");
  });
});
