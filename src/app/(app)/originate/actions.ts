"use server";

import { requireUser } from "@/lib/auth";
import { recordMovements } from "@/lib/record-movement";

export async function recordOrigination(input: unknown): Promise<{ count: number }> {
  const user = await requireUser();
  return recordMovements(user, "origination", input);
}
