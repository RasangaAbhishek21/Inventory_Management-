"use client";

import { useMemo, useState } from "react";
import { formatQty } from "@/lib/format";
import { fieldInputClass } from "@/components/ui/Field";
import { t } from "@/strings";

interface Balance {
  location_id: string;
  product_id: string;
  finish_id: string | null;
  qty_on_hand: number;
}
interface InTransit {
  product_id: string;
  finish_id: string | null;
  qty: number;
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-ink-60">{label}</div>
      <div className="num mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}

export function SpotInventory({
  balances,
  inTransit,
  locations,
  productNames,
  productImages,
  productCategory,
  categories,
  finishNames,
  thumbBaseUrl,
  initialQ = "",
}: {
  balances: Balance[];
  inTransit: InTransit[];
  locations: { id: string; name: string }[];
  productNames: Record<string, string>;
  productImages: Record<string, string | null>;
  productCategory: Record<string, string | null>;
  categories: { id: string; name: string }[];
  finishNames: Record<string, string>;
  thumbBaseUrl: string;
  initialQ?: string;
}) {
  const [q, setQ] = useState(initialQ);
  const [category, setCategory] = useState("");
  const [hideZero, setHideZero] = useState(true);

  const rows = useMemo(() => {
    const key = (p: string, f: string | null) => `${p}::${f ?? ""}`;
    const map = new Map<
      string,
      { product_id: string; finish_id: string | null; byLoc: Record<string, number>; transit: number }
    >();
    const ensure = (p: string, f: string | null) => {
      const k = key(p, f);
      let row = map.get(k);
      if (!row) {
        row = { product_id: p, finish_id: f, byLoc: {}, transit: 0 };
        map.set(k, row);
      }
      return row;
    };

    for (const b of balances) ensure(b.product_id, b.finish_id).byLoc[b.location_id] = b.qty_on_hand;
    for (const it of inTransit) ensure(it.product_id, it.finish_id).transit += it.qty;

    const needle = q.trim().toLowerCase();
    return [...map.values()]
      .map((r) => {
        const onHand = locations.reduce((s, l) => s + (r.byLoc[l.id] ?? 0), 0);
        return {
          ...r,
          product: productNames[r.product_id] ?? "—",
          finish: r.finish_id ? (finishNames[r.finish_id] ?? "") : null,
          onHand,
          total: onHand + r.transit,
        };
      })
      .filter((r) => {
        if (needle && !r.product.toLowerCase().includes(needle)) return false;
        if (category && productCategory[r.product_id] !== category) return false;
        if (hideZero && r.total === 0) return false;
        return true;
      })
      .sort(
        (a, b) =>
          a.product.localeCompare(b.product) || (a.finish ?? "").localeCompare(b.finish ?? ""),
      );
  }, [balances, inTransit, locations, productNames, productCategory, finishNames, q, category, hideZero]);

  const totals = useMemo(() => {
    const byLoc: Record<string, number> = {};
    let transit = 0;
    let onHand = 0;
    for (const r of rows) {
      for (const l of locations) byLoc[l.id] = (byLoc[l.id] ?? 0) + (r.byLoc[l.id] ?? 0);
      transit += r.transit;
      onHand += r.onHand;
    }
    return { byLoc, transit, onHand, total: onHand + transit };
  }, [rows, locations]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Lines" value={formatQty(rows.length)} />
        <StatTile label="Units on hand" value={formatQty(totals.onHand)} />
        <StatTile label={t.capture.inTransit} value={formatQty(totals.transit)} />
        <StatTile label="Locations" value={formatQty(locations.length)} />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t.capture.checkStockPrompt}
            className={`${fieldInputClass} min-w-52 flex-1`}
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm shadow-sm"
          >
            <option value="">{t.reports.allCategories}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 px-1 text-sm text-ink-60">
            <input
              type="checkbox"
              checked={hideZero}
              onChange={(e) => setHideZero(e.target.checked)}
              className="size-4"
            />
            {t.spot.hideZero}
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-subtle text-left text-xs uppercase tracking-wide text-ink-60">
                <th className="w-12 py-2 pl-4 pr-2">
                  <span className="sr-only">Image</span>
                </th>
                <th className="px-2 py-2">{t.common.product}</th>
                <th className="px-2 py-2">{t.common.finish}</th>
                {locations.map((l) => (
                  <th key={l.id} className="px-2 py-2 text-right">
                    {l.name}
                  </th>
                ))}
                <th className="px-2 py-2 text-right">{t.capture.inTransit}</th>
                <th className="py-2 pl-2 pr-4 text-right">{t.spot.total}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={locations.length + 5} className="px-4 py-10 text-center text-ink-60">
                    {t.empty.noResults}
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const img = productImages[r.product_id];
                  return (
                    <tr
                      key={`${r.product_id}${r.finish_id ?? ""}`}
                      className="border-b border-border last:border-0 hover:bg-surface-subtle"
                    >
                      <td className="py-2 pl-4 pr-2">
                        {img ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={`${thumbBaseUrl}/${img}?width=72&height=72&resize=cover`}
                            alt=""
                            className="h-9 w-9 rounded-md border border-border object-cover"
                          />
                        ) : (
                          <span className="block h-9 w-9 rounded-md border border-border bg-surface-subtle" />
                        )}
                      </td>
                      <td className="px-2 py-2 font-medium">{r.product}</td>
                      <td className="px-2 py-2 text-ink-60">{r.finish ?? "—"}</td>
                      {locations.map((l) => {
                        const v = r.byLoc[l.id] ?? 0;
                        return (
                          <td
                            key={l.id}
                            className={`num px-2 py-2 text-right ${v === 0 ? "text-border-strong" : ""}`}
                          >
                            {formatQty(v)}
                          </td>
                        );
                      })}
                      <td className="num px-2 py-2 text-right text-ink-60">
                        {r.transit ? formatQty(r.transit) : "—"}
                      </td>
                      <td className="num py-2 pl-2 pr-4 text-right font-semibold">
                        {formatQty(r.total)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {rows.length > 0 ? (
              <tfoot>
                <tr className="border-t border-border-strong bg-surface-subtle font-semibold">
                  <td className="py-2 pl-4 pr-2" colSpan={3}>
                    {t.reports.grandTotal}
                  </td>
                  {locations.map((l) => (
                    <td key={l.id} className="num px-2 py-2 text-right">
                      {formatQty(totals.byLoc[l.id] ?? 0)}
                    </td>
                  ))}
                  <td className="num px-2 py-2 text-right">{formatQty(totals.transit)}</td>
                  <td className="num py-2 pl-2 pr-4 text-right">{formatQty(totals.total)}</td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </div>
    </div>
  );
}
