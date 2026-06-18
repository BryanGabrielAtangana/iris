// SPDX-License-Identifier: Apache-2.0
import type { EvalCase } from "./dataset.js";

/**
 * The v0.3 labeled set over the 15-skill starter library.
 *
 * Categories:
 *  - SEMANTIC_ONLY: paraphrases that share *no meaningful surface form* with the
 *    target skill (true synonyms / restructured phrasing). The lexical engine
 *    must score low here (≤ 40% acc@1) — it is the proof the eval isolates
 *    meaning rather than shared keywords.
 *  - POSITIVES: the full positive set (includes SEMANTIC_ONLY plus more natural
 *    paraphrases), ≥ 100 cases across the library.
 *  - AMBIGUOUS: queries that legitimately match two skills (any-of accepted).
 *  - NEGATIVES_OOD: out-of-domain queries that match nothing.
 *  - NEGATIVES_NEARMISS: in-domain-sounding queries with no correct skill (e.g.
 *    adjacent to a skill's area but not actually covered) — must be rejected.
 */

export const SEMANTIC_ONLY: EvalCase[] = [
  // git-commit-message
  { query: "phrase a short note that records what I just altered, for the team's source-control history", expected: "git-commit-message" },
  { query: "describe the work I finished so it reads well when saving a snapshot to the repository", expected: "git-commit-message" },

  // pdf-forms
  { query: "enter my personal details into the empty boxes on a tax return and seal it so nobody can edit it", expected: "pdf-forms" },
  { query: "bind several separate printable pages into a single booklet", expected: "pdf-forms" },

  // changelog-update
  { query: "record this new capability in the project's running list of notable improvements", expected: "changelog-update" },

  // regex-builder
  { query: "validate whether a string looks like a proper hex color code", expected: "regex-builder" },
  { query: "design a recognizer for text that looks like a license plate", expected: "regex-builder" },

  // sql-migration
  { query: "add a new property to how my application's records are persisted in the backing store", expected: "sql-migration" },

  // csv-wrangler
  { query: "strip out the repeated lines from a comma-delimited grid of data", expected: "csv-wrangler" },

  // api-mock-server
  { query: "set up a stand-in backend that always answers with the same hardcoded data while I build the frontend", expected: "api-mock-server" },

  // dockerfile-author
  { query: "write the recipe that bundles my app into an isolated, portable runnable package", expected: "dockerfile-author" },

  // web-scraper
  { query: "automatically collect the advertised costs shown across an online shop", expected: "web-scraper" },

  // image-resizer
  { query: "make these pictures smaller and switch them to a different file type", expected: "image-resizer" },

  // json-transformer
  { query: "flatten a deeply nested set of key-value records into a simpler layout", expected: "json-transformer" },

  // env-config
  { query: "keep my app's configuration values and credentials out of the codebase", expected: "env-config" },

  // http-request
  { query: "reach out to a remote service over the network and read back what it sends", expected: "http-request" },

  // markdown-toc
  { query: "build a clickable list of links to each part of a long write-up", expected: "markdown-toc" },

  // cron-scheduler
  { query: "set up something to happen on its own at the start of each business day", expected: "cron-scheduler" },
];

export const POSITIVES: EvalCase[] = [
  ...SEMANTIC_ONLY,

  // git-commit-message
  { query: "write a commit message for my staged changes", expected: "git-commit-message" },
  { query: "turn this diff into a conventional commit", expected: "git-commit-message" },
  { query: "summarize my staged changes for the commit", expected: "git-commit-message" },

  // pdf-forms
  { query: "fill out this pdf form with my information", expected: "pdf-forms" },
  { query: "merge these two pdfs into one", expected: "pdf-forms" },
  { query: "extract the text from a pdf document", expected: "pdf-forms" },

  // changelog-update
  { query: "add a changelog entry for this feature", expected: "changelog-update" },
  { query: "record this fix under the unreleased section of the changelog", expected: "changelog-update" },
  { query: "update keep-a-changelog for the new release", expected: "changelog-update" },

  // regex-builder
  { query: "write a regex to match email addresses", expected: "regex-builder" },
  { query: "build a regular expression for phone numbers", expected: "regex-builder" },
  { query: "debug why my regex isn't matching dates", expected: "regex-builder" },

  // sql-migration
  { query: "write a database migration to add a column", expected: "sql-migration" },
  { query: "create a migration for an orders table", expected: "sql-migration" },
  { query: "add an index to speed up a slow query as a schema change", expected: "sql-migration" },

  // csv-wrangler
  { query: "remove duplicate rows from this csv", expected: "csv-wrangler" },
  { query: "filter the csv to rows where status is active", expected: "csv-wrangler" },
  { query: "clean up this messy spreadsheet", expected: "csv-wrangler" },

  // api-mock-server
  { query: "mock a rest endpoint that returns sample users", expected: "api-mock-server" },
  { query: "stub an api so my tests don't hit the network", expected: "api-mock-server" },
  { query: "serve canned json responses for local development", expected: "api-mock-server" },

  // dockerfile-author
  { query: "write a dockerfile for my node app", expected: "dockerfile-author" },
  { query: "make my docker image smaller with a multi-stage build", expected: "dockerfile-author" },
  { query: "containerize this python service", expected: "dockerfile-author" },

  // web-scraper
  { query: "scrape product data from this website", expected: "web-scraper" },
  { query: "extract all the links from a web page", expected: "web-scraper" },
  { query: "pull structured data out of some html", expected: "web-scraper" },

  // image-resizer
  { query: "resize these images to thumbnails", expected: "image-resizer" },
  { query: "convert a png to a jpg", expected: "image-resizer" },
  { query: "crop and resize this photo", expected: "image-resizer" },

  // json-transformer
  { query: "reshape this json structure", expected: "json-transformer" },
  { query: "filter json objects by a field value", expected: "json-transformer" },
  { query: "transform this json into a different shape", expected: "json-transformer" },

  // env-config
  { query: "create a .env file for this project", expected: "env-config" },
  { query: "add a new environment variable", expected: "env-config" },
  { query: "manage local secrets with dotenv", expected: "env-config" },

  // http-request
  { query: "call this rest endpoint and show the response", expected: "http-request" },
  { query: "send a post request with a json body", expected: "http-request" },
  { query: "make an http request to an api and inspect the result", expected: "http-request" },

  // markdown-toc
  { query: "add a table of contents to this readme", expected: "markdown-toc" },
  { query: "generate a toc from the markdown headings", expected: "markdown-toc" },
  { query: "build a table of contents for my docs", expected: "markdown-toc" },

  // cron-scheduler
  { query: "what cron expression runs every 15 minutes", expected: "cron-scheduler" },
  { query: "schedule a job to run every weekday at 9am", expected: "cron-scheduler" },
  { query: "write a cron schedule for a nightly task", expected: "cron-scheduler" },

  // --- additional natural paraphrases (volume) ---
  { query: "help me word the commit for these staged edits", expected: "git-commit-message" },
  { query: "improve this commit message", expected: "git-commit-message" },
  { query: "draft a commit summarizing the bug fix I just made", expected: "git-commit-message" },

  { query: "split this pdf into separate pages", expected: "pdf-forms" },
  { query: "fill in the fields of this application pdf", expected: "pdf-forms" },
  { query: "pull the form data out of a filled pdf", expected: "pdf-forms" },

  { query: "what goes under unreleased in the changelog", expected: "changelog-update" },
  { query: "log this breaking change in the changelog", expected: "changelog-update" },
  { query: "write a changelog note for the bug fix", expected: "changelog-update" },

  { query: "construct a regex for matching urls", expected: "regex-builder" },
  { query: "explain what this regular expression does", expected: "regex-builder" },
  { query: "make a pattern to extract hashtags from text", expected: "regex-builder" },

  { query: "rename a database column without downtime via a migration", expected: "sql-migration" },
  { query: "write a reversible schema migration", expected: "sql-migration" },
  { query: "add a foreign key with a migration", expected: "sql-migration" },

  { query: "deduplicate rows in this spreadsheet", expected: "csv-wrangler" },
  { query: "join two csv files on an id column", expected: "csv-wrangler" },
  { query: "normalize and clean the columns in this tabular data", expected: "csv-wrangler" },

  { query: "fake a webhook receiver for local testing", expected: "api-mock-server" },
  { query: "return hardcoded json from a mock endpoint", expected: "api-mock-server" },
  { query: "stub out the payments api for my tests", expected: "api-mock-server" },

  { query: "write a multi-stage dockerfile for a go service", expected: "dockerfile-author" },
  { query: "reduce the size of my container image", expected: "dockerfile-author" },
  { query: "add a non-root user to my dockerfile", expected: "dockerfile-author" },

  { query: "scrape the headlines from a news website", expected: "web-scraper" },
  { query: "extract table data from an html page", expected: "web-scraper" },
  { query: "crawl a site and collect product info", expected: "web-scraper" },

  { query: "batch resize a folder of images", expected: "image-resizer" },
  { query: "convert these images from heic to jpg", expected: "image-resizer" },
  { query: "generate thumbnails from these pictures", expected: "image-resizer" },

  { query: "extract a field from each object in this json array", expected: "json-transformer" },
  { query: "map this json into a new structure", expected: "json-transformer" },
  { query: "merge and reshape these json objects", expected: "json-transformer" },

  { query: "document which environment variables my app needs", expected: "env-config" },
  { query: "load config from a .env file", expected: "env-config" },
  { query: "keep api keys out of source control", expected: "env-config" },

  { query: "make a GET request to this api and parse the json", expected: "http-request" },
  { query: "send an authenticated request with a bearer token", expected: "http-request" },
  { query: "hit this endpoint and check the status code", expected: "http-request" },

  { query: "insert a table of contents into my markdown", expected: "markdown-toc" },
  { query: "list all the headings as a contents section", expected: "markdown-toc" },
  { query: "auto-generate a toc for this long readme", expected: "markdown-toc" },

  { query: "schedule something to run on the first of every month", expected: "cron-scheduler" },
  { query: "cron syntax for every hour on the hour", expected: "cron-scheduler" },
  { query: "run a backup job every sunday at midnight", expected: "cron-scheduler" },
];

export const AMBIGUOUS: EvalCase[] = [
  { query: "convert this data file into a different format", expected: ["csv-wrangler", "json-transformer", "image-resizer"] },
  { query: "set up automated tests against a fake backend", expected: ["api-mock-server", "http-request"] },
  { query: "document the recent updates for this version", expected: ["changelog-update", "git-commit-message"] },
  { query: "transform and clean this dataset", expected: ["csv-wrangler", "json-transformer"] },
];

/** Out-of-domain — nothing in the library handles these. */
export const NEGATIVES_OOD: string[] = [
  "what's the weather going to be tomorrow",
  "translate this paragraph into French",
  "book me a flight to Tokyo next week",
  "recommend a good Italian restaurant nearby",
  "what is 17 multiplied by 34",
  "play some relaxing jazz music",
  "summarize the plot of this novel",
  "who won the football match last night",
  "what's a good name for my cat",
  "convert 100 dollars to euros",
  "remind me to call my mom at 6pm",
  "write a poem about the ocean",
  "what's the capital of Australia",
  "how do I tie a bow tie",
  "plan a three-day trip to Rome",
  "draft an out-of-office email reply",
  "what stocks should I buy today",
  "tell me a fun fact about space",
  "how many calories are in a banana",
  "suggest a workout routine for beginners",
  "what's the meaning of life",
  "help me practice Spanish vocabulary",
  "design a logo for my coffee shop",
  "what movies are playing this weekend",
  "write a haiku about autumn",
  "what time zone is New York in",
  "give me a recipe for banana bread",
  "how do I meditate properly",
  "summarize today's top news",
  "what's a good gift for a 5 year old",
];

/**
 * Near-miss — adjacent to a skill's domain but NOT actually covered by any
 * skill in the library. A good system must still abstain (no skill is right).
 */
export const NEGATIVES_NEARMISS: string[] = [
  "deploy my container to a kubernetes cluster", // docker-adjacent, no k8s skill
  "set up a CI/CD pipeline in github actions", // devops-adjacent, no CI skill
  "roll back a deployment to the previous version", // ops-adjacent, no deploy skill
  "design the database tables for an e-commerce app from scratch", // data-modeling, not a migration
  "train a machine learning model on this dataset", // data-adjacent, no ML skill
  "optimize this SQL query's execution plan for performance", // sql-adjacent, not a migration
  "set up oauth login for my web app", // auth, not covered
  "write unit tests for this function", // testing-adjacent, no test-writing skill
  "profile my node app to find a memory leak", // perf, not covered
  "encrypt these files with a password", // security-adjacent, not env-config
  "generate fake user data for seeding", // data-adjacent, no faker skill
  "compress this folder into a zip archive", // file-adjacent, no archive skill
  "lint and format my typescript code", // tooling, not covered
  "parse and validate an xml document", // data-adjacent, not json
  "send a templated marketing email campaign", // email, not http-request
  "set up websocket streaming between client and server", // network-adjacent, not http-request
  "provision a load balancer in front of my servers", // infra, not covered
  "write terraform to create cloud resources", // IaC, not covered
  "set up monitoring and alerting for my service", // observability, not covered
  "migrate my data from mongodb to postgres", // data-move, not a schema migration
  "rotate the api keys stored in my secrets manager", // secrets-adjacent, not env-config setup
  "build a graphql schema for my api", // api-adjacent, not covered
];
