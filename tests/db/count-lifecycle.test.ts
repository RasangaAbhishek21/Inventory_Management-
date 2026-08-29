import { describe, it, expect } from "vitest";
import { withRollback } from "./helpers";

// Step 8 wiring: the screens call open → (staff) set line → submit → (ops) post,
// via the same RPCs. This walks that whole path with the right role contexts.

describe("count lifecycle through the RPCs the UI uses", () => {
  it("ops opens, staff counts + submits, ops posts", async () => {
    await withRollback(async (t) => {
      const mah = await t.locationId("MAH");
      const ops = await t.makeActor("ops_manager", { locationCode: "MAH" });
      const staff = await t.makeActor("staff", { locationCode: "MAH" });
      const a = await t.makeProduct("Count Lifecycle A", 10000);
      const b = await t.makeProduct("Count Lifecycle B", 20000);

      await t.asUser(ops);
      for (const p of [a, b]) {
        await t.q(
          `insert into stock_movements (movement_type, location_id, product_id, quantity,
                                        transaction_date, entered_by)
           values ('origination', $1, $2, 6, current_date, $3)`,
          [mah, p, ops],
        );
      }

      const count = await t.one<{ id: string }>(
        `select id from rpc_open_stock_count($1, current_date)`,
        [mah],
      );

      // staff reads the BLIND view (no system_qty) and sets counts
      await t.asUser(staff);
      const blind = await t.q(
        `select id, product_id from v_count_lines_blind where stock_count_id = $1`,
        [count.id],
      );
      expect(blind.rows).toHaveLength(2);
      expect(Object.keys(blind.rows[0])).not.toContain("system_qty");

      const byProduct = Object.fromEntries(blind.rows.map((r) => [r.product_id, r.id]));
      await t.q(`select rpc_set_count_line($1, 6, null)`, [byProduct[a]]); // variance 0
      await t.q(`select rpc_set_count_line($1, 4, null)`, [byProduct[b]]); // variance -2
      await t.q(`select rpc_submit_stock_count($1)`, [count.id]);

      // ops reviews (full table) and posts
      await t.asUser(ops);
      const review = await t.q(
        `select product_id, system_qty, counted_qty, variance
           from stock_count_lines where stock_count_id = $1 order by variance`,
        [count.id],
      );
      expect(review.rows.map((r) => Number(r.variance)).sort()).toEqual([-2, 0]);

      await t.q(`select rpc_post_stock_count($1)`, [count.id]);
      expect(await t.balance(mah, b)).toBe(4);

      const status = await t.val<string>(`select status from stock_counts where id = $1`, [count.id]);
      expect(status).toBe("posted");
    });
  });
});
