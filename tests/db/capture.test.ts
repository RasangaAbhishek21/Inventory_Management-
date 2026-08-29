import { describe, it, expect } from "vitest";
import { withRollback } from "./helpers";

// Step-5 capture screens post through these same paths: a plain stock_movements insert
// (originate / deliver / return) with unit_selling_price omitted so the trigger stamps
// it, and the transfer RPCs for send / confirm-receipt.

describe("capture flows", () => {
  it("originate: staff insert with values omitted → trigger stamps selling price", async () => {
    await withRollback(async (t) => {
      const mah = await t.locationId("MAH");
      const staff = await t.makeActor("staff", { locationCode: "MAH" });
      const product = await t.makeProduct("Capture Rack", 18500);
      await t.asUser(staff);

      const m = await t.one<{ unit_selling_price: string }>(
        `insert into stock_movements
           (movement_type, location_id, product_id, finish_id, variant_note, quantity,
            transaction_date, entered_by, notes)
         values ('origination', $1, $2, null, 'custom 1200mm', 3, current_date, $3, null)
         returning unit_selling_price`,
        [mah, product, staff],
      );
      expect(Number(m.unit_selling_price)).toBe(18500);
      expect(await t.balance(mah, product)).toBe(3);
    });
  });

  it("deliver: negative dispatch with an order number leaves the location", async () => {
    await withRollback(async (t) => {
      const mah = await t.locationId("MAH");
      const staff = await t.makeActor("staff", { locationCode: "MAH" });
      const product = await t.makeProduct("Capture Rack", 18500);
      await t.asUser(staff);
      await t.q(
        `insert into stock_movements (movement_type, location_id, product_id, quantity,
                                      transaction_date, entered_by)
         values ('origination', $1, $2, 5, current_date, $3)`,
        [mah, product, staff],
      );
      await t.q(
        `insert into stock_movements (movement_type, location_id, product_id, quantity,
                                      transaction_date, entered_by, order_number)
         values ('dispatch', $1, $2, -2, current_date, $3, 'SO-1234')`,
        [mah, product, staff],
      );
      expect(await t.balance(mah, product)).toBe(3);
    });
  });

  it("send transfer then confirm short: RPC round-trip returns ref + variance status", async () => {
    await withRollback(async (t) => {
      const mah = await t.locationId("MAH");
      const pil = await t.locationId("PIL");
      const ops = await t.makeActor("ops_manager", { locationCode: "MAH" });
      const product = await t.makeProduct("Capture Rack", 18500);
      await t.asUser(ops);
      await t.q(
        `insert into stock_movements (movement_type, location_id, product_id, quantity,
                                      transaction_date, entered_by)
         values ('origination', $1, $2, 5, current_date, $3)`,
        [mah, product, ops],
      );

      const tr = await t.one<{ id: string; transfer_ref: string }>(
        `select id, transfer_ref
           from rpc_dispatch_transfer($1, $2, current_date, 'SO-9', null, $3::jsonb)`,
        [mah, pil, JSON.stringify([{ product_id: product, qty: 5 }])],
      );
      expect(tr.transfer_ref).toMatch(/^TRF-\d{4}-\d{4}$/);

      const line = await t.one<{ id: string }>(
        `select id from transfer_lines where transfer_id = $1`,
        [tr.id],
      );
      const done = await t.one<{ status: string }>(
        `select status from rpc_receive_transfer($1, current_date, $2::jsonb)`,
        [tr.id, JSON.stringify([{ line_id: line.id, qty_received: 3 }])],
      );
      expect(done.status).toBe("received_with_variance");
      expect(await t.balance(pil, product)).toBe(3);
    });
  });
});
