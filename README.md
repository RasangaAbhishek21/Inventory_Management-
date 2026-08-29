# Home 47 — Inventory Management

Finished-goods inventory for Deco Culture (Pvt) Ltd, trading as Home 47. Records every
movement of finished units between the two factories and the showroom, and answers
"what do we have, where, right now" for any staff member at any time.

- **Spec:** [`docs/home47-inventory-build-brief-v2.md`](docs/home47-inventory-build-brief-v2.md)
- **Build plan:** [`docs/TECHNICAL_PLAN.md`](docs/TECHNICAL_PLAN.md)

> **Deviation from brief §3:** the Supabase project is in `eu-central-1` (Frankfurt), not
> `ap-southeast-1` (Singapore). Accepted 2026-08-29 for now; revisit before go-live —
> Frankfurt adds roughly 150 ms round-trip latency for Sri Lankan users on every write.

## Stack

Next.js (App Router, TypeScript) · React + Tailwind CSS v4 · Supabase (Postgres, Auth,
Storage) · Row Level Security for authorisation · PWA · deployed on Vercel.

## Prerequisites

| Tool | Why | Install |
|---|---|---|
| Node.js 20+ | everything | `winget install OpenJS.NodeJS.LTS` |
| Docker Desktop | local Supabase (`supabase start`) + pgTAP tests | `winget install Docker.DockerDesktop` (needs WSL2 + BIOS virtualisation) |
| Supabase CLI | migrations, local stack, tests | installed as a dev dependency — use `npx supabase …` |

Docker is optional for app development: you can point `.env.local` at the hosted Supabase
project instead. The pgTAP acceptance-test suite then runs in CI (GitHub Actions has Docker)
rather than locally.

> **Google Drive note:** this repo lives under a synced Drive folder. `node_modules` and
> `.next` sync is slow and can cause file-lock errors during `npm install` / `next build`.
> For active development, clone to a path outside Drive sync, or exclude those folders in
> Google Drive for desktop.

## Local setup

```bash
npm install
cp .env.example .env.local   # then fill in the values (see below)
```

### Environment variables

| Var | Where it's used | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser + server | publishable / anon key — safe to expose; RLS protects data |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | secret / service_role key. Used only in `src/lib/supabase/admin.ts` and `scripts/`. Never prefix with `NEXT_PUBLIC`. |
| `SUPABASE_DB_URL` | CLI + tests only | Postgres connection string. URL-encode `@` in the password as `%40`. |

### Running the database

**Local (Docker):**

```bash
npx supabase start                # first run pulls images
npx supabase db reset             # applies supabase/migrations/* then supabase/seed.sql
npm run gen:types                 # regenerate src/types/database.ts
```

**Against the hosted project (no Docker):**

```bash
npx supabase db push --db-url "$SUPABASE_DB_URL"
```

All schema changes are numbered SQL files in `supabase/migrations/`. Never change schema by
hand in the Supabase dashboard.

### Running the app

```bash
npm run dev            # http://localhost:3000 (Turbopack; service worker disabled)
npm run build          # runs `next build --webpack` — the Serwist SW plugin needs webpack
npm start              # serve the production build
```

### PWA icons

`public/icons/*` are generated from an inline mark:

```bash
npm run gen:icons      # rewrites icon-192 / icon-512 / icon-maskable-512
```

### Tests

```bash
npm run test           # everything (unit + db)
npm run test:unit      # Vitest — pure logic + schema
npm run test:db        # Vitest + pg — the brief §11 acceptance tests, each in a
                       # rolled-back transaction against SUPABASE_DB_URL
npm run test:e2e       # Playwright (scaffold)
```

CI (`.github/workflows/ci.yml`) runs `test:unit` + lint + typecheck + build, and a
separate job runs `test:db` against a fresh local Supabase in Docker.

## Creating the first admin user

There is no self-signup. After the database is up and `SUPABASE_SERVICE_ROLE_KEY` is set:

```bash
npx tsx scripts/create-admin.ts --email you@home47.lk --password "…" --name "Your Name"
```

This creates the `auth.users` row (email pre-confirmed) and inserts a `profiles` row with
`role = 'admin'`. Subsequent users are created from **Admin → Users** in the app.

## Deployment (Vercel)

1. Push this folder to its GitHub repo.
2. Create a Vercel project from that repo (root directory = `home47-inventory` if the repo
   contains the whole Drive folder; root if the repo is this folder only).
3. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY` in Vercel → Project → Settings → Environment Variables.
4. Apply migrations to the production project: `npx supabase db push`.
5. Run the admin script once against production.

## Project layout

```
src/
  config.ts              # every tunable number (brief §3)
  strings/               # all user-facing copy (brief §9)
  app/                   # routes — see docs/TECHNICAL_PLAN.md §1
  lib/supabase/          # server / client / middleware / admin clients
  lib/                   # auth guards, csv, formatting, error mapping
  components/
supabase/
  migrations/            # numbered SQL — the only way schema changes
  seed.sql               # reference data
  tests/                 # pgTAP acceptance tests
```

## Build sequence

See `docs/TECHNICAL_PLAN.md` §12. Go live after step 7 with the first physical count on
paper; step 8 (stock counts) is built and tested against how that count actually went.
