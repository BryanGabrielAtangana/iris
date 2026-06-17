---
name: git-commit-message
description: Write a clear, conventional commit message that summarizes staged changes.
when_to_use: Use when writing or improving a git commit message for staged changes.
when_not_to_use: Do not use for rebasing, squashing, or rewriting existing history.
examples:
  - write a commit message for my staged changes
  - what should my commit message say
  - turn this diff into a conventional commit
  - draft a commit for these changes
tags: [git, vcs, commit, conventional-commits]
version: 1.0.0
license: Apache-2.0
requires:
  code_execution: true
---

# git-commit-message

Produce a commit message that explains **what changed and why**, formatted as a
[Conventional Commit](https://www.conventionalcommits.org/).

## Steps

1. Inspect the staged changes:
   ```bash
   git diff --cached
   ```
2. Pick a type: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `build`, `ci`.
3. Write a subject line: `type(scope): imperative summary` — 50 chars or fewer,
   no trailing period.
4. Add a body (wrapped at 72 cols) explaining the motivation and any trade-offs,
   if the change is non-trivial.
5. Reference issues in a footer (e.g. `Closes #123`) when relevant.

## Example

```
fix(parser): tolerate unknown frontmatter keys

Skill files in the wild carry extra metadata. Passing it through instead of
rejecting keeps third-party skills loadable.

Closes #42
```
