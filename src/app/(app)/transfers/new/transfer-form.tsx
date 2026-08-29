"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PrimaryAction } from "@/components/ui/PrimaryAction";
import { Field, fieldInputClass } from "@/components/ui/Field";
import { Stepper } from "@/components/ui/Stepper";
import { ProductPicker, type PickerProduct } from "@/components/capture/ProductPicker";
import { isoDate, formatQty } from "@/lib/format";
import { t } from "@/strings";
import { dispatchTransfer } from "./actions";

interface Line {
  key: string;
  product: PickerProduct;
  finishId: string | null;
  qty: number;
  variantNote: string;
}

interface Balance {
  location_id: string;
  product_id: string;
  finish_id: string | null;
  qty_on_hand: number;
}

export function TransferForm({
  products,
  finishes,
  locations,
  balances,
  fromLocationId,
  lockFrom,
  thumbBaseUrl,
}: {
  products: PickerProduct[];
  finishes: { id: string; name: string }[];
  locations: { id: string; name: string }[];
  balances: Balance[];
  fromLocationId: string;
  lockFrom: boolean;
  thumbBaseUrl: string;
}) {
  const router = useRouter();
  const [from, setFrom] = useState(fromLocationId);
  const [to, setTo] = useState(locations.find((l) => l.id !== fromLocationId)?.id ?? "");
  const [date, setDate] = useState(isoDate());
  const [order, setOrder] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentRef, setSentRef] = useState<string | null>(null);

  const availAt = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of balances) {
      if (b.location_id === from) m.set(`${b.product_id}:${b.finish_id ?? ""}`, b.qty_on_hand);
    }
    return m;
  }, [balances, from]);

  // Only offer products that actually have stock at the chosen source (brief §8.3).
  const availableProducts = useMemo(() => {
    const withStock = new Set(
      balances.filter((b) => b.location_id === from && b.qty_on_hand > 0).map((b) => b.product_id),
    );
    return products.filter((p) => withStock.has(p.id));
  }, [products, balances, from]);

  const fromName = locations.find((l) => l.id === from)?.name ?? "";
  const patch = (key: string, next: Partial<Line>) =>
    setLines((cur) => cur.map((l) => (l.key === key ? { ...l, ...next } : l)));

  async function submit() {
    if (lines.length === 0 || !to) return;
    setBusy(true);
    setError(null);
    try {
      const { ref } = await dispatchTransfer({
        from_location_id: from,
        to_location_id: to,
        dispatch_date: date,
        order_number: order.trim() || null,
        notes: notes.trim() || null,
        lines: lines.map((l) => ({
          product_id: l.product.id,
          finish_id: l.finishId,
          variant_note: l.variantNote.trim() || null,
          qty: l.qty,
        })),
      });
      setSentRef(ref);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  if (sentRef) {
    return (
      <div className="flex max-w-md flex-col gap-3 rounded-xl border border-success/30 bg-success-bg p-5">
        <p className="text-sm text-success">{t.confirmations.transferSent(sentRef)}</p>
        <p className="num text-3xl font-bold tracking-tight text-ink">{sentRef}</p>
        <button
          type="button"
          onClick={() => {
            router.push("/");
            router.refresh();
          }}
          className="w-fit rounded-lg border border-border-strong bg-surface px-4 py-2 text-sm font-medium"
        >
          {t.common.back}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <Field label={t.capture.fromLocation}>
          {lockFrom ? (
            <input value={fromName} readOnly className={`${fieldInputClass} bg-page`} />
          ) : (
            <select value={from} onChange={(e) => setFrom(e.target.value)} className={fieldInputClass}>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label={t.capture.toLocation}>
          <select value={to} onChange={(e) => setTo(e.target.value)} className={fieldInputClass}>
            {locations
              .filter((l) => l.id !== from)
              .map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
          </select>
        </Field>
      </div>

      <ProductPicker
        products={availableProducts}
        thumbBaseUrl={thumbBaseUrl}
        emptyLabel={t.capture.nothingAtSource(fromName)}
        onSelect={(p) =>
          setLines((cur) => [
            ...cur,
            { key: crypto.randomUUID(), product: p, finishId: finishes[0]?.id ?? null, qty: 1, variantNote: "" },
          ])
        }
      />

      {lines.length === 0 ? (
        <p className="text-sm text-ink-60">{t.capture.noLinesYet}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {lines.map((l) => {
            const avail = availAt.get(`${l.product.id}:${l.finishId ?? ""}`) ?? 0;
            return (
              <li key={l.key} className="flex flex-col gap-2 rounded-lg border border-sand bg-surface p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium">{l.product.name}</span>
                  <button
                    type="button"
                    onClick={() => setLines((cur) => cur.filter((x) => x.key !== l.key))}
                    className="text-sm text-danger"
                  >
                    {t.capture.remove}
                  </button>
                </div>
                {finishes.length > 0 ? (
                  <select
                    value={l.finishId ?? ""}
                    onChange={(e) => patch(l.key, { finishId: e.target.value || null })}
                    className={fieldInputClass}
                  >
                    <option value="">{t.admin.none}</option>
                    {finishes.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                ) : null}
                <Stepper value={l.qty} onChange={(n) => patch(l.key, { qty: n })} max={avail || undefined} />
                <span className={`text-sm ${l.qty > avail ? "text-danger" : "text-ink-60"}`}>
                  <span className="num">{formatQty(avail)}</span> {t.capture.availableAt(fromName)}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <Field label={t.capture.transactionDate}>
        <input type="date" value={date} max={isoDate()} onChange={(e) => setDate(e.target.value)} className={fieldInputClass} />
      </Field>
      <Field label={t.capture.orderNumber} optional>
        <input value={order} onChange={(e) => setOrder(e.target.value)} className={fieldInputClass} />
      </Field>
      <Field label={t.common.notes} optional>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} className={fieldInputClass} />
      </Field>

      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <PrimaryAction type="button" onClick={submit} disabled={busy || lines.length === 0 || !to}>
        {t.capture.transferAction}
      </PrimaryAction>
    </div>
  );
}
