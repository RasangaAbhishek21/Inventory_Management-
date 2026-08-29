# Home 47 Inventory — Technical Implementation Plan

**Companion to:** `home47-inventory-build-brief-v2.md` (the brief is the spec; this plan is *how*)
**Status:** for review — no code written yet
**Target:** Phase 1 + Phase 2, build sequence per brief §10

---

## 0. How to read this

The brief is authoritative on *what* and *why*. This document commits to *how*: exact file
layout, dependency choices with rationale, a migration-by-migration breakdown, the full RLS
policy catalogue, every trigger/function/RPC signature, and a mapping of all 24 acceptance
tests to concrete test suites.

Nothing here contradicts the brief. Where the brief left a decision open, the choice is
marked **[decision]** with the reasoning. Things that still need a human answer are in
§14, and none of them block starting step 1.

Guiding constraint from the brief §1: **the system must run without the founder.** Every
choice below that could have gone toward "an admin approves this" instead goes toward
"the database enforces this and surfaces the exception on a report."

---

## 1. Repository layout

Everything lands in the `home47-inventory/` subfolder alongside the brief.

```
home47-inventory/
  README.md                      # local setup, env vars, migrations, first admin (step 1 deliverable)
  package.json
  next.config.ts
  tsconfig.json
  postcss.config.mjs
  .nvmrc                         # 20.x
  .env.example
  .eslintrc / eslint.config.mjs
  .github/workflows/ci.yml
  vitest.config.ts
  playwright.config.ts

  src/
    config.ts                    # THE single config module (brief §3). Imported as @/config
    app/
      layout.tsx                 # root: fonts, theme tokens, <html lang="en">
      globals.css                # Tailwind + CSS custom properties for the palette
      manifest.ts                # web app manifest (Next metadata route)
      (auth)/
        login/page.tsx
      (app)/
        layout.tsx               # authed shell: header (user + location), nav, <Toaster/>
        page.tsx                 # Home (§8.1)
        originate/page.tsx       # §8.2
        transfers/
          new/page.tsx           # §8.3 Send transfer
          receive/page.tsx       # §8.4 Confirm receipt (list)
          receive/[id]/page.tsx  # confirm one
        deliver/page.tsx         # §8.5
        returns/page.tsx         # §8.6
        stock/page.tsx           # §8.7 Check stock
        counts/
          page.tsx               # count list (§8.8)
          [id]/count/page.tsx    # counter view (staff) — blind
          [id]/review/page.tsx   # review view (ops/admin)
        adjustments/
          page.tsx               # post adjustment (§8.9)
          variances/page.tsx     # open variances + one-tap resolve
        reports/
          page.tsx               # index
          stock-on-hand/page.tsx
          movement/page.tsx
          in-transit/page.tsx
          open-variances/page.tsx
          adjustment-exceptions/page.tsx
          stock-accuracy/page.tsx
          close-pack/page.tsx
        admin/
          products/…             # list / new / [id]
          finishes/page.tsx
          categories/page.tsx
          locations/page.tsx
          users/…                # list / new / [id]
          opening-balances/page.tsx   # §8.12
      api/
        movements/route.ts       # POST: originate | deliver | return | adjustment (single-row)
        transfers/
          dispatch/route.ts
          receive/route.ts
          cancel/route.ts
        counts/
          open/route.ts
          submit/route.ts
          post/route.ts
        opening-balances/
          preview/route.ts       # validate CSV, return row-level errors, commit nothing
          commit/route.ts        # atomic
        users/route.ts           # POST create user (service role), PATCH role/active
        reports/[name]/route.ts  # GET → text/csv
    components/
      ui/                        # PrimaryAction, Stepper, ProductPicker, FinishSelect,
                                 # QtyCell, Toast, AgeBadge, EmptyState, DateField, Field
      transfers/  counts/  reports/  admin/   # feature components
    lib/
      supabase/
        server.ts                # createServerClient (@supabase/ssr) — RSC + route handlers
        client.ts                # createBrowserClient
        middleware.ts            # session refresh
        admin.ts                 # service-role client — server-only, never imported client-side
      auth.ts                    # requireUser(), requireRole(), getProfile() for route handlers
      db.ts                      # typed wrappers around .rpc() calls + error mapping
      csv.ts                     # parse (papaparse) + serialise
      format.ts                  # tabular number / date / value formatting
      errors.ts                  # PG error code → user string
    strings/
      en.ts                      # ALL user-facing copy (brief §9 "single module")
      index.ts                   # t() accessor; si.ts added later
    types/
      database.ts                # generated: supabase gen types typescript

  supabase/
    config.toml
    migrations/
      0001_extensions.sql
      0002_reference_tables.sql
      0003_profiles.sql
      0004_transfers.sql
      0005_stock_counts.sql
      0006_stock_movements.sql
      0007_fn_valuation.sql
      0008_triggers_movements.sql
      0009_balances.sql
      0010_ref_counters.sql
      0011_rpc_transfers.sql
      0012_rpc_counts.sql
      0013_rpc_opening_balances.sql
      0014_rls_enable.sql
      0015_rls_helpers.sql
      0016_rls_reference.sql
      0017_rls_movements.sql
      0018_rls_transfers_counts.sql
      0019_grants.sql
      0020_storage.sql
      0021_report_views.sql
    seed.sql                     # locations, categories, finishes, adjustment_reasons
    tests/                       # pgTAP
      00_setup.sql               # helper: make_user(role, loc) etc.
      01_ledger.sql
      02_permissions_rls.sql
      03_valuation_time.sql
      04_counts.sql
      05_import.sql
  scripts/
    create-admin.ts              # first admin (service role)

  tests/
    integration/                 # Vitest — route handlers against local Supabase
      opening-balances.test.ts
      counter-api-no-system-qty.test.ts
      reports-csv.test.ts
    e2e/                         # Playwright — a thin happy-path per capture screen
```

**[decision] Subfolder, not repo root.** Google Drive sync + `node_modules` is a known
source of file-lock failures during `npm install` / `next build`. Recommend the user runs
`git`/`npm` from a Drive-excluded working copy, but the canonical tree lives here as asked.
README will document adding `home47-inventory/node_modules` and `.next` to the Drive
ignore list, or cloning elsewhere for active dev.

---

## 2. Tooling & dependencies

| Concern | Choice | Rationale |
|---|---|---|
| Runtime | Node 20 LTS (`.nvmrc`, `engines`) | Vercel default; stable |
| Package manager | **npm** | Zero-friction on Windows for a small team; lockfile committed |
| Framework | Next.js 15 (App Router), TypeScript strict | Locked by brief |
| Styling | Tailwind CSS v4 (`@theme` in `globals.css`) | Current default in `create-next-app`; palette as CSS vars |
| Supabase client | `@supabase/supabase-js` + `@supabase/ssr` | Cookie-based auth for App Router (RSC, route handlers, middleware) |
| Forms + validation | `react-hook-form` + `zod` | One zod schema per action, **shared** by client form and route handler |
| Server state / lists | `@tanstack/react-query` | Receipt badge + in-transit benefit from cached polling; capture forms are local state |
| Toasts / success state | `sonner` | Brief §9 demands an "unmissable" confirmation naming what was recorded |
| Client image compression | `browser-image-compression` | Brief §8.11: compress client-side, cap 2 MB |
| CSV | `papaparse` | Opening-balance import + report exports |
| Dates | `date-fns` + `@date-fns/tz` | `transaction_date` is a plain `date`; keep everything in Asia/Colombo, no UTC drift |
| PWA | `@serwist/next` | Minimal SW: precache app shell + static assets, **NetworkOnly** for everything under `/api` and all data reads. No offline queue (brief §2). Offline → a plain "You're offline" page. |
| Unit / component tests | **Vitest** + `@testing-library/react` | |
| DB tests | **pgTAP** via `supabase test db` | Triggers, functions, RLS — tests 1–6, 12–17, 19–24 |
| E2E | **Playwright** | Tests 18 (API shape) belongs to integration; E2E covers capture-screen happy paths |
| Lint / format | ESLint (next config) + Prettier | |
| Types | `supabase gen types typescript` → `src/types/database.ts`, drift-checked in CI |

No UI component library — the brief's interface direction (§9) is specific and minimal;
a component kit would fight it. Hand-build ~10 primitives in `components/ui/`.

---

## 3. Environment & local setup

`.env.example`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # server only — used in src/lib/supabase/admin.ts and scripts/
SUPABASE_DB_URL=                  # local: postgresql://postgres:postgres@127.0.0.1:54322/postgres
NEXT_PUBLIC_APP_TZ=Asia/Colombo
```

**Local loop:** `supabase start` → `supabase db reset` (applies `migrations/` + `seed.sql`)
→ `npm run gen:types` → `npm run dev`. **DB tests:** `supabase test db`.
**First admin:** `npx tsx scripts/create-admin.ts --email x --password y --name "…"` —
creates the `auth.users` row via `auth.admin.createUser({ email_confirm: true })` and inserts
a `profiles` row with `role='admin'`. README documents all of this.

**Cloud (done by the user, per §14):** create Supabase project in `ap-southeast-1`, set the
three keys in Vercel, `supabase link` + `supabase db push` for migrations, run the admin
script once against prod.

---

## 4. Migration plan

The brief's DDL has forward references (`stock_movements` → `transfers`, `stock_counts`).
Real order below resolves that. Each file is idempotent-safe for `db reset`; no hand edits
in the dashboard (brief §3).

### 0001_extensions.sql
`pg_trgm` (search-as-you-type on `products.name`), `citext` optional for case-insensitive
name uniqueness. `gen_random_uuid()` is core in PG14+, no `pgcrypto` needed.

### 0002_reference_tables.sql
`locations`, `product_categories`, `finishes`, `products`, `adjustment_reasons` — verbatim
from brief §4.1. Add:
- `products`: `updated_at` trigger (`set_updated_at()`), `gin` trgm index on `name`.
- `adjustment_reasons`: no change; `is_system` rows protected by a trigger in 0008
  (block `is_active=false` when `is_system`).

### 0003_profiles.sql
`profiles` verbatim (brief §4.2). No `handle_new_user` trigger — accounts are admin-created
only. `updated_at` not in brief; leave as-is (`created_at` only).

### 0004_transfers.sql
`transfers` + `transfer_lines` verbatim (brief §4.4). Add:
- partial index `transfers (to_location_id) where status = 'dispatched'` (receipt inbox).
- `transfer_lines` check already covers `qty_dispatched > 0`; `qty_received` validated in RPC.

### 0005_stock_counts.sql
`stock_counts` + `stock_count_lines` verbatim (brief §4.5), including the generated
`variance` column. Add:
- **partial unique index** `stock_counts (location_id) where status in ('open','submitted')`
  → enforces "only one open/submitted count per location" (**test 22**).

### 0006_stock_movements.sql
`stock_movements` verbatim (brief §4.3) — now that `transfers`/`stock_counts` exist. All five
indexes from the brief. No `quantity_on_hand` column, ever (brief §4.3).

### 0007_fn_valuation.sql
```
fn_avg_unit_value(p_location uuid, p_product uuid, p_finish uuid)
  returns table (avg_selling numeric, avg_cost numeric)
```
`SUM(quantity*unit_selling_price)/NULLIF(SUM(quantity),0)` and the same for
`unit_standard_cost` (with `coalesce(unit_standard_cost,0)` inside the sum, but return NULL
for cost if **every** contributing line is null-cost so reports can still count gaps).
`NULLIF(...,0)` makes divide-by-zero return NULL rather than error — the §6 fallback
handles the NULL.

### 0008_triggers_movements.sql
Three `BEFORE INSERT` triggers on `stock_movements`, in this order (Postgres fires
alphabetically by trigger name — names chosen to force the order):

1. **`t10_stamp_values` → `fn_stamp_movement_values()`** — authoritative valuation (brief §6).
   Branch on context:
   | Case | Value written |
   |---|---|
   | `reverses_movement_id` set | copy `unit_selling_price` / `unit_standard_cost` from the referenced row (so a reversal returns balance value exactly — **test 5**) |
   | `movement_type = 'opening'` | require caller-supplied values non-null; leave as-is |
   | `movement_type = 'transfer_in'` | require caller-supplied (copied from `transfer_lines` by the receive RPC); leave as-is |
   | `origination`, `return` | `products.selling_price` / `standard_cost` **now** |
   | `transfer_out`, `dispatch`, negative `adjustment` | `fn_avg_unit_value(location,product,finish)` |
   | positive `adjustment` | `fn_avg_unit_value` if current balance `> 0`, **else** `products.selling_price`/`standard_cost` (**test 16**) |
   "Current balance" = `SELECT sum(quantity) FROM stock_movements WHERE location/product/finish` (pre-insert).

2. **`t20_date_window` → `fn_check_movement_date()`** — `transaction_date <= current_date`
   always (no forward-dating, brief §5.6). For the inserting user's role = `staff`:
   `transaction_date >= current_date - (BACKDATE_LIMIT_DAYS || ' days')::interval`.
   `admin`/`ops_manager` have no lower bound. Role read via `fn_auth_role()` (0015).
   `RAISE EXCEPTION` with plain-language message + `ERRCODE 'P0001'`.
   *Skipped when `stock_count_id is not null`* — count adjustments are dated `count_date`
   which is already validated at count open.

3. **`t30_no_negative` → `fn_guard_negative_stock()`** — if the resulting balance for
   `(location,product,finish)` would be `< 0`, `RAISE EXCEPTION` naming the location and
   available qty: *"Only 2 available at Maharagama Factory. Ask the Operations Manager to
   post an adjustment before dispatching 3."* (brief §5.1, **test 4**).
   **Bypass when `NEW.stock_count_id is not null`** (brief §4.5, §5.1 exception, **test 21**).

Plus one trigger on `adjustment_reasons`: block deactivating an `is_system` row.
Plus `t_lock_ledger` — see 0019 (grants) for the UPDATE/DELETE lock; also add a
`BEFORE UPDATE OR DELETE` trigger that unconditionally `RAISE EXCEPTION` as belt-and-braces
for any path holding table-owner rights (**test 6**).

### 0009_balances.sql
- `v_stock_balances` — verbatim from brief §4.6.
- `fn_stock_balances(as_at date, p_location uuid default null)` — same aggregation with
  `where transaction_date <= as_at [and location_id = p_location]`, `having sum(quantity) <> 0`.
  **All reports call this** (brief §4.6) — tests 13, 14 depend on `transaction_date`, not
  `entered_at`.

### 0010_ref_counters.sql
`ref_counters (scope text, period text, seq int, primary key (scope, period))`.
`fn_next_ref(scope text, period text, prefix text)` → `UPDATE … SET seq = seq + 1 …
RETURNING`, upsert on miss, formats `TRF-2026-0041`. `count_ref` is deterministic
(`CNT-2026-03-MAH`) — built in the count-open RPC, uniqueness caught by the column
constraint.

### 0011_rpc_transfers.sql — `SECURITY INVOKER` (RLS still applies)
```
rpc_dispatch_transfer(p_from uuid, p_to uuid, p_date date, p_order text,
                      p_notes text, p_lines jsonb)  returns transfers
rpc_receive_transfer(p_transfer uuid, p_date date, p_lines jsonb)  returns transfers
rpc_cancel_transfer(p_transfer uuid, p_reason text)  returns transfers
```
- **dispatch:** insert `transfers` (ref via `fn_next_ref`), `transfer_lines` (stamp
  `unit_selling_price`/`unit_standard_cost` from `fn_avg_unit_value` at source), then one
  `transfer_out` movement per line (negative). Guard trigger enforces stock availability.
  status `dispatched`. (**tests 1, 15**)
- **receive:** per line, require `0 <= qty_received <= qty_dispatched` (**reject `>`** —
  brief §4.4). Insert `transfer_in` (positive) at destination for `qty_received`, values
  copied from `transfer_lines`. status `received` if all lines match, else
  `received_with_variance` (**test 3**). Shortfall is **not** written off.
- **cancel:** only when status `dispatched`; only `ops_manager`/`admin` (RLS on the movement
  insert + an explicit role check for a clean error). Insert reversing `transfer_out`
  (positive) per line with `reverses_movement_id`. status `cancelled`.

### 0012_rpc_counts.sql
```
rpc_open_stock_count(p_location uuid, p_date date)     returns stock_counts   -- ops/admin
rpc_add_count_line(p_count uuid, p_product uuid, p_finish uuid)  returns stock_count_lines
rpc_submit_stock_count(p_count uuid)                   returns stock_counts
rpc_post_stock_count(p_count uuid)                     returns stock_counts   -- ops/admin
```
- **open:** `SECURITY INVOKER`; RLS restricts to ops/admin. Snapshot: insert a
  `stock_count_lines` row for every `(product,finish)` with `sum(quantity) <> 0` at the
  location, `system_qty = that sum`, `counted_qty = null`. Partial unique index blocks a
  second open/submitted count (**test 22**). Movements posted later don't touch `system_qty`
  (**test 17**) — it's a stored snapshot.
- **add_count_line:** floor finds — `system_qty = 0`, unique `(count,product,finish)`.
- **submit:** reject if any line has `counted_qty is null` (**test 19**). status `submitted`.
- **post:** `SECURITY DEFINER` **only** to run as table owner is *not* needed — the negative
  bypass is handled by the guard trigger checking `stock_count_id`. Keep `SECURITY INVOKER`,
  RLS restricts to ops/admin. For each line with `variance <> 0`: insert one `adjustment`
  movement at the count location, `quantity = variance`, `transaction_date = count_date`,
  `stock_count_id = p_count`, `reason_id =` *Count correction — surplus* (variance > 0) or
  *— shortfall* (variance < 0) (**test 20**). Guard trigger is bypassed → item may go
  negative (**test 21**). status `posted`, immutable thereafter.
- Review-screen warning data (brief §4.5, §8.8): a view
  `v_count_late_movements(stock_count_id)` = movements at the count's location with
  `transaction_date <= count_date AND entered_at > stock_counts.opened_at`.

### 0013_rpc_opening_balances.sql — `SECURITY INVOKER`, RLS = admin only
```
rpc_commit_opening_balances(p_go_live date, p_rows jsonb)  returns int
```
Resolves `location_code`/`product_name`/`finish_name` to ids; **any** unresolved row →
`RAISE EXCEPTION`, whole call rolls back (**test 24**). Inserts `opening` movements dated
`p_go_live` with supplied unit values. `preview` route handler runs the same resolution
read-only and returns per-row errors without writing. A guard: refuse if any `opening`
movement already exists unless `p_force` is passed (brief §8.12).

### 0014_rls_enable.sql
`alter table … enable row level security` on every table incl. `stock_movements`,
`transfers`, `transfer_lines`, `stock_counts`, `stock_count_lines`, `profiles`,
reference tables, `ref_counters` (no policies → locked to service role / definer).

### 0015_rls_helpers.sql
`SECURITY DEFINER` helpers (avoid RLS recursion on `profiles`):
```
fn_auth_role()          returns text     -- profiles.role for auth.uid(), STABLE
fn_auth_home_location() returns uuid
fn_auth_is_active()     returns boolean
```
`profiles` policies use `auth.uid() = id` for self-read + `fn_auth_role() = 'admin'` for all.

### 0016_rls_reference.sql
- **read:** every authenticated, active user may `select` `locations`, `product_categories`,
  `finishes`, `products`, `adjustment_reasons`, `v_stock_balances`, all report views
  (brief §7 "View stock, all locations" — everyone).
- **write:** `products`/`finishes`/`product_categories`/`locations` insert/update →
  `fn_auth_role() in ('ops_manager','admin')`. `products.standard_cost` writes →
  additionally allow `finance` **but only that column**: enforced with a column-privilege
  `GRANT` + a trigger that rejects non-cost changes by `finance` (RLS can't do column-level).
- `profiles` insert/update (users & roles) → `fn_auth_role() = 'admin'` only.

### 0017_rls_movements.sql — the core (brief §5, §7)
`stock_movements` — **no UPDATE/DELETE policy at all** (plus grant revoke in 0019 +
trigger in 0008). INSERT policy `WITH CHECK`:

```
fn_auth_is_active()
AND entered_by = auth.uid()
AND (
  -- admin / ops_manager: any location, any type except 'opening'
  ( fn_auth_role() in ('admin','ops_manager')
    AND movement_type <> 'opening' )
  OR
  -- staff: own location, capture types only, never adjustment/opening
  ( fn_auth_role() = 'staff'
    AND location_id = fn_auth_home_location()
    AND movement_type in ('origination','transfer_out','transfer_in','dispatch','return') )
  OR
  -- opening: admin only (also gated by the rpc)
  ( fn_auth_role() = 'admin' AND movement_type = 'opening' )
)
AND ( movement_type <> 'adjustment' OR reason_id is not null )       -- brief §5.4
AND ( movement_type <> 'origination'
      OR exists (select 1 from locations l
                 where l.id = location_id and l.can_originate) )     -- brief §5.2 (belt; also trigger)
```
`finance` matches none of the branches → **cannot insert any movement** (**test 11**).
Date-window and negative-stock are triggers, not policy, so the error messages are useful.
`transfer_in` by `staff` is additionally scoped in 0018 to transfers whose `to_location_id`
is their home location (the RPC is where that's checked cleanly; policy keeps `location_id =
home` which is equivalent since `transfer_in.location_id = to_location_id`).

### 0018_rls_transfers_counts.sql
- `transfers` / `transfer_lines` insert & update: `admin`/`ops_manager` any;
  `staff` only where `from_location_id = fn_auth_home_location()` (dispatch) or, for the
  receive update, `to_location_id = fn_auth_home_location()`. `finance`: read-only.
- `stock_counts` insert/update (open/submit/post/cancel): `fn_auth_role() in
  ('ops_manager','admin')` (**test 10**). `staff` may `select`.
- `stock_count_lines` update (`counted_qty`, `notes`): `staff` allowed **only** when the
  parent count `status = 'open'` and `location_id = fn_auth_home_location()`; ops/admin any.
  `select` on lines for `status = 'open'` **excludes `system_qty`** — see §5 note; the
  blind-count guarantee is delivered by the RPC/route layer returning a projection without
  `system_qty`, and a `v_count_lines_blind` view that omits the column, which is the only
  thing the counter screen reads (**test 18**).

### 0019_grants.sql
```
revoke update, delete on stock_movements from authenticated, anon;
revoke delete on stock_movements from authenticated, anon;
-- opening/reference: no direct table grants to authenticated for writes handled by RPC
grant execute on all rpc_* to authenticated;
revoke all on ref_counters from authenticated, anon;
```
Column grant for finance cost maintenance:
`grant update (standard_cost, updated_at) on products to authenticated;` paired with the
0016 trigger that lets `finance` change *only* those columns.

### 0020_storage.sql
Bucket `product-images`, `public = true` (public read for `<img>`). Storage RLS:
`insert`/`update`/`delete` → `fn_auth_role() in ('ops_manager','admin')`. Path convention
`products/{product_id}/{uuid}.webp`. Thumbnails via Supabase render/transform URL params,
never full-size in lists (brief §8.11).

### 0021_report_views.sql
- `v_in_transit` — `dispatched` transfers, `age_hours = now() - dispatched_at`, sender,
  destination, line count, `value_at_selling_price` from `transfer_lines`.
- `v_open_variances` — transfers `status = 'received_with_variance'` with **no**
  `stock_movements` row where `movement_type='adjustment' AND transfer_id = transfers.id`;
  per-line `shortfall = qty_dispatched - coalesce(qty_received,0)`.
- `v_adjustment_exceptions` — `adjustment` movements where
  `abs(quantity) >= ADJ_QTY_EXCEPTION OR abs(quantity*unit_selling_price) >= ADJ_VALUE_EXCEPTION`
  (thresholds inlined at migration time from `config.ts` values — see §7 note), with
  `entered_by` name, reason label, month.
- `v_stock_accuracy` — per `location_id, date_trunc('month', count_date)`:
  `line_accuracy = lines_zero_variance / lines_counted`,
  `unit_accuracy = 1 - sum(abs(variance)) / nullif(sum(system_qty),0)`,
  `net_value_impact = sum(variance * <avg selling value at post>)`. Reads posted counts.
- Read policy: `finance`/`ops_manager`/`admin` for exception + accuracy;
  everyone for in-transit + open-variances (they're operational).
  `finance` explicitly can run **all** reports (**test 11**).

### seed.sql
Locations (MAH/GON originate, PIL not), the 7 categories, finishes (seed a starter set:
White, Oak, Walnut — confirm full list, §14), and all 8 adjustment reasons with
`is_system` on the two count-correction rows and `requires_note` on *Other*.

---

## 5. Blind-count enforcement (brief §4.5, §8.8, test 18)

Server-side, three layers:
1. `v_count_lines_blind` — view over `stock_count_lines` **without** `system_qty` /
   `variance`; the counter page (`/counts/[id]/count`) reads only this.
2. The count RPCs never return `system_qty` for a count in `open` status.
3. Integration test `counter-api-no-system-qty.test.ts` asserts the JSON payload for an
   `open` count has no `system_qty` key, for `staff` **and** `ops_manager` (**test 18**).

`system_qty` becomes visible only through `/counts/[id]/review`, which requires
`ops_manager`/`admin` and `status in ('submitted','posted')`.

---

## 6. `src/config.ts`

```ts
export const config = {
  BACKDATE_LIMIT_DAYS: 30,          // staff only; admin/ops unbounded (brief §5.6)
  ADJ_QTY_EXCEPTION: 3,             // abs(quantity) >=            (brief §5.5)
  ADJ_VALUE_EXCEPTION: 100_000,     // abs(quantity*unit_selling) >=
  RECEIPT_AGE_AMBER_HOURS: 24,      // brief §8.4
  RECEIPT_AGE_RED_HOURS: 48,
  IN_TRANSIT_AGE_AMBER_HOURS: 24,
  IN_TRANSIT_AGE_RED_HOURS: 48,
  APP_TZ: 'Asia/Colombo',
  MAX_IMAGE_BYTES: 2_000_000,      // brief §8.11
} as const
```
Migrations that need the two exception thresholds (`v_adjustment_exceptions`) read them at
generation time from a tiny codegen step (`npm run gen:sql-config` writes
`0021`'s numbers from `config.ts`) **or** — simpler and chosen — store them in a
`app_config` single-row table seeded from `config.ts` on deploy, and the view joins it.
**[decision]** `app_config` table: keeps the DB self-consistent and the view honest without
a codegen dance. `config.ts` remains the source; a migration seeds it; README documents that
changing a threshold = new migration.

---

## 7. Strings module (`src/strings/en.ts`)

One flat, typed object. Categories: `nav`, `home`, `actions`, `fields`, `confirmations`,
`errors`, `empty`, `reports`, `admin`. Success strings are templates:
`recorded: (q, name, finish, loc) => \`Recorded — ${q} × ${name} (${finish}) at ${loc}.\``
Error strings map from `src/lib/errors.ts` which translates PG `SQLSTATE`/`MESSAGE` (the
triggers already raise human text — pass it straight through when `ERRCODE = 'P0001'`).
`t()` in `index.ts` is a thin typed getter; `si.ts` slots in beside `en.ts` later with no
component changes (brief §9).

---

## 8. API surface (route handlers)

All under `src/app/api/`. Each: `requireUser()` → `zod.parse(body)` → `supabase.rpc()` or
single insert → map error → JSON. Single-row capture (originate/deliver/return/adjustment)
goes direct-insert through RLS + triggers; multi-row goes through the RPCs in §4.

| Route | Method | Calls | Notes |
|---|---|---|---|
| `/api/movements` | POST | insert `stock_movements` | discriminated union on `movement_type`; array for multi-line originate/deliver |
| `/api/transfers/dispatch` | POST | `rpc_dispatch_transfer` | returns `transfer_ref` for the success screen |
| `/api/transfers/receive` | POST | `rpc_receive_transfer` | |
| `/api/transfers/cancel` | POST | `rpc_cancel_transfer` | ops/admin |
| `/api/counts/open` | POST | `rpc_open_stock_count` | ops/admin |
| `/api/counts/submit` | POST | `rpc_submit_stock_count` | |
| `/api/counts/post` | POST | `rpc_post_stock_count` | ops/admin |
| `/api/opening-balances/preview` | POST | read-only resolve | returns `{ rows: [{line, errors[]}] }` |
| `/api/opening-balances/commit` | POST | `rpc_commit_opening_balances` | admin |
| `/api/users` | POST/PATCH | `admin.createUser` + `profiles` | **service-role** client, admin role only |
| `/api/reports/[name]` | GET | report view / `fn_stock_balances` | `Content-Type: text/csv`; `?as_at=`, `?from=`, `?to=`, `?location=` |

Service role is imported **only** in `src/lib/supabase/admin.ts` and `scripts/`; an ESLint
`no-restricted-imports` rule forbids it anywhere under `src/app/**/page.tsx` or
`src/components/**`.

---

## 9. Screens → routes (brief §8)

Covered by the tree in §1. Interaction commitments from §9 that become shared components:
- `PrimaryAction` — the **only** component allowed to use Home Yellow `#F7C517` (as fill
  behind `#1A1A1A` text). Lint note in the file. One per screen.
- `Stepper` — `− [ input ] +`, 48 px targets, `inputmode="numeric"`, min 18 px digits,
  `tabular-nums`. Used everywhere a quantity is entered (never a bare field).
- `AgeBadge` — amber past `RECEIPT_AGE_AMBER_HOURS`, red past red threshold.
- `EmptyState` — every list route has a written empty string (brief §9).
- `ConfirmToast` — fired after every movement-creating call, names exactly what was written.
- Palette as CSS custom properties in `globals.css`: `--ink #1A1A1A`, `--page #F5F1EB`,
  `--yellow #F7C517`, `--sand #D4C5A9`, `--danger` (muted red), `--amber`. Tailwind v4
  `@theme` maps them to `bg-ink`, `text-ink`, etc.

---

## 10. Valuation implementation (brief §6) — where each rule lives

| Brief rule | Implementation |
|---|---|
| Two prices per product | `products.selling_price` (ops/admin), `products.standard_cost` (finance/admin, column-grant + trigger) |
| Values stamped, never live (§5.7, **test 12**) | `fn_stamp_movement_values()` writes at insert; nothing recomputes. Reports read stamped `unit_*` off `stock_movements`. |
| `fn_avg_unit_value` | 0007, `NULLIF(sum(quantity),0)` guards div-by-zero |
| Per-type value source table | `fn_stamp_movement_values()` branch table in §4/0008 — 1:1 with brief §6 |
| Positive adj at zero balance → product price (**test 16**) | explicit branch: `balance > 0 ? avg : product price` |
| Reversal keeps original value (**test 5**) | first branch copies from `reverses_movement_id` row |
| Reports label "at selling price" / "at standard cost" | column headers in `strings/en.ts`; no bare "Value" anywhere |
| Null cost handling | `fn_stock_balances` / `v_stock_balances` expose `lines_missing_cost`; report footers surface it |

---

## 11. Test strategy — 24 acceptance tests mapped

**pgTAP** (`supabase/tests/`, run by `supabase test db`) — DB invariants. Helper
`tests/00_setup.sql` seeds users of each role at known locations and provides
`set_auth(user_uuid)` wrapping `set local role authenticated; set local
"request.jwt.claims" …`.

| # | Brief test | Suite | Mechanism under test |
|---|---|---|---|
| 1 | originate 5 → transfer 5, no receipt → MAH 0 / PIL 0 / in-transit 5 | 01_ledger | dispatch RPC + `v_in_transit` |
| 2 | receive 5 → PIL 5 / in-transit 0 | 01_ledger | receive RPC |
| 3 | receive 4/5 → PIL 4, `received_with_variance`, 1 open variance | 01_ledger | receive RPC + `v_open_variances` |
| 4 | dispatch 3 with 2 on hand → rejected, names available qty | 01_ledger | `t30_no_negative` |
| 5 | reverse a movement → balance restored, both rows visible | 01_ledger | `reverses_movement_id`, stamp copy |
| 6 | UPDATE/DELETE on `stock_movements` fails for every app role | 02_permissions | grants revoke + `t_lock_ledger` |
| 7 | staff cannot insert adjustment (DB rejects) | 02_permissions | 0017 policy |
| 8 | staff@MAH cannot insert any movement at GON | 02_permissions | 0017 policy |
| 9 | staff cannot originate at PIL showroom | 02_permissions | 0017 policy + `can_originate` |
| 10 | staff cannot open/post/cancel a count | 02_permissions | 0018 policy |
| 11 | finance cannot insert any movement, can read every report | 02_permissions | 0017 (no branch) + report read policies |
| 12 | changing `selling_price` doesn't alter existing movements / past reports | 03_valuation_time | stamped values |
| 13 | as-at past date excludes later-dated movements | 03_valuation_time | `fn_stock_balances` `transaction_date <=` |
| 14 | movement entered today, dated last Tue → in last Tue's balance | 03_valuation_time | same |
| 15 | wavg: 2@10000 + 3@12000, transfer 1 out → stamped 11200 | 03_valuation_time | `fn_avg_unit_value` |
| 16 | positive adjustment at zero balance → stamped at product price, no error | 03_valuation_time | stamp fallback branch |
| 17 | opening a count snapshots; later movement doesn't change `system_qty` | 04_counts | `rpc_open_stock_count` |
| 18 | counter API response has no `system_qty` for `open` count, any role | tests/integration | route handler projection + `v_count_lines_blind` |
| 19 | count can't submit while any `counted_qty` is null | 04_counts | `rpc_submit_stock_count` |
| 20 | post count: counted 4 vs system 6 → one −2 adjustment, reason shortfall, dated count_date, linked | 04_counts | `rpc_post_stock_count` |
| 21 | posting a count that takes an item negative succeeds | 04_counts | guard bypass on `stock_count_id` |
| 22 | second count can't open while one is open/submitted | 04_counts | partial unique index |
| 23 | line accuracy = zero-variance lines ÷ counted lines, matches hand example | 04_counts | `v_stock_accuracy` |
| 24 | opening-balance import with unknown product → commits nothing | 05_import + integration | `rpc_commit_opening_balances` rollback |

**Vitest integration** (`tests/integration/`) — route handlers against local Supabase:
18, 24 (end-to-end via the preview+commit routes), report CSV shape/labels.

**Playwright E2E** (`tests/e2e/`) — one happy path per capture screen (originate, send
transfer, confirm receipt with variance prompt, deliver, return, check stock) + the blind
counter screen renders no system figure. Not a substitute for pgTAP; a smoke layer.

**CI** (`.github/workflows/ci.yml`): typecheck → lint → `supabase start` →
`supabase db reset` → `supabase test db` → `supabase gen types` drift check →
`vitest run` → `playwright test` (against `next build && next start`).

---

## 12. Build sequence → branches (brief §10)

Each step is one PR, merged green before the next. Steps 1–7 = go-live; count runs on paper
first; step 8 built against the real count.

| Step | Branch | Contains | Exit check |
|---|---|---|---|
| 1 Foundation | `feat/01-foundation` | repo, `create-next-app`, Supabase local, 0001–0006 + 0014–0016 + seed, `@supabase/ssr` auth, login, `profiles`, PWA shell, `config.ts`, `strings/en.ts`, README, CI skeleton | login works; RLS on; `supabase test db` runs (0 tests) |
| 2 Ledger core | `feat/02-ledger` | 0007–0013, 0017–0021, all RPCs, pgTAP suites 01–05 (RPC-level) | **tests 1–6, 12–24 pass at DB level** |
| 3 Admin | `feat/03-admin` | products/finishes/categories/locations/users CRUD, image upload + compression, storage policies | ops can add a product with image; finance can edit only `standard_cost` |
| 4 Opening balances | `feat/04-opening` | preview + commit screens, `rpc_commit_opening_balances`, integration test | **test 24**; refuses double-run |
| 5 Capture screens | `feat/05-capture` | originate, send transfer, confirm receipt (variance prompt), deliver, return, check stock; `PrimaryAction`/`Stepper`/`AgeBadge`/`ConfirmToast`; E2E happy paths | tests 1–4 exercised through UI; **test 8, 9** via UI + DB |
| 6 Adjustments + variances | `feat/06-adjustments` | post adjustment, open-variances list + one-tap resolve (pre-fills `transfer_id`) | **test 7** (UI hidden + DB refuses); variance resolves and drops off the list |
| 7 Reports | `feat/07-reports` | stock-on-hand, movement, in-transit, close pack; CSV export; "at selling price"/"at standard cost" headers; missing-cost footers | **tests 11, 12, 13, 14** via reports; close-pack CSV shape signed off by Finance |
| — | **GO LIVE** | first physical count on paper | |
| 8 Stock counts | `feat/08-counts` | full count schema already in step 2; counter view (blind), review view, posting, count list, accuracy report; pgTAP suite 04 through UI | **tests 17–23**; blind guarantee holds (**18**) |
| 9 Remaining reports | `feat/09-reports2` | adjustment exceptions, stock accuracy (one click from index) | **test 23** matches hand-worked sheet; exceptions show §5.5 rows |
| 10 Polish | `feat/10-polish` | PWA install prompt, offline "you're offline" page, loading skeletons, keyboard focus order, empty states audit | Lighthouse PWA installable; axe clean on capture screens |

---

## 13. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Live-value bug (brief §5.7 "easiest bug to introduce") | values only ever written by `fn_stamp_movement_values()`; reports never join `products` for price; **test 12** in CI from step 2 |
| RLS recursion on `profiles` | `SECURITY DEFINER` helpers (`fn_auth_role` etc.), never a self-join policy |
| Trigger firing order | trigger names `t10_/t20_/t30_` force stamp → date → guard |
| Google Drive + `node_modules` | README: dev from a Drive-excluded clone; `.next`/`node_modules` in Drive ignore |
| `finance` column-level write to `standard_cost` | can't be RLS; column `GRANT` + reject-other-columns trigger; **test in 03_admin** |
| Count posting div-by-zero on value impact | `fn_avg_unit_value` returns NULL via `NULLIF`; stamp + accuracy view `coalesce` to product price |
| Blind count leak via any read path | counter screen reads `v_count_lines_blind` only; integration **test 18** covers staff + ops |
| Backdate window bypass | enforced in `t20_date_window` trigger (not just UI), role-aware |

---

## 14. Open questions for the client (none block step 1)

1. **Finishes seed list** — brief seeds only "White, Oak, Walnut" as examples. Full list?
2. **Category "Dressing Tables"** vs screen §8 wording "Dressing Tables" — confirm exact
   labels/casing for the 7 categories (used as `unique` names).
3. **Go-live date** for `opening` movements — set at import time, or fixed constant?
4. **`transfer_ref` / `count_ref` year basis** — calendar year assumed (`TRF-2026-0041`).
5. **Timezone** — assuming `Asia/Colombo` everywhere; `transaction_date` is a plain date so
   "today" is Colombo-today. Confirm.
6. **Who creates the Supabase project / GitHub repo / Vercel project** — plan assumes the
   client does, using the README; I provide migrations + scripts.
7. **Password policy / reset flow** — Supabase Auth defaults (email link reset)? No
   self-signup is locked; password reset via email still needed?
8. **Founder's monthly one-pager** (brief §12) — deferred per §10, but confirm it's not
   expected at go-live.

---

## 15. What I need to start step 1

Nothing from the client is strictly required to begin Foundation locally. To *finish* step 1
(a deployable shell) I need items 6 and 7 above. I can start now and surface 1–5 as I hit
them.
