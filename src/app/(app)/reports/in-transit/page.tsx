import { createClient } from "@/lib/supabase/server";
import { getInTransit } from "@/lib/reports";
import { AgeBadge } from "@/components/ui/AgeBadge";
import { config } from "@/config";
import { formatValue } from "@/lib/format";
import { t } from "@/strings";

export default async function InTransitReportPage() {
  const supabase = await createClient();
  const rows = await getInTransit(supabase);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t.reports.inTransit}</h1>
        <a href={`/api/reports/in-transit`} className="rounded-lg border border-ink px-3 py-1.5 text-sm font-medium">
          {t.reports.downloadCsv}
        </a>
      </div>

      {rows.length === 0 ? (
        <p className="text-ink-60">{t.empty.inbound}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-sand">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-col gap-1 py-3">
              <div className="flex items-center justify-between">
                <span className="num font-semibold">{r.transfer_ref}</span>
                <AgeBadge
                  hours={Number(r.age_hours)}
                  amberAt={config.IN_TRANSIT_AGE_AMBER_HOURS}
                  redAt={config.IN_TRANSIT_AGE_RED_HOURS}
                />
              </div>
              <span className="text-sm text-ink-60">
                {r.from_location} → {r.to_location} · {t.capture.lines(r.line_count)} ·{" "}
                {r.dispatched_by_name} · <span className="num">{formatValue(Number(r.value_at_selling_price))}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
