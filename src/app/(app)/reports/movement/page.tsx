import { createClient } from "@/lib/supabase/server";
import { getMovementRows } from "@/lib/reports";
import { formatQty, formatValue, isoDate, isoDaysAgo } from "@/lib/format";
import type { MovementType } from "@/types/database";
import { t } from "@/strings";

const TYPES: MovementType[] = [
  "opening",
  "origination",
  "transfer_out",
  "transfer_in",
  "dispatch",
  "return",
  "adjustment",
];

export default async function MovementReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const from = str("from") || isoDaysAgo(29);
  const to = str("to") || isoDate();

  const supabase = await createClient();
  const [{ data: locations }, { data: products }, { data: finishes }, { data: users }, { rows }] =
    await Promise.all([
      supabase.from("locations").select("id, name").order("name"),
      supabase.from("products").select("id, name").order("name"),
      supabase.from("finishes").select("id, name").order("name"),
      supabase.from("profiles").select("id, full_name").order("full_name"),
      getMovementRows(supabase, {
        from,
        to,
        locationId: str("location") || null,
        productId: str("product") || null,
        finishId: str("finish") || null,
        type: (str("type") as MovementType) || null,
        userId: str("user") || null,
      }),
    ]);

  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(sp).filter(([, v]) => typeof v === "string")) as Record<string, string>,
  );
  qs.set("from", from);
  qs.set("to", to);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{t.reports.stockMovement}</h1>

      <form method="get" className="flex flex-wrap items-end gap-2 text-sm">
        <label className="flex flex-col">
          {t.reports.from}
          <input type="date" name="from" defaultValue={from} max={isoDate()} className="rounded-lg border border-sand bg-surface px-2 py-1" />
        </label>
        <label className="flex flex-col">
          {t.reports.to}
          <input type="date" name="to" defaultValue={to} max={isoDate()} className="rounded-lg border border-sand bg-surface px-2 py-1" />
        </label>
        <label className="flex flex-col">
          {t.common.location}
          <select name="location" defaultValue={str("location")} className="rounded-lg border border-sand bg-surface px-2 py-1">
            <option value="">{t.reports.allLocations}</option>
            {(locations ?? []).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col">
          {t.common.product}
          <select name="product" defaultValue={str("product")} className="rounded-lg border border-sand bg-surface px-2 py-1">
            <option value="">—</option>
            {(products ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col">
          {t.common.finish}
          <select name="finish" defaultValue={str("finish")} className="rounded-lg border border-sand bg-surface px-2 py-1">
            <option value="">—</option>
            {(finishes ?? []).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col">
          Type
          <select name="type" defaultValue={str("type")} className="rounded-lg border border-sand bg-surface px-2 py-1">
            <option value="">{t.reports.allTypes}</option>
            {TYPES.map((ty) => <option key={ty} value={ty}>{ty}</option>)}
          </select>
        </label>
        <label className="flex flex-col">
          {t.reports.enteredBy}
          <select name="user" defaultValue={str("user")} className="rounded-lg border border-sand bg-surface px-2 py-1">
            <option value="">{t.reports.allUsers}</option>
            {(users ?? []).map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
          </select>
        </label>
        <button type="submit" className="rounded-lg border border-ink px-3 py-1.5 font-medium">{t.reports.apply}</button>
        <a href={`/api/reports/movement?${qs.toString()}`} className="rounded-lg border border-ink px-3 py-1.5 font-medium">
          {t.reports.downloadCsv}
        </a>
      </form>

      {rows.length === 0 ? (
        <p className="text-ink-60">{t.reports.noRows}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink text-left">
                <th className="px-2 py-1">{t.common.date}</th>
                <th className="px-2 py-1">Type</th>
                <th className="px-2 py-1">{t.common.location}</th>
                <th className="px-2 py-1">{t.common.product}</th>
                <th className="px-2 py-1 text-right">{t.reports.quantity}</th>
                <th className="px-2 py-1 text-right">{t.reports.valueAtSelling}</th>
                <th className="px-2 py-1">{t.reports.reference}</th>
                <th className="px-2 py-1">{t.reports.enteredBy}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-sand">
                  <td className="px-2 py-1">{r.date}</td>
                  <td className="px-2 py-1">
                    {r.type}
                    {r.reverses ? (
                      <span className="ml-1 text-ink-60">({t.reports.reverses(r.reverses)})</span>
                    ) : null}
                  </td>
                  <td className="px-2 py-1">{r.location}</td>
                  <td className="px-2 py-1">
                    {r.product}
                    {r.finish ? <span className="text-ink-60"> ({r.finish})</span> : null}
                  </td>
                  <td className={`num px-2 py-1 text-right ${r.quantity < 0 ? "text-danger" : ""}`}>
                    {formatQty(r.quantity)}
                  </td>
                  <td className="num px-2 py-1 text-right">{formatValue(r.valueAtSelling)}</td>
                  <td className="num px-2 py-1">{r.reference ?? "—"}</td>
                  <td className="px-2 py-1">{r.enteredBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
