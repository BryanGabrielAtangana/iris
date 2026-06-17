---
name: regex-builder
description: Construct, explain, and test regular expressions for matching text patterns.
when_to_use: Use when constructing, debugging, or explaining a regular expression.
when_not_to_use: Do not use for full grammar parsing or extracting structured data from HTML.
examples:
  - write a regex to match email addresses
  - build a pattern for US phone numbers
  - why does my regex not match this string
  - extract dates with a regular expression
tags: [regex, text, matching, validation]
version: 1.0.0
license: Apache-2.0
---

# regex-builder

Design a regular expression, explain each part, and verify it against examples.

## Steps

1. Pin down the target: list strings that should match and that should not.
2. Build the pattern incrementally, anchoring with `^`/`$` when matching whole
   strings.
3. Prefer explicit character classes over `.`; escape metacharacters.
4. Test against the positive and negative examples before shipping.
5. Document the pattern with comments or the `x` (extended) flag where supported.

## Example

Match an email (pragmatic, not RFC-complete):

```
^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$
```

with the case-insensitive flag enabled.
