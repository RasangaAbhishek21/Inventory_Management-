import { describe, it, expect } from "vitest";
import { validateRows, type RefData } from "@/lib/opening-balances";

const refs: RefData = {
  locationCodes: new Set(["MAH", "GON", "PIL"]),
  productNames: new Set(["Leo Book Rack Vertical", "Aster Table"]),
  finishNames: new Set(["White", "Oak"]),
};

describe("opening balance validation", () => {
  it("accepts a clean file and computes totals", () => {
    const res = validateRows(
      [
        { location_code: "MAH", product_name: "Leo Book Rack Vertical", finish_name: "White", quantity: "5", unit_selling_price: "18500", unit_standard_cost: "11200" },
        { location_code: "GON", product_name: "Aster Table", finish_name: "", quantity: "2", unit_selling_price: "40000", unit_standard_cost: "" },
      ],
      refs,
    );
    expect(res.errorCount).toBe(0);
    expect(res.totals.units).toBe(7);
    expect(res.totals.valueAtSelling).toBe(5 * 18500 + 2 * 40000);
    expect(res.rows[1].value?.unit_standard_cost).toBeNull();
    expect(res.rows[1].value?.finish_name).toBeNull();
  });

  it("flags unknown names, bad numbers and missing fields with line numbers", () => {
    const res = validateRows(
      [
        { location_code: "ZZZ", product_name: "Nope", finish_name: "Teak", quantity: "0", unit_selling_price: "-1", unit_standard_cost: "x" },
        { location_code: "MAH", product_name: "Aster Table", quantity: "3", unit_selling_price: "1000" },
      ],
      refs,
    );
    expect(res.errorCount).toBe(1);
    const bad = res.rows[0];
    expect(bad.line).toBe(2); // header is line 1
    expect(bad.value).toBeNull();
    expect(bad.errors.join(" ")).toMatch(/unknown location code "ZZZ"/);
    expect(bad.errors.join(" ")).toMatch(/unknown product "Nope"/);
    expect(bad.errors.join(" ")).toMatch(/unknown finish "Teak"/);
    expect(bad.errors.join(" ")).toMatch(/quantity must be a whole number, not zero/);
    expect(bad.errors.join(" ")).toMatch(/unit_selling_price must be greater than zero/);
    expect(bad.errors.join(" ")).toMatch(/unit_standard_cost must be zero or more/);
    expect(res.rows[1].errors).toEqual([]);
  });
});
