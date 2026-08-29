"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

const schema = z.object({
  location_id: z.string().uuid(),
  product_id: z.string().uuid(),
  finish_id: z.string().uuid().nullable(),
  direction: z.enum(["increase", "decrease"]),
  quantity: z.number().int().positive(),
  reason_id: z.string().uuid(),
  notes: z.string().trim().max(500).nullable(),
  transaction_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  transfer_id: z.string().uuid().nullable(),
});

export async function postAdjustment(input: unknown): Promise<{ ok: true }> {
  const user = await requireRole("ops_manager", "admin");
  const p = schema.parse(input);

  const supabase = await createClient();

  const { data: reason } = await supabase
    .from("adjustment_reasons")
    .select("requires_note, is_active")
    .eq("id", p.reason_id)
    .maybeSingle();
  if (!reason || !reason.is_active) throw new Error("Choose a valid reason.");
  if (reason.requires_note && !p.notes) throw new Error("This reason needs a note.");

  const quantity = p.direction === "decrease" ? -p.quantity : p.quantity;

  const { error } = await supabase.from("stock_movements").insert({
    movement_type: "adjustment",
    location_id: p.location_id,
    product_id: p.product_id,
    finish_id: p.finish_id,
    quantity,
    transaction_date: p.transaction_date,
    entered_by: user.id,
    reason_id: p.reason_id,
    transfer_id: p.transfer_id,
    notes: p.notes,
  });
  if (error) throw new Error(error.message);
  return { ok: true };
}
