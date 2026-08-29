import { describe, it, expect } from "vitest";
import { withRollback } from "./helpers";
import { validateRows, type RefData } from "@/lib/opening-balances";

// Exercises the step-4 import as the server action does it: validateRows() to build the
// payload, then rpc_commit_opening_balances with that exact shape (finish_name / cost
// as null, not omitted).

describe("opening-balance import flow", () => {
  it("validates a CSV then commits it through the RPC", async () => {
    await withRollback(async (t) => {
      const mah = await t.locationId("MAH");
      const admin = await t.makeActor("admin", { locationCode: "MAH" });
      const p1 = await t.makeProduct("Leo Book Rack Vertical", 18500, 11200);
      await t.makeProduct("Aster Table", 40000);

      const refs: RefData = {
        locationCodes: new Set(["MAH", "GON", "PIL"]),
        productNames: new Set(["Leo Book Rack Vertical", "Aster Table"]),
        finishNames: new Set(["White", "Oak", "Walnut"]),
      };

      const csv = [
        { location_code: "MAH", product_name: "Leo Book Rack Vertical", finish_name: "White", quantity: "5", unit_selling_price: "18500", unit_standard_cost: "11200" },
        { location_code: "GON", product_name: "Aster Table", finish_name: "", quantity: "2", unit_selling_price: "40000", unit_standard_cost: "" },
      ];

      const result = validateRows(csv, refs);
      expect(result.errorCount).toBe(0);

      const payload = result.rows.map((r) => r.value).filter(Boolean);

      await t.asUser(admin);
      const committed = await t.val<string>(
        `select rpc_commit_opening_balances(current_date, $1::jsonb, false)`,
        [JSON.stringify(payload)],
      );
      expect(Number(committed)).toBe(2);

      // white-finish line landed at MAH with the finish resolved
      const bal = await t.q(
        `select b.qty_on_hand, f.name as finish
           from v_stock_balances b left join finishes f on f.id = b.finish_id
          where b.location_id = $1 and b.product_id = $2`,
        [mah, p1],
      );
      expect(Number(bal.rows[0].qty_on_hand)).toBe(5);
      expect(bal.rows[0].finish).toBe("White");
    });
  });

  it("a bad product name is caught before the RPC is ever called", async () => {
    const refs: RefData = {
      locationCodes: new Set(["MAH"]),
      productNames: new Set(["Real Product"]),
      finishNames: new Set(),
    };
    const result = validateRows(
      [
        { location_code: "MAH", product_name: "Real Product", quantity: "1", unit_selling_price: "10" },
        { location_code: "MAH", product_name: "Ghost", quantity: "1", unit_selling_price: "10" },
      ],
      refs,
    );
    expect(result.errorCount).toBe(1);
    expect(result.rows[1].errors.join(" ")).toMatch(/unknown product "Ghost"/);
  });
});
