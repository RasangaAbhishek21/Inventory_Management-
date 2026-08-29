"use client";

import { useMemo, useState } from "react";
import { formatQty } from "@/lib/format";
import { t } from "@/strings";

interface Balance {
  location_id: string;
  product_id: string;
  finish_id: string | null;
  qty_on_hand: number;
}

export function CheckStock({
  balances,
  productNames,
  locationNames,
  finishNames,
}: {
  balances: Balance[];
  productNames: Record<string, string>;
  locationNames: Record<string, string>;
  finishNames: Record<string, string>;
}) {
  const [q, setQ] = useState("");

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    const byProduct = new Map<string, Balance[]>();
    for (const b of balances) {
      const name = productNames[b.product_id] ?? "";
      if (!name.toLowerCase().includes(needle)) continue;
      const arr = byProduct.get(b.product_id) ?? [];
      arr.push(b);
      byProduct.set(b.product_id, arr);
    }
    return [...byProduct.entries()]
      .map(([pid, rows]) => ({
        pid,
        name: productNames[pid] ?? "—",
        rows: rows
          .filter((r) => r.qty_on_hand !== 0)
          .sort(
            (a, b) =>
              (locationNames[a.location_id] ?? "").localeCompare(locationNames[b.location_id] ?? "") ||
              (a.finish_id ? finishNames[a.finish_id] ?? "" : "").localeCompare(
                b.finish_id ? finishNames[b.finish_id] ?? "" : "",
              ),
          ),
      }))
      .filter((g) => g.rows.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [q, balances, productNames, locationNames, finishNames]);

  return (
    <div className="flex flex-col gap-4">
      <input
        type="search"
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t.capture.checkStockPrompt}
        className="rounded-lg border border-sand bg-surface px-3 py-3 text-base"
      />

      {q.trim() === "" ? (
        <p className="text-ink-60">{t.empty.stockSearch}</p>
      ) : groups.length === 0 ? (
        <p className="text-ink-60">{t.empty.noResults}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {groups.map((g) => (
            <li key={g.pid} className="rounded-lg border border-sand bg-surface p-3">
              <div className="mb-2 font-medium">{g.name}</div>
              <table className="w-full text-sm">
                <tbody>
                  {g.rows.map((r, i) => (
                    <tr key={i} className="border-t border-sand first:border-0">
                      <td className="py-1">{locationNames[r.location_id] ?? "—"}</td>
                      <td className="py-1 text-ink-60">
                        {r.finish_id ? finishNames[r.finish_id] ?? "" : "—"}
                      </td>
                      <td className="num py-1 text-right font-semibold">
                        {formatQty(r.qty_on_hand)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
