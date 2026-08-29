import { createClient } from "@/lib/supabase/server";
import { getStockAccuracy } from "@/lib/reports";
import { formatQty, formatValue } from "@/lib/format";
import { t } from "@/strings";

const pct = (v: number | null) => (v == null ? "—" : `${(v * 100).toFixed(0)}%`);

export default async function StockAccuracyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const location = str("location");
  const month = /^\d{4}-\d{2}$/.test(str("month")) ? str("month") : "";

  const supabase = await createClient();
  const [{ data: locations }, rows] = await Promise.all([
    supabase.from("locations").select("id, name").order("name"),
    getStockAccuracy(supabase, {
      locationId: location || null,
      month: month ? `${month}-01` : null,
    }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{t.reports.stockAccuracy}</h1>
      <p className="text-ink-60">{t.reports.accuracyIntro}</p>

      <form method="get" className="flex flex-wrap items-end gap-2 text-sm">
        <label className="flex flex-col">
          {t.common.location}
          <select name="location" defaultValue={location} className="rounded-lg border border-sand bg-surface px-2 py-1">
            <option value="">{t.reports.allLocations}</option>
            {(locations ?? []).map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col">
          {t.reports.month}
          <input type="month" name="month" defaultValue={month} className="rounded-lg border border-sand bg-surface px-2 py-1" />
        </label>
        <button type="submit" className="rounded-lg border border-ink px-3 py-1.5 font-medium">
          {t.reports.apply}
        </button>
        <a href={`/api/reports/stock-accuracy?${new URLSearchParams({ ...(location ? { location } : {}), ...(month ? { month } : {}) }).toString()}`} className="rounded-lg border border-ink px-3 py-1.5 font-medium">
          {t.reports.downloadCsv}
        </a>
      </form>

      {rows.length === 0 ? (
        <p className="text-ink-60">{t.reports.noAccuracy}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink text-left">
                <th className="px-2 py-1">{t.reports.month}</th>
                <th className="px-2 py-1">{t.common.location}</th>
                <th className="px-2 py-1 text-right">{t.reports.linesCounted}</th>
                <th className="px-2 py-1 text-right">{t.counts.lineAccuracy}</th>
                <th className="px-2 py-1 text-right">{t.reports.unitAccuracy}</th>
                <th className="px-2 py-1 text-right">{t.counts.unitsOver}</th>
                <th className="px-2 py-1 text-right">{t.counts.unitsShort}</th>
                <th className="px-2 py-1 text-right">{t.counts.netValueImpact}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-sand">
                  <td className="num px-2 py-1">{r.month}</td>
                  <td className="px-2 py-1">{r.location}</td>
                  <td className="num px-2 py-1 text-right">{r.linesCounted}</td>
                  <td className="num px-2 py-1 text-right font-semibold">{pct(r.lineAccuracy)}</td>
                  <td className="num px-2 py-1 text-right">{pct(r.unitAccuracy)}</td>
                  <td className="num px-2 py-1 text-right text-amber">{formatQty(r.unitsOver)}</td>
                  <td className="num px-2 py-1 text-right text-danger">{formatQty(r.unitsShort)}</td>
                  <td className="num px-2 py-1 text-right">{formatValue(r.netValueImpact)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
