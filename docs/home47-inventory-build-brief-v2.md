# Home 47 — Inventory Management System
## Build brief for Claude Code

**Client:** Deco Culture (Pvt) Ltd, trading as Home 47
**Version:** 2.0 — build-ready
**Build scope:** Phase 1 + Phase 2 (see §10)

---

## 1. What this system is for

Home 47 manufactures modern furniture at two factories and sells through one showroom. Today, nobody can answer "what do we have, where, right now" without a phone call. This system answers that question and records every movement that changes the answer.

**Two objectives, in priority order:**

1. Staff record finished-goods movement between the three stock locations.
2. Any staff member can see stock availability at any location, at any time.

**A third objective that governs every design decision:** the system must run without the founder. He is relocating and will not be an operator, an approver, or a support desk. Where there is a choice between a feature that needs his judgement and one that doesn't, build the one that doesn't.

### Scale

Roughly 130 customer orders per month. Around 200–400 finished units moving per month. 17 staff, of whom perhaps 10 will use the system. Three locations. This is a small system — resist any architecture that assumes otherwise.

---

## 2. Explicitly out of scope

Do not build these. If a requirement seems to need one of them, stop and ask.

- Raw materials, work-in-progress, or BOM consumption (a separate tool handles this)
- Purchase orders, suppliers, or goods-receipt from suppliers
- Barcode or QR scanning — volume does not justify it
- Offline mode / service-worker sync queue
- Shopify integration or SKU sync
- FIFO or weighted-average **cost layering** for accounting purposes (see §6 for what we do instead)
- Any accounting entries — ERPNext remains the book of record for finance
- Multi-currency
- Customer records — order number as free text is sufficient
- Stock reservation against open orders
- Native mobile apps — this is a PWA

---

## 3. Technology stack — locked

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js (App Router), TypeScript | Single deployable unit |
| UI | React + Tailwind CSS | Mobile-first |
| Database | Supabase Postgres | Region: `ap-southeast-1` (Singapore) |
| File storage | Supabase Storage | Product images only |
| Auth | Supabase Auth, email + password | Accounts created by admin; no self-signup |
| Authorisation | Postgres Row Level Security | Rules live in the DB, not the UI |
| Hosting | Vercel | Pro plan |
| Installability | PWA — web app manifest + icons | Installed to Android home screen |
| Data access | Supabase JS client with RLS, plus Next.js route handlers for anything needing elevated privileges | Never expose the service-role key to the browser |

**Repository:** private GitHub repo. Include a `README.md` covering local setup, environment variables, running migrations, and how to create the first admin user.

**Migrations:** all schema changes as numbered SQL migration files under `supabase/migrations/`. No schema changes made by hand in the Supabase dashboard.

**Configuration constants** live in a single `config.ts` — backdating window, adjustment exception thresholds, receipt ageing thresholds. Do not scatter magic numbers through the code.

---

## 4. Data model

### 4.1 Reference tables

```sql
create table locations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,          -- 'Maharagama Factory'
  code          text not null unique,          -- 'MAH'
  location_type text not null check (location_type in ('factory','showroom')),
  can_originate boolean not null default false,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

create table product_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,             -- 'Tables', 'Storage', 'Mirrors'
  sort_order int  not null default 0,
  is_active  boolean not null default true
);

create table finishes (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,             -- 'White', 'Oak', 'Walnut'
  sort_order int  not null default 0,
  is_active  boolean not null default true
);

create table products (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,                -- must match the Shopify product title exactly
  category_id    uuid references product_categories(id),
  selling_price  numeric(12,2) not null,
  standard_cost  numeric(12,2),                -- maintained by Finance; nullable until populated
  image_path     text,                         -- Supabase Storage object path
  shopify_sku    text,                         -- deliberately unused in v2; do not remove
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table adjustment_reasons (
  id            uuid primary key default gen_random_uuid(),
  label         text not null unique,
  requires_note boolean not null default false,
  is_system     boolean not null default false, -- system reasons cannot be deactivated
  is_active     boolean not null default true
);
```

**Seed data.**

Locations: Maharagama Factory (`MAH`, factory, originates), Gonapola Factory (`GON`, factory, originates), Piliyandala Showroom (`PIL`, showroom, does not originate).

Categories: Tables, Storage, Dressing Tables, Mirrors, TV Console, Coffee Table, Side Table.

Adjustment reasons: Damaged in factory; Damaged in transit; Lost / unaccounted; Count correction — surplus (`is_system`); Count correction — shortfall (`is_system`); Returned to production; Written off — quality; Other (`requires_note`).

### 4.2 Users

```sql
create table profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  full_name        text not null,
  role             text not null check (role in ('admin','ops_manager','finance','staff')),
  home_location_id uuid references locations(id),
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);
```

Each staff member logs in as themselves on their own phone. Do not build shared-device user switching.

### 4.3 The movement ledger — the centre of the system

This is an **append-only ledger**. Balances are always derived by summing it. There is no `quantity_on_hand` column anywhere in this schema, and none may be added.

```sql
create table stock_movements (
  id                  bigint generated always as identity primary key,
  movement_type       text not null check (movement_type in
                        ('opening','origination','transfer_out','transfer_in',
                         'dispatch','return','adjustment')),
  location_id         uuid not null references locations(id),
  product_id          uuid not null references products(id),
  finish_id           uuid references finishes(id),
  variant_note        text,                     -- free text: 'custom 1200mm width'
  quantity            integer not null check (quantity <> 0),  -- signed: + into location, - out of
  unit_selling_price  numeric(12,2) not null,   -- stamped, never looked up live
  unit_standard_cost  numeric(12,2),            -- stamped, never looked up live
  transaction_date    date not null,            -- when it physically happened
  entered_at          timestamptz not null default now(),
  entered_by          uuid not null references profiles(id),
  transfer_id         uuid references transfers(id),
  stock_count_id      uuid references stock_counts(id),
  order_number        text,
  reason_id           uuid references adjustment_reasons(id),
  notes               text,
  reverses_movement_id bigint references stock_movements(id),
  created_at          timestamptz not null default now()
);

create index on stock_movements (location_id, product_id, finish_id, transaction_date);
create index on stock_movements (transaction_date);
create index on stock_movements (transfer_id);
create index on stock_movements (stock_count_id);
create index on stock_movements (movement_type, transaction_date);
```

**Sign convention:** `quantity` is positive when stock enters the location and negative when it leaves. Never store an unsigned quantity with a separate direction flag.

| Type | Sign | Created by |
|---|---|---|
| `opening` | + | One-time import at go-live |
| `origination` | + | Factory staff, at a `can_originate` location |
| `transfer_out` | − | Dispatch step of a transfer |
| `transfer_in` | + | Receipt-confirmation step of a transfer |
| `dispatch` | − | Delivery to a customer |
| `return` | + | Customer return |
| `adjustment` | ± | Operations Manager only, or generated by posting a stock count |

**Immutability:** revoke `UPDATE` and `DELETE` on `stock_movements` for all application roles. A mistake is corrected by inserting a reversing movement with `reverses_movement_id` set. This is not negotiable — the reversal trail is the audit trail.

### 4.4 Transfers — a two-step event

```sql
create table transfers (
  id               uuid primary key default gen_random_uuid(),
  transfer_ref     text not null unique,        -- 'TRF-2026-0041', generated
  from_location_id uuid not null references locations(id),
  to_location_id   uuid not null references locations(id),
  status           text not null check (status in
                     ('dispatched','received','received_with_variance','cancelled')),
  dispatch_date    date not null,
  dispatched_by    uuid not null references profiles(id),
  dispatched_at    timestamptz not null default now(),
  receipt_date     date,
  received_by      uuid references profiles(id),
  received_at      timestamptz,
  order_number     text,
  notes            text,
  check (from_location_id <> to_location_id)
);

create table transfer_lines (
  id                 uuid primary key default gen_random_uuid(),
  transfer_id        uuid not null references transfers(id) on delete cascade,
  product_id         uuid not null references products(id),
  finish_id          uuid references finishes(id),
  variant_note       text,
  qty_dispatched     integer not null check (qty_dispatched > 0),
  qty_received       integer,                   -- null until receipt confirmed
  unit_selling_price numeric(12,2) not null,    -- stamped at dispatch
  unit_standard_cost numeric(12,2)
);
```

**How the two steps post to the ledger:**

- **On dispatch:** insert `transfer_out` movements (negative) at the source location, one per line. Stock leaves the source immediately. Transfer status = `dispatched`.
- **Between the two:** the stock exists at no location. It is *in transit*. `SUM(qty_dispatched) - SUM(coalesce(qty_received,0))` across `status = 'dispatched'` transfers is the in-transit quantity. This is correct and intentional — do not create a phantom "In Transit" location.
- **On receipt confirmation:** the receiver enters the quantity actually received per line. Insert `transfer_in` movements (positive) at the destination for `qty_received`, carrying the values stamped on the transfer line.
- **If `qty_received < qty_dispatched`:** status becomes `received_with_variance`. The shortfall is **not** auto-written-off. It remains an open variance on a report until the Operations Manager posts an adjustment with a reason code. This is deliberate friction and is the whole point of the two-step design.
- **If `qty_received > qty_dispatched`:** reject at input. Ask the sender to correct the dispatch instead.
- **If `qty_received = 0` for a line:** allowed, and treated as a variance of the full line.

**Cancellation:** a `dispatched` transfer may be cancelled only by the Operations Manager, which inserts reversing movements at the source and sets status `cancelled`. A `received` transfer cannot be cancelled — correct it with adjustments.

### 4.5 Stock counts

```sql
create table stock_counts (
  id            uuid primary key default gen_random_uuid(),
  count_ref     text not null unique,           -- 'CNT-2026-03-MAH', generated
  location_id   uuid not null references locations(id),
  count_date    date not null,
  status        text not null check (status in
                  ('open','submitted','posted','cancelled')),
  opened_by     uuid not null references profiles(id),
  opened_at     timestamptz not null default now(),
  submitted_by  uuid references profiles(id),
  submitted_at  timestamptz,
  posted_by     uuid references profiles(id),
  posted_at     timestamptz,
  notes         text
);

create table stock_count_lines (
  id                 uuid primary key default gen_random_uuid(),
  stock_count_id     uuid not null references stock_counts(id) on delete cascade,
  product_id         uuid not null references products(id),
  finish_id          uuid references finishes(id),
  system_qty         integer not null,          -- snapshotted when the count is opened
  counted_qty        integer,                   -- null until entered
  variance           integer generated always as (counted_qty - system_qty) stored,
  notes              text,
  unique (stock_count_id, product_id, finish_id)
);
```

**Count lifecycle:**

1. **Open.** The Operations Manager opens a count for a location on a date. The system snapshots current balances into `stock_count_lines.system_qty` for every `(product, finish)` with a non-zero balance at that location. The count sheet is now frozen against that snapshot.
2. **Count.** Staff enter `counted_qty` line by line. **`system_qty` is not shown on screen during this stage, and is not sent to the client.** Staff may add lines for items found on the floor that had a zero system balance — those lines get `system_qty = 0`.
3. **Submit.** All lines must have a `counted_qty`. Status becomes `submitted`. Variance is now revealed.
4. **Post.** The Operations Manager reviews the variance list and posts. For every line with a non-zero variance, insert an `adjustment` movement at the count location for the variance amount, dated `count_date`, with `stock_count_id` set and `reason_id` set to *Count correction — surplus* or *Count correction — shortfall*. Status becomes `posted`.

**Rules.** Only one `open` or `submitted` count per location at a time. Movements dated on or before `count_date` that are entered *after* the snapshot will make the posted adjustment slightly wrong — accept this and surface it: on the review screen, warn if any movement at that location was entered after the count was opened but dated on or before `count_date`. A `posted` count is immutable; correct with normal adjustments.

**Blind counting is a control, not a UI preference.** If the counter can see the system figure, a meaningful proportion will transcribe it rather than count. Enforce the hiding server-side.

### 4.6 Derived balance

```sql
create view v_stock_balances as
select
  m.location_id,
  m.product_id,
  m.finish_id,
  sum(m.quantity)                                             as qty_on_hand,
  sum(m.quantity * m.unit_selling_price)                      as value_at_selling_price,
  sum(m.quantity * coalesce(m.unit_standard_cost, 0))         as value_at_standard_cost,
  count(*) filter (where m.unit_standard_cost is null)        as lines_missing_cost
from stock_movements m
group by 1,2,3
having sum(m.quantity) <> 0;
```

For as-at-date reporting, implement a function `fn_stock_balances(as_at date, location_id uuid default null)` running the same aggregation with `where transaction_date <= as_at`. All reports call this function — do not duplicate the aggregation logic in the application layer.

---

## 5. Business rules

These are invariants. Enforce them in the database (constraints, triggers, RLS) wherever possible, and in the UI as a second layer.

1. **No negative stock.** A `transfer_out`, `dispatch`, or negative `adjustment` that would take `(location, product, finish)` below zero is rejected. The error message must state the current available quantity by name, e.g. *"Only 2 available at Maharagama. Ask the Operations Manager to post an adjustment before dispatching 3."* Enforce with a `BEFORE INSERT` trigger — the UI check alone is not sufficient. **Exception:** adjustments generated by posting a stock count bypass this check, because a count is by definition the authority on physical reality.

2. **Origination only at originating locations.** `movement_type = 'origination'` requires `locations.can_originate = true`.

3. **Staff act only at their own location.** A user with role `staff` may insert movements only where `location_id = their home_location_id`, or confirm receipt of a transfer whose `to_location_id` is their home location, or enter count lines for a count at their home location. Enforced by RLS.

4. **Adjustments are restricted.** Only `ops_manager` and `admin` may insert `movement_type = 'adjustment'` directly, or post a stock count. A `reason_id` is mandatory. If the chosen reason has `requires_note = true`, `notes` is mandatory.

5. **Adjustment exceptions are surfaced, not blocked.** Any single adjustment where `abs(quantity) >= 3` **or** `abs(quantity * unit_selling_price) >= 100000` appears on a monthly exceptions report visible to `finance` and `admin`. It is not blocked and needs no approval — the control is visibility, not a gate. Thresholds live in `config.ts`.

6. **Transaction date may be backdated but not forward-dated.** `transaction_date <= current_date`, and not more than `BACKDATE_LIMIT_DAYS` (default 30) in the past for `staff`. `admin` and `ops_manager` have no lower bound.

7. **Values are stamped, never live.** Every movement carries the unit values at the moment it was created. Changing `products.selling_price` must have no effect on any existing movement or any historical report. This is the single easiest bug to introduce here — acceptance test 8 covers it.

8. **Reversals only.** No update or delete of `stock_movements` through any code path.

---

## 6. Valuation

Home 47 does not have BOM-driven costing yet, so two values are carried per unit and both are shown, clearly labelled.

**Products carry two prices.** `selling_price` (maintained by admin/ops) and `standard_cost` (maintained by Finance, nullable initially). Reports must handle null costs without breaking and must show how many lines are missing a cost.

**Weighted average at a location.** Define a function `fn_avg_unit_value(location_id, product_id, finish_id)` returning:

```
SUM(quantity * unit_selling_price) / SUM(quantity)   -- and the same for standard_cost
over all movements at that location for that product+finish
```

**Every movement type has one defined value source. This table is exhaustive:**

| Movement type | Value stamped |
|---|---|
| `opening` | As supplied in the import CSV |
| `origination` | `products.selling_price` / `standard_cost` at that moment |
| `transfer_out` | `fn_avg_unit_value` at the source location |
| `transfer_in` | Copied from the matching `transfer_lines` row |
| `dispatch` | `fn_avg_unit_value` at the source location |
| `return` | `products.selling_price` / `standard_cost` at that moment |
| `adjustment` (negative) | `fn_avg_unit_value` at the location |
| `adjustment` (positive) | `fn_avg_unit_value` at the location if balance > 0, **otherwise** `products.selling_price` / `standard_cost` |

The fallback in the last row matters — a positive adjustment or count surplus at a location currently holding zero of that item would otherwise divide by zero.

Implement this as a Postgres function called from the insert path so it cannot be bypassed by the application layer.

**Reports label the basis explicitly.** Every valuation column header reads either "at selling price" or "at standard cost". Never print a bare "Value" column.

---

## 7. Roles and permissions

| Capability | staff | ops_manager | finance | admin |
|---|:--:|:--:|:--:|:--:|
| View stock, all locations | ✓ | ✓ | ✓ | ✓ |
| Originate (own location, if it originates) | ✓ | ✓ | | ✓ |
| Dispatch a transfer (own location) | ✓ | ✓ | | ✓ |
| Confirm receipt (own location) | ✓ | ✓ | | ✓ |
| Dispatch to customer (own location) | ✓ | ✓ | | ✓ |
| Record a customer return | ✓ | ✓ | | ✓ |
| Enter count lines (own location) | ✓ | ✓ | | ✓ |
| Act at **any** location | | ✓ | | ✓ |
| Post adjustments | | ✓ | | ✓ |
| Open, submit and post stock counts | | ✓ | | ✓ |
| Cancel a dispatched transfer | | ✓ | | ✓ |
| Run all reports and export CSV | | ✓ | ✓ | ✓ |
| Maintain `standard_cost` | | | ✓ | ✓ |
| Manage products, finishes, categories, locations | | ✓ | | ✓ |
| Manage users and roles | | | | ✓ |

Every one of these must be expressed as an RLS policy. The UI hides what a user cannot do; the database refuses it. Write a test per row.

---

## 8. Screens

Mobile-first throughout. Assume an Android phone held one-handed in a factory. Reports may assume a wider screen.

### 8.1 Home

Large tap targets, no dense text.

- **Confirm receipt** — with a count badge when transfers are inbound to this user's location. First item on the screen when the badge is non-zero.
- **Count stock** — shown only when an open count exists for this user's location
- **Originate stock** — only at originating locations
- **Send transfer**
- **Deliver to customer**
- **Check stock**
- Footer: current user name and location

### 8.2 Originate stock

Product picker (search-as-you-type, image thumbnail and name) → finish dropdown → quantity stepper → optional variant note → transaction date (defaults to today) → optional notes → **Record stock**.

Support adding multiple lines before submitting. Show a running line count.

### 8.3 Send transfer

From location (fixed to the user's location for `staff`) → to location → add lines → transfer date → optional order number → optional notes → **Send transfer**.

Show available quantity at the source next to each line as it is added, so the user sees the constraint before hitting the error.

On success, display the generated transfer reference prominently — the driver may need to quote it.

### 8.4 Confirm receipt

Transfers where `to_location_id` is the user's location and `status = 'dispatched'`, oldest first, with an age indicator that turns amber past 24 hours and red past 48 (thresholds in `config.ts`).

Opening one shows each line with the dispatched quantity pre-filled and editable. Confirming with any line reduced prompts: *"You received fewer than were sent. This will be reported as a variance for the Operations Manager to resolve."*

### 8.5 Deliver to customer

Product/finish/quantity lines → **order number (required)** → delivery date → optional notes → **Record delivery**.

Order number is required here and nowhere else. It is the only link back to Shopify.

### 8.6 Record a return

Product/finish/quantity → location → order number (optional) → reason note → date → **Record return**.

### 8.7 Check stock

A search box. Type a product name, see quantity by location and finish in a compact table. This is the screen the showroom will use most; make it fast and make it the easiest thing to reach.

### 8.8 Count stock

**Counter view (staff).** The open count for their location as a list of lines. Each line shows product, finish, and an empty quantity input. **No system quantity anywhere on this screen.** Progress indicator (*"34 of 61 counted"*). An **Add item not on this list** control for floor finds. **Submit count** is disabled until every line has a value.

**Review view (ops_manager, admin).** Once submitted: every line with product, finish, system quantity, counted quantity, variance, and value impact — sorted by absolute value impact, largest first. Summary header showing line accuracy %, total units over, total units short, and net value impact. Warning banner if any movement was entered after the count opened but dated on or before the count date. **Post count** generates the adjustments.

**Count list.** All counts by location and date with status, accuracy %, and net variance.

### 8.9 Adjustments

Location → product → finish → **increase or decrease** → quantity → reason (dropdown) → note (conditionally required) → date → **Post adjustment**.

Separately, an **Open variances** list showing transfers with `received_with_variance` and no offsetting adjustment yet, with a one-tap **Resolve** that pre-fills an adjustment for the shortfall.

### 8.10 Reports

All support an as-at or date-range parameter and CSV export.

**Stock on hand.** As-at date (defaults today), location (or all), category. Columns: product, finish, quantity, value at selling price, value at standard cost. Grouped by location with subtotals and a grand total. Footer notes any lines missing a standard cost.

**Stock movement.** Date range, location, product, finish, movement type, user. Full ledger rows including who entered each, when, and the reference (transfer ref, count ref, order number). Reversals shown alongside what they reverse.

**In transit.** All `dispatched` transfers with age in hours, sender, destination, lines, and value.

**Open variances.** As §8.9.

**Adjustment exceptions.** Adjustments meeting the §5.5 thresholds for the selected month, with who posted them and the reason given.

**Stock accuracy.** By location and month: line accuracy % (lines with zero variance ÷ lines counted), unit accuracy % (1 − total absolute unit variance ÷ total system units), and net value impact. This is the Operations Manager's standing number — make it one click from the reports index.

**Monthly close pack.** A single CSV of closing stock by location, product, finish, quantity, and both values, for the selected month-end. This is what Finance posts against in ERPNext.

### 8.11 Admin

Products (list, add, edit, deactivate, image upload), finishes, categories, locations, users. Deactivation must be used rather than deletion anywhere a record could be referenced by a movement.

**Product images:** upload to a Supabase Storage bucket, public read, authenticated write restricted to `ops_manager`/`admin`. Compress client-side before upload, cap at 2 MB, store the object path in `products.image_path`. Serve thumbnails via Supabase image transformation, not full-size images in list views.

### 8.12 Opening balances

Admin-only, one-time. Upload a CSV of `location_code, product_name, finish_name, quantity, unit_selling_price, unit_standard_cost`. Preview with row-level validation errors shown inline. Commit atomically as `opening` movements dated the go-live date — a single invalid row commits nothing. Refuse to run twice without explicit confirmation.

---

## 9. Interface direction

This is an operational tool used by people with dusty hands in bright light, not a marketing surface. Home 47's brand shows up in restraint, not decoration.

**Palette.** Near Black `#1A1A1A` for text and primary surfaces. Warm White `#F5F1EB` as the page background. Home Yellow `#F7C517` reserved for one job: the primary action on each screen, and the receipt badge. Sand `#D4C5A9` for dividers and inactive states. A muted red for destructive actions and shortfall variances, amber for ageing indicators and surpluses.

**Critical contrast note:** `#F7C517` fails contrast requirements as a text colour on white. Use it only as a fill behind near-black text, never as a foreground colour on a light background.

**Typography.** One family, generously sized. Minimum 16px body, minimum 18px for numeric quantities. Tabular figures so numeric columns align.

**Touch.** Minimum 48px tap targets. Quantity entry uses stepper buttons with a numeric input between them, never a bare text field — thumbs are imprecise and gloves are worse.

**Confirmation.** Every movement-creating action produces an unmissable success state naming exactly what was recorded: *"Recorded — 3 × Leo Book Rack Vertical (White) at Maharagama."* Staff need to trust it went in, or they will record it twice.

**Errors.** State what happened and what to do, in the app's voice. *"Only 2 available at Maharagama. Ask the Operations Manager to post an adjustment."* Not *"Insufficient inventory (error 409)."*

**Empty states.** *"Nothing waiting to be received."* — an invitation or a reassurance, not a blank panel.

**Language.** English for v2. Keep all user-facing strings in a single module so Sinhala labels can be added later without touching components.

---

## 10. Build sequence

Both phases are in scope, but build and merge in this order. Each step should be independently working before the next begins.

1. **Foundation** — repo, Supabase project, migrations, seed data, auth, profiles, RLS scaffolding, PWA shell.
2. **Ledger core** — `stock_movements`, the negative-stock trigger, `fn_avg_unit_value`, the stamping logic, `v_stock_balances` and `fn_stock_balances`. Test this layer hard before any UI exists on top of it.
3. **Admin** — products, categories, finishes, locations, users, image upload.
4. **Opening balances** — the CSV import.
5. **Capture screens** — originate, send transfer, confirm receipt, deliver, return, check stock.
6. **Adjustments and open variances.**
7. **Reports** — stock on hand, movement, in transit, close pack.
8. **Stock counts** — schema, counter view, review view, posting, accuracy report.
9. **Remaining reports** — adjustment exceptions, stock accuracy.
10. **Polish** — PWA install prompt, offline-tolerant error handling, loading states, keyboard focus.

**Deployment note for the client:** go live after step 7 with the first physical count run on paper. Step 8 is then built and tested against how the count actually went, rather than against an assumption about it.

### Deferred to a later phase

Shopify SKU population and order-number validation; ageing and slow-mover analysis at the showroom; a display-stock sub-location at Piliyandala; a summary dashboard of the §12 metrics; Sinhala localisation.

---

## 11. Acceptance tests

Automated. These are the definition of done.

**Ledger**
1. Originating 5 at Maharagama, then transferring 5 to Piliyandala without confirming receipt, leaves Maharagama at 0, Piliyandala at 0, and in-transit at 5.
2. Confirming receipt of 5 puts Piliyandala at 5 and in-transit at 0.
3. Confirming receipt of 4 against 5 dispatched puts Piliyandala at 4, sets status `received_with_variance`, and creates one open variance of 1.
4. Attempting to dispatch 3 when 2 are on hand is rejected, and the error names the available quantity.
5. Reversing a movement returns the balance to its prior value and leaves both rows visible in the movement report.
6. `UPDATE` and `DELETE` on `stock_movements` fail for every application role.

**Permissions**
7. A `staff` user cannot insert an adjustment — the database rejects it, not just the UI.
8. A `staff` user at Maharagama cannot insert any movement at Gonapola.
9. A `staff` user cannot originate at Piliyandala Showroom.
10. A `staff` user cannot open, post or cancel a stock count.
11. A `finance` user cannot insert any movement but can read every report.

**Valuation and time**
12. Changing `products.selling_price` after a movement exists does not alter the value of any existing movement, nor any report run for a prior date.
13. Stock on hand as at a past date excludes movements dated after it, regardless of when they were entered.
14. A movement entered today with a transaction date of last Tuesday appears in last Tuesday's balance.
15. Weighted average: originate 2 units at 10,000 and 3 at 12,000 at one location, then transfer 1 out — the outbound movement is stamped at 11,200.
16. A positive adjustment at a location holding zero of that item is stamped at the current product selling price and does not error.

**Counts**
17. Opening a count snapshots current balances; a movement posted after the snapshot does not change `system_qty`.
18. The counter API response contains no `system_qty` field for a count in `open` status, for any role.
19. A count cannot be submitted while any line has a null `counted_qty`.
20. Posting a count with a line counted at 4 against a system quantity of 6 creates one adjustment of −2 with reason *Count correction — shortfall*, dated the count date, linked to the count.
21. Posting a count that takes an item negative succeeds — the count bypasses the negative-stock trigger.
22. A second count cannot be opened for a location while one is `open` or `submitted`.
23. Line accuracy is computed as lines with zero variance ÷ lines counted, and matches a hand-worked example.

**Import**
24. Opening balance import rejects a CSV containing an unknown product name, and commits nothing.

---

## 12. Operating model — for the client, not the build

Software does not make people record movements. These mechanisms do. They are listed here so the build supports them, and so whoever owns this system after handover knows what it is for.

- Nothing leaves a factory without a recorded dispatch. The Operations Manager enforces this on the floor.
- The receiving location confirms within 24 hours. The ageing badge is what makes this visible.
- A physical count at all three locations monthly, blind, posted by the Operations Manager.
- **Stock accuracy %** is the Operations Manager's standing number, reviewed weekly.
- Finance posts one adjusting entry in ERPNext monthly from the close pack CSV.
- The founder receives a monthly one-page summary and does not log in.

---

## 13. Assumptions taken

Raise these with the client if the build contradicts them.

1. Staff use personal phones with individual logins. No shared-device switching.
2. Connectivity at all three sites is adequate for real-time recording; the 30-day backdating window covers the gaps.
3. No separate display-stock location at the showroom yet.
4. English-only interface for now.
