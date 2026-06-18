// SPDX-License-Identifier: Apache-2.0
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import type { Skill, FindResult, FindResponse } from "@iris-sylvia/protocol";
import {
  type EmbeddingProvider,
  type VectorStore,
  createEmbeddingProvider,
  createVectorStore,
  cosineSimilarity,
  embedQueries,
} from "@iris-sylvia/embeddings";
import { scanLibrary, type ScanResult } from "./scan.js";
import { buildTier1Index, type Tier1Options } from "./tier1.js";
import { skillIndexText, skillTriggerText, Bm25Index } from "./ranking.js";
import {
  fuse,
  DEFAULT_STRATEGY,
  type RetrievalStrategy,
  type FusionConfig,
  type Signal,
} from "./fusion.js";
import { confidence, scoreStats, DEFAULT_CONFIDENCE } from "./abstain.js";
import { readLockfile, writeLockfile, buildLockfile } from "./lockfile-io.js";
import { watchLibrary, type Unsubscribe } from "./watch.js";

export interface IrisLibraryOptions {
  /** Library root directory (folder of skill folders). */
  root: string;
  /** Embedding provider; defaults to the local offline provider. */
  provider?: EmbeddingProvider;
  /** Path for the persisted vector index; defaults to `<root>/.iris/index.json`. */
  indexPath?: string;
  /** Retrieval strategy (dense / sparse / a fusion). Default {@link DEFAULT_STRATEGY}. */
  strategy?: RetrievalStrategy;
  /** Lexical weight for the convex-combo fusions (`blend`/`znorm`/`minmax`). */
  lexicalWeight?: number;
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
  private readonly fusion: FusionConfig;
  private store: VectorStore;
  private indexed = new Map<string, IndexedSkill>();
  private bm25 = new Bm25Index([]);
  private errors: ScanResult["errors"] = [];

  constructor(opts: IrisLibraryOptions) {
    this.root = opts.root;
    this.provider = opts.provider ?? createEmbeddingProvider();
    this.indexPath = opts.indexPath ?? join(opts.root, ".iris", "index.json");
    this.fusion = { strategy: opts.strategy ?? DEFAULT_STRATEGY, lexicalWeight: opts.lexicalWeight };
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
    if (skills.length === 0) {
      this.bm25 = new Bm25Index([]);
      return;
    }
    // Corpus-aware lexical index (needs all skills to compute IDF / avg length).
    this.bm25 = new Bm25Index(
      skills.map((s) => ({ id: s.id, text: skillTriggerText(s), name: s.metadata.name })),
    );
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

  /**
   * Build the Tier-1 awareness mini-index. When `scopeIds` is given (Mode B),
   * only the loadout's skills are listed.
   */
  buildTier1Index(opts?: Tier1Options & { scopeIds?: string[] }): string {
    const skills = opts?.scopeIds
      ? this.skills().filter((s) => opts.scopeIds!.includes(s.id))
      : this.skills();
    return buildTier1Index(skills, opts);
  }

  /**
   * Tier-2 retrieval: embed the query, score every skill with a hybrid of
   * embedding cosine and lexical overlap, and return the top-k ranked results.
   *
   * Pass `scopeIds` to bound discovery to a loadout (Mode B). If nothing in the
   * scope matches and `allowBroaden` is set, retrieval falls back to the full
   * library.
   */
  async find(
    query: string,
    k = 5,
    opts?: { scopeIds?: string[]; allowBroaden?: boolean },
  ): Promise<FindResult[]> {
    if (this.indexed.size === 0 || query.trim().length === 0) return [];
    const [queryVec] = await embedQueries(this.provider, [query]);
    const qv = queryVec ?? [];

    const scopeSet = opts?.scopeIds ? new Set(opts.scopeIds) : undefined;
    let scored = this.scoreAgainst(query, qv, scopeSet);

    // Bounded discovery found nothing; broaden to the full library if allowed.
    if (scopeSet && scored.length === 0 && opts?.allowBroaden) {
      scored = this.scoreAgainst(query, qv, undefined);
    }
    scored.sort((a, b) => b.score - a.score);

    // Attach calibrated confidence using the *full* distribution (background
    // z-score + margin-to-next), before slicing to k.
    const { mean, std } = scoreStats(scored.map((s) => s.score));
    for (let i = 0; i < scored.length; i++) {
      const s = scored[i]!;
      const next = scored[i + 1]?.score ?? 0;
      const z = std > 0 ? (s.score - mean) / std : 0;
      s.confidence = confidence(s.score, s.score - next, z);
    }
    return scored.slice(0, Math.max(0, k));
  }

  /**
   * Like {@link find}, but also returns the query-level abstention signal: the
   * top candidate's confidence and `noStrongMatch`. This is what `find_skill`
   * surfaces so an agent can decide whether to act or ask.
   */
  async findDetailed(
    query: string,
    k = 5,
    opts?: { scopeIds?: string[]; allowBroaden?: boolean },
  ): Promise<FindResponse> {
    const results = await this.find(query, k, opts);
    // `find` already computed each result's confidence over the *full* candidate
    // distribution (not just the top-k), so reuse the top one directly.
    const top = results[0]?.confidence ?? 0;
    return {
      results,
      confidence: top,
      noStrongMatch: results.length === 0 || top < DEFAULT_CONFIDENCE.threshold,
    };
  }

  private scoreAgainst(query: string, qv: number[], scope?: Set<string>): FindResult[] {
    const signals: Signal[] = [];
    const meta = new Map<string, Skill>();
    for (const { skill, vector } of this.indexed.values()) {
      if (scope && !scope.has(skill.id)) continue;
      signals.push({
        id: skill.id,
        semantic: cosineSimilarity(qv, vector),
        lexical: this.bm25.score(query, skill.id),
      });
      meta.set(skill.id, skill);
    }

    const fused = fuse(signals, this.fusion);
    const scored: FindResult[] = [];
    for (const [id, skill] of meta) {
      scored.push({
        id,
        name: skill.metadata.name,
        score: fused.get(id) ?? 0,
        when_to_use: skill.metadata.when_to_use,
      });
    }
    return scored;
  }

  /**
   * Raw per-skill signals (dense cosine + sparse BM25) for a query — the inputs
   * to {@link fuse}. Exposed so the bench can sweep many fusion variants from a
   * single embedding pass instead of re-indexing per strategy.
   */
  async signals(query: string, opts?: { scopeIds?: string[] }): Promise<Signal[]> {
    if (this.indexed.size === 0 || query.trim().length === 0) return [];
    const [queryVec] = await embedQueries(this.provider, [query]);
    const qv = queryVec ?? [];
    const scope = opts?.scopeIds ? new Set(opts.scopeIds) : undefined;
    const signals: Signal[] = [];
    for (const { skill, vector } of this.indexed.values()) {
      if (scope && !scope.has(skill.id)) continue;
      signals.push({
        id: skill.id,
        semantic: cosineSimilarity(qv, vector),
        lexical: this.bm25.score(query, skill.id),
      });
    }
    return signals;
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
