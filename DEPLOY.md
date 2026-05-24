# FabSimple — Production Deployment

This guide walks through deploying FabSimple to production: a hosted Supabase project plus a Vercel-hosted Next.js frontend.

## Prerequisites

- A Supabase account with billing enabled (Free tier works for staging, Pro tier or above is recommended for prod)
- A Vercel account
- The Supabase CLI installed locally: `npm install -g supabase` (or use the devDep `npx supabase`)
- An OpenAI API key (or compatible LLM endpoint) for the AI Copilot

---

## 1. Create the hosted Supabase project

```bash
# In the Supabase dashboard, create a new project and note:
#   • Project ref (e.g. abcdefghijklmnop)
#   • Database password
#   • Region (pick closest to your users)
```

Link the local checkout to it:

```bash
cd fab-simple
npx supabase link --project-ref <YOUR_PROJECT_REF>
# CLI prompts for the database password
```

## 2. Push migrations

```bash
npm run db:push
# This pushes supabase/migrations/* in chronological order:
#   20260524000001_schema.sql           (schema)
#   20260524000002_triggers.sql         (business triggers)
#   20260524000003_rls.sql              (RLS policies)
#   20260524000004_seed.sql             (demo data — REVIEW BEFORE RUNNING IN PROD)
#   20260524000005_notification_triggers.sql
```

**Important — production seed:** the `20260524000004_seed.sql` migration inserts demo users with the password `demo123!`. Before pushing to production:

- either remove that migration from your remote branch, OR
- regenerate the user passwords and rotate before exposing the URL

## 3. Configure Edge Function secrets

```bash
# OpenAI for Copilot
npx supabase secrets set OPENAI_API_KEY=sk-...
npx supabase secrets set OPENAI_MODEL=gpt-4o-mini    # or gpt-4o, gpt-4-turbo, etc.

# App URL (used in invite emails)
npx supabase secrets set APP_URL=https://yourapp.vercel.app

# Optional: structured logging level
npx supabase secrets set LOG_LEVEL=info
```

## 4. Deploy Edge Functions

```bash
npm run functions:deploy
# Equivalent to: supabase functions deploy api
```

The function URL will be `https://<PROJECT_REF>.supabase.co/functions/v1/api`.

## 5. Configure Vercel

Create the project on Vercel, point at this repo (or push via `vercel --prod`), then set the following env vars in the Vercel dashboard:

| Key                            | Value                                                          |
|--------------------------------|----------------------------------------------------------------|
| `NEXT_PUBLIC_SUPABASE_URL`     | `https://<PROJECT_REF>.supabase.co`                            |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`| anon key from Supabase dashboard → Settings → API              |
| `NEXT_PUBLIC_API_BASE`         | `https://<PROJECT_REF>.supabase.co/functions/v1/api`           |
| `NEXT_PUBLIC_FAB_MODE`         | `live`                                                         |
| `NEXT_PUBLIC_SENTRY_DSN`       | _(optional)_ Sentry DSN to enable error reporting              |

Trigger a deploy: `git push` to your linked branch, or run `vercel --prod`.

## 6. Configure Supabase Auth

In the Supabase dashboard → Authentication → URL Configuration:

- **Site URL:** `https://yourapp.vercel.app`
- **Redirect URLs:** `https://yourapp.vercel.app/auth/callback`

Optionally enable additional providers (Google, GitHub, etc.) under Authentication → Providers.

## 7. Verify storage buckets

The `20260524000004_seed.sql` migration creates four private buckets: `drawings`, `mtrs`, `photos`, `billing`. Confirm they exist in **Storage** and review their policies. Files are accessed via signed URLs through the API (`/files/sign-upload`, `/files/sign-read/:id`).

## 8. Smoke test the deploy

```bash
# Replace with your real URLs and keys
SB_URL=https://<PROJECT_REF>.supabase.co
ANON=<your-anon-key>

# 1. sign in
TOKEN=$(curl -s -X POST "$SB_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d '{"email":"<your-real-user>","password":"<their-password>"}' | jq -r .access_token)

# 2. hit /dashboard
curl -s "$SB_URL/functions/v1/api/dashboard" -H "Authorization: Bearer $TOKEN" | jq '.ok'
```

## 9. Production hardening checklist

- [ ] Remove or replace the demo-seed migration
- [ ] Enable email confirmations in Supabase Auth (Authentication → Settings)
- [ ] Set up custom SMTP for transactional email (otherwise the Supabase shared sender is used)
- [ ] Enable backups + Point-in-Time Recovery on the Supabase project (Pro tier)
- [ ] Configure a custom domain on Vercel
- [ ] Set up Sentry DSN and verify error capture
- [ ] Review RLS policies before granting access to real customers
- [ ] Wire the GitHub Actions CI to require green builds before merging

## 10. Common operations

```bash
# Roll forward a new migration
npx supabase migration new add_new_feature
# … write SQL in the generated file …
npm run db:push

# Redeploy edge functions after code changes
npm run functions:deploy

# Open the Supabase dashboard for the linked project
npx supabase status
```
