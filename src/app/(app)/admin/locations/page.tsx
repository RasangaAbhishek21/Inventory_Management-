import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PrimaryAction } from "@/components/ui/PrimaryAction";
import { Field, fieldInputClass } from "@/components/ui/Field";
import { t } from "@/strings";
import { createLocation, updateLocation, setLocationActive } from "./actions";

export default async function LocationsPage() {
  await requireRole("ops_manager", "admin");
  const supabase = await createClient();
  const { data: locations } = await supabase
    .from("locations")
    .select("id, name, code, location_type, can_originate, is_active")
    .order("name");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">{t.admin.locations}</h1>

      <form action={createLocation} className="flex flex-col gap-3 rounded-lg border border-sand bg-surface p-4">
        <Field label={t.admin.name}>
          <input name="name" required className={fieldInputClass} />
        </Field>
        <Field label={t.admin.code} hint="2–8 letters, unique">
          <input name="code" required maxLength={8} className={fieldInputClass} />
        </Field>
        <Field label={t.admin.locationType}>
          <select name="location_type" className={fieldInputClass} defaultValue="factory">
            <option value="factory">{t.admin.factory}</option>
            <option value="showroom">{t.admin.showroom}</option>
          </select>
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="can_originate" className="size-5" />
          {t.admin.canOriginate}
        </label>
        <PrimaryAction type="submit">{t.admin.add}</PrimaryAction>
      </form>

      <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        {(locations ?? []).map((l) => (
          <li key={l.id} className="flex flex-col gap-2 px-4 py-3">
            <form action={updateLocation.bind(null, l.id)} className="flex flex-col gap-2">
              <div className="flex gap-2">
                <input
                  name="name"
                  defaultValue={l.name}
                  required
                  className="flex-1 rounded-lg border border-sand bg-surface px-3 py-2 text-base"
                />
                <input
                  name="code"
                  defaultValue={l.code}
                  required
                  maxLength={8}
                  className="w-24 rounded-lg border border-sand bg-surface px-3 py-2 text-base uppercase"
                />
              </div>
              <div className="flex items-center gap-3">
                <select
                  name="location_type"
                  defaultValue={l.location_type}
                  className="rounded-lg border border-sand bg-surface px-3 py-2 text-base"
                >
                  <option value="factory">{t.admin.factory}</option>
                  <option value="showroom">{t.admin.showroom}</option>
                </select>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="can_originate"
                    defaultChecked={l.can_originate}
                    className="size-5"
                  />
                  {t.admin.canOriginate}
                </label>
                <button type="submit" className="ml-auto rounded-lg border border-ink px-3 py-2 text-sm">
                  {t.common.save}
                </button>
              </div>
            </form>
            <form action={setLocationActive.bind(null, l.id, !l.is_active)}>
              <button
                type="submit"
                className={`text-sm ${l.is_active ? "text-danger" : "text-ink-60"}`}
              >
                {l.is_active ? t.admin.deactivate : t.admin.reactivate}
              </button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
