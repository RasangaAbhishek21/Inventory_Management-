import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { CurrentUser } from "@/lib/auth";
import type { MovementType } from "@/types/database";

const lineSchema = z.object({
  product_id: z.string().uuid(),
  finish_id: z.string().uuid().nullable(),
  variant_note: z.string().trim().max(200).nullable(),
  quantity: z.number().int().positive(),
});

export const capturePayloadSchema = z.object({
  location_id: z.string().uuid(),
  transaction_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  order_number: z.string().trim().max(120).nullable(),
  notes: z.string().trim().max(500).nullable(),
  lines: z.array(lineSchema).min(1),
});

export type CapturePayload = z.infer<typeof capturePayloadSchema>;

/**
 * Insert one movement per line. `direction` is +1 for stock entering the location
 * (origination, return) and -1 for stock leaving it (dispatch). Values are stamped by
 * the DB trigger; negative-stock and date-window are enforced there too.
 */
export async function recordMovements(
  user: CurrentUser,
  movementType: Extract<MovementType, "origination" | "dispatch" | "return">,
  input: unknown,
  opts: { requireOrderNumber?: boolean } = {},
): Promise<{ count: number }> {
  if (user.role === "finance") throw new Error("You can't record stock movements.");
  const p = capturePayloadSchema.parse(input);

  if (opts.requireOrderNumber && !p.order_number) {
    throw new Error("An order number is required.");
  }

  const direction = movementType === "dispatch" ? -1 : 1;
  const supabase = await createClient();

  const rows = p.lines.map((l) => ({
    movement_type: movementType,
    location_id: p.location_id,
    product_id: l.product_id,
    finish_id: l.finish_id,
    variant_note: l.variant_note,
    quantity: direction * l.quantity,
    transaction_date: p.transaction_date,
    entered_by: user.id,
    order_number: p.order_number,
    notes: p.notes,
  }));

  const { error } = await supabase.from("stock_movements").insert(rows);
  if (error) throw new Error(error.message);
  return { count: rows.length };
}
