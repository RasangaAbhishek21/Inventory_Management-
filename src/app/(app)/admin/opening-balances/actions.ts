"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import {
  validateRows,
  type CommitRow,
  type RefData,
  type ValidationResult,
} from "@/lib/opening-balances";
import type { Json } from "@/types/database";

async function loadRefs(): Promise<RefData> {
  const supabase = await createClient();
  const [locs, prods, fins] = await Promise.all([
    supabase.from("locations").select("code"),
    supabase.from("products").select("name").eq("is_active", true),
    supabase.from("finishes").select("name").eq("is_active", true),
  ]);
  return {
    locationCodes: new Set((locs.data ?? []).map((r) => r.code)),
    productNames: new Set((prods.data ?? []).map((r) => r.name)),
    finishNames: new Set((fins.data ?? []).map((r) => r.name)),
  };
}

/** Validate parsed CSV rows against reference data. Writes nothing. */
export async function previewOpeningBalances(
  rows: Record<string, string>[],
): Promise<ValidationResult> {
  await requireRole("admin");
  const refs = await loadRefs();
  return validateRows(rows, refs);
}

/** Already-imported check for the page. */
export async function openingAlreadyImported(): Promise<boolean> {
  await requireRole("admin");
  const supabase = await createClient();
  const { count } = await supabase
    .from("stock_movements")
    .select("id", { count: "exact", head: true })
    .eq("movement_type", "opening");
  return (count ?? 0) > 0;
}

const commitSchema = z.object({
  goLive: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "pick a go-live date"),
  force: z.boolean().default(false),
  rows: z.array(z.record(z.string(), z.string())).min(1),
});

/** Commit atomically as `opening` movements. Delegates to the DB RPC. */
export async function commitOpeningBalances(input: {
  goLive: string;
  force: boolean;
  rows: Record<string, string>[];
}): Promise<{ committed: number }> {
  await requireRole("admin");
  const { goLive, force, rows } = commitSchema.parse(input);

  const refs = await loadRefs();
  const result = validateRows(rows, refs);
  if (result.errorCount > 0) {
    throw new Error("The file still has errors. Fix them and preview again.");
  }

  const payload = result.rows
    .map((r) => r.value)
    .filter((v): v is CommitRow => v !== null);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("rpc_commit_opening_balances", {
    p_go_live: goLive,
    p_rows: payload as unknown as Json,
    p_force: force,
  });
  if (error) throw new Error(error.message);
  return { committed: data ?? 0 };
}
