---
name: sql-migration
description: Author and apply reversible relational database schema migrations safely.
when_to_use: Use when creating, editing, or applying a SQL database schema migration.
when_not_to_use: Do not use for ad-hoc analytics queries or NoSQL data modeling.
examples:
  - add a column to the users table
  - write a migration to create an orders table
  - rename a column without downtime
  - add an index to speed up this query
tags: [sql, database, migration, schema, ddl]
version: 1.0.0
license: Apache-2.0
requires:
  code_execution: true
---

# sql-migration

Write forward and rollback migrations that are safe to run against live data.

## Steps

1. Write the forward migration as idempotent DDL where possible
   (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`).
2. Always provide a matching `down`/rollback.
3. For large tables, prefer online-safe steps: add nullable column → backfill in
   batches → add constraint → swap reads.
4. Name migrations with an ordered, timestamped prefix.
5. Test forward + rollback on a copy before applying to production.

## Example

```sql
-- up
ALTER TABLE users ADD COLUMN last_login_at timestamptz;
-- down
ALTER TABLE users DROP COLUMN last_login_at;
```
