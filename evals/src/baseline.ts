// SPDX-License-Identifier: Apache-2.0
import type { Skill, FindResult } from "@iris-sylvia/core";
import {
  createEmbeddingProvider,
  cosineSimilarity,
  type EmbeddingProvider,
} from "@iris-sylvia/embeddings";

/**
 * The naive baseline that Iris must beat.
 *
 * It models today's status quo: every skill's flat `name + description` is
 * dumped into the agent's context and it picks by similarity over that text
 * alone — no `when_to_use`, no `examples`, no `tags`, and no lexical/hybrid
 * re-ranking. We approximate the agent's judgment with embedding similarity
 * over the same flat text, using the same provider so the only variable is the
 * richer metadata + ranking that Iris adds.
 */
export class NaiveBaseline {
  private readonly provider: EmbeddingProvider;
  private vectors = new Map<string, { skill: Skill; vector: number[] }>();

  constructor(provider: EmbeddingProvider = createEmbeddingProvider()) {
    this.provider = provider;
  }

  async index(skills: Skill[]): Promise<void> {
    const texts = skills.map((s) => `${s.metadata.name}. ${s.metadata.description}`);
    const vecs = await this.provider.embed(texts);
    this.vectors.clear();
    skills.forEach((skill, i) => this.vectors.set(skill.id, { skill, vector: vecs[i] ?? [] }));
  }

  async find(query: string, k: number): Promise<FindResult[]> {
    const [qv] = await this.provider.embed([query]);
    const q = qv ?? [];
    const scored: FindResult[] = [];
    for (const { skill, vector } of this.vectors.values()) {
      scored.push({
        id: skill.id,
        name: skill.metadata.name,
        score: Math.max(0, cosineSimilarity(q, vector)),
        when_to_use: skill.metadata.when_to_use,
      });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, k);
  }
}
