// SPDX-License-Identifier: Apache-2.0

/**
 * A labeled retrieval example: a user query and the skill(s) that should win.
 * `expected` may be an array for ambiguous queries that legitimately match more
 * than one skill (any of them counts as correct at acc@1).
 */
export interface EvalCase {
  query: string;
  expected: string | string[];
}

/** True when `id` satisfies a case's expectation (single id or any-of array). */
export function matchesExpected(expected: string | string[], id: string): boolean {
  return Array.isArray(expected) ? expected.includes(id) : expected === id;
}

/**
 * Labeled query → expected-skill dataset over the starter `skills/` library.
 * Queries deliberately avoid copying the skill name verbatim so the benchmark
 * measures intent matching, not string equality.
 */
export const DATASET: EvalCase[] = [
  // git-commit-message
  { query: "summarize my staged changes into a commit", expected: "git-commit-message" },
  { query: "what should I write in this commit", expected: "git-commit-message" },
  { query: "turn this diff into a conventional commit", expected: "git-commit-message" },
  {
    query: "help me describe these code changes for version control",
    expected: "git-commit-message",
  },

  // pdf-forms
  { query: "fill in the fields of this pdf application", expected: "pdf-forms" },
  { query: "pull the text out of a pdf document", expected: "pdf-forms" },
  { query: "combine several pdfs into a single file", expected: "pdf-forms" },
  { query: "split a pdf into individual pages", expected: "pdf-forms" },

  // changelog-update
  { query: "record this fix under the unreleased section", expected: "changelog-update" },
  { query: "add a note to the changelog for the new feature", expected: "changelog-update" },
  { query: "update keep a changelog for the release", expected: "changelog-update" },

  // regex-builder
  { query: "create a pattern that matches email addresses", expected: "regex-builder" },
  { query: "my regular expression isn't matching, help me debug it", expected: "regex-builder" },
  { query: "build an expression to capture phone numbers", expected: "regex-builder" },
  { query: "match dates inside a block of text", expected: "regex-builder" },

  // sql-migration
  { query: "add a nullable column to the accounts table", expected: "sql-migration" },
  { query: "write a reversible schema change for the database", expected: "sql-migration" },
  { query: "create an index to speed up a slow query", expected: "sql-migration" },
  { query: "rename a database column safely without downtime", expected: "sql-migration" },

  // csv-wrangler
  { query: "drop duplicate rows from a spreadsheet", expected: "csv-wrangler" },
  { query: "keep only the rows where status equals active", expected: "csv-wrangler" },
  { query: "join two csv files on an id column", expected: "csv-wrangler" },
  { query: "clean up messy tabular data", expected: "csv-wrangler" },

  // api-mock-server
  { query: "stub a rest endpoint so my tests don't hit the network", expected: "api-mock-server" },
  { query: "serve fake json responses during development", expected: "api-mock-server" },
  { query: "set up a fake webhook receiver locally", expected: "api-mock-server" },

  // dockerfile-author
  { query: "containerize my node service", expected: "dockerfile-author" },
  { query: "shrink the size of my container image", expected: "dockerfile-author" },
  { query: "add a multi-stage build for my app image", expected: "dockerfile-author" },
  { query: "write a container build file for a python app", expected: "dockerfile-author" },
];
