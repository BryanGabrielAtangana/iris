# Iris examples

Iris knows every capability you own and hands the right one to whatever agent
you're working with, exactly when it's needed. The examples in this directory
show that end to end — from cloning the repo to watching the right skill fire
inside an agent.

## What's inside

- [`quickstart/`](./quickstart/README.md) — **Start here.** A complete,
  copy-pasteable walkthrough that takes a brand-new user from `git clone` to a
  working setup: building the monorepo, creating a skill library, searching it,
  syncing skills into a project, and connecting the Iris MCP server to Claude
  Code (or any MCP client). Ends by showing the right skill being surfaced and
  loaded for a real task.

## Background

Iris uses **two-tier discovery** so agents stay aware of every skill without
paying to load them all:

- **Tier 1 — awareness.** A compact mini-index of every skill (name + when to
  use) is always in context. For Claude Code this is injected into `CLAUDE.md`;
  for the MCP server it lives in the `iris_find` tool description.
- **Tier 2 — retrieval.** `iris search` / `iris_find` runs local, offline
  semantic retrieval to rank the skills most relevant to the task at hand.
- **Tier 3 — on-demand load.** Only the chosen skill's full instructions (and
  any reference files) are loaded, via `iris_load` or the `skill://<id>`
  resource.

For the protocol details, see [`../spec/skill-access-protocol.md`](../spec/skill-access-protocol.md).
