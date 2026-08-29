import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAdjustmentExceptions, monthStart } from "@/lib/reports";
import { formatQty, formatValue, isoDate } from "@/lib/format";
import { t } from "@/strings";

export default async function AdjustmentExceptionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Brief §5.5 — this report is for finance and admin.
  await requireRole("finance", "admin");
  const sp = await searchParams;
  const ym =
    typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month)
      ? sp.month
      : isoDate().slice(0, 7);
  const month = monthStart(ym);

  const supabase = await createClient();
  const rows = await getAdjustmentExceptions(supabase, month);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{t.reports.adjustmentExceptions}</h1>
      <p className="text-ink-60">{t.reports.exceptionsIntro}</p>

      <form method="get" className="flex flex-wrap items-end gap-2 text-sm">
        <label className="flex flex-col">
          {t.reports.month}
          <input
            type="month"
            name="month"
            defaultValue={ym}
            className="rounded-lg border border-sand bg-surface px-2 py-1"
          />
        </label>
        <button type="submit" className="rounded-lg border border-ink px-3 py-1.5 font-medium">
          {t.reports.apply}
        </button>
        <a
          href={`/api/reports/adjustment-exceptions?month=${ym}`}
          className="rounded-lg border border-ink px-3 py-1.5 font-medium"
        >
          {t.reports.downloadCsv}
        </a>
      </form>

      {rows.length === 0 ? (
        <p className="text-ink-60">{t.reports.noExceptions}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-subtle text-left text-xs uppercase tracking-wide text-ink-60">
                <th className="px-2 py-1">{t.common.date}</th>
                <th className="px-2 py-1">{t.common.location}</th>
                <th className="px-2 py-1">{t.common.product}</th>
                <th className="px-2 py-1 text-right">{t.reports.quantity}</th>
                <th className="px-2 py-1 text-right">{t.reports.valueAtSelling}</th>
                <th className="px-2 py-1">{t.adjust.reason}</th>
                <th className="px-2 py-1">{t.reports.enteredBy}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-border">
                  <td className="px-2 py-1">{r.date}</td>
                  <td className="px-2 py-1">{r.location}</td>
                  <td className="px-2 py-1">
                    {r.product}
                    {r.finish ? <span className="text-ink-60"> ({r.finish})</span> : null}
                  </td>
                  <td className={`num px-2 py-1 text-right ${r.quantity < 0 ? "text-danger" : "text-amber"}`}>
                    {formatQty(r.quantity)}
                  </td>
                  <td className="num px-2 py-1 text-right">{formatValue(r.valueAtSelling)}</td>
                  <td className="px-2 py-1">
                    {r.reason ?? "—"}
                    {r.notes ? <span className="text-ink-60"> — {r.notes}</span> : null}
                  </td>
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
