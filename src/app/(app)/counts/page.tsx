import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { OpenCount } from "./open-count";
import { t } from "@/strings";

const STATUS_LABEL: Record<string, string> = {
  open: t.counts.open,
  submitted: t.counts.submitted,
  posted: t.counts.posted,
  cancelled: t.counts.cancelled,
};

export default async function CountsPage() {
  const user = await requireUser();
  const isOps = user.role === "ops_manager" || user.role === "admin";
  const supabase = await createClient();

  const [{ data: counts }, { data: locations }] = await Promise.all([
    supabase
      .from("stock_counts")
      .select("id, count_ref, location_id, count_date, status")
      .order("count_date", { ascending: false }),
    supabase.from("locations").select("id, name").eq("is_active", true).order("name"),
  ]);
  const locName = new Map((locations ?? []).map((l) => [l.id, l.name]));

  // Per-count line accuracy + net variance (ops/admin can read the lines).
  const stats = new Map<string, { accuracy: number | null; net: number }>();
  if (isOps && counts) {
    const ids = counts.filter((c) => c.status === "submitted" || c.status === "posted").map((c) => c.id);
    if (ids.length) {
      const { data: lines } = await supabase
        .from("stock_count_lines")
        .select("stock_count_id, variance")
        .in("stock_count_id", ids);
      for (const id of ids) {
        const ls = (lines ?? []).filter((l) => l.stock_count_id === id);
        const counted = ls.filter((l) => l.variance !== null);
        const zero = counted.filter((l) => l.variance === 0).length;
        stats.set(id, {
          accuracy: counted.length ? zero / counted.length : null,
          net: ls.reduce((s, l) => s + (l.variance ?? 0), 0),
        });
      }
    }
  }

  const openLocationIds = new Set(
    (counts ?? []).filter((c) => c.status === "open" || c.status === "submitted").map((c) => c.location_id),
  );
  const openable = (locations ?? []).filter((l) => !openLocationIds.has(l.id));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{t.counts.title}</h1>

      {isOps && openable.length > 0 ? (
        <OpenCount locations={openable.map((l) => ({ id: l.id, name: l.name }))} />
      ) : null}

      {!counts || counts.length === 0 ? (
        <p className="text-ink-60">{t.counts.none}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-sand">
          {counts.map((c) => {
            const st = stats.get(c.id);
            const href =
              c.status === "open"
                ? `/counts/${c.id}/count`
                : isOps
                  ? `/counts/${c.id}/review`
                  : `/counts/${c.id}/count`;
            return (
              <li key={c.id}>
                <Link href={href} className="tap flex flex-col gap-1 py-3">
                  <div className="flex items-center justify-between">
                    <span className="num font-semibold">{c.count_ref}</span>
                    <span className="text-sm text-ink-60">{STATUS_LABEL[c.status]}</span>
                  </div>
                  <span className="text-sm text-ink-60">
                    {locName.get(c.location_id)} · {c.count_date}
                    {st?.accuracy != null
                      ? ` · ${t.counts.accuracy} ${(st.accuracy * 100).toFixed(0)}% · ${t.counts.netVariance} ${st.net}`
                      : ""}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
