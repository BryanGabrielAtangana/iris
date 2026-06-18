// SPDX-License-Identifier: Apache-2.0
import type { EvalCase } from "./dataset.js";

/**
 * The HARD set: paraphrased, indirect queries that deliberately avoid the
 * skill's own vocabulary (name / when_to_use / examples). This measures whether
 * retrieval matches *meaning*, not shared keywords — the property that makes
 * discovery consistent for real users who phrase things their own way.
 */
export const HARD_CASES: EvalCase[] = [
  // git-commit-message
  {
    query: "describe the edits I just staged so they land in source control",
    expected: "git-commit-message",
  },
  {
    query: "what wording should accompany this set of changes when I save it to the repo history",
    expected: "git-commit-message",
  },
  { query: "summarize my diff into a short conventional message", expected: "git-commit-message" },

  // pdf-forms
  { query: "populate the fields in this electronic application document", expected: "pdf-forms" },
  { query: "stitch several portable documents into a single file", expected: "pdf-forms" },
  { query: "pull the written content out of an exported acroform", expected: "pdf-forms" },

  // changelog-update
  {
    query: "note this new capability in the project's release history file",
    expected: "changelog-update",
  },
  { query: "record what changed under the upcoming version section", expected: "changelog-update" },
  {
    query: "add a user-facing bullet about this fix to the changes log",
    expected: "changelog-update",
  },

  // regex-builder
  {
    query: "craft a pattern that recognizes valid email-looking strings",
    expected: "regex-builder",
  },
  {
    query: "my expression for matching phone numbers isn't catching them, help me fix it",
    expected: "regex-builder",
  },
  { query: "design a matcher that extracts dates from free text", expected: "regex-builder" },

  // sql-migration
  { query: "evolve the database schema to add a new field to a table", expected: "sql-migration" },
  { query: "write a reversible change to introduce an orders table", expected: "sql-migration" },
  {
    query: "speed up a slow query by adding the right index, as a schema change",
    expected: "sql-migration",
  },

  // csv-wrangler
  { query: "tidy a messy spreadsheet and drop the repeated rows", expected: "csv-wrangler" },
  { query: "keep only the records where the status field says active", expected: "csv-wrangler" },
  { query: "combine two comma-separated files on a shared key column", expected: "csv-wrangler" },

  // api-mock-server
  {
    query: "spin up a throwaway endpoint that returns canned responses for my tests",
    expected: "api-mock-server",
  },
  {
    query: "fake a backend so my front-end tests don't hit the real service",
    expected: "api-mock-server",
  },
  { query: "serve some hardcoded JSON locally while I develop", expected: "api-mock-server" },

  // dockerfile-author
  {
    query: "package my node service into a small reproducible image",
    expected: "dockerfile-author",
  },
  { query: "shrink the size of the container build for my app", expected: "dockerfile-author" },
  {
    query: "write the build recipe to run my python app in a container",
    expected: "dockerfile-author",
  },
];

/**
 * Out-of-domain queries that match NOTHING in the library. A good system
 * returns low scores here so the agent doesn't force an irrelevant skill — the
 * "knows when to stay quiet" half of consistency.
 */
export const NEGATIVE_QUERIES: string[] = [
  "what's the weather going to be tomorrow",
  "translate this paragraph into French",
  "book me a flight to Tokyo next week",
  "recommend a good Italian restaurant nearby",
  "what is 17 multiplied by 34",
  "play some relaxing jazz music",
  "summarize the plot of this novel",
  "who won the football match last night",
];
