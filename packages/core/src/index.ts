// SPDX-License-Identifier: Apache-2.0

/**
 * @iris/core — parsing, indexing (Tier-1 + Tier-2), retrieval/ranking and the
 * lockfile. Depends only on @iris/protocol and @iris/embeddings.
 */
export * from "./parse-skill.js";
export * from "./scan.js";
export * from "./tier1.js";
export * from "./ranking.js";
export * from "./lockfile-io.js";
export * from "./watch.js";
export * from "./library.js";

// Re-export the protocol surface for convenience so downstream packages can
// import from a single place.
export type {
  Skill,
  SkillMetadata,
  FindResult,
  Tier1Entry,
  Lockfile,
  LockEntry,
} from "@iris/protocol";
export {
  PROTOCOL_VERSION,
  TIER1_TOKEN_BUDGET,
  estimateTokens,
  generateJsonSchema,
  parseSkillMetadata,
  SkillValidationError,
} from "@iris/protocol";
