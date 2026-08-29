import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PrimaryAction } from "@/components/ui/PrimaryAction";
import { fieldInputClass } from "@/components/ui/Field";
import { t } from "@/strings";
import { createCategory, updateCategory, setCategoryActive } from "./actions";

export default async function CategoriesPage() {
  await requireRole("ops_manager", "admin");
  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("product_categories")
    .select("id, name, sort_order, is_active")
    .order("sort_order")
    .order("name");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">{t.admin.categories}</h1>

      <form action={createCategory} className="flex flex-col gap-3 rounded-lg border border-sand bg-surface p-4">
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
        {(categories ?? []).map((c) => (
          <li key={c.id} className="flex items-center gap-2 py-3">
            <form action={updateCategory.bind(null, c.id)} className="flex flex-1 items-center gap-2">
              <input
                name="name"
                defaultValue={c.name}
                required
                className="flex-1 rounded-lg border border-sand bg-surface px-3 py-2 text-base"
              />
              <input
                name="sort_order"
                type="number"
                min={0}
                defaultValue={c.sort_order}
                aria-label={t.admin.sortOrder}
                className="w-20 rounded-lg border border-sand bg-surface px-3 py-2 text-base"
              />
              <button type="submit" className="rounded-lg border border-ink px-3 py-2 text-sm">
                {t.common.save}
              </button>
            </form>
            <form action={setCategoryActive.bind(null, c.id, !c.is_active)}>
              <button
                type="submit"
                className={`rounded-lg px-3 py-2 text-sm ${c.is_active ? "text-danger" : "text-ink-60"}`}
              >
                {c.is_active ? t.admin.deactivate : t.admin.reactivate}
              </button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
