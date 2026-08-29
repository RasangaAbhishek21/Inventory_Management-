"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { toast } from "sonner";
import { PrimaryAction } from "@/components/ui/PrimaryAction";
import { Field, fieldInputClass } from "@/components/ui/Field";
import { formatValue, isoDate } from "@/lib/format";
import { OPENING_CSV_COLUMNS, type ValidationResult } from "@/lib/opening-balances";
import { t } from "@/strings";
import { previewOpeningBalances, commitOpeningBalances } from "./actions";

const REQUIRED_COLUMNS = ["location_code", "product_name", "quantity", "unit_selling_price"];

export function OpeningBalancesImport({ alreadyImported }: { alreadyImported: boolean }) {
  const router = useRouter();
  const [rows, setRows] = useState<Record<string, string>[] | null>(null);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [goLive, setGoLive] = useState(isoDate());
  const [force, setForce] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setResult(null);
    setBusy(true);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
      complete: (parsed) => {
        setBusy(false);
        const headers = parsed.meta.fields ?? [];
        const missing = REQUIRED_COLUMNS.filter((c) => !headers.includes(c));
        if (missing.length) {
          setError(t.opening.missingColumns(missing.join(", ")));
          setRows(null);
          return;
        }
        setRows(parsed.data);
      },
      error: () => {
        setBusy(false);
        setError(t.opening.parseError);
        setRows(null);
      },
    });
  }

  async function runPreview() {
    if (!rows) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await previewOpeningBalances(rows));
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(false);
  }

  async function runCommit() {
    if (!rows || !result || result.errorCount > 0) return;
    setBusy(true);
    setError(null);
    try {
      const { committed } = await commitOpeningBalances({ goLive, force, rows });
      toast.success(t.opening.committed(committed));
      router.push("/admin");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const clean = result && result.errorCount === 0;

  return (
    <div className="flex flex-col gap-4">
      <Field label={t.opening.chooseFile}>
        <input type="file" accept=".csv,text/csv" onChange={pickFile} className="text-sm" />
      </Field>

      {busy && !result ? <p className="text-sm text-ink-60">{t.opening.parsing}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {rows && !result ? (
        <PrimaryAction type="button" onClick={runPreview} disabled={busy}>
          {t.opening.preview}
        </PrimaryAction>
      ) : null}

      {result ? (
        <>
          <p className={`text-sm ${clean ? "text-ink" : "text-danger"}`}>
            {clean
              ? t.opening.rowsOk(result.rows.length)
              : t.opening.rowsWithErrors(result.errorCount, result.rows.length)}
          </p>
          {clean ? (
            <p className="text-sm text-ink-60">
              {t.opening.totals(result.totals.units, formatValue(result.totals.valueAtSelling))}
            </p>
          ) : null}

          <div className="overflow-x-auto rounded-lg border border-sand">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-sand text-left">
                  <th className="px-2 py-1">{t.opening.line}</th>
                  {OPENING_CSV_COLUMNS.map((c) => (
                    <th key={c} className="px-2 py-1">
                      {c}
                    </th>
                  ))}
                  <th className="px-2 py-1"></th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r) => (
                  <tr
                    key={r.line}
                    className={`border-b border-sand ${r.errors.length ? "bg-surface" : ""}`}
                  >
                    <td className="px-2 py-1">{r.line}</td>
                    {OPENING_CSV_COLUMNS.map((c) => (
                      <td key={c} className="px-2 py-1 num">
                        {r.raw[c] ?? ""}
                      </td>
                    ))}
                    <td className="px-2 py-1 text-danger">{r.errors.join("; ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {clean ? (
            <div className="flex flex-col gap-3">
              <Field label={t.opening.goLiveDate}>
                <input
                  type="date"
                  value={goLive}
                  max={isoDate()}
                  onChange={(e) => setGoLive(e.target.value)}
                  className={fieldInputClass}
                />
              </Field>
              {alreadyImported ? (
                <label className="flex items-center gap-2 text-sm text-amber">
                  <input
                    type="checkbox"
                    checked={force}
                    onChange={(e) => setForce(e.target.checked)}
                    className="size-5"
                  />
                  {t.opening.confirmForce}
                </label>
              ) : null}
              <PrimaryAction
                type="button"
                onClick={runCommit}
                disabled={busy || (alreadyImported && !force)}
              >
                {busy ? t.opening.committing : t.opening.commit(result.rows.length)}
              </PrimaryAction>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
