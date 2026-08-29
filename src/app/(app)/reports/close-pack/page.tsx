import { createClient } from "@/lib/supabase/server";
import { getStockOnHand } from "@/lib/reports";
import { formatQty, formatValue, isoDate, isoLastMonthEnd } from "@/lib/format";
import { t } from "@/strings";

export default async function ClosePackPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const monthEnd =
    (typeof sp.month_end === "string" && sp.month_end) || isoLastMonthEnd();

  const supabase = await createClient();
  const { rows } = await getStockOnHand(supabase, { asAt: monthEnd });

  const grand = rows.reduce(
    (a, r) => {
      a.qty += r.quantity;
      a.sell += r.valueAtSelling;
      a.cost += r.valueAtStandardCost;
      return a;
    },
    { qty: 0, sell: 0, cost: 0 },
  );

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{t.reports.closePack}</h1>
      <p className="text-ink-60">{t.reports.closePackIntro}</p>

      <form method="get" className="flex flex-wrap items-end gap-2 text-sm">
        <label className="flex flex-col">
          {t.reports.monthEnd}
          <input
            type="date"
            name="month_end"
            defaultValue={monthEnd}
            max={isoDate()}
            className="rounded-lg border border-sand bg-surface px-2 py-1"
          />
        </label>
        <button type="submit" className="rounded-lg border border-ink px-3 py-1.5 font-medium">
          {t.reports.apply}
        </button>
        <a
          href={`/api/reports/close-pack?month_end=${monthEnd}`}
          className="rounded-lg border border-ink px-3 py-1.5 font-medium"
        >
          {t.reports.getPack}
        </a>
      </form>

      <p className="text-sm text-ink-60">
        {rows.length} lines · <span className="num">{formatQty(grand.qty)}</span> units ·{" "}
        <span className="num">{formatValue(grand.sell)}</span> {t.reports.valueAtSelling.toLowerCase()} ·{" "}
        <span className="num">{formatValue(grand.cost)}</span> {t.reports.valueAtStandardCost.toLowerCase()}
      </p>
    </div>
  );
}
