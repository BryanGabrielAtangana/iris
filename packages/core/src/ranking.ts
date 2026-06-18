// SPDX-License-Identifier: Apache-2.0
import type { Skill } from "@iris-sylvia/protocol";

/** Tokenize to lowercase alphanumeric tokens (shared with retrieval). */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

/**
 * The single weighted-concat "blob" representation. Retained for the bench-off
 * baseline; {@link skillFields} is the production representation.
 */
export function skillIndexText(skill: Skill): string {
  const m = skill.metadata;
  const parts: string[] = [m.name, m.name, m.description];
  if (m.when_to_use) parts.push(m.when_to_use, m.when_to_use);
  for (const ex of m.examples) parts.push(ex);
  if (m.tags.length) parts.push(m.tags.join(" "));
  return parts.join("\n");
}

/** A field of a skill that is embedded as its own retrieval target. */
export interface SkillField {
  text: string;
  weight: number;
}

/**
 * Retrieval representation: the rich **blob** (the proven baseline vector) as the
 * primary target, plus a few **sharp single-field targets** — `when_to_use` and
 * **each `example`** (examples are proxy queries, the strongest available
 * signal). A skill is scored by its *best-matching* target (max-over-fields), so
 * the blob anchors a floor while a strong single-example/intent match can win
 * without being diluted by surrounding prose.
 *
 * Deliberately omits `name`/`tags`/`description` as *standalone* vectors: those
 * fragments embed poorly in isolation (context-free), inflate negatives under
 * the max, and already live inside the blob. An earlier draft that exploded
 * every field into its own vector regressed semantic-only acc@1 (83.3% → 72.2%)
 * and negative rejection — keeping the blob as the floor is what fixes that.
 */
export function skillFields(skill: Skill): SkillField[] {
  const m = skill.metadata;
  const fields: SkillField[] = [];
  const seen = new Set<string>();
  const push = (text: string | undefined, weight: number): void => {
    const t = text?.trim();
    if (!t) return;
    const key = t.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    fields.push({ text: t, weight });
  };
  push(skillIndexText(skill), 1.0); // rich blob — the baseline floor
  push(m.when_to_use, 1.0); // sharp intent target
  for (const ex of m.examples) push(ex, 1.0); // proxy queries — strongest signal
  return fields;
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
