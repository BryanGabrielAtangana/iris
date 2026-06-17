// SPDX-License-Identifier: Apache-2.0
import type { Skill } from "@iris/protocol";

/** Tokenize to lowercase alphanumeric tokens (shared with retrieval). */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

/**
 * The text that represents a skill for Tier-2 embedding. Discovery-relevant
 * fields (name, when_to_use, examples) are weighted by repetition so that the
 * embedding leans on intent signals rather than prose.
 */
export function skillIndexText(skill: Skill): string {
  const m = skill.metadata;
  const parts: string[] = [
    m.name,
    m.name, // weight the name
    m.description,
  ];
  if (m.when_to_use) parts.push(m.when_to_use, m.when_to_use);
  for (const ex of m.examples) parts.push(ex);
  if (m.tags.length) parts.push(m.tags.join(" "));
  return parts.join("\n");
}

/** The concise "trigger text" used for the lexical half of the score. */
export function skillTriggerText(skill: Skill): string {
  const m = skill.metadata;
  return [m.name, m.when_to_use ?? "", m.examples.join(" "), m.tags.join(" "), m.description]
    .join(" ")
    .trim();
}

/**
 * Lexical relevance in [0, 1]: the fraction of query tokens that appear in the
 * skill's trigger text, with a bonus when the skill's name tokens are present.
 */
export function lexicalScore(query: string, skill: Skill): number {
  const qTokens = new Set(tokenize(query));
  if (qTokens.size === 0) return 0;
  const triggerTokens = new Set(tokenize(skillTriggerText(skill)));

  let overlap = 0;
  for (const t of qTokens) if (triggerTokens.has(t)) overlap++;
  const coverage = overlap / qTokens.size;

  const nameTokens = new Set(tokenize(skill.metadata.name));
  let nameHits = 0;
  for (const t of nameTokens) if (qTokens.has(t)) nameHits++;
  const nameBonus = nameTokens.size > 0 ? nameHits / nameTokens.size : 0;

  return clamp01(0.8 * coverage + 0.2 * nameBonus);
}

export interface CombineWeights {
  embedding: number;
  lexical: number;
}

export const DEFAULT_WEIGHTS: CombineWeights = { embedding: 0.6, lexical: 0.4 };

/** Combine a (non-negative) embedding cosine and a lexical score into [0, 1]. */
export function combineScores(
  embeddingScore: number,
  lexical: number,
  weights: CombineWeights = DEFAULT_WEIGHTS,
): number {
  const total = weights.embedding + weights.lexical;
  const e = clamp01(embeddingScore);
  return clamp01((weights.embedding * e + weights.lexical * lexical) / total);
}

export function clamp01(x: number): number {
  if (Number.isNaN(x)) return 0;
  return Math.max(0, Math.min(1, x));
}
