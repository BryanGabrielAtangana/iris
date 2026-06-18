# Quickstart: from clone to the right skill firing

Iris knows every capability you own and hands the right one to whatever agent
you're working with, exactly when it's needed. This walkthrough takes you from a
fresh clone to a working setup where an agent asks Iris for help mid-task and
the right skill fires.

You'll:

1. Build the monorepo.
2. Point Iris at a skill library (using the bundled `skills/` folder, and also
   building your own with `iris init` + `iris add`).
3. Search the library with `iris search`.
4. Sync skills into a project with `iris sync`.
5. Connect the `iris-mcp` server to Claude Code (and any other MCP client).
6. Watch a real task surface and load the right skill.

---

## 1. Prerequisites

- **Node.js 20 or newer** (`node --version`).
- **pnpm** via Corepack (ships with Node):

```bash
corepack enable
corepack prepare pnpm@latest --activate
```

---

## 2. Clone, install, build

```bash
git clone https://github.com/your-org/iris.git
cd iris
pnpm install
pnpm build
```

`pnpm build` compiles every workspace package, producing the CLI
(`packages/cli/dist/index.js`) and the MCP server
(`packages/mcp-server/dist/cli.js`).

For the rest of this guide we'll call the CLI through the repo script `pnpm iris`
(defined in the root `package.json`). If you prefer, link it globally instead:

```bash
# Optional: expose `iris` and `iris-mcp` on your PATH
pnpm --filter @iris/cli exec npm link
pnpm --filter @iris/mcp exec npm link
```

Wherever you see `pnpm iris`, you can substitute a linked `iris` binary.

---

## 3. Point Iris at a skill library

A **library** is just a folder of skills. Iris resolves the library root from,
in order: the `--library`/`-l` flag, the `IRIS_LIBRARY` environment variable, or
the current working directory.

### Option A — use the bundled starter skills

This repo ships 8 ready-to-use skills in [`skills/`](../../skills). Point Iris at
them with `IRIS_LIBRARY`:

```bash
export IRIS_LIBRARY="$PWD/skills"
pnpm iris doctor
```

`iris doctor` validates the library and reports how many skills were discovered
and indexed.

### Option B — build your own library

```bash
# Create an empty library somewhere (defaults to the current directory)
pnpm iris init ~/my-skills

# Add skills into it (copy a skill folder in by path)
pnpm iris add ./skills/pdf-forms --library ~/my-skills
pnpm iris add ./skills/git-commit-message --library ~/my-skills

# Remove one later by id
pnpm iris remove pdf-forms --library ~/my-skills
```

You can also set `IRIS_LIBRARY=~/my-skills` once and drop the `--library` flag.

The rest of this guide assumes the bundled library:

```bash
export IRIS_LIBRARY="$PWD/skills"
```

---

## 4. Search the library (Tier-2 retrieval)

Ask for a skill in plain language. Iris runs **local, offline** semantic
retrieval — no network, no API keys — and ranks the closest matches:

```bash
pnpm iris search "fill out a pdf form"
```

Ranked output looks like this (scores and order may vary slightly by version):

```text
Top 5 skills for: "fill out a pdf form"

   92%  pdf-forms  (pdf-forms)
        Use when filling, extracting from, merging, or splitting PDF documents or forms.
   41%  csv-wrangler  (csv-wrangler)
        Use when cleaning, filtering, joining, or reshaping CSV/TSV data.
   29%  api-mock-server  (api-mock-server)
        Use when standing up a temporary mock HTTP API for local development or tests.
   ...
```

Use `-k` to control how many results come back:

```bash
pnpm iris search "fill out a pdf form" -k 3
```

The top line — `pdf-forms` — is the skill an agent would load to do the work.

---

## 5. Sync skills into a project

`iris sync` writes skills into a project in the format each surface expects, and
injects the **Tier-1 awareness index** into the always-loaded surface file.

```bash
cd ~/my-project
pnpm --dir /path/to/iris iris sync \
  --library /path/to/iris/skills \
  --adapter claude-code \
  --target .
```

(Or, with `IRIS_LIBRARY` exported and `iris` on your PATH, just
`iris sync --adapter claude-code --target .`.)

Available adapters: `claude-code`, `codex`, `chat`. Pass several at once:
`--adapter claude-code,codex,chat`.

For the `claude-code` adapter this produces:

```text
.
├── .claude/
│   └── skills/
│       ├── pdf-forms/
│       │   ├── SKILL.md
│       │   └── scripts/
│       └── git-commit-message/
│           └── SKILL.md
└── CLAUDE.md          # Tier-1 awareness block injected here
```

The Tier-1 index is inserted into `CLAUDE.md` inside a **managed block**, so
everything you've written around it is left untouched:

```markdown
# My Project

...your own project notes...

<!-- IRIS:BEGIN (managed by `iris sync` — do not edit) -->

# Available skills (Iris) — call find_skill to retrieve, load_skill to open

- git-commit-message — Use when writing or improving a git commit message for staged changes.
- pdf-forms — Use when filling, extracting from, merging, or splitting PDF documents or forms.
- ...
<!-- IRIS:END -->
```

Re-running `iris sync` replaces only the content between the
`<!-- IRIS:BEGIN ... -->` and `<!-- IRIS:END -->` markers, so your edits outside
the block always survive.

---

## 6. Connect the MCP server to Claude Code

The MCP route keeps the library out of your project tree entirely: the agent
discovers and loads skills live over the Model Context Protocol.

The server binary is `iris-mcp [libraryRoot]`. It reads the library from its
first argument, the `IRIS_LIBRARY` env var, or the current directory. Add it to
Claude Code's MCP server config:

```json
{
  "mcpServers": {
    "iris": {
      "command": "node",
      "args": ["/path/to/iris/packages/mcp-server/dist/cli.js", "/path/to/iris/skills"],
      "env": {
        "IRIS_LIBRARY": "/path/to/iris/skills"
      }
    }
  }
}
```

Notes:

- If you linked the binary globally (step 2), you can use `"command": "iris-mcp"`
  with `"args": ["/path/to/iris/skills"]` instead of invoking `node` directly.
- Set `"IRIS_NO_EXEC": "1"` in `env` to disable script execution
  (`run_skill_script` becomes a no-op) if you want a read-only server.

Because `iris-mcp` is a standard **stdio MCP server**, the same entry works with
any MCP client — Codex, Cursor, Gemini CLI, and others — just drop it into that
client's MCP config.

Once connected, the server exposes:

- **Tools** — `find_skill(query, k?)`, `load_skill(id)`,
  `run_skill_script(id, script, args?)`. The Tier-1 awareness index is
  embedded right in the `find_skill` tool description, so the agent is aware of
  every skill before it ever searches.
- **Resources** — `skill://<id>` and `skill://<id>/<ref>`.
- **Prompts** — `iris:<skill-name>` for each skill.

---

## 7. What to expect

With the MCP server connected, ask Claude Code to do something a skill covers:

> "Write a commit message for my staged changes."

Here's what happens under the hood:

1. **Awareness (Tier 1).** The agent already sees `git-commit-message` in the
   `find_skill` tool description — it knows the capability exists.
2. **Retrieval (Tier 2).** The agent calls `find_skill("write a commit message
for staged changes")`. Iris ranks `git-commit-message` at the top.
3. **Load (Tier 3).** The agent calls `load_skill("git-commit-message")` to pull
   in the full instructions — only now, only this one skill.
4. **The right skill fires.** Following the loaded steps, the agent inspects the
   staged diff and writes a clean, conventional commit message.

Try a few others — "fill out this PDF form", "write a Dockerfile for this app",
"build a regex that matches…" — and watch Iris surface the matching skill each
time.

---

## Where to go next

- Protocol details: [`../../spec/skill-access-protocol.md`](../../spec/skill-access-protocol.md)
- The starter skills: [`../../skills/`](../../skills)
- CLI reference: `pnpm iris --help` (and `pnpm iris <command> --help`)
