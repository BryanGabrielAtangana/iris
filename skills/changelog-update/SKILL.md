---
name: changelog-update
description: Add a well-formed entry to a Keep a Changelog style CHANGELOG file.
when_to_use: Use when adding or editing an entry in a project's CHANGELOG.
when_not_to_use: Do not use to write git commit messages or GitHub release notes.
examples:
  - add a changelog entry for this feature
  - update the changelog for the new release
  - record this bug fix in the changelog
  - what goes under Unreleased in the changelog
tags: [changelog, release, documentation, semver]
version: 1.0.0
license: Apache-2.0
---

# changelog-update

Maintain a `CHANGELOG.md` in the [Keep a Changelog](https://keepachangelog.com/)
format, grouped under an `## [Unreleased]` heading until release.

## Steps

1. Find or create the `## [Unreleased]` section at the top.
2. Place the entry under the right group: `Added`, `Changed`, `Deprecated`,
   `Removed`, `Fixed`, or `Security`.
3. Write a user-facing, past-tense bullet. Link issues/PRs where helpful.
4. On release, rename `Unreleased` to `## [x.y.z] - YYYY-MM-DD` and add a fresh
   empty `Unreleased` section.

## Example

```
## [Unreleased]

### Fixed
- Tolerate unknown frontmatter keys when parsing skills (#42).
```
