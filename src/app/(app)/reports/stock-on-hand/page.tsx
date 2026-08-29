import { createClient } from "@/lib/supabase/server";
import { getStockOnHand } from "@/lib/reports";
import { formatQty, formatValue, isoDate } from "@/lib/format";
import { t } from "@/strings";

export default async function StockOnHandPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const asAt = str("as_at") || isoDate();
  const location = str("location");
  const category = str("category");

  const supabase = await createClient();
  const [{ data: locations }, { data: categories }, { rows }] = await Promise.all([
    supabase.from("locations").select("id, name").order("name"),
    supabase.from("product_categories").select("id, name").order("sort_order"),
    getStockOnHand(supabase, {
      asAt,
      locationId: location || null,
      categoryId: category || null,
    }),
  ]);

  // group by location
  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const g = groups.get(r.location) ?? [];
    g.push(r);
    groups.set(r.location, g);
  }
  const grand = rows.reduce(
    (acc, r) => {
      acc.qty += r.quantity;
      acc.sell += r.valueAtSelling;
      acc.cost += r.valueAtStandardCost;
      return acc;
    },
    { qty: 0, sell: 0, cost: 0 },
  );
  const missing = rows.filter((r) => r.missingCost).length;

  const csvHref = `/api/reports/stock-on-hand?as_at=${asAt}${location ? `&location=${location}` : ""}${category ? `&category=${category}` : ""}`;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{t.reports.stockOnHand}</h1>

      <form method="get" className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col text-sm">
          {t.reports.asAt}
          <input type="date" name="as_at" defaultValue={asAt} max={isoDate()} className="rounded-lg border border-sand bg-surface px-2 py-1" />
        </label>
        <label className="flex flex-col text-sm">
          {t.common.location}
          <select name="location" defaultValue={location} className="rounded-lg border border-sand bg-surface px-2 py-1">
            <option value="">{t.reports.allLocations}</option>
            {(locations ?? []).map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-sm">
          {t.admin.category}
          <select name="category" defaultValue={category} className="rounded-lg border border-sand bg-surface px-2 py-1">
            <option value="">{t.reports.allCategories}</option>
            {(categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded-lg border border-ink px-3 py-1.5 text-sm font-medium">
          {t.reports.apply}
        </button>
        <a href={csvHref} className="rounded-lg border border-ink px-3 py-1.5 text-sm font-medium">
          {t.reports.downloadCsv}
        </a>
      </form>

      {rows.length === 0 ? (
        <p className="text-ink-60">{t.reports.noRows}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-subtle text-left text-xs uppercase tracking-wide text-ink-60">
                <th className="px-2 py-1">{t.common.product}</th>
                <th className="px-2 py-1">{t.common.finish}</th>
                <th className="px-2 py-1 text-right">{t.reports.quantity}</th>
                <th className="px-2 py-1 text-right">{t.reports.valueAtSelling}</th>
                <th className="px-2 py-1 text-right">{t.reports.valueAtStandardCost}</th>
              </tr>
            </thead>
            {[...groups.entries()].map(([loc, gRows]) => {
              const sub = gRows.reduce(
                (a, r) => {
                  a.qty += r.quantity;
                  a.sell += r.valueAtSelling;
                  a.cost += r.valueAtStandardCost;
                  return a;
                },
                { qty: 0, sell: 0, cost: 0 },
              );
              return (
                <tbody key={loc}>
                  <tr className="bg-sand/40">
                    <td colSpan={5} className="px-2 py-1 font-semibold">{loc}</td>
                  </tr>
                  {gRows.map((r, i) => (
                    <tr key={i} className="border-b border-border">
                      <td className="px-2 py-1">{r.product}</td>
                      <td className="px-2 py-1 text-ink-60">{r.finish ?? "—"}</td>
                      <td className="num px-2 py-1 text-right">{formatQty(r.quantity)}</td>
                      <td className="num px-2 py-1 text-right">{formatValue(r.valueAtSelling)}</td>
                      <td className="num px-2 py-1 text-right">{formatValue(r.valueAtStandardCost)}</td>
                    </tr>
                  ))}
                  <tr className="border-b border-ink font-medium">
                    <td className="px-2 py-1" colSpan={2}>{t.reports.subtotal} — {loc}</td>
                    <td className="num px-2 py-1 text-right">{formatQty(sub.qty)}</td>
                    <td className="num px-2 py-1 text-right">{formatValue(sub.sell)}</td>
                    <td className="num px-2 py-1 text-right">{formatValue(sub.cost)}</td>
                  </tr>
                </tbody>
              );
            })}
            <tfoot>
              <tr className="font-semibold">
                <td className="px-2 py-2" colSpan={2}>{t.reports.grandTotal}</td>
                <td className="num px-2 py-2 text-right">{formatQty(grand.qty)}</td>
                <td className="num px-2 py-2 text-right">{formatValue(grand.sell)}</td>
                <td className="num px-2 py-2 text-right">{formatValue(grand.cost)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {missing > 0 ? (
        <p className="text-sm text-ink-60">{t.reports.missingCostFooter(missing)}</p>
      ) : null}
    </div>
  );
}
