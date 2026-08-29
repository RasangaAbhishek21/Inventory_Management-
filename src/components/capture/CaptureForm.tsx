"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PrimaryAction } from "@/components/ui/PrimaryAction";
import { Field, fieldInputClass } from "@/components/ui/Field";
import { Stepper } from "@/components/ui/Stepper";
import { ProductPicker, type PickerProduct } from "@/components/capture/ProductPicker";
import { isoDate } from "@/lib/format";
import { t } from "@/strings";

interface Line {
  key: string;
  product: PickerProduct;
  finishId: string | null;
  qty: number;
  variantNote: string;
}

export function CaptureForm({
  products,
  finishes,
  locations,
  defaultLocationId,
  lockLocation,
  thumbBaseUrl,
  action,
  submitLabel,
  orderNumber = "hidden",
  dateLabel,
  notesLabel,
}: {
  products: PickerProduct[];
  finishes: { id: string; name: string }[];
  locations: { id: string; name: string }[];
  defaultLocationId: string;
  lockLocation: boolean;
  thumbBaseUrl: string;
  action: (input: unknown) => Promise<{ count: number }>;
  submitLabel: string;
  orderNumber?: "required" | "optional" | "hidden";
  dateLabel: string;
  notesLabel?: string;
}) {
  const router = useRouter();
  const [locationId, setLocationId] = useState(defaultLocationId);
  const [date, setDate] = useState(isoDate());
  const [order, setOrder] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patch = (key: string, next: Partial<Line>) =>
    setLines((cur) => cur.map((l) => (l.key === key ? { ...l, ...next } : l)));

  async function submit() {
    if (lines.length === 0) return;
    if (orderNumber === "required" && !order.trim()) {
      setError(t.capture.orderNumber + " " + t.common.required);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { count } = await action({
        location_id: locationId,
        transaction_date: date,
        order_number: order.trim() || null,
        notes: notes.trim() || null,
        lines: lines.map((l) => ({
          product_id: l.product.id,
          finish_id: l.finishId,
          variant_note: l.variantNote.trim() || null,
          quantity: l.qty,
        })),
      });
      const locName = locations.find((x) => x.id === locationId)?.name ?? "";
      if (count === 1) {
        const l = lines[0];
        const finish = finishes.find((f) => f.id === l.finishId)?.name ?? null;
        toast.success(t.confirmations.recorded(l.qty, l.product.name, finish, locName));
      } else {
        toast.success(`Recorded ${count} lines at ${locName}.`);
      }
      router.push("/");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      {!lockLocation ? (
        <Field label={t.common.location}>
          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            className={fieldInputClass}
          >
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </Field>
      ) : null}

      <ProductPicker
        products={products}
        thumbBaseUrl={thumbBaseUrl}
        onSelect={(p) =>
          setLines((cur) => [
            ...cur,
            {
              key: crypto.randomUUID(),
              product: p,
              finishId: finishes[0]?.id ?? null,
              qty: 1,
              variantNote: "",
            },
          ])
        }
      />

      {lines.length === 0 ? (
        <p className="text-sm text-ink-60">{t.capture.noLinesYet}</p>
      ) : (
        <>
          <p className="text-sm text-ink-60">{t.capture.lines(lines.length)}</p>
          <ul className="flex flex-col gap-4">
            {lines.map((l) => (
              <li
                key={l.key}
                className="flex flex-col gap-2 rounded-lg border border-sand bg-surface p-3"
              >
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
                <Stepper value={l.qty} onChange={(n) => patch(l.key, { qty: n })} />
                <input
                  value={l.variantNote}
                  onChange={(e) => patch(l.key, { variantNote: e.target.value })}
                  placeholder={t.capture.variantNoteEg}
                  className={fieldInputClass}
                />
              </li>
            ))}
          </ul>
        </>
      )}

      {orderNumber !== "hidden" ? (
        <Field
          label={t.capture.orderNumber}
          optional={orderNumber === "optional"}
        >
          <input
            value={order}
            onChange={(e) => setOrder(e.target.value)}
            className={fieldInputClass}
          />
        </Field>
      ) : null}

      <Field label={dateLabel}>
        <input
          type="date"
          value={date}
          max={isoDate()}
          onChange={(e) => setDate(e.target.value)}
          className={fieldInputClass}
        />
      </Field>

      <Field label={notesLabel ?? t.common.notes} optional={!notesLabel}>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} className={fieldInputClass} />
      </Field>

      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <PrimaryAction type="button" onClick={submit} disabled={busy || lines.length === 0}>
        {submitLabel}
      </PrimaryAction>
    </div>
  );
}
