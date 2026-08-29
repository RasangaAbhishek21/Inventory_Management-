import { describe, it, expect } from "vitest";
import { withRollback } from "./helpers";

// Brief §11 — Valuation and time. Acceptance tests 12-16.

describe("valuation & time", () => {
  it("12: changing selling_price does not alter existing movements or a prior-date report", async () => {
    await withRollback(async (t) => {
      const mah = await t.locationId("MAH");
      const actor = await t.makeActor("ops_manager", { locationCode: "MAH" });
      const product = await t.makeProduct("Aster Table", 10000);
      await t.asUser(actor);

      const m = await t.one<{ id: string; unit_selling_price: string }>(
        `insert into stock_movements (movement_type, location_id, product_id, quantity,
                                      unit_selling_price, transaction_date, entered_by)
         values ('origination', $1, $2, 5, 0, current_date, $3)
         returning id, unit_selling_price`,
        [mah, product, actor],
      );
      expect(Number(m.unit_selling_price)).toBe(10000);

      await t.asOwner();
      await t.q(`update products set selling_price = 20000 where id = $1`, [product]);

      const after = await t.val<string>(
        `select unit_selling_price from stock_movements where id = $1`,
        [m.id],
      );
      expect(Number(after)).toBe(10000);

      const val = await t.val<string>(
        `select value_at_selling_price from fn_stock_balances(current_date, $1)
          where product_id = $2`,
        [mah, product],
      );
      expect(Number(val)).toBe(50000);
    });
  });

  it("13: stock on hand as at a past date excludes later-dated movements", async () => {
    await withRollback(async (t) => {
      const mah = await t.locationId("MAH");
      const actor = await t.makeActor("ops_manager", { locationCode: "MAH" });
      const product = await t.makeProduct("Aster Table", 10000);
      await t.asUser(actor);

      await t.q(
        `insert into stock_movements (movement_type, location_id, product_id, quantity,
                                      unit_selling_price, transaction_date, entered_by)
         values ('origination', $1, $2, 5, 0, current_date, $3)`,
        [mah, product, actor],
      );

      const yesterday = await t.q(
        `select qty_on_hand from fn_stock_balances(current_date - 1, $1) where product_id = $2`,
        [mah, product],
      );
      expect(yesterday.rows).toHaveLength(0);

      const today = await t.val<string>(
        `select qty_on_hand from fn_stock_balances(current_date, $1) where product_id = $2`,
        [mah, product],
      );
      expect(Number(today)).toBe(5);
    });
  });

  it("14: a movement entered today, dated 6 days ago, appears in that day's balance", async () => {
    await withRollback(async (t) => {
      const mah = await t.locationId("MAH");
      const actor = await t.makeActor("ops_manager", { locationCode: "MAH" });
      const product = await t.makeProduct("Aster Table", 10000);
      await t.asUser(actor);

      await t.q(
        `insert into stock_movements (movement_type, location_id, product_id, quantity,
                                      unit_selling_price, transaction_date, entered_by)
         values ('origination', $1, $2, 5, 0, current_date - 6, $3)`,
        [mah, product, actor],
      );

      const bal = await t.val<string>(
        `select qty_on_hand from fn_stock_balances(current_date - 6, $1) where product_id = $2`,
        [mah, product],
      );
      expect(Number(bal)).toBe(5);
    });
  });

  it("15: weighted average — 2@10000 + 3@12000, transfer 1 out → stamped 11200", async () => {
    await withRollback(async (t) => {
      const mah = await t.locationId("MAH");
      const pil = await t.locationId("PIL");
      const actor = await t.makeActor("ops_manager", { locationCode: "MAH" });
      const product = await t.makeProduct("Aster Table", 10000);
      await t.asUser(actor);

      await t.q(
        `insert into stock_movements (movement_type, location_id, product_id, quantity,
                                      unit_selling_price, transaction_date, entered_by)
         values ('origination', $1, $2, 2, 0, current_date, $3)`,
        [mah, product, actor],
      );
      await t.asOwner();
      await t.q(`update products set selling_price = 12000 where id = $1`, [product]);
      await t.asUser(actor);
      await t.q(
        `insert into stock_movements (movement_type, location_id, product_id, quantity,
                                      unit_selling_price, transaction_date, entered_by)
         values ('origination', $1, $2, 3, 0, current_date, $3)`,
        [mah, product, actor],
      );

      await t.q(
        `select * from rpc_dispatch_transfer($1, $2, current_date, null, null, $3::jsonb)`,
        [mah, pil, JSON.stringify([{ product_id: product, qty: 1 }])],
      );

      const stamped = await t.val<string>(
        `select unit_selling_price from stock_movements
          where product_id = $1 and movement_type = 'transfer_out'`,
        [product],
      );
      expect(Number(stamped)).toBe(11200);
    });
  });

  it("16: positive adjustment at zero balance is stamped at product price, no error", async () => {
    await withRollback(async (t) => {
      const mah = await t.locationId("MAH");
      const actor = await t.makeActor("ops_manager", { locationCode: "MAH" });
      const product = await t.makeProduct("Aster Table", 15000);
      const reason = await t.reasonId("Count correction — surplus");
      await t.asUser(actor);

      const m = await t.one<{ unit_selling_price: string }>(
        `insert into stock_movements (movement_type, location_id, product_id, quantity,
                                      unit_selling_price, transaction_date, entered_by, reason_id)
         values ('adjustment', $1, $2, 3, 0, current_date, $3, $4)
         returning unit_selling_price`,
        [mah, product, actor, reason],
      );
      expect(Number(m.unit_selling_price)).toBe(15000);
      expect(await t.balance(mah, product)).toBe(3);
    });
  });
});
