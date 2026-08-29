"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PrimaryAction } from "@/components/ui/PrimaryAction";
import { formatQty, formatValue } from "@/lib/format";
import { t } from "@/strings";
import { postCount, cancelCount } from "../../actions";

interface ReviewLine {
  product: string;
  finish: string | null;
  system: number;
  counted: number | null;
  variance: number | null;
  valueImpact: number;
}

export function ReviewView({
  countId,
  countRef,
  status,
  lines,
  hasLateMovements,
}: {
  countId: string;
  countRef: string;
  status: string;
  lines: ReviewLine[];
  hasLateMovements: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const counted = lines.filter((l) => l.variance !== null);
  const zero = counted.filter((l) => l.variance === 0).length;
  const lineAccuracy = counted.length ? zero / counted.length : null;
  const over = lines.reduce((s, l) => s + Math.max(l.variance ?? 0, 0), 0);
  const short = lines.reduce((s, l) => s + Math.min(l.variance ?? 0, 0), 0);
  const netValue = lines.reduce((s, l) => s + l.valueImpact, 0);

  async function run(fn: () => Promise<unknown>, okMsg: string) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      toast.success(okMsg);
      router.push("/counts");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-2 rounded-lg border border-sand bg-surface p-3 text-sm">
        <div>
          <dt className="text-ink-60">{t.counts.lineAccuracy}</dt>
          <dd className="num text-lg font-semibold">
            {lineAccuracy == null ? "—" : `${(lineAccuracy * 100).toFixed(0)}%`}
          </dd>
        </div>
        <div>
          <dt className="text-ink-60">{t.counts.netValueImpact}</dt>
          <dd className="num text-lg font-semibold">{formatValue(netValue)}</dd>
        </div>
        <div>
          <dt className="text-ink-60">{t.counts.unitsOver}</dt>
          <dd className="num text-lg font-semibold text-amber">{formatQty(over)}</dd>
        </div>
        <div>
          <dt className="text-ink-60">{t.counts.unitsShort}</dt>
          <dd className="num text-lg font-semibold text-danger">{formatQty(short)}</dd>
        </div>
      </dl>

      {hasLateMovements ? (
        <p className="rounded-lg border border-amber bg-surface p-3 text-sm text-amber">
          {t.counts.lateWarning}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-subtle text-left text-xs uppercase tracking-wide text-ink-60">
              <th className="px-2 py-1">{t.common.product}</th>
              <th className="px-2 py-1 text-right">{t.counts.system}</th>
              <th className="px-2 py-1 text-right">{t.counts.counted}</th>
              <th className="px-2 py-1 text-right">{t.counts.variance}</th>
              <th className="px-2 py-1 text-right">{t.counts.valueImpact}</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="border-b border-border">
                <td className="px-2 py-1">
                  {l.product}
                  {l.finish ? <span className="text-ink-60"> ({l.finish})</span> : null}
                </td>
                <td className="num px-2 py-1 text-right">{formatQty(l.system)}</td>
                <td className="num px-2 py-1 text-right">
                  {l.counted == null ? "—" : formatQty(l.counted)}
                </td>
                <td
                  className={`num px-2 py-1 text-right ${
                    (l.variance ?? 0) < 0 ? "text-danger" : (l.variance ?? 0) > 0 ? "text-amber" : ""
                  }`}
                >
                  {l.variance == null ? "—" : formatQty(l.variance)}
                </td>
                <td className="num px-2 py-1 text-right">{formatValue(l.valueImpact)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {status === "submitted" ? (
        <div className="flex flex-col gap-2">
          <PrimaryAction
            type="button"
            disabled={busy}
            onClick={() => {
              if (confirm(t.counts.postConfirm)) run(() => postCount(countId), t.counts.posted_toast);
            }}
          >
            {t.counts.postCount}
          </PrimaryAction>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (confirm(t.counts.cancelConfirm))
                run(() => cancelCount(countId, null), `${countRef} ${t.counts.cancelled.toLowerCase()}`);
            }}
            className="text-sm text-danger"
          >
            {t.counts.cancelCount}
          </button>
        </div>
      ) : (
        <p className="text-sm text-ink-60">{t.counts.postedReadOnly}</p>
      )}
    </div>
  );
}
