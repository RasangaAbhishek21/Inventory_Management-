import { describe, it, expect } from "vitest";
import { withRollback, type Tx } from "./helpers";

// Brief §11 — Counts. Acceptance tests 17-23.

async function originate(
  t: Tx,
  loc: string,
  product: string,
  qty: number,
  actor: string,
  daysAgo = 0,
) {
  await t.q(
    `insert into stock_movements (movement_type, location_id, product_id, quantity,
                                  unit_selling_price, transaction_date, entered_by)
     values ('origination', $1, $2, $3, 0, current_date - $4::int, $5)`,
    [loc, product, qty, daysAgo, actor],
  );
}

describe("stock counts", () => {
  it("17: opening a count snapshots balances; a later movement does not change system_qty", async () => {
    await withRollback(async (t) => {
      const mah = await t.locationId("MAH");
      const ops = await t.makeActor("ops_manager", { locationCode: "MAH" });
      const product = await t.makeProduct("Nova Dresser", 20000);
      await t.asUser(ops);
      await originate(t, mah, product, 6, ops);

      const count = await t.one<{ id: string }>(
        `select id from rpc_open_stock_count($1, current_date)`,
        [mah],
      );
      const snap = await t.val<string>(
        `select system_qty from stock_count_lines where stock_count_id = $1 and product_id = $2`,
        [count.id, product],
      );
      expect(Number(snap)).toBe(6);

      await originate(t, mah, product, 4, ops);
      const after = await t.val<string>(
        `select system_qty from stock_count_lines where stock_count_id = $1 and product_id = $2`,
        [count.id, product],
      );
      expect(Number(after)).toBe(6);
    });
  });

  it("18: an open count exposes no system_qty to staff, and the blind view omits it", async () => {
    await withRollback(async (t) => {
      const mah = await t.locationId("MAH");
      const ops = await t.makeActor("ops_manager", { locationCode: "MAH" });
      const staff = await t.makeActor("staff", { locationCode: "MAH" });
      const product = await t.makeProduct("Nova Dresser", 20000);
      await t.asUser(ops);
      await originate(t, mah, product, 6, ops);
      await t.q(`select id from rpc_open_stock_count($1, current_date)`, [mah]);

      // blind view never carries system_qty / variance
      const cols = await t.q(
        `select column_name from information_schema.columns where table_name = 'v_count_lines_blind'`,
      );
      const names = cols.rows.map((r) => r.column_name);
      expect(names).not.toContain("system_qty");
      expect(names).not.toContain("variance");

      // staff get ZERO rows from the real table (no SELECT policy for them), so no
      // system_qty value is ever reachable...
      await t.asUser(staff);
      const direct = await t.q(`select system_qty from stock_count_lines`);
      expect(direct.rows).toHaveLength(0);
      // ...but they can read the blind columns for every line through the view
      const blind = await t.q(`select id, counted_qty from v_count_lines_blind`);
      expect(blind.rows.length).toBeGreaterThan(0);
    });
  });

  it("19: a count cannot be submitted while any line has a null counted_qty", async () => {
    await withRollback(async (t) => {
      const mah = await t.locationId("MAH");
      const ops = await t.makeActor("ops_manager", { locationCode: "MAH" });
      const product = await t.makeProduct("Nova Dresser", 20000);
      await t.asUser(ops);
      await originate(t, mah, product, 6, ops);
      const count = await t.one<{ id: string }>(
        `select id from rpc_open_stock_count($1, current_date)`,
        [mah],
      );
      await expect(
        t.q(`select rpc_submit_stock_count($1)`, [count.id]),
      ).rejects.toThrow(/counted quantity/i);
    });
  });

  it("20: posting counted 4 vs system 6 → one −2 adjustment, shortfall reason, dated count date, linked", async () => {
    await withRollback(async (t) => {
      const mah = await t.locationId("MAH");
      const ops = await t.makeActor("ops_manager", { locationCode: "MAH" });
      const product = await t.makeProduct("Nova Dresser", 20000);
      const shortfall = await t.reasonId("Count correction — shortfall");
      await t.asUser(ops);
      await originate(t, mah, product, 6, ops, 2);

      const count = await t.one<{ id: string; count_date: string }>(
        `select id, count_date from rpc_open_stock_count($1, current_date - 1)`,
        [mah],
      );
      const line = await t.one<{ id: string }>(
        `select id from stock_count_lines where stock_count_id = $1 and product_id = $2`,
        [count.id, product],
      );
      await t.q(`select rpc_set_count_line($1, 4, null)`, [line.id]);
      await t.q(`select rpc_submit_stock_count($1)`, [count.id]);
      await t.q(`select rpc_post_stock_count($1)`, [count.id]);

      const adj = await t.q(
        `select quantity, reason_id, transaction_date, stock_count_id
           from stock_movements where movement_type = 'adjustment' and product_id = $1`,
        [product],
      );
      expect(adj.rows).toHaveLength(1);
      expect(Number(adj.rows[0].quantity)).toBe(-2);
      expect(adj.rows[0].reason_id).toBe(shortfall);
      expect(String(adj.rows[0].stock_count_id)).toBe(String(count.id));
      expect(new Date(adj.rows[0].transaction_date as string).toISOString().slice(0, 10)).toBe(
        new Date(count.count_date).toISOString().slice(0, 10),
      );
      expect(await t.balance(mah, product)).toBe(4);
    });
  });

  it("21: posting a count that takes an item negative succeeds (trigger bypass)", async () => {
    await withRollback(async (t) => {
      const mah = await t.locationId("MAH");
      const ops = await t.makeActor("ops_manager", { locationCode: "MAH" });
      const product = await t.makeProduct("Nova Dresser", 20000);
      await t.asUser(ops);
      await originate(t, mah, product, 2, ops);

      const count = await t.one<{ id: string }>(
        `select id from rpc_open_stock_count($1, current_date)`,
        [mah],
      );
      const line = await t.one<{ id: string }>(
        `select id from stock_count_lines where stock_count_id = $1 and product_id = $2`,
        [count.id, product],
      );

      // physically remove the stock after the snapshot, then count zero
      await t.q(
        `insert into stock_movements (movement_type, location_id, product_id, quantity,
                                      unit_selling_price, transaction_date, entered_by, order_number)
         values ('dispatch', $1, $2, -2, 0, current_date, $3, 'SO-1')`,
        [mah, product, ops],
      );
      expect(await t.balance(mah, product)).toBe(0);

      await t.q(`select rpc_set_count_line($1, 0, null)`, [line.id]);
      await t.q(`select rpc_submit_stock_count($1)`, [count.id]);
      await t.q(`select rpc_post_stock_count($1)`, [count.id]);

      expect(await t.balance(mah, product)).toBe(-2);
    });
  });

  it("22: a second count cannot be opened while one is open or submitted", async () => {
    await withRollback(async (t) => {
      const mah = await t.locationId("MAH");
      const ops = await t.makeActor("ops_manager", { locationCode: "MAH" });
      await t.asUser(ops);
      await t.q(`select id from rpc_open_stock_count($1, current_date)`, [mah]);
      await expect(
        t.q(`select id from rpc_open_stock_count($1, current_date)`, [mah]),
      ).rejects.toThrow(/already an open count/i);
    });
  });

  it("23: line accuracy = zero-variance lines ÷ lines counted (hand example: 2/3)", async () => {
    await withRollback(async (t) => {
      const mah = await t.locationId("MAH");
      const ops = await t.makeActor("ops_manager", { locationCode: "MAH" });
      const a = await t.makeProduct("Count A", 1000);
      const b = await t.makeProduct("Count B", 1000);
      const c = await t.makeProduct("Count C", 1000);
      await t.asUser(ops);
      await originate(t, mah, a, 5, ops);
      await originate(t, mah, b, 5, ops);
      await originate(t, mah, c, 5, ops);

      const count = await t.one<{ id: string }>(
        `select id from rpc_open_stock_count($1, current_date)`,
        [mah],
      );
      const lines = await t.q(
        `select scl.id, scl.product_id from stock_count_lines scl where scl.stock_count_id = $1`,
        [count.id],
      );
      const byProd = Object.fromEntries(lines.rows.map((r) => [r.product_id, r.id]));
      await t.q(`select rpc_set_count_line($1, 5, null)`, [byProd[a]]); // variance 0
      await t.q(`select rpc_set_count_line($1, 5, null)`, [byProd[b]]); // variance 0
      await t.q(`select rpc_set_count_line($1, 3, null)`, [byProd[c]]); // variance -2
      await t.q(`select rpc_submit_stock_count($1)`, [count.id]);
      await t.q(`select rpc_post_stock_count($1)`, [count.id]);

      const acc = await t.one<{ line_accuracy: string; lines_counted: string; lines_zero_variance: string }>(
        `select line_accuracy, lines_counted, lines_zero_variance
           from v_stock_accuracy where location = 'Maharagama Factory'`,
      );
      expect(Number(acc.lines_counted)).toBe(3);
      expect(Number(acc.lines_zero_variance)).toBe(2);
      expect(Number(acc.line_accuracy)).toBeCloseTo(0.6667, 3);
    });
  });
});
