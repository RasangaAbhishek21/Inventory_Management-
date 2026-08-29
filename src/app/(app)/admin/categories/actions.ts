"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

const schema = z.object({
  name: z.string().trim().min(1).max(60),
  sort_order: z.coerce.number().int().min(0).default(0),
});

export async function createCategory(formData: FormData) {
  await requireRole("ops_manager", "admin");
  const parsed = schema.parse({
    name: formData.get("name"),
    sort_order: formData.get("sort_order") ?? 0,
  });
  const supabase = await createClient();
  const { error } = await supabase.from("product_categories").insert(parsed);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/categories");
}

export async function updateCategory(id: string, formData: FormData) {
  await requireRole("ops_manager", "admin");
  const parsed = schema.parse({
    name: formData.get("name"),
    sort_order: formData.get("sort_order") ?? 0,
  });
  const supabase = await createClient();
  const { error } = await supabase.from("product_categories").update(parsed).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/categories");
}

export async function setCategoryActive(id: string, is_active: boolean) {
  await requireRole("ops_manager", "admin");
  const supabase = await createClient();
  const { error } = await supabase.from("product_categories").update({ is_active }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/categories");
}
