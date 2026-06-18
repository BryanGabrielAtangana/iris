---
"@iris/adapters": minor
"iris": patch
---

Add a Cursor adapter and inject a behavioral awareness directive into every always-loaded surface.

- New `cursor` adapter writes an `alwaysApply` rule at `.cursor/rules/iris.mdc` so Iris skills are discovered automatically in Cursor, matching the Claude Code and Codex adapters.
- All adapters now prepend a directive instructing the agent to call `find_skill` before improvising (not just the Tier-1 inventory), making skill discovery plug-and-play instead of opt-in.
