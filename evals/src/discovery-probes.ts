// SPDX-License-Identifier: Apache-2.0
//
// Blind discovery probe set (handoff v0.5 Task B). Natural-language tasks that
// *should* trigger a skill — but NEVER name a skill or say "use a skill". The
// agent has to recognize the intent and reach for find_skill on its own.
//
// expect: skill id (should fire that skill) · string[] (any-of, ambiguous) ·
//         null (near-miss — in-domain-sounding but NO skill fits; fire nothing).

export type ProbeCategory = "obvious" | "paraphrase" | "near-miss" | "ambiguous";

export interface Probe {
  id: string;
  prompt: string;
  expect: string | string[] | null;
  category: ProbeCategory;
}

export const PROBES: Probe[] = [
  // --- obvious: clear intent, plain language, skill unnamed ---
  { id: "o-git", category: "obvious", expect: "git-commit-message", prompt: "I just finished reworking the login flow — help me wrap up this change in version control." },
  { id: "o-pdf", category: "obvious", expect: "pdf-forms", prompt: "I have a PDF application form and need to put my name, address and date into the fields." },
  { id: "o-changelog", category: "obvious", expect: "changelog-update", prompt: "We're cutting a release — I need to note the new features and fixes somewhere users will see them." },
  { id: "o-regex", category: "obvious", expect: "regex-builder", prompt: "I need a pattern to pull all the email addresses out of this blob of text." },
  { id: "o-sql", category: "obvious", expect: "sql-migration", prompt: "Add a last_login timestamp column to the users table, in a way that's safe to roll out to production." },
  { id: "o-csv", category: "obvious", expect: "csv-wrangler", prompt: "This spreadsheet export has a bunch of duplicate rows I want gone." },
  { id: "o-mock", category: "obvious", expect: "api-mock-server", prompt: "I want a fake backend that returns canned JSON so I can build the UI before the real API exists." },
  { id: "o-docker", category: "obvious", expect: "dockerfile-author", prompt: "Package my Node service so it runs the same everywhere." },
  { id: "o-scrape", category: "obvious", expect: "web-scraper", prompt: "Grab all the product prices off this shop's listing pages automatically." },
  { id: "o-image", category: "obvious", expect: "image-resizer", prompt: "These photos are huge — shrink them and save them as WebP." },
  { id: "o-json", category: "obvious", expect: "json-transformer", prompt: "Flatten this deeply nested JSON into something flat I can put in a table." },
  { id: "o-env", category: "obvious", expect: "env-config", prompt: "Keep my database password and API keys out of the source code." },
  { id: "o-http", category: "obvious", expect: "http-request", prompt: "Call this REST endpoint and show me what it sends back." },
  { id: "o-toc", category: "obvious", expect: "markdown-toc", prompt: "Build a linked table of contents for this long markdown document." },
  { id: "o-cron", category: "obvious", expect: "cron-scheduler", prompt: "Run a cleanup job automatically every night at 2am." },

  // --- paraphrase: oblique phrasing, true synonyms ---
  { id: "p-git", category: "paraphrase", expect: "git-commit-message", prompt: "I'm about to record my work into the project history but I'm blanking on how to phrase what I changed." },
  { id: "p-pdf", category: "paraphrase", expect: "pdf-forms", prompt: "Stamp my personal details onto this document's empty boxes and seal it so nobody can edit it." },
  { id: "p-regex", category: "paraphrase", expect: "regex-builder", prompt: "Check whether a string the user typed is a well-formed hex colour code." },
  { id: "p-csv", category: "paraphrase", expect: "csv-wrangler", prompt: "Reshape a messy comma-separated dump into clean, filtered columns." },
  { id: "p-cron", category: "paraphrase", expect: "cron-scheduler", prompt: "Set something up to happen on its own on the first of every month." },
  { id: "p-scrape", category: "paraphrase", expect: "web-scraper", prompt: "Pull structured data off a website that doesn't offer any API." },

  // --- near-miss: sounds in-domain, but NO skill covers it → fire nothing ---
  { id: "n-k8s", category: "near-miss", expect: null, prompt: "Deploy my container to a Kubernetes cluster with three replicas and autoscaling." },
  { id: "n-queryopt", category: "near-miss", expect: null, prompt: "Optimize this slow database query's execution plan with better indexes." },
  { id: "n-tests", category: "near-miss", expect: null, prompt: "Write unit tests for this React component." },
  { id: "n-ci", category: "near-miss", expect: null, prompt: "Set up a CI/CD pipeline that runs my test suite on every push." },
  { id: "n-bundle", category: "near-miss", expect: null, prompt: "Minify and tree-shake my JavaScript bundle for production." },

  // --- ambiguous: two+ skills legitimately apply (any-of) ---
  { id: "a-convert", category: "ambiguous", expect: ["csv-wrangler", "json-transformer", "image-resizer"], prompt: "Convert this data file into a different format." },
  { id: "a-faketest", category: "ambiguous", expect: ["api-mock-server", "http-request"], prompt: "Set up automated tests that run against a fake backend." },
  { id: "a-document", category: "ambiguous", expect: ["changelog-update", "git-commit-message"], prompt: "Document the recent updates for this new version." },
];

export function matchesProbe(expect: Probe["expect"], id: string): boolean {
  if (expect === null) return false;
  return Array.isArray(expect) ? expect.includes(id) : expect === id;
}
