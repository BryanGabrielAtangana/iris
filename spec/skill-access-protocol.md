<!-- SPDX-License-Identifier: Apache-2.0 -->

# Iris Skill Access Protocol

**Version:** 0.1.0 · **Status:** Draft · **License:** Apache-2.0

> Iris knows every capability you own and hands the right one to whatever agent
> you're working with, exactly when it's needed.

This document is the human-readable, versioned specification of how Iris
describes skills and exposes them to agents. The TypeScript reference
implementation lives in [`@iris/protocol`](../packages/protocol); a JSON Schema
generated from the same zod definitions is available via
`generateJsonSchema()` so non-TypeScript consumers can validate skill metadata.

## 1. Motivation

Agents today load every skill's `name + ~200-char description` into context and
pick by raw model judgment over that flat list. It scales badly and fires
inconsistently. Iris solves a **discovery + invocation** problem (not a
distribution one) with **two-tier discovery**.

## 2. Skills

A **skill** is a folder, in the Anthropic skill format:

```
my-skill/
├─ SKILL.md          # required: YAML frontmatter + Markdown body
├─ scripts/          # optional: executable helpers
├─ references/       # optional: supporting docs loaded on demand
└─ assets/           # optional: templates, fixtures, etc.
```

`SKILL.md` is YAML frontmatter followed by a Markdown body:

```markdown
---
name: pdf-forms
description: Fill, extract, merge, and split PDF documents and forms.
when_to_use: Use when filling, extracting from, merging, or splitting PDFs or forms.
examples:
  - fill out this pdf form
  - merge these two pdfs
tags: [pdf, documents, forms]
version: 1.0.0
requires:
  code_execution: true
---

# pdf-forms

Markdown instructions for the agent…
```

### 2.1 Metadata fields

| Field                     | Type         | Req. | Purpose                                                 |
| ------------------------- | ------------ | :--: | ------------------------------------------------------- |
| `name`                    | string ≤64   |  ✓   | Anthropic-spec identifier (display + prompt name).      |
| `description`             | string ≤1024 |  ✓   | Anthropic-spec one-paragraph description.               |
| `when_to_use`             | string ≤280  |      | Drives the Tier-1 one-liner; positive trigger guidance. |
| `when_not_to_use`         | string ≤280  |      | Negative guidance to prevent over-firing.               |
| `examples`                | string[]     |      | Example user intents that should trigger the skill.     |
| `tags`                    | string[]     |      | Free-form facets for grouping/filtering.                |
| `version`                 | string       |      | Semver; defaults to `0.0.0`.                            |
| `license`                 | string       |      | SPDX license id.                                        |
| `requires.mcp_servers`    | string[]     |      | MCP servers the skill assumes are connected.            |
| `requires.packages`       | string[]     |      | Package dependencies the skill's scripts assume.        |
| `requires.code_execution` | boolean      |      | `true` ⇒ needs a filesystem/exec-capable surface.       |

Unknown frontmatter keys are **tolerated** (passthrough) so third-party skills
remain loadable. Only `name` and `description` are required; the Iris extensions
are optional but make discovery substantially more reliable.

### 2.2 Skill identity

Each skill has a stable `id` derived by slugifying its name (falling back to the
folder name). Ids are unique within a library; collisions are disambiguated by
suffixing the parent directory. Ids are used across the surface as
`skill://<id>` and `/iris:<name>`.

## 3. Two-tier discovery

### Tier 1 — Awareness

A tiny (~1k token) always-present mini-index, one line per skill:

```
- pdf-forms — Use when filling, extracting, or merging PDF documents or forms.
- git-commit-message — Use when writing commit messages from staged changes.
```

It is deterministic (sorted by name), regenerable, and budgeted: if a library
is too large to fit, lines are kept until the budget is reached and the
remainder is summarized (`…and N more skills — call iris_find`). Retrieval is
invisible if the agent does not know the library exists, so **Tier 1 must always
be injected** into a surface the agent already loads (e.g. `CLAUDE.md`,
`AGENTS.md`) and into the `iris_find` tool description.

The Tier-1 line for a skill is `- {name} — {when_to_use || first sentence of description}`.

### Tier 2 — Retrieval

Semantic search over rich skill metadata, returning ranked candidates with
relevance scores in `[0, 1]`. The reference implementation embeds a weighted
document per skill (name, description, `when_to_use`, `examples`, `tags`) and
combines embedding cosine similarity with a lexical overlap score (hybrid
ranking). Embeddings are pluggable; the default is fully **local and offline**.

`find(query, k) → { id, name, score, when_to_use }[]`

### Tier 3 — Load

The full `SKILL.md` body is loaded on demand (`iris_load`), and
references/scripts/assets are loaded only when needed — progressive disclosure
done correctly.

## 4. MCP surface

Iris is delivered primarily as an MCP server so it works across Claude Code,
Codex, Cursor, Gemini CLI, etc. without modifying those agents.

### Tools

- `iris_find(query: string, k?: number)` → ranked `{ id, name, score, when_to_use }[]`.
  **The tool's description embeds the Tier-1 index** — this is the awareness signal.
- `iris_load(id: string)` → the full `SKILL.md` body.
- `iris_execute_script(id, script, args?)` → run a bundled script on
  exec-capable surfaces; otherwise return a clear "not supported here" message.
  Only scripts the skill declares can run, resolved inside the skill directory.

### Resources

- `skill://<id>` → the skill body (`text/markdown`).
- `skill://<id>/<ref>` → a bundled reference/script/asset file.

### Prompts

- `iris:<skill-name>` → registered per skill for explicit invocation.

### Notifications

On library changes (file watcher), the server emits `notifications/tools/list_changed`,
`notifications/resources/list_changed`, and `notifications/prompts/list_changed`
for hot reload, and refreshes the embedded Tier-1 index.

## 5. Lockfile (`iris.lock`)

A library's pinned skills are recorded in `iris.lock` (JSON). There is no
database beyond the vector index.

```json
{
  "lockfileVersion": 1,
  "skills": [
    {
      "id": "pdf-forms",
      "version": "1.0.0",
      "source": "./pdf-forms",
      "integrity": "sha256:…"
    }
  ]
}
```

`integrity` is a stable sha256 over the skill directory's file contents.

## 6. Capability / graceful degradation

`requires` lets a surface degrade gracefully: chat-only surfaces receive
instructions without scripts, and `requires.code_execution` / `requires.mcp_servers`
let a host decide whether a skill is fully supported. Signing, sandboxing, and
at-scale security scanning are explicitly **future work** — this spec leaves
interfaces, not implementations.

## 7. Versioning

This protocol is versioned independently of the implementation. Backwards-
compatible additions (new optional fields) bump the minor version; breaking
changes bump the major version. `PROTOCOL_VERSION` is exported from
`@iris/protocol`.
