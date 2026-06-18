// SPDX-License-Identifier: Apache-2.0
import { type Skill, type Tier1Entry, TIER1_TOKEN_BUDGET, estimateTokens } from "@iris/protocol";

/** Derive the Tier-1 one-liner for a skill. */
export function tier1Line(skill: Skill): string {
  const when =
    skill.metadata.when_to_use?.trim() ||
    firstSentence(skill.metadata.description) ||
    skill.metadata.description;
  return `- ${skill.metadata.name} — ${when}`;
}

export function toTier1Entry(skill: Skill): Tier1Entry {
  return {
    id: skill.id,
    name: skill.metadata.name,
    when_to_use: skill.metadata.when_to_use?.trim() || firstSentence(skill.metadata.description),
  };
}

function firstSentence(text: string): string {
  const match = text.match(/^.*?[.!?](\s|$)/);
  return (match ? match[0] : text).trim();
}

export interface Tier1Options {
  /** Soft token budget; defaults to the protocol's TIER1_TOKEN_BUDGET. */
  budget?: number;
}

/**
 * Build the always-present Tier-1 "Awareness" mini-index: one line per skill.
 *
 * The index is deterministic (skills are sorted by name) and regenerable. If
 * the rendered index would exceed the token budget, lines are truncated and a
 * summary footer is appended pointing the agent at `iris_find` for the rest —
 * awareness is preserved even when the full list cannot fit.
 */
export function buildTier1Index(skills: Skill[], opts: Tier1Options = {}): string {
  const budget = opts.budget ?? TIER1_TOKEN_BUDGET;
  const sorted = [...skills].sort((a, b) => a.metadata.name.localeCompare(b.metadata.name));
  const lines = sorted.map(tier1Line);

  const header = "# Available skills (Iris) — call find_skill to retrieve, load_skill to open";
  const full = [header, ...lines].join("\n");
  if (estimateTokens(full) <= budget) return full;

  // Over budget: keep as many full lines as fit, then summarise the remainder.
  const kept: string[] = [header];
  let used = estimateTokens(header);
  let shown = 0;
  for (const line of lines) {
    const cost = estimateTokens(line) + 1;
    if (used + cost > budget - 20) break;
    kept.push(line);
    used += cost;
    shown++;
  }
  const remaining = lines.length - shown;
  if (remaining > 0) {
    kept.push(`- …and ${remaining} more skills — call find_skill to discover them by intent.`);
  }
  return kept.join("\n");
}
