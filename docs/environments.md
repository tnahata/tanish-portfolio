# Environments

Production and everything else share nothing at the data layer. Preview deployments, local
development, and the eval suite all write to a Neon branch that production never reads.

## Neon

Project `Personal Portfolio Bot` (`billowing-shadow-94902986`), region `aws-us-east-2`, Postgres 18,
database `neondb`, role `neondb_owner`.

| Branch | Id | Used by |
|---|---|---|
| `production` (default) | `br-broad-cloud-aykx4na8` | Vercel Production only |
| `development` | `br-divine-glade-ay9wqxm1` | Vercel Preview, Vercel Development, local, evals |

`development` was branched from `production`, so it started as a copy-on-write clone: same 81
chunks, and the interaction rows that had accumulated during the build. Neon branches share storage
until they diverge, so the clone cost nothing.

## Vercel

`DATABASE_URL` is three separate entries, one per target, rather than one entry spanning several.
`vercel env ls` prints one row per entry, so three rows for `DATABASE_URL` is the check that the
split is real.

| Variable | Development | Preview | Production |
|---|---|---|---|
| `DATABASE_URL` | `development` branch | `development` branch | `production` branch |
| `NEXT_PUBLIC_BASE_URL` | deployment URL | deployment URL | `https://tanishnahata.com` |
| `OPENAI_API_KEY` | — | shared | shared |
| `ANTHROPIC_API_KEY` | — | shared | shared |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | — | shared | shared |
| `CLERK_SECRET_KEY` | — | shared | shared |

Clerk is still one instance across Preview and Production, so both share a user pool. Splitting it
needs a Clerk production instance and DNS records; see "Clerk" below.

## Corpus in production

`npm run ingest` writes to whatever `DATABASE_URL` names, which locally is the `development` branch.
Production chunks therefore do not update on merge. Re-ingest against production deliberately:

```bash
DATABASE_URL=$(npx neonctl connection-string production \
  --project-id billowing-shadow-94902986 \
  --role-name neondb_owner --database-name neondb --pooled) npm run ingest
```

Ingest reconciles by content hash, so a rerun that changes nothing prints `no-op`.

## Clerk

One application, two instances. The development instance issues `pk_test_`/`sk_test_` keys and works
on any origin, which is why preview deployments authenticate without configuration. The production
instance issues `pk_live_`/`sk_live_` and requires CNAME records on the apex domain before Clerk
will hand out sessions.

Until those records exist, Production runs on development-instance keys. That means a shared user
pool with preview, development-instance rate limits, and shorter session lifetimes.
