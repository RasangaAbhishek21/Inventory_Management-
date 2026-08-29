/**
 * Delete a user from Supabase Auth (and, by cascade, their profiles row).
 *
 *   npx tsx scripts/delete-user.ts --email smoketest@home47.lk
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 * This is a hard delete and cannot be undone — make sure you have another admin
 * account before removing the last one.
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
  if (!email) {
    console.error("Usage: tsx scripts/delete-user.ts --email <address>");
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

  // Find the user id by email (paginate defensively for larger directories).
  let userId: string | undefined;
  for (let page = 1; page <= 20 && !userId; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      console.error("listUsers failed:", error.message);
      process.exit(1);
    }
    userId = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id;
    if (data.users.length < 200) break;
  }

  if (!userId) {
    console.error(`No user found with email "${email}".`);
    process.exit(1);
  }

  // Guard: refuse to delete the last remaining active admin.
  const { data: admins } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .eq("is_active", true);
  if (admins && admins.length <= 1 && admins.some((a) => a.id === userId)) {
    console.error("Refusing to delete the last active admin. Create another admin first.");
    process.exit(1);
  }

  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) {
    console.error("deleteUser failed:", error.message);
    process.exit(1);
  }

  console.log(`✓ Deleted ${email} (${userId}). Its profiles row was removed by cascade.`);
}

main();
