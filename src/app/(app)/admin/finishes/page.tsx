import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PrimaryAction } from "@/components/ui/PrimaryAction";
import { fieldInputClass } from "@/components/ui/Field";
import { t } from "@/strings";
import { createFinish, updateFinish, setFinishActive } from "./actions";

export default async function FinishesPage() {
  await requireRole("ops_manager", "admin");
  const supabase = await createClient();
  const { data: finishes } = await supabase
    .from("finishes")
    .select("id, name, sort_order, is_active")
    .order("sort_order")
    .order("name");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">{t.admin.finishes}</h1>

      <form action={createFinish} className="flex flex-col gap-3 rounded-lg border border-sand bg-surface p-4">
        <div className="flex gap-2">
          <input name="name" placeholder={t.admin.name} required className={fieldInputClass} />
          <input
            name="sort_order"
            type="number"
            min={0}
            defaultValue={0}
            aria-label={t.admin.sortOrder}
            className="w-24 rounded-lg border border-sand bg-surface px-3 py-2 text-base"
          />
        </div>
        <PrimaryAction type="submit">{t.admin.add}</PrimaryAction>
      </form>

      <ul className="flex flex-col divide-y divide-sand">
        {(finishes ?? []).map((f) => (
          <li key={f.id} className="flex items-center gap-2 py-3">
            <form action={updateFinish.bind(null, f.id)} className="flex flex-1 items-center gap-2">
              <input
                name="name"
                defaultValue={f.name}
                required
                className="flex-1 rounded-lg border border-sand bg-surface px-3 py-2 text-base"
              />
              <input
                name="sort_order"
                type="number"
                min={0}
                defaultValue={f.sort_order}
                aria-label={t.admin.sortOrder}
                className="w-20 rounded-lg border border-sand bg-surface px-3 py-2 text-base"
              />
              <button type="submit" className="rounded-lg border border-ink px-3 py-2 text-sm">
                {t.common.save}
              </button>
            </form>
            <form action={setFinishActive.bind(null, f.id, !f.is_active)}>
              <button
                type="submit"
                className={`rounded-lg px-3 py-2 text-sm ${f.is_active ? "text-danger" : "text-ink-60"}`}
              >
                {f.is_active ? t.admin.deactivate : t.admin.reactivate}
              </button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
