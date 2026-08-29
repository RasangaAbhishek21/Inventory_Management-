"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PrimaryAction } from "@/components/ui/PrimaryAction";
import { Stepper } from "@/components/ui/Stepper";
import { ProductPicker, type PickerProduct } from "@/components/capture/ProductPicker";
import { fieldInputClass } from "@/components/ui/Field";
import { t } from "@/strings";
import { addCountLine, setCountLine, submitCount } from "../../actions";

interface Line {
  line_id: string;
  product: string;
  finish: string | null;
  counted: number | null;
}

export function CounterView({
  countId,
  isOps,
  initialLines,
  products,
  finishes,
  thumbBaseUrl,
}: {
  countId: string;
  isOps: boolean;
  initialLines: Line[];
  products: PickerProduct[];
  finishes: { id: string; name: string }[];
  thumbBaseUrl: string;
}) {
  const router = useRouter();
  const [lines, setLines] = useState<Line[]>(initialLines);
  const [addFinish, setAddFinish] = useState<string | null>(finishes[0]?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const done = lines.filter((l) => l.counted !== null).length;
  const allCounted = lines.length > 0 && done === lines.length;

  async function save(lineId: string, qty: number) {
    setLines((cur) => cur.map((l) => (l.line_id === lineId ? { ...l, counted: qty } : l)));
    try {
      await setCountLine({ line_id: lineId, qty, notes: null });
    } catch (err) {
      setError((err as Error).message);
      toast.error((err as Error).message);
    }
  }

  async function addItem(p: PickerProduct) {
    setError(null);
    try {
      await addCountLine({ count_id: countId, product_id: p.id, finish_id: addFinish });
      router.refresh();
      // optimistic: append; a refresh will reconcile ids
      setLines((cur) => [
        ...cur,
        {
          line_id: `pending-${p.id}-${addFinish ?? ""}`,
          product: p.name,
          finish: finishes.find((f) => f.id === addFinish)?.name ?? null,
          counted: null,
        },
      ]);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await submitCount(countId);
      toast.success(t.counts.submitted_toast);
      router.push(isOps ? `/counts/${countId}/review` : "/counts");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="num text-sm text-ink-60">{t.counts.progress(done, lines.length)}</p>

      <ul className="flex flex-col gap-3">
        {lines.map((l) => (
          <li
            key={l.line_id}
            className="flex flex-col gap-2 rounded-lg border border-sand bg-surface p-3"
          >
            <span className="font-medium">
              {l.product}
              {l.finish ? ` (${l.finish})` : ""}
            </span>
            {l.counted === null ? (
              <button
                type="button"
                onClick={() => save(l.line_id, 0)}
                disabled={l.line_id.startsWith("pending-")}
                className="rounded-lg border border-ink px-3 py-2 text-sm font-medium"
              >
                {t.counts.counted}…
              </button>
            ) : (
              <Stepper value={l.counted} min={0} onChange={(n) => save(l.line_id, n)} />
            )}
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-2 rounded-lg border border-sand bg-surface p-3">
        <span className="text-sm font-medium">{t.counts.addItem}</span>
        {finishes.length > 0 ? (
          <select
            value={addFinish ?? ""}
            onChange={(e) => setAddFinish(e.target.value || null)}
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
        <ProductPicker products={products} thumbBaseUrl={thumbBaseUrl} onSelect={addItem} />
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <PrimaryAction type="button" onClick={submit} disabled={busy || !allCounted}>
        {t.counts.submitCount}
      </PrimaryAction>
    </div>
  );
}
