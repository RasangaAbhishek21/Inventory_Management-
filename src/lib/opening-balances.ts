/**
 * Parsing and validation for the opening-balance CSV (brief §8.12).
 *
 * Columns: location_code, product_name, finish_name, quantity,
 *          unit_selling_price, unit_standard_cost
 * finish_name and unit_standard_cost are optional.
 *
 * Kept framework-free so it is unit-testable and shared by the preview server action.
 * The database RPC does its own resolution and is the real gate (atomic, one bad row
 * commits nothing) — this just surfaces every problem up front.
 */

export const OPENING_CSV_COLUMNS = [
  "location_code",
  "product_name",
  "finish_name",
  "quantity",
  "unit_selling_price",
  "unit_standard_cost",
] as const;

export interface RefData {
  locationCodes: Set<string>;
  productNames: Set<string>;
  finishNames: Set<string>;
}

export interface CommitRow {
  location_code: string;
  product_name: string;
  finish_name: string | null;
  quantity: number;
  unit_selling_price: number;
  unit_standard_cost: number | null;
}

export interface ValidatedRow {
  line: number; // 1-based, matching the CSV (header is line 1, first data row line 2)
  raw: Record<string, string>;
  value: CommitRow | null;
  errors: string[];
}

export interface ValidationResult {
  rows: ValidatedRow[];
  errorCount: number;
  totals: { units: number; valueAtSelling: number };
}

function num(v: string | undefined): number | null {
  const s = (v ?? "").trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

export function validateRows(
  raw: Record<string, string>[],
  refs: RefData,
): ValidationResult {
  let units = 0;
  let valueAtSelling = 0;

  const rows: ValidatedRow[] = raw.map((r, i) => {
    const line = i + 2;
    const errors: string[] = [];

    const location_code = (r.location_code ?? "").trim();
    const product_name = (r.product_name ?? "").trim();
    const finish_name = (r.finish_name ?? "").trim() || null;
    const quantity = num(r.quantity);
    const unit_selling_price = num(r.unit_selling_price);
    const unit_standard_cost = num(r.unit_standard_cost);

    if (!location_code) errors.push("location_code is required");
    else if (!refs.locationCodes.has(location_code))
      errors.push(`unknown location code "${location_code}"`);

    if (!product_name) errors.push("product_name is required");
    else if (!refs.productNames.has(product_name))
      errors.push(`unknown product "${product_name}"`);

    if (finish_name && !refs.finishNames.has(finish_name))
      errors.push(`unknown finish "${finish_name}"`);

    if (quantity === null) errors.push("quantity is required");
    else if (Number.isNaN(quantity) || !Number.isInteger(quantity) || quantity === 0)
      errors.push("quantity must be a whole number, not zero");

    if (unit_selling_price === null) errors.push("unit_selling_price is required");
    else if (Number.isNaN(unit_selling_price) || unit_selling_price <= 0)
      errors.push("unit_selling_price must be greater than zero");

    if (unit_standard_cost !== null && (Number.isNaN(unit_standard_cost) || unit_standard_cost < 0))
      errors.push("unit_standard_cost must be zero or more");

    const value: CommitRow | null =
      errors.length === 0
        ? {
            location_code,
            product_name,
            finish_name,
            quantity: quantity as number,
            unit_selling_price: unit_selling_price as number,
            unit_standard_cost: unit_standard_cost,
          }
        : null;

    if (value) {
      units += value.quantity;
      valueAtSelling += value.quantity * value.unit_selling_price;
    }

    return { line, raw: r, value, errors };
  });

  return {
    rows,
    errorCount: rows.filter((r) => r.errors.length > 0).length,
    totals: { units, valueAtSelling },
  };
}
