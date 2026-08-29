import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PrimaryAction } from "@/components/ui/PrimaryAction";
import { formatValue } from "@/lib/format";
import { t } from "@/strings";
import { setProductActive } from "./actions";

export default async function ProductsPage() {
  const user = await requireRole("ops_manager", "admin", "finance");
  const isOps = user.role === "ops_manager" || user.role === "admin";
  const supabase = await createClient();

  const { data: products } = await supabase
    .from("products")
    .select("id, name, selling_price, standard_cost, is_active, category_id")
    .order("name");
  const { data: categories } = await supabase
    .from("product_categories")
    .select("id, name");
  const catName = new Map((categories ?? []).map((c) => [c.id, c.name]));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">
          {isOps ? t.admin.products : t.admin.productCosts}
        </h1>
        {isOps ? (
          <Link href="/admin/products/new">
            <PrimaryAction type="button">{t.admin.add}</PrimaryAction>
          </Link>
        ) : null}
      </div>

      <ul className="flex flex-col divide-y divide-sand">
        {(products ?? []).map((p) => (
          <li key={p.id} className="flex items-center gap-3 py-3">
            <Link href={`/admin/products/${p.id}`} className="flex-1">
              <div className={`font-medium ${p.is_active ? "" : "text-ink-60 line-through"}`}>
                {p.name}
              </div>
              <div className="text-sm text-ink-60">
                {p.category_id ? catName.get(p.category_id) ?? "" : ""}
                {" · "}
                {t.admin.sellingPrice}: <span className="num">{formatValue(p.selling_price)}</span>
                {" · "}
                {t.admin.standardCost}: <span className="num">{formatValue(p.standard_cost)}</span>
              </div>
            </Link>
            {isOps ? (
              <form action={setProductActive.bind(null, p.id, !p.is_active)}>
                <button
                  type="submit"
                  className={`text-sm ${p.is_active ? "text-danger" : "text-ink-60"}`}
                >
                  {p.is_active ? t.admin.deactivate : t.admin.reactivate}
                </button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
