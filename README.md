# Ledger

A personal expense tracker. Imports CSV and PDF statements from Wealthsimple and Scotiabank, auto-categorizes spending, and tracks percentage-based paycheck allocations against actual spending.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- Neon Postgres + Drizzle ORM
- Auth.js (email + password; signups lockable via `ALLOW_SIGNUPS`)
- Deployed on Vercel

## Development

```bash
pnpm install
cp .env.example .env.local   # fill in values
pnpm db:push                 # sync schema to database
pnpm dev
```

## Environment variables

See `.env.example`:

- `DATABASE_URL` — Neon Postgres connection string
- `AUTH_SECRET` — session encryption secret (`npx auth secret`)
- `ALLOW_SIGNUPS` — `true` while registering yourself, then set to `false`

## Importing statements

- **Wealthsimple**: account page → export transactions as CSV (preferred), or upload the monthly PDF statement.
- **Scotiabank**: online banking → download transactions as CSV (preferred), or upload the PDF statement.

Re-uploading overlapping date ranges is safe — duplicates are detected and skipped.
