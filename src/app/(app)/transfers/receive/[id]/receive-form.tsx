"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PrimaryAction } from "@/components/ui/PrimaryAction";
import { Field, fieldInputClass } from "@/components/ui/Field";
import { Stepper } from "@/components/ui/Stepper";
import { isoDate } from "@/lib/format";
import { t } from "@/strings";
import { confirmReceipt } from "../actions";

interface LineView {
  line_id: string;
  product: string;
  finish: string | null;
  qty_dispatched: number;
  imageUrl: string | null;
}

export function ReceiveForm({
  transferId,
  transferRef,
  lines,
}: {
  transferId: string;
  transferRef: string;
  lines: LineView[];
}) {
  const router = useRouter();
  const [received, setReceived] = useState<Record<string, number>>(
    Object.fromEntries(lines.map((l) => [l.line_id, l.qty_dispatched])),
  );
  const [date, setDate] = useState(isoDate());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const anyShort = lines.some((l) => received[l.line_id] < l.qty_dispatched);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const { status } = await confirmReceipt({
        transfer_id: transferId,
        receipt_date: date,
        lines: lines.map((l) => ({ line_id: l.line_id, qty_received: received[l.line_id] })),
      });
      toast.success(
        status === "received_with_variance"
          ? t.confirmations.receiptWithVariance(transferRef)
          : t.confirmations.receiptConfirmed(transferRef),
      );
      router.push("/transfers/receive");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-4">
        {lines.map((l) => (
          <li
            key={l.line_id}
            className="flex items-start gap-3 rounded-lg border border-sand bg-surface p-3"
          >
            <div className="flex flex-1 flex-col gap-2">
              <span className="font-medium">
                {l.product}
                {l.finish ? ` (${l.finish})` : ""}
              </span>
              <span className="text-sm text-ink-60">
                {t.capture.dispatchedQty}: <span className="num">{l.qty_dispatched}</span>
              </span>
              <div className="flex items-center gap-2">
                <span className="text-sm">{t.capture.receivedQty}</span>
                <Stepper
                  value={received[l.line_id]}
                  min={0}
                  max={l.qty_dispatched}
                  onChange={(n) => setReceived((r) => ({ ...r, [l.line_id]: n }))}
                />
              </div>
            </div>
            {l.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={l.imageUrl}
                alt=""
                className="h-16 w-16 shrink-0 rounded-md object-cover"
              />
            ) : (
              <span className="h-16 w-16 shrink-0 rounded-md bg-sand/60" />
            )}
          </li>
        ))}
      </ul>

      <Field label={t.capture.transactionDate}>
        <input type="date" value={date} max={isoDate()} onChange={(e) => setDate(e.target.value)} className={fieldInputClass} />
      </Field>

      {anyShort ? (
        <p className="rounded-lg border border-amber bg-surface p-3 text-sm text-amber">
          {t.capture.varianceWarning}
        </p>
      ) : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <PrimaryAction type="button" onClick={submit} disabled={busy}>
        {t.capture.receiveOne}
      </PrimaryAction>
    </div>
  );
}
