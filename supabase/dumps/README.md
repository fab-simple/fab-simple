# FabSimple — Database dumps

Snapshots of the local Supabase Postgres taken after running migrations +
seeds against a clean stack. Use these to spin up a new environment with the
exact same schema (and optionally data) as the dev box.

All dumps were produced via `supabase db dump --local` against Postgres 17.

| File         | Contents                              | Size  |
| ------------ | ------------------------------------- | ----- |
| `schema.sql` | DDL only — tables, types, RLS, indexes, triggers, functions | 126 KB |
| `data.sql`   | Data only (COPY statements) — every row in `auth`, `public`, `storage`, `supabase_functions` schemas | 138 KB |
| `full.sql`   | `schema.sql` + `data.sql` concatenated — single-file restore | 264 KB |

## Quick reference

- 38 tables in `public`
- 22 custom enum types
- 75 RLS policies, 71 indexes
- Demo company `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa` ("NOVUSsteel Demo Shop") fully populated:
  102 parts · 5 projects · 11 inventory · 11 certifications · 8 NCRs · 4 weld inspections ·
  5 paint inspections · 6 job-cost lines · 3 billing apps · 1 cut plan · 24 AISC items ·
  10 OSHA items · 8 erection sequences · 4 shipping tickets · 66 notifications · 20 activity events
- 7 demo users (`{owner,pm,estimator,foreman,qc,accounting,worker}@demo.fabsimple.io`, password `demo123!`)

## Restore options

### A. Fresh local Supabase from migrations (recommended for devs)

You don't need these dumps — just run:

```bash
supabase db reset      # drops local DB and replays every migration in supabase/migrations
```

The seed migrations (`20260524000004_seed.sql` and `20260525000002_demo_seed_full.sql`)
will re-create the demo account from scratch.

### B. Restore from `full.sql` into a fresh local Supabase

```bash
supabase stop --no-backup
supabase start                                         # bootstraps auth/storage schemas, extensions, etc.
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -v ON_ERROR_STOP=1 \
  -f supabase/dumps/full.sql
```

> The dump references the Supabase-managed `extensions` schema (and `auth`,
> `storage`, `supabase_functions`). Restore it **on top of a Supabase-
> bootstrapped database**, not a virgin Postgres install. The simplest way
> is to `supabase start` first, which provisions all the required
> schemas/extensions, then load `full.sql`.

Use this if you need a byte-identical copy of the dev DB (same UUIDs, same
`created_at` timestamps) — handy for reproducing bugs or running QA against
a frozen snapshot.

### C. Restore just the schema, then seed your own data

```bash
psql "$DATABASE_URL" -f supabase/dumps/schema.sql
psql "$DATABASE_URL" -f supabase/migrations/20260524000004_seed.sql
psql "$DATABASE_URL" -f supabase/migrations/20260525000002_demo_seed_full.sql
```

### D. Push to a hosted Supabase project

```bash
supabase link --project-ref <your-ref>
supabase db push                             # apply migrations to the hosted DB
psql "$DATABASE_URL" -f supabase/migrations/20260524000004_seed.sql
psql "$DATABASE_URL" -f supabase/migrations/20260525000002_demo_seed_full.sql
```

(Don't `psql … -f full.sql` against a hosted project — it includes the
`auth.*` system tables, which the hosted instance manages itself.)

## Refreshing the dumps

When the schema or seed data changes, regenerate the snapshots from a clean
local stack:

```bash
supabase db reset                                            # rebuild local DB from migrations + seeds
supabase db dump --local                  -f supabase/dumps/schema.sql
supabase db dump --local --data-only --use-copy -f supabase/dumps/data.sql
cat supabase/dumps/schema.sql supabase/dumps/data.sql > supabase/dumps/full.sql
```
