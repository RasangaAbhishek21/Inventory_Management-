import { config } from "@/config";

/**
 * Presentation helpers. Numbers render with tabular figures (see globals.css) so
 * columns align; these just handle grouping and precision.
 */

const valueFmt = new Intl.NumberFormat(config.CURRENCY_LOCALE, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const qtyFmt = new Intl.NumberFormat(config.CURRENCY_LOCALE, {
  maximumFractionDigits: 0,
});

/** A money amount, no currency symbol (brief §2 — single currency). e.g. "1,234.00" */
export function formatValue(n: number | null | undefined): string {
  if (n == null) return "—";
  return valueFmt.format(n);
}

/** A whole-unit quantity. e.g. "1,200" */
export function formatQty(n: number | null | undefined): string {
  if (n == null) return "—";
  return qtyFmt.format(n);
}

/** ISO date (yyyy-mm-dd) for <input type="date"> and transaction_date columns. */
export function isoDate(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** ISO date N days before today. */
export function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return isoDate(d);
}

/** ISO date for the last day of the previous month. */
export function isoLastMonthEnd(): string {
  const d = new Date();
  d.setDate(0);
  return isoDate(d);
}

/** Whole hours between two instants, floored. */
export function hoursSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
}
