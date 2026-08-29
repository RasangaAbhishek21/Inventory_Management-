"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PrimaryAction } from "@/components/ui/PrimaryAction";
import { Field, fieldInputClass } from "@/components/ui/Field";
import { isoDate } from "@/lib/format";
import { t } from "@/strings";
import { openCount } from "./actions";

export function OpenCount({ locations }: { locations: { id: string; name: string }[] }) {
  const router = useRouter();
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");
  const [date, setDate] = useState(isoDate());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!locationId) return;
    setBusy(true);
    setError(null);
    try {
      const { id } = await openCount({ location_id: locationId, count_date: date });
      router.push(`/counts/${id}/count`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-sand bg-surface p-4">
      <h2 className="font-semibold">{t.counts.openTitle}</h2>
      <Field label={t.common.location}>
        <select value={locationId} onChange={(e) => setLocationId(e.target.value)} className={fieldInputClass}>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      </Field>
      <Field label={t.counts.countDate}>
        <input type="date" value={date} max={isoDate()} onChange={(e) => setDate(e.target.value)} className={fieldInputClass} />
      </Field>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <PrimaryAction type="button" onClick={submit} disabled={busy}>
        {t.counts.openAction}
      </PrimaryAction>
    </div>
  );
}
