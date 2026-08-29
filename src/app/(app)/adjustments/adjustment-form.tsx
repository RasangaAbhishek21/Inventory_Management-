"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PrimaryAction } from "@/components/ui/PrimaryAction";
import { Field, fieldInputClass } from "@/components/ui/Field";
import { Stepper } from "@/components/ui/Stepper";
import { ProductPicker, type PickerProduct } from "@/components/capture/ProductPicker";
import { isoDate } from "@/lib/format";
import { t } from "@/strings";
import { postAdjustment } from "./actions";

interface Reason {
  id: string;
  label: string;
  requires_note: boolean;
}

export interface AdjustmentPrefill {
  transfer_id: string;
  transfer_ref: string;
  location_id: string;
  product: PickerProduct;
  finish_id: string | null;
  quantity: number;
}

export function AdjustmentForm({
  products,
  finishes,
  locations,
  reasons,
  thumbBaseUrl,
  prefill,
}: {
  products: PickerProduct[];
  finishes: { id: string; name: string }[];
  locations: { id: string; name: string }[];
  reasons: Reason[];
  thumbBaseUrl: string;
  prefill?: AdjustmentPrefill;
}) {
  const router = useRouter();
  const [locationId, setLocationId] = useState(prefill?.location_id ?? locations[0]?.id ?? "");
  const [product, setProduct] = useState<PickerProduct | null>(prefill?.product ?? null);
  const [finishId, setFinishId] = useState<string | null>(
    prefill?.finish_id ?? finishes[0]?.id ?? null,
  );
  const [direction, setDirection] = useState<"increase" | "decrease">(
    prefill ? "decrease" : "decrease",
  );
  const [qty, setQty] = useState(prefill?.quantity ?? 1);
  const [reasonId, setReasonId] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(isoDate());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reason = useMemo(() => reasons.find((r) => r.id === reasonId), [reasons, reasonId]);
  const noteRequired = Boolean(reason?.requires_note);

  async function submit() {
    if (!product) {
      setError(t.capture.pickAProduct);
      return;
    }
    if (!reasonId) {
      setError(t.adjust.pickReason);
      return;
    }
    if (noteRequired && !notes.trim()) {
      setError(t.adjust.noteRequired);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await postAdjustment({
        location_id: locationId,
        product_id: product.id,
        finish_id: finishId,
        direction,
        quantity: qty,
        reason_id: reasonId,
        notes: notes.trim() || null,
        transaction_date: date,
        transfer_id: prefill?.transfer_id ?? null,
      });
      toast.success(prefill ? t.adjust.resolved(prefill.transfer_ref) : t.adjust.posted);
      router.push(prefill ? "/adjustments/variances" : "/");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {prefill ? (
        <p className="rounded-lg border border-amber bg-surface p-3 text-sm text-amber">
          {t.adjust.fromVariance(prefill.transfer_ref)}
        </p>
      ) : null}

      <Field label={t.common.location}>
        <select
          value={locationId}
          onChange={(e) => setLocationId(e.target.value)}
          disabled={Boolean(prefill)}
          className={fieldInputClass}
        >
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </Field>

      {product ? (
        <div className="flex items-center justify-between rounded-lg border border-sand bg-surface p-3">
          <span className="font-medium">{product.name}</span>
          {!prefill ? (
            <button type="button" onClick={() => setProduct(null)} className="text-sm text-danger">
              {t.capture.remove}
            </button>
          ) : null}
        </div>
      ) : (
        <ProductPicker products={products} thumbBaseUrl={thumbBaseUrl} onSelect={setProduct} />
      )}

      {finishes.length > 0 ? (
        <Field label={t.common.finish}>
          <select
            value={finishId ?? ""}
            onChange={(e) => setFinishId(e.target.value || null)}
            disabled={Boolean(prefill)}
            className={fieldInputClass}
          >
            <option value="">{t.admin.none}</option>
            {finishes.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </Field>
      ) : null}

      <div className="flex gap-2">
        {(["increase", "decrease"] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDirection(d)}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
              direction === d ? "border-ink bg-ink text-page" : "border-sand"
            }`}
          >
            {d === "increase" ? t.adjust.increase : t.adjust.decrease}
          </button>
        ))}
      </div>
      <Stepper value={qty} onChange={setQty} />

      <Field label={t.adjust.reason}>
        <select
          value={reasonId}
          onChange={(e) => setReasonId(e.target.value)}
          className={fieldInputClass}
        >
          <option value="">{t.adjust.pickReason}</option>
          {reasons.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label={t.common.notes}
        optional={!noteRequired}
        hint={noteRequired ? t.adjust.noteRequired : undefined}
      >
        <input value={notes} onChange={(e) => setNotes(e.target.value)} className={fieldInputClass} />
      </Field>

      <Field label={t.capture.transactionDate}>
        <input
          type="date"
          value={date}
          max={isoDate()}
          onChange={(e) => setDate(e.target.value)}
          className={fieldInputClass}
        />
      </Field>

      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <PrimaryAction type="button" onClick={submit} disabled={busy}>
        {t.adjust.post}
      </PrimaryAction>
    </div>
  );
}
