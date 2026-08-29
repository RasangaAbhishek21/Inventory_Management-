"use server";

import { requireUser } from "@/lib/auth";
import { recordMovements } from "@/lib/record-movement";

export async function recordDelivery(input: unknown): Promise<{ count: number }> {
  const user = await requireUser();
  return recordMovements(user, "dispatch", input, { requireOrderNumber: true });
}
