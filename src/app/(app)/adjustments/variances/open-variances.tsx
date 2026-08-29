"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { fieldInputClass } from "@/components/ui/Field";
import { formatQty, formatValue } from "@/lib/format";
import { t } from "@/strings";
import { resolveVariance } from "./actions";

interface VarianceLine {
  line_id: string;
  product: string;
  finish: string | null;
  shortfall: number;
  shortfall_value: number;
}
interface VarianceGroup {
  transfer_id: string;
  transfer_ref: string;
  to_location: string;
  lines: VarianceLine[];
}

export function OpenVariances({
  groups,
  reasons,
}: {
  groups: VarianceGroup[];
  reasons: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [reasonByTransfer, setReasonByTransfer] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function resolve(g: VarianceGroup) {
    const reason_id = reasonByTransfer[g.transfer_id];
    if (!reason_id) {
      setError(t.adjust.pickReason);
      return;
    }
    setBusy(g.transfer_id);
    setError(null);
    try {
      await resolveVariance({ transfer_id: g.transfer_id, reason_id });
      toast.success(t.adjust.resolved(g.transfer_ref));
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(null);
  }

  if (groups.length === 0) {
    return <p className="text-ink-60">{t.adjust.noVariances}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {groups.map((g) => {
        const totalShort = g.lines.reduce((s, l) => s + l.shortfall, 0);
        return (
          <div key={g.transfer_id} className="flex flex-col gap-2 rounded-lg border border-sand bg-surface p-3">
            <div className="flex items-center justify-between">
              <span className="num font-semibold">{g.transfer_ref}</span>
              <span className="text-sm text-ink-60">{g.to_location}</span>
            </div>
            <ul className="text-sm">
              {g.lines.map((l) => (
                <li key={l.line_id} className="flex justify-between py-0.5">
                  <span>
                    {l.product}
                    {l.finish ? ` (${l.finish})` : ""}
                  </span>
                  <span className="num text-danger">
                    −{formatQty(l.shortfall)} · {formatValue(l.shortfall_value)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-sm text-ink-60">{t.adjust.resolveSummary(totalShort)}</p>
            <div className="flex gap-2">
              <select
                value={reasonByTransfer[g.transfer_id] ?? ""}
                onChange={(e) =>
                  setReasonByTransfer((m) => ({ ...m, [g.transfer_id]: e.target.value }))
                }
                className={`${fieldInputClass} flex-1`}
              >
                <option value="">{t.adjust.pickReason}</option>
                {reasons.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => resolve(g)}
                disabled={busy === g.transfer_id}
                className="rounded-lg border border-ink px-4 py-2 font-semibold disabled:opacity-50"
              >
                {t.adjust.resolve}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
