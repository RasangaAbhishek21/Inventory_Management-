/**
 * Create the first admin user. There is no self-signup (brief §3).
 *
 *   npx tsx scripts/create-admin.ts --email you@home47.lk --password "…" --name "Your Name"
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 * Creates the auth.users row (email pre-confirmed) and a profiles row with role='admin'.
 * Safe to re-run — it updates the existing profile to admin if the email already exists.
 */
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database";

loadEnv({ path: ".env.local" });

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = arg("email");
  const password = arg("password");
  const name = arg("name");
  const homeLocationCode = arg("location"); // optional

  if (!email || !password || !name) {
    console.error(
      'Usage: tsx scripts/create-admin.ts --email <e> --password <p> --name "<n>" [--location MAH]',
    );
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local");
    process.exit(1);
  }

  const supabase = createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let homeLocationId: string | null = null;
  if (homeLocationCode) {
    const { data: loc, error } = await supabase
      .from("locations")
      .select("id")
      .eq("code", homeLocationCode)
      .maybeSingle();
    if (error || !loc) {
      console.error(`Location code "${homeLocationCode}" not found. Seed the DB first.`);
      process.exit(1);
    }
    homeLocationId = loc.id;
  }

  // Create or find the auth user.
  const created = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  let userId = created.data.user?.id;
  if (created.error) {
    if (!/already/i.test(created.error.message)) {
      console.error("createUser failed:", created.error.message);
      process.exit(1);
    }
    // Already exists — look it up.
    const { data: list } = await supabase.auth.admin.listUsers();
    userId = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id;
  }

  if (!userId) {
    console.error("Could not resolve the user id.");
    process.exit(1);
  }

  const { error: upsertError } = await supabase.from("profiles").upsert({
    id: userId,
    full_name: name,
    role: "admin",
    home_location_id: homeLocationId,
    is_active: true,
  });

  if (upsertError) {
    console.error("profiles upsert failed:", upsertError.message);
    process.exit(1);
  }

  console.log(`✓ Admin ready: ${email} (${userId})`);
}

main();
