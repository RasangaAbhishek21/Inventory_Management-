import { describe, it, expect } from "vitest";
import { withRollback } from "./helpers";
import { config } from "@/config";

// Step 9 — the adjustment-exceptions and stock-accuracy views the reports read.

describe("adjustment exceptions view", () => {
  it("surfaces an adjustment over the §5.5 quantity threshold, not one below", async () => {
    await withRollback(async (t) => {
      const mah = await t.makeLocation();
      const ops = await t.makeActor("ops_manager", { locationId: mah });
      const big = await t.makeProduct("Exc Big", 5000);
      const small = await t.makeProduct("Exc Small", 5000);
      const reason = await t.reasonId("Lost / unaccounted");
      await t.asUser(ops);
      for (const p of [big, small]) {
        await t.q(
          `insert into stock_movements (movement_type, location_id, product_id, quantity,
                                        transaction_date, entered_by)
           values ('origination', $1, $2, 20, current_date, $3)`,
          [mah, p, ops],
        );
      }
      // over threshold: abs(quantity) >= ADJ_QTY_EXCEPTION
      await t.q(
        `insert into stock_movements (movement_type, location_id, product_id, quantity,
                                      transaction_date, entered_by, reason_id)
         values ('adjustment', $1, $2, $3, current_date, $4, $5)`,
        [mah, big, -config.ADJ_QTY_EXCEPTION, ops, reason],
      );
      // under threshold
      await t.q(
        `insert into stock_movements (movement_type, location_id, product_id, quantity,
                                      transaction_date, entered_by, reason_id)
         values ('adjustment', $1, $2, -1, current_date, $3, $4)`,
        [mah, small, ops, reason],
      );

      const rows = await t.q(
        `select product, quantity, reason, entered_by_name
           from v_adjustment_exceptions
          where month = date_trunc('month', current_date)::date`,
      );
      const names = rows.rows.map((r) => r.product);
      expect(names).toContain("Exc Big");
      expect(names).not.toContain("Exc Small");
      const big1 = rows.rows.find((r) => r.product === "Exc Big")!;
      expect(big1.reason).toBe("Lost / unaccounted");
      expect(big1.entered_by_name).toBe("Test ops_manager");
    });
  });
});

describe("stock accuracy view", () => {
  it("reports line & unit accuracy for a posted count", async () => {
    await withRollback(async (t) => {
      const mah = await t.makeLocation();
      const ops = await t.makeActor("ops_manager", { locationId: mah });
      const a = await t.makeProduct("Acc A", 1000);
      const b = await t.makeProduct("Acc B", 1000);
      await t.asUser(ops);
      await t.q(
        `insert into stock_movements (movement_type, location_id, product_id, quantity, transaction_date, entered_by)
         values ('origination',$1,$2,10,current_date,$3),('origination',$1,$4,10,current_date,$3)`,
        [mah, a, ops, b],
      );
      const count = await t.one<{ id: string }>(
        `select id from rpc_open_stock_count($1, current_date)`,
        [mah],
      );
      const lines = await t.q(
        `select id, product_id from stock_count_lines where stock_count_id = $1`,
        [count.id],
      );
      const byP = Object.fromEntries(lines.rows.map((r) => [r.product_id, r.id]));
      await t.q(`select rpc_set_count_line($1, 10, null)`, [byP[a]]); // variance 0
      await t.q(`select rpc_set_count_line($1, 7, null)`, [byP[b]]); // variance -3
      await t.q(`select rpc_submit_stock_count($1)`, [count.id]);
      await t.q(`select rpc_post_stock_count($1)`, [count.id]);

      const acc = await t.one<{ line_accuracy: string; unit_accuracy: string; units_short: string }>(
        `select line_accuracy, unit_accuracy, units_short
           from v_stock_accuracy where location_id = $1`,
        [mah],
      );
      expect(Number(acc.line_accuracy)).toBeCloseTo(0.5, 3); // 1 of 2 lines zero-variance
      expect(Number(acc.unit_accuracy)).toBeCloseTo(1 - 3 / 20, 3); // 3 abs variance / 20 system units
      expect(Number(acc.units_short)).toBe(-3);
    });
  });
});
