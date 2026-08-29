import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AgeBadge } from "@/components/ui/AgeBadge";
import { hoursSince } from "@/lib/format";
import { t } from "@/strings";

export default async function ReceiveListPage() {
  const user = await requireUser();
  const supabase = await createClient();

  let query = supabase
    .from("v_in_transit")
    .select("id, transfer_ref, from_location, to_location, to_location_id, dispatched_at, dispatched_by_name, line_count")
    .order("dispatched_at", { ascending: true });

  if (user.role === "staff" && user.homeLocationId) {
    query = query.eq("to_location_id", user.homeLocationId);
  }
  const { data: inbound } = await query;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{t.capture.receiveTitle}</h1>

      {!inbound || inbound.length === 0 ? (
        <p className="text-ink-60">{t.empty.inbound}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          {inbound.map((tr) => (
            <li key={tr.id}>
              <Link href={`/transfers/receive/${tr.id}`} className="tap flex flex-col gap-1 px-4 py-3 hover:bg-surface-subtle">
                <div className="flex items-center justify-between gap-2">
                  <span className="num font-semibold">{tr.transfer_ref}</span>
                  <AgeBadge hours={hoursSince(tr.dispatched_at)} />
                </div>
                <span className="text-sm text-ink-60">
                  {tr.from_location} → {tr.to_location} · {t.capture.lines(tr.line_count)} ·{" "}
                  {tr.dispatched_by_name}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
