// SPDX-License-Identifier: Apache-2.0
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { cosineSimilarity } from "./provider.js";

export interface VectorRecord {
  id: string;
  vector: number[];
  metadata?: Record<string, unknown>;
}

export interface VectorQueryHit {
  id: string;
  score: number;
  metadata?: Record<string, unknown>;
}

/**
 * An embedded, local-first vector store. Skill libraries are small (tens to a
 * few hundred entries), so a brute-force cosine scan is both exact and plenty
 * fast, while keeping zero infrastructure and full offline operation.
 *
 * TODO(iris): swap the scan for `sqlite-vec` or LanceDB behind this same
 * interface if libraries ever grow large enough to need ANN.
 */
export interface VectorStore {
  readonly dimensions: number;
  upsert(records: VectorRecord[]): Promise<void>;
  remove(ids: string[]): Promise<void>;
  query(vector: number[], k: number): Promise<VectorQueryHit[]>;
  clear(): Promise<void>;
  size(): number;
  /** Persist to the configured path (no-op for purely in-memory stores). */
  save(): Promise<void>;
  /** Load from the configured path if it exists. */
  load(): Promise<void>;
}

interface PersistShape {
  version: 1;
  dimensions: number;
  records: VectorRecord[];
}

export interface MemoryVectorStoreOptions {
  dimensions: number;
  /** Optional JSON file the index is persisted to / loaded from. */
  path?: string;
}

export class MemoryVectorStore implements VectorStore {
  readonly dimensions: number;
  private readonly path?: string;
  private records = new Map<string, VectorRecord>();

  constructor(opts: MemoryVectorStoreOptions) {
    this.dimensions = opts.dimensions;
    this.path = opts.path;
  }

  async upsert(records: VectorRecord[]): Promise<void> {
    for (const r of records) this.records.set(r.id, r);
  }

  async remove(ids: string[]): Promise<void> {
    for (const id of ids) this.records.delete(id);
  }

  async query(vector: number[], k: number): Promise<VectorQueryHit[]> {
    const hits: VectorQueryHit[] = [];
    for (const r of this.records.values()) {
      hits.push({ id: r.id, score: cosineSimilarity(vector, r.vector), metadata: r.metadata });
    }
    hits.sort((a, b) => b.score - a.score);
    return hits.slice(0, Math.max(0, k));
  }

  async clear(): Promise<void> {
    this.records.clear();
  }

  size(): number {
    return this.records.size;
  }

  async save(): Promise<void> {
    if (!this.path) return;
    const data: PersistShape = {
      version: 1,
      dimensions: this.dimensions,
      records: [...this.records.values()],
    };
    await mkdir(dirname(this.path), { recursive: true });
    await writeFile(this.path, JSON.stringify(data), "utf8");
  }

  async load(): Promise<void> {
    if (!this.path) return;
    let raw: string;
    try {
      raw = await readFile(this.path, "utf8");
    } catch {
      return; // no persisted index yet
    }
    const data = JSON.parse(raw) as PersistShape;
    this.records.clear();
    for (const r of data.records) this.records.set(r.id, r);
  }
}
