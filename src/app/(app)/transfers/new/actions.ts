"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import type { Json } from "@/types/database";

const schema = z.object({
  from_location_id: z.string().uuid(),
  to_location_id: z.string().uuid(),
  dispatch_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  order_number: z.string().trim().max(120).nullable(),
  notes: z.string().trim().max(500).nullable(),
  lines: z
    .array(
      z.object({
        product_id: z.string().uuid(),
        finish_id: z.string().uuid().nullable(),
        variant_note: z.string().trim().max(200).nullable(),
        qty: z.number().int().positive(),
      }),
    )
    .min(1),
});

export async function dispatchTransfer(input: unknown): Promise<{ ref: string; id: string }> {
  const user = await requireUser();
  if (user.role === "finance") throw new Error("You can't send transfers.");
  const p = schema.parse(input);
  if (p.from_location_id === p.to_location_id) {
    throw new Error("Choose a different destination.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("rpc_dispatch_transfer", {
    p_from: p.from_location_id,
    p_to: p.to_location_id,
    p_date: p.dispatch_date,
    p_order: p.order_number,
    p_notes: p.notes,
    p_lines: p.lines as unknown as Json,
  });
  if (error) throw new Error(error.message);
  return { ref: data.transfer_ref, id: data.id };
}
