import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PrimaryAction } from "@/components/ui/PrimaryAction";
import { Field, fieldInputClass } from "@/components/ui/Field";
import { t } from "@/strings";
import { createUser, updateUser, setUserActive } from "./actions";

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "staff", label: t.admin.roleStaff },
  { value: "ops_manager", label: t.admin.roleOps },
  { value: "finance", label: t.admin.roleFinance },
  { value: "admin", label: t.admin.roleAdmin },
];

export default async function UsersPage() {
  await requireRole("admin");
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, role, home_location_id, is_active")
    .order("full_name");
  const { data: locations } = await supabase
    .from("locations")
    .select("id, name")
    .eq("is_active", true)
    .order("name");
  const { data: authList } = await admin.auth.admin.listUsers({ perPage: 200 });
  const emailById = new Map((authList?.users ?? []).map((u) => [u.id, u.email ?? ""]));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">{t.admin.users}</h1>

      <form action={createUser} className="flex flex-col gap-3 rounded-lg border border-sand bg-surface p-4">
        <Field label={t.admin.fullName}>
          <input name="full_name" required className={fieldInputClass} />
        </Field>
        <Field label={t.admin.email}>
          <input name="email" type="email" required className={fieldInputClass} />
        </Field>
        <Field label={t.admin.tempPassword} hint="At least 8 characters. The user changes it later.">
          <input name="password" type="text" required minLength={8} className={fieldInputClass} />
        </Field>
        <div className="flex gap-2">
          <Field label={t.admin.role}>
            <select name="role" defaultValue="staff" className={fieldInputClass}>
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t.admin.homeLocation} optional>
            <select name="home_location_id" defaultValue="" className={fieldInputClass}>
              <option value="">{t.admin.none}</option>
              {(locations ?? []).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <PrimaryAction type="submit">{t.admin.add}</PrimaryAction>
      </form>

      <ul className="flex flex-col divide-y divide-sand">
        {(profiles ?? []).map((p) => (
          <li key={p.id} className="flex flex-col gap-2 py-3">
            <div className="text-sm text-ink-60">{emailById.get(p.id)}</div>
            <form action={updateUser.bind(null, p.id)} className="flex flex-col gap-2">
              <input
                name="full_name"
                defaultValue={p.full_name}
                required
                className="rounded-lg border border-sand bg-surface px-3 py-2 text-base"
              />
              <div className="flex flex-wrap items-center gap-2">
                <select
                  name="role"
                  defaultValue={p.role}
                  className="rounded-lg border border-sand bg-surface px-3 py-2 text-base"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <select
                  name="home_location_id"
                  defaultValue={p.home_location_id ?? ""}
                  className="rounded-lg border border-sand bg-surface px-3 py-2 text-base"
                >
                  <option value="">{t.admin.none}</option>
                  {(locations ?? []).map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
                <button type="submit" className="rounded-lg border border-ink px-3 py-2 text-sm">
                  {t.common.save}
                </button>
              </div>
            </form>
            <form action={setUserActive.bind(null, p.id, !p.is_active)}>
              <button
                type="submit"
                className={`text-sm ${p.is_active ? "text-danger" : "text-ink-60"}`}
              >
                {p.is_active ? `${t.admin.active} — ${t.admin.deactivate}` : `${t.admin.inactive} — ${t.admin.reactivate}`}
              </button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
