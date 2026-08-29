import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, MovementType } from "@/types/database";
import { isoDate } from "@/lib/format";

type Client = SupabaseClient<Database>;

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------
export function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  const esc = (v: string | number | null) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
}

export function csvResponse(filename: string, body: string): Response {
  return new Response("﻿" + body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------
async function nameMaps(supabase: Client) {
  const [products, locations, finishes, categories] = await Promise.all([
    supabase.from("products").select("id, name, category_id"),
    supabase.from("locations").select("id, name, code"),
    supabase.from("finishes").select("id, name"),
    supabase.from("product_categories").select("id, name"),
  ]);
  return {
    product: new Map((products.data ?? []).map((p) => [p.id, p.name])),
    productCategory: new Map((products.data ?? []).map((p) => [p.id, p.category_id])),
    location: new Map((locations.data ?? []).map((l) => [l.id, l.name])),
    finish: new Map((finishes.data ?? []).map((f) => [f.id, f.name])),
    category: new Map((categories.data ?? []).map((c) => [c.id, c.name])),
  };
}

// ---------------------------------------------------------------------------
// Stock on hand (brief §8.10)
// ---------------------------------------------------------------------------
export interface StockOnHandRow {
  location: string;
  product: string;
  finish: string | null;
  category: string | null;
  quantity: number;
  valueAtSelling: number;
  valueAtStandardCost: number;
  missingCost: boolean;
}

export interface StockOnHandParams {
  asAt?: string;
  locationId?: string | null;
  categoryId?: string | null;
}

export async function getStockOnHand(
  supabase: Client,
  params: StockOnHandParams,
): Promise<{ rows: StockOnHandRow[]; asAt: string }> {
  const asAt = params.asAt ?? isoDate();
  const maps = await nameMaps(supabase);

  const { data, error } = await supabase.rpc("fn_stock_balances", {
    as_at: asAt,
    p_location: params.locationId ?? null,
  });
  if (error) throw new Error(error.message);

  const rows: StockOnHandRow[] = (data ?? [])
    .filter((r) => {
      if (!params.categoryId) return true;
      return maps.productCategory.get(r.product_id) === params.categoryId;
    })
    .map((r) => {
      const catId = maps.productCategory.get(r.product_id) ?? null;
      return {
        location: maps.location.get(r.location_id) ?? "—",
        product: maps.product.get(r.product_id) ?? "—",
        finish: r.finish_id ? (maps.finish.get(r.finish_id) ?? null) : null,
        category: catId ? (maps.category.get(catId) ?? null) : null,
        quantity: r.qty_on_hand,
        valueAtSelling: Number(r.value_at_selling_price),
        valueAtStandardCost: Number(r.value_at_standard_cost),
        missingCost: r.lines_missing_cost > 0,
      };
    })
    .sort(
      (a, b) =>
        a.location.localeCompare(b.location) ||
        a.product.localeCompare(b.product) ||
        (a.finish ?? "").localeCompare(b.finish ?? ""),
    );

  return { rows, asAt };
}

// ---------------------------------------------------------------------------
// Stock movement ledger (brief §8.10)
// ---------------------------------------------------------------------------
export interface MovementRow {
  id: number;
  date: string;
  type: MovementType;
  location: string;
  product: string;
  finish: string | null;
  quantity: number;
  valueAtSelling: number;
  reference: string | null;
  enteredBy: string;
  enteredAt: string;
  reverses: number | null;
}

export interface MovementParams {
  from?: string;
  to?: string;
  locationId?: string | null;
  productId?: string | null;
  finishId?: string | null;
  type?: MovementType | null;
  userId?: string | null;
}

export async function getMovementRows(
  supabase: Client,
  params: MovementParams,
): Promise<{ rows: MovementRow[]; from: string; to: string }> {
  const to = params.to ?? isoDate();
  const from = params.from ?? to;
  const maps = await nameMaps(supabase);

  const [{ data: profiles }, { data: transfers }, { data: counts }] = await Promise.all([
    supabase.from("profiles").select("id, full_name"),
    supabase.from("transfers").select("id, transfer_ref"),
    supabase.from("stock_counts").select("id, count_ref"),
  ]);
  const userName = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  const trRef = new Map((transfers ?? []).map((t) => [t.id, t.transfer_ref]));
  const cntRef = new Map((counts ?? []).map((c) => [c.id, c.count_ref]));

  let q = supabase
    .from("stock_movements")
    .select(
      "id, movement_type, location_id, product_id, finish_id, quantity, unit_selling_price, transaction_date, entered_at, entered_by, transfer_id, stock_count_id, order_number, reverses_movement_id",
    )
    .gte("transaction_date", from)
    .lte("transaction_date", to)
    .order("transaction_date", { ascending: true })
    .order("id", { ascending: true });

  if (params.locationId) q = q.eq("location_id", params.locationId);
  if (params.productId) q = q.eq("product_id", params.productId);
  if (params.finishId) q = q.eq("finish_id", params.finishId);
  if (params.type) q = q.eq("movement_type", params.type);
  if (params.userId) q = q.eq("entered_by", params.userId);

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const rows: MovementRow[] = (data ?? []).map((m) => ({
    id: m.id,
    date: m.transaction_date,
    type: m.movement_type,
    location: maps.location.get(m.location_id) ?? "—",
    product: maps.product.get(m.product_id) ?? "—",
    finish: m.finish_id ? (maps.finish.get(m.finish_id) ?? null) : null,
    quantity: m.quantity,
    valueAtSelling: m.quantity * Number(m.unit_selling_price),
    reference:
      (m.transfer_id ? trRef.get(m.transfer_id) : null) ??
      (m.stock_count_id ? cntRef.get(m.stock_count_id) : null) ??
      m.order_number ??
      null,
    enteredBy: userName.get(m.entered_by) ?? "—",
    enteredAt: m.entered_at,
    reverses: m.reverses_movement_id,
  }));

  return { rows, from, to };
}

// ---------------------------------------------------------------------------
// In transit (brief §8.10)
// ---------------------------------------------------------------------------
export async function getInTransit(supabase: Client) {
  const { data, error } = await supabase
    .from("v_in_transit")
    .select(
      "id, transfer_ref, from_location, to_location, dispatch_date, dispatched_at, dispatched_by_name, age_hours, line_count, value_at_selling_price",
    )
    .order("dispatched_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Monthly close pack (brief §8.10) — closing stock at a month-end date
// ---------------------------------------------------------------------------
export async function getClosePack(supabase: Client, monthEnd: string) {
  const { rows } = await getStockOnHand(supabase, { asAt: monthEnd });
  return rows;
}
