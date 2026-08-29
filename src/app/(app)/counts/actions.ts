"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole, requireUser } from "@/lib/auth";

const uuid = z.string().uuid();
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export async function openCount(input: unknown): Promise<{ id: string }> {
  await requireRole("ops_manager", "admin");
  const { location_id, count_date } = z
    .object({ location_id: uuid, count_date: dateStr })
    .parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("rpc_open_stock_count", {
    p_location: location_id,
    p_date: count_date,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/counts");
  return { id: data.id };
}

export async function addCountLine(input: unknown): Promise<{ id: string }> {
  await requireUser();
  const { count_id, product_id, finish_id } = z
    .object({ count_id: uuid, product_id: uuid, finish_id: uuid.nullable() })
    .parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("rpc_add_count_line", {
    p_count: count_id,
    p_product: product_id,
    p_finish: finish_id,
  });
  if (error) throw new Error(error.message);
  return { id: data.id };
}

export async function setCountLine(input: unknown): Promise<{ ok: true }> {
  await requireUser();
  const { line_id, qty, notes } = z
    .object({ line_id: uuid, qty: z.number().int().min(0), notes: z.string().trim().max(200).nullable() })
    .parse(input);
  const supabase = await createClient();
  const { error } = await supabase.rpc("rpc_set_count_line", {
    p_line: line_id,
    p_qty: qty,
    p_notes: notes,
  });
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function submitCount(id: string): Promise<{ ok: true }> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("rpc_submit_stock_count", { p_count: uuid.parse(id) });
  if (error) throw new Error(error.message);
  revalidatePath("/counts");
  return { ok: true };
}

export async function postCount(id: string): Promise<{ ok: true }> {
  await requireRole("ops_manager", "admin");
  const supabase = await createClient();
  const { error } = await supabase.rpc("rpc_post_stock_count", { p_count: uuid.parse(id) });
  if (error) throw new Error(error.message);
  revalidatePath("/counts");
  return { ok: true };
}

export async function cancelCount(id: string, reason: string | null): Promise<{ ok: true }> {
  await requireRole("ops_manager", "admin");
  const supabase = await createClient();
  const { error } = await supabase.rpc("rpc_cancel_stock_count", {
    p_count: uuid.parse(id),
    p_reason: reason,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/counts");
  return { ok: true };
}
