import { describe, it, expect } from "vitest";
import { withRollback } from "./helpers";

// Step 6 — manual adjustments and resolving an open variance.

describe("adjustments & variances", () => {
  it("ops posts a decrease with a reason; the balance drops and the movement carries the reason", async () => {
    await withRollback(async (t) => {
      const mah = await t.locationId("MAH");
      const ops = await t.makeActor("ops_manager", { locationCode: "MAH" });
      const product = await t.makeProduct("Adj Rack", 18500);
      const reason = await t.reasonId("Damaged in factory");
      await t.asUser(ops);
      await t.q(
        `insert into stock_movements (movement_type, location_id, product_id, quantity,
                                      transaction_date, entered_by)
         values ('origination', $1, $2, 10, current_date, $3)`,
        [mah, product, ops],
      );

      const m = await t.one<{ quantity: string; reason_id: string }>(
        `insert into stock_movements (movement_type, location_id, product_id, quantity,
                                      transaction_date, entered_by, reason_id, notes)
         values ('adjustment', $1, $2, -3, current_date, $3, $4, 'broke a leg')
         returning quantity, reason_id`,
        [mah, product, ops, reason],
      );
      expect(Number(m.quantity)).toBe(-3);
      expect(m.reason_id).toBe(reason);
      expect(await t.balance(mah, product)).toBe(7);
    });
  });

  it("an adjustment without a reason is rejected (RLS check requires reason_id, table CHECK backs it)", async () => {
    await withRollback(async (t) => {
      const mah = await t.locationId("MAH");
      const ops = await t.makeActor("ops_manager", { locationCode: "MAH" });
      const product = await t.makeProduct("Adj Rack", 18500);
      await t.asUser(ops);
      await t.q(
        `insert into stock_movements (movement_type, location_id, product_id, quantity,
                                      transaction_date, entered_by)
         values ('origination', $1, $2, 10, current_date, $3)`,
        [mah, product, ops],
      );
      const msg = await t.expectError(
        `insert into stock_movements (movement_type, location_id, product_id, quantity,
                                      transaction_date, entered_by)
         values ('adjustment', $1, $2, -1, current_date, $3)`,
        [mah, product, ops],
      );
      expect(msg).toMatch(/row-level security|adjustment_needs_reason|violates check/i);
    });
  });

  it("resolving a variance: an adjustment carrying transfer_id drops it off v_open_variances", async () => {
    await withRollback(async (t) => {
      const mah = await t.locationId("MAH");
      const pil = await t.locationId("PIL");
      const ops = await t.makeActor("ops_manager", { locationCode: "MAH" });
      const product = await t.makeProduct("Adj Rack", 18500);
      const reason = await t.reasonId("Damaged in transit");
      await t.asUser(ops);
      await t.q(
        `insert into stock_movements (movement_type, location_id, product_id, quantity,
                                      transaction_date, entered_by)
         values ('origination', $1, $2, 5, current_date, $3)`,
        [mah, product, ops],
      );
      const tr = await t.one<{ id: string }>(
        `select id from rpc_dispatch_transfer($1, $2, current_date, null, null, $3::jsonb)`,
        [mah, pil, JSON.stringify([{ product_id: product, qty: 5 }])],
      );
      const line = await t.one<{ id: string }>(
        `select id from transfer_lines where transfer_id = $1`,
        [tr.id],
      );
      await t.q(`select rpc_receive_transfer($1, current_date, $2::jsonb)`, [
        tr.id,
        JSON.stringify([{ line_id: line.id, qty_received: 3 }]),
      ]);

      let open = await t.q(`select 1 from v_open_variances where transfer_id = $1`, [tr.id]);
      expect(open.rows.length).toBe(1);

      await t.q(
        `insert into stock_movements (movement_type, location_id, product_id, quantity,
                                      transaction_date, entered_by, reason_id, transfer_id, notes)
         values ('adjustment', $1, $2, -2, current_date, $3, $4, $5, 'resolves TRF')`,
        [pil, product, ops, reason, tr.id],
      );

      open = await t.q(`select 1 from v_open_variances where transfer_id = $1`, [tr.id]);
      expect(open.rows.length).toBe(0);
      expect(await t.balance(pil, product)).toBe(1);
    });
  });
});
