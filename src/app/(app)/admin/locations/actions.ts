"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  code: z.string().trim().min(2).max(8).toUpperCase(),
  location_type: z.enum(["factory", "showroom"]),
  can_originate: z.coerce.boolean(),
});

export async function createLocation(formData: FormData) {
  await requireRole("ops_manager", "admin");
  const parsed = schema.parse({
    name: formData.get("name"),
    code: formData.get("code"),
    location_type: formData.get("location_type"),
    can_originate: formData.get("can_originate") === "on",
  });
  const supabase = await createClient();
  const { error } = await supabase.from("locations").insert(parsed);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/locations");
}

export async function updateLocation(id: string, formData: FormData) {
  await requireRole("ops_manager", "admin");
  const parsed = schema.parse({
    name: formData.get("name"),
    code: formData.get("code"),
    location_type: formData.get("location_type"),
    can_originate: formData.get("can_originate") === "on",
  });
  const supabase = await createClient();
  const { error } = await supabase.from("locations").update(parsed).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/locations");
}

export async function setLocationActive(id: string, is_active: boolean) {
  await requireRole("ops_manager", "admin");
  const supabase = await createClient();
  const { error } = await supabase.from("locations").update({ is_active }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/locations");
}
