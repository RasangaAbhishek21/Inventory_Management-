import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PrimaryAction } from "@/components/ui/PrimaryAction";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { STORAGE_RENDER_BASE } from "@/lib/capture-data";
import { formatValue } from "@/lib/format";
import { t } from "@/strings";
import { setProductActive } from "./actions";

export default async function ProductsPage() {
  const user = await requireRole("ops_manager", "admin", "finance");
  const isOps = user.role === "ops_manager" || user.role === "admin";
  const supabase = await createClient();

  const { data: products } = await supabase
    .from("products")
    .select("id, name, image_path, selling_price, standard_cost, is_active, category_id")
    .order("name");
  const { data: categories } = await supabase.from("product_categories").select("id, name");
  const catName = new Map((categories ?? []).map((c) => [c.id, c.name]));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={isOps ? t.admin.products : t.admin.productCosts}
        actions={
          isOps ? (
            <Link href="/admin/products/new">
              <PrimaryAction type="button" inline>
                {t.admin.add}
              </PrimaryAction>
            </Link>
          ) : undefined
        }
      />

      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-subtle text-left text-xs uppercase tracking-wide text-ink-60">
                <th className="w-12 py-2 pl-4 pr-2"></th>
                <th className="px-2 py-2">{t.admin.name}</th>
                <th className="px-2 py-2">{t.common.status}</th>
                <th className="px-2 py-2">{t.admin.category}</th>
                <th className="px-2 py-2 text-right">{t.admin.sellingPrice}</th>
                <th className="px-2 py-2 text-right">{t.admin.standardCost}</th>
                {isOps ? <th className="py-2 pl-2 pr-4 text-right"></th> : null}
              </tr>
            </thead>
            <tbody>
              {(products ?? []).length === 0 ? (
                <tr>
                  <td colSpan={isOps ? 7 : 6} className="px-4 py-10 text-center text-ink-60">
                    {t.empty.noResults}
                  </td>
                </tr>
              ) : (
                (products ?? []).map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-border last:border-0 hover:bg-surface-subtle"
                  >
                    <td className="py-2 pl-4 pr-2">
                      {p.image_path ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`${STORAGE_RENDER_BASE}/${p.image_path}?width=72&height=72&resize=cover`}
                          alt=""
                          className="h-9 w-9 rounded-md border border-border object-cover"
                        />
                      ) : (
                        <span className="block h-9 w-9 rounded-md border border-border bg-surface-subtle" />
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <Link href={`/admin/products/${p.id}`} className="font-medium hover:underline">
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-2 py-2">
                      <Badge tone={p.is_active ? "success" : "neutral"}>
                        {p.is_active ? t.admin.active : t.admin.inactive}
                      </Badge>
                    </td>
                    <td className="px-2 py-2 text-ink-60">
                      {p.category_id ? (catName.get(p.category_id) ?? "—") : "—"}
                    </td>
                    <td className="num px-2 py-2 text-right">{formatValue(p.selling_price)}</td>
                    <td className="num px-2 py-2 text-right">{formatValue(p.standard_cost)}</td>
                    {isOps ? (
                      <td className="py-2 pl-2 pr-4 text-right">
                        <form action={setProductActive.bind(null, p.id, !p.is_active)}>
                          <button
                            type="submit"
                            className={`text-sm ${p.is_active ? "text-danger" : "text-ink-60"} hover:underline`}
                          >
                            {p.is_active ? t.admin.deactivate : t.admin.reactivate}
                          </button>
                        </form>
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
