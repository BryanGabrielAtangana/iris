// SPDX-License-Identifier: Apache-2.0
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import type { Skill, FindResult } from "@iris/protocol";
import {
  type EmbeddingProvider,
  type VectorStore,
  createEmbeddingProvider,
  createVectorStore,
  cosineSimilarity,
} from "@iris/embeddings";
import { scanLibrary, type ScanResult } from "./scan.js";
import { buildTier1Index, type Tier1Options } from "./tier1.js";
import {
  skillIndexText,
  lexicalScore,
  combineScores,
  type CombineWeights,
} from "./ranking.js";
import { readLockfile, writeLockfile, buildLockfile } from "./lockfile-io.js";
import { watchLibrary, type Unsubscribe } from "./watch.js";

export interface IrisLibraryOptions {
  /** Library root directory (folder of skill folders). */
  root: string;
  /** Embedding provider; defaults to the local offline provider. */
  provider?: EmbeddingProvider;
  /** Path for the persisted vector index; defaults to `<root>/.iris/index.json`. */
  indexPath?: string;
  /** Optional override for the embedding/lexical blend. */
  weights?: CombineWeights;
}

interface IndexedSkill {
  skill: Skill;
  vector: number[];
}

/**
 * A loaded Iris skill library: the single object the MCP server and CLI build
 * on. It owns the parsed skills, the Tier-1 awareness index, the Tier-2 vector
 * index and the lockfile.
 */
export class IrisLibrary {
  readonly root: string;
  private readonly provider: EmbeddingProvider;
  private readonly indexPath: string;
  private readonly weights?: CombineWeights;
  private store: VectorStore;
  private indexed = new Map<string, IndexedSkill>();
  private errors: ScanResult["errors"] = [];

  constructor(opts: IrisLibraryOptions) {
    this.root = opts.root;
    this.provider = opts.provider ?? createEmbeddingProvider();
    this.indexPath = opts.indexPath ?? join(opts.root, ".iris", "index.json");
    this.weights = opts.weights;
    this.store = createVectorStore({ dimensions: this.provider.dimensions, path: this.indexPath });
  }

  /** Scan the library, parse skills and (re)build the Tier-2 vector index. */
  async load(): Promise<void> {
    const result = await scanLibrary(this.root);
    this.errors = result.errors;
    await this.indexSkills(result.skills);
  }

  private async indexSkills(skills: Skill[]): Promise<void> {
    this.indexed.clear();
    await this.store.clear();
    if (skills.length === 0) return;
    const vectors = await this.provider.embed(skills.map(skillIndexText));
    const records = skills.map((skill, i) => {
      const vector = vectors[i] ?? [];
      this.indexed.set(skill.id, { skill, vector });
      return { id: skill.id, vector };
    });
    await this.store.upsert(records);
  }

  skills(): Skill[] {
    return [...this.indexed.values()].map((i) => i.skill);
  }

  getSkill(id: string): Skill | undefined {
    return this.indexed.get(id)?.skill;
  }

  scanErrors(): ScanResult["errors"] {
    return this.errors;
  }

  /** Build the Tier-1 awareness mini-index for the loaded skills. */
  buildTier1Index(opts?: Tier1Options): string {
    return buildTier1Index(this.skills(), opts);
  }

  /**
   * Tier-2 retrieval: embed the query, score every skill with a hybrid of
   * embedding cosine and lexical overlap, and return the top-k ranked results.
   */
  async find(query: string, k = 5): Promise<FindResult[]> {
    if (this.indexed.size === 0 || query.trim().length === 0) return [];
    const [queryVec] = await this.provider.embed([query]);
    const qv = queryVec ?? [];

    const scored: FindResult[] = [];
    for (const { skill, vector } of this.indexed.values()) {
      const embeddingScore = cosineSimilarity(qv, vector);
      const lexical = lexicalScore(query, skill);
      const score = combineScores(embeddingScore, lexical, this.weights);
      scored.push({
        id: skill.id,
        name: skill.metadata.name,
        score,
        when_to_use: skill.metadata.when_to_use,
      });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, Math.max(0, k));
  }

  /** Tier-3: return the full SKILL.md body for a skill id. */
  async loadBody(id: string): Promise<string | undefined> {
    return this.getSkill(id)?.body;
  }

  /** Read a bundled reference/script/asset file for a skill. */
  async loadReference(id: string, ref: string): Promise<string | undefined> {
    const skill = this.getSkill(id);
    if (!skill) return undefined;
    const normalized = ref.replace(/^[./\\]+/, "");
    const known = [...skill.references, ...skill.scripts, ...skill.assets];
    if (!known.includes(normalized)) return undefined;
    try {
      return await readFile(join(skill.dir, normalized), "utf8");
    } catch {
      return undefined;
    }
  }

  // --- lockfile ---

  async readLock() {
    return readLockfile(this.root);
  }

  /** Pin the currently-loaded skills into `iris.lock`. */
  async writeLock(): Promise<void> {
    const lock = await buildLockfile(this.skills(), this.root);
    await writeLockfile(this.root, lock);
  }

  // --- persistence & hot reload ---

  async saveIndex(): Promise<void> {
    await this.store.save();
  }

  /**
   * Watch the library for changes and reload on debounce. The callback fires
   * after the index has been rebuilt so callers can emit MCP notifications.
   */
  watch(onChange: () => void): Unsubscribe {
    return watchLibrary(this.root, async () => {
      await this.load();
      onChange();
    });
  }
}
