// SPDX-License-Identifier: Apache-2.0
import { z } from "zod";

/**
 * One entry of the Tier-1 "Awareness" mini-index.
 * Rendered as `- <name> — <when_to_use>`.
 */
export const Tier1Entry = z.object({
  id: z.string(),
  name: z.string(),
  when_to_use: z.string(),
});

export type Tier1Entry = z.infer<typeof Tier1Entry>;

/**
 * A ranked candidate returned by Tier-2 retrieval (`iris_find`).
 */
export const FindResult = z.object({
  id: z.string(),
  name: z.string(),
  /** Relevance score in [0, 1]; higher is better. */
  score: z.number(),
  when_to_use: z.string().optional(),
});

export type FindResult = z.infer<typeof FindResult>;

/**
 * Soft budget for the Tier-1 index. The mini-index must stay tiny because it
 * is always present in context. Estimated in tokens (~4 chars/token).
 */
export const TIER1_TOKEN_BUDGET = 1000;

/** Rough token estimate used to keep the Tier-1 index within budget. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
