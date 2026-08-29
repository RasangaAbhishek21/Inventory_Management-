"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { productSchema, standardCostSchema } from "./schema";

export async function createProduct(formData: FormData) {
  await requireRole("ops_manager", "admin");
  const p = productSchema.parse(Object.fromEntries(formData));
  const supabase = await createClient();
  const { error } = await supabase.from("products").insert(p);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/products");
}

export async function updateProduct(id: string, formData: FormData) {
  await requireRole("ops_manager", "admin");
  const p = productSchema.parse(Object.fromEntries(formData));
  const supabase = await createClient();
  const { error } = await supabase.from("products").update(p).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/products");
}

/** Finance path — the DB also blocks Finance from touching any other column. */
export async function updateStandardCost(id: string, formData: FormData) {
  await requireRole("finance", "admin");
  const raw = formData.get("standard_cost");
  const standard_cost = standardCostSchema.parse(typeof raw === "string" ? raw : undefined);
  const supabase = await createClient();
  const { error } = await supabase.from("products").update({ standard_cost }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/products");
}

export async function setProductActive(id: string, is_active: boolean) {
  await requireRole("ops_manager", "admin");
  const supabase = await createClient();
  const { error } = await supabase.from("products").update({ is_active }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/products");
}
