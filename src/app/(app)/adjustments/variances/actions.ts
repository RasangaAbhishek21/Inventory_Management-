"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

const schema = z.object({
  transfer_id: z.string().uuid(),
  reason_id: z.string().uuid(),
});

/** Post one adjustment per shorted line of a varianced transfer, each carrying the
 *  transfer_id so the transfer drops off the open-variances list (brief §8.9). */
export async function resolveVariance(input: unknown): Promise<{ count: number }> {
  const user = await requireRole("ops_manager", "admin");
  const { transfer_id, reason_id } = schema.parse(input);
  const supabase = await createClient();

  const { data: transfer } = await supabase
    .from("transfers")
    .select("id, transfer_ref, to_location_id, status")
    .eq("id", transfer_id)
    .maybeSingle();
  if (!transfer || transfer.status !== "received_with_variance") {
    throw new Error("That transfer no longer has an open variance.");
  }

  const { count: existing } = await supabase
    .from("stock_movements")
    .select("id", { count: "exact", head: true })
    .eq("transfer_id", transfer_id)
    .eq("movement_type", "adjustment");
  if ((existing ?? 0) > 0) throw new Error("This variance has already been resolved.");

  const { data: reason } = await supabase
    .from("adjustment_reasons")
    .select("requires_note, is_active")
    .eq("id", reason_id)
    .maybeSingle();
  if (!reason || !reason.is_active) throw new Error("Choose a valid reason.");

  const { data: lines } = await supabase
    .from("transfer_lines")
    .select("product_id, finish_id, qty_dispatched, qty_received")
    .eq("transfer_id", transfer_id);

  const rows = (lines ?? [])
    .map((l) => ({
      shortfall: l.qty_dispatched - (l.qty_received ?? 0),
      product_id: l.product_id,
      finish_id: l.finish_id,
    }))
    .filter((l) => l.shortfall > 0)
    .map((l) => ({
      movement_type: "adjustment" as const,
      location_id: transfer.to_location_id,
      product_id: l.product_id,
      finish_id: l.finish_id,
      quantity: -l.shortfall,
      transaction_date: new Date().toISOString().slice(0, 10),
      entered_by: user.id,
      reason_id,
      transfer_id,
      notes: `Resolves variance on ${transfer.transfer_ref}`,
    }));

  if (rows.length === 0) throw new Error("Nothing to resolve.");

  const { error } = await supabase.from("stock_movements").insert(rows);
  if (error) throw new Error(error.message);
  return { count: rows.length };
}
