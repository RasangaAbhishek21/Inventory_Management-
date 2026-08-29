import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/types/database";

export interface CurrentUser {
  id: string;
  email: string | null;
  fullName: string;
  role: Role;
  homeLocationId: string | null;
  homeLocationName: string | null;
}

/**
 * Resolve the signed-in user and their profile for Server Components / Route Handlers.
 * Returns null if there is no valid session or no active profile.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, home_location_id, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !profile.is_active) return null;

  let homeLocationName: string | null = null;
  if (profile.home_location_id) {
    const { data: loc } = await supabase
      .from("locations")
      .select("name")
      .eq("id", profile.home_location_id)
      .maybeSingle();
    homeLocationName = loc?.name ?? null;
  }

  return {
    id: user.id,
    email: user.email ?? null,
    fullName: profile.full_name,
    role: profile.role,
    homeLocationId: profile.home_location_id,
    homeLocationName,
  };
}

/** Require a signed-in active user or redirect to /login. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Require one of the given roles, or redirect home. */
export async function requireRole(...roles: Role[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect("/");
  return user;
}
