// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { Bm25Index, contentTokens } from "../src/index.js";

// A tiny corpus that mirrors the shape of skill trigger text.
const CORPUS = [
  { id: "regex-builder", name: "regex builder", text: "build and test regular expressions to match emails phone numbers and dates" },
  { id: "dockerfile-author", name: "dockerfile author", text: "write a dockerfile to containerize and package a node application image" },
  { id: "sql-migration", name: "sql migration", text: "create a database migration to add a column or index to a table schema" },
  { id: "csv-wrangler", name: "csv wrangler", text: "filter deduplicate and clean rows in a csv spreadsheet of comma separated data" },
];

describe("contentTokens", () => {
  it("lowercases, splits, and drops stopwords", () => {
    expect(contentTokens("Write a Dockerfile for the app")).toEqual(["write", "dockerfile", "app"]);
  });
});

describe("Bm25Index", () => {
  const idx = new Bm25Index(CORPUS);

  it("ranks the on-topic skill first for a vocabulary query", () => {
    const ranked = CORPUS.map((d) => ({ id: d.id, s: idx.score("write a dockerfile to containerize my app", d.id) }))
      .sort((a, b) => b.s - a.s);
    expect(ranked[0]?.id).toBe("dockerfile-author");
    expect(ranked[0]?.s).toBeGreaterThan(0.3);
  });

  it("scores exactly 0 when the query shares no content tokens (rejection floor)", () => {
    for (const d of CORPUS) {
      expect(idx.score("the weather forecast for tomorrow", d.id)).toBe(0);
    }
  });

  it("returns 0 for an unknown skill id", () => {
    expect(idx.score("regular expression", "does-not-exist")).toBe(0);
  });

  it("rewards rare (high-IDF) terms over common ones", () => {
    // "migration" is unique to one doc; "add" is a dropped stopword, "table" rarer.
    const rare = idx.raw("migration", "sql-migration");
    const common = idx.raw("data", "csv-wrangler");
    expect(rare).toBeGreaterThan(0);
    expect(rare).toBeGreaterThan(common * 0.5);
  });

  it("stays in [0, 1] and is monotonic in raw score", () => {
    const s = idx.score("create a database migration for a new table", "sql-migration");
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThan(1);
  });
});
