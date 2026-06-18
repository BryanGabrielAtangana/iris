// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtemp } from "node:fs/promises";
import {
  LocalHashingProvider,
  createEmbeddingProvider,
  createVectorStore,
  cosineSimilarity,
  MemoryVectorStore,
  resolveDefaultProvider,
} from "./index.js";

describe("LocalHashingProvider", () => {
  it("produces deterministic, unit-normalized vectors of the right size", async () => {
    const p = new LocalHashingProvider(128);
    const [a] = await p.embed(["fill out a pdf form"]);
    const [b] = await p.embed(["fill out a pdf form"]);
    expect(a).toHaveLength(128);
    expect(a).toEqual(b); // deterministic
    const norm = Math.sqrt((a as number[]).reduce((s, v) => s + v * v, 0));
    expect(norm).toBeCloseTo(1, 5);
  });

  it("ranks lexically related text higher than unrelated text", async () => {
    const p = createEmbeddingProvider();
    const [query] = await p.embed(["I need to merge two pdf files together"]);
    const [related] = await p.embed(["Merge, split and combine PDF documents"]);
    const [unrelated] = await p.embed(["Write a git commit message from staged changes"]);
    const simRelated = cosineSimilarity(query as number[], related as number[]);
    const simUnrelated = cosineSimilarity(query as number[], unrelated as number[]);
    expect(simRelated).toBeGreaterThan(simUnrelated);
  });
});

describe("MemoryVectorStore", () => {
  it("returns nearest neighbours ranked by score", async () => {
    const p = createEmbeddingProvider();
    const store = createVectorStore({ dimensions: p.dimensions });
    const docs = [
      { id: "pdf", text: "Fill, extract or merge PDF documents and forms" },
      { id: "git", text: "Write commit messages from staged git changes" },
      { id: "sql", text: "Query and migrate relational SQL databases" },
    ];
    const vecs = await p.embed(docs.map((d) => d.text));
    await store.upsert(docs.map((d, i) => ({ id: d.id, vector: vecs[i] as number[] })));

    const [q] = await p.embed(["help me combine some pdf forms"]);
    const hits = await store.query(q as number[], 3);
    expect(hits[0]?.id).toBe("pdf");
    expect(store.size()).toBe(3);
  });

  it("persists and reloads from disk", async () => {
    const dir = await mkdtemp(join(tmpdir(), "iris-vec-"));
    const path = join(dir, "index.json");
    const store = new MemoryVectorStore({ dimensions: 4, path });
    await store.upsert([{ id: "a", vector: [1, 0, 0, 0] }]);
    await store.save();

    const reloaded = new MemoryVectorStore({ dimensions: 4, path });
    await reloaded.load();
    expect(reloaded.size()).toBe(1);
    const hits = await reloaded.query([1, 0, 0, 0], 1);
    expect(hits[0]?.id).toBe("a");
    expect(hits[0]?.score).toBeCloseTo(1, 5);
  });

  it("removes records", async () => {
    const store = createVectorStore({ dimensions: 2 });
    await store.upsert([
      { id: "a", vector: [1, 0] },
      { id: "b", vector: [0, 1] },
    ]);
    await store.remove(["a"]);
    expect(store.size()).toBe(1);
  });
});

describe("resolveDefaultProvider", () => {
  it("returns the lexical provider when kind is local", async () => {
    const p = await resolveDefaultProvider({ kind: "local" });
    expect(p.name).toBe("local-hashing");
  });

  it("falls back to the lexical provider when the semantic model can't load", async () => {
    // Force the failure path with a model id that can't resolve, so this stays a
    // fast, deterministic unit test instead of a ~12s live model download (which
    // flaked against the 30s timeout). Real model loading is covered by the
    // accuracy CI job, which has the model cache.
    let fellBack = false;
    const p = await resolveDefaultProvider({
      model: "iris-test/nonexistent-model",
      onFallback: () => (fellBack = true),
    });
    const [v] = await p.embed(["semantic search test"]);
    expect((v ?? []).length).toBe(p.dimensions);
    expect(p.name).toBe("local-hashing");
    expect(fellBack).toBe(true);
  }, 30_000);
});
