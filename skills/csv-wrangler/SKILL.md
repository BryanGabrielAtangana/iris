---
name: csv-wrangler
description: Clean, deduplicate, filter, and reshape CSV and other tabular data.
when_to_use: Use when cleaning, deduplicating, filtering, or reshaping CSV or tabular data.
when_not_to_use: Do not use for transforming JSON documents or querying a SQL database.
examples:
  - remove duplicate rows from this csv
  - filter the csv to rows where status is active
  - merge two csv files on a key column
  - convert this spreadsheet to clean csv
tags: [csv, data, cleaning, tabular, etl]
version: 1.0.0
license: Apache-2.0
requires:
  code_execution: true
---

# csv-wrangler

Tidy and transform tabular data with small, verifiable steps.

## Steps

1. Inspect the header and a few rows; confirm the delimiter and encoding.
2. Normalize: trim whitespace, fix headers, coerce types.
3. Apply the operation: dedupe, filter, join, pivot, or aggregate.
4. Validate row counts before and after so you do not silently drop data.
5. Write UTF-8 output with a stable column order.

## Example

Deduplicate with the standard library:

```bash
python scripts/dedupe.py input.csv > output.csv
```
