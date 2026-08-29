"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import type { Json } from "@/types/database";

const schema = z.object({
  transfer_id: z.string().uuid(),
  receipt_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  lines: z
    .array(z.object({ line_id: z.string().uuid(), qty_received: z.number().int().min(0) }))
    .min(1),
});

export async function confirmReceipt(
  input: unknown,
): Promise<{ status: string; ref: string }> {
  const user = await requireUser();
  if (user.role === "finance") throw new Error("You can't confirm receipts.");
  const p = schema.parse(input);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("rpc_receive_transfer", {
    p_transfer: p.transfer_id,
    p_date: p.receipt_date,
    p_lines: p.lines as unknown as Json,
  });
  if (error) throw new Error(error.message);
  return { status: data.status, ref: data.transfer_ref };
}
