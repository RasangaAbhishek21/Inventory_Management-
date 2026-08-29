"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";

const roleEnum = z.enum(["admin", "ops_manager", "finance", "staff"]);
const optionalUuid = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable();

const createSchema = z.object({
  full_name: z.string().trim().min(1).max(120),
  email: z.string().trim().email(),
  password: z.string().min(8, "at least 8 characters"),
  role: roleEnum,
  home_location_id: optionalUuid,
});

/** Provision a new user. Accounts are admin-created only (brief §3). Uses the
 *  service-role client — never exposed to the browser. */
export async function createUser(formData: FormData) {
  await requireRole("admin");
  const input = createSchema.parse(Object.fromEntries(formData));

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(error?.message ?? "Could not create the account.");

  const { error: profileError } = await admin.from("profiles").insert({
    id: data.user.id,
    full_name: input.full_name,
    role: input.role,
    home_location_id: input.home_location_id,
    is_active: true,
  });
  if (profileError) {
    // roll back the orphaned auth user
    await admin.auth.admin.deleteUser(data.user.id).catch(() => {});
    throw new Error(profileError.message);
  }

  revalidatePath("/admin/users");
}

const updateSchema = z.object({
  full_name: z.string().trim().min(1).max(120),
  role: roleEnum,
  home_location_id: optionalUuid,
});

export async function updateUser(id: string, formData: FormData) {
  await requireRole("admin");
  const input = updateSchema.parse(Object.fromEntries(formData));
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update(input).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/users");
}

export async function setUserActive(id: string, is_active: boolean) {
  await requireRole("admin");
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ is_active }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/users");
}
