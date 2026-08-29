import { describe, it, expect } from "vitest";
import { withRollback } from "./helpers";

// Brief §11 — Ledger. Acceptance tests 1-6.

describe("ledger", () => {
  it("1: originate 5 at MAH, transfer 5 to PIL unreceived → MAH 0, PIL 0, in-transit 5", async () => {
    await withRollback(async (t) => {
      const mah = await t.locationId("MAH");
      const pil = await t.locationId("PIL");
      const actor = await t.makeActor("ops_manager", { locationCode: "MAH" });
      const product = await t.makeProduct("Leo Book Rack", 10000);
      await t.asUser(actor);

      await t.q(
        `insert into stock_movements (movement_type, location_id, product_id, quantity,
                                      unit_selling_price, transaction_date, entered_by)
         values ('origination', $1, $2, 5, 0, current_date, $3)`,
        [mah, product, actor],
      );

      await t.q(
        `select * from rpc_dispatch_transfer($1, $2, current_date, null, null, $3::jsonb)`,
        [mah, pil, JSON.stringify([{ product_id: product, qty: 5 }])],
      );

      expect(await t.balance(mah, product)).toBe(0);
      expect(await t.balance(pil, product)).toBe(0);

      const inTransit = await t.val<string>(
        `select coalesce(sum(qty_dispatched - coalesce(qty_received,0)),0)::int
           from transfer_lines tl join transfers tr on tr.id = tl.transfer_id
          where tr.status = 'dispatched'`,
      );
      expect(Number(inTransit)).toBe(5);
    });
  });

  it("2: confirming receipt of 5 → PIL 5, in-transit 0", async () => {
    await withRollback(async (t) => {
      const mah = await t.locationId("MAH");
      const pil = await t.locationId("PIL");
      const actor = await t.makeActor("ops_manager", { locationCode: "MAH" });
      const product = await t.makeProduct("Leo Book Rack", 10000);
      await t.asUser(actor);

      await t.q(
        `insert into stock_movements (movement_type, location_id, product_id, quantity,
                                      unit_selling_price, transaction_date, entered_by)
         values ('origination', $1, $2, 5, 0, current_date, $3)`,
        [mah, product, actor],
      );
      const tr = await t.one<{ id: string }>(
        `select * from rpc_dispatch_transfer($1, $2, current_date, null, null, $3::jsonb)`,
        [mah, pil, JSON.stringify([{ product_id: product, qty: 5 }])],
      );
      const line = await t.one<{ id: string }>(
        `select id from transfer_lines where transfer_id = $1`,
        [tr.id],
      );

      await t.q(`select * from rpc_receive_transfer($1, current_date, $2::jsonb)`, [
        tr.id,
        JSON.stringify([{ line_id: line.id, qty_received: 5 }]),
      ]);

      expect(await t.balance(pil, product)).toBe(5);
      const status = await t.val<string>(`select status from transfers where id = $1`, [tr.id]);
      expect(status).toBe("received");
      const inTransit = await t.val<string>(
        `select coalesce(sum(qty_dispatched - coalesce(qty_received,0)),0)::int
           from transfer_lines tl join transfers tr on tr.id = tl.transfer_id
          where tr.status = 'dispatched'`,
      );
      expect(Number(inTransit)).toBe(0);
    });
  });

  it("3: receiving 4 of 5 → PIL 4, status received_with_variance, one open variance of 1", async () => {
    await withRollback(async (t) => {
      const mah = await t.locationId("MAH");
      const pil = await t.locationId("PIL");
      const actor = await t.makeActor("ops_manager", { locationCode: "MAH" });
      const product = await t.makeProduct("Leo Book Rack", 10000);
      await t.asUser(actor);

      await t.q(
        `insert into stock_movements (movement_type, location_id, product_id, quantity,
                                      unit_selling_price, transaction_date, entered_by)
         values ('origination', $1, $2, 5, 0, current_date, $3)`,
        [mah, product, actor],
      );
      const tr = await t.one<{ id: string }>(
        `select * from rpc_dispatch_transfer($1, $2, current_date, null, null, $3::jsonb)`,
        [mah, pil, JSON.stringify([{ product_id: product, qty: 5 }])],
      );
      const line = await t.one<{ id: string }>(
        `select id from transfer_lines where transfer_id = $1`,
        [tr.id],
      );

      await t.q(`select * from rpc_receive_transfer($1, current_date, $2::jsonb)`, [
        tr.id,
        JSON.stringify([{ line_id: line.id, qty_received: 4 }]),
      ]);

      expect(await t.balance(pil, product)).toBe(4);
      expect(await t.val<string>(`select status from transfers where id = $1`, [tr.id])).toBe(
        "received_with_variance",
      );

      const variances = await t.q(`select * from v_open_variances where transfer_id = $1`, [tr.id]);
      expect(variances.rows).toHaveLength(1);
      expect(Number(variances.rows[0].shortfall)).toBe(1);
    });
  });

  it("4: dispatching 3 when 2 on hand is rejected and names the available quantity", async () => {
    await withRollback(async (t) => {
      const mah = await t.locationId("MAH");
      const pil = await t.locationId("PIL");
      const actor = await t.makeActor("ops_manager", { locationCode: "MAH" });
      const product = await t.makeProduct("Leo Book Rack", 10000);
      await t.asUser(actor);

      await t.q(
        `insert into stock_movements (movement_type, location_id, product_id, quantity,
                                      unit_selling_price, transaction_date, entered_by)
         values ('origination', $1, $2, 2, 0, current_date, $3)`,
        [mah, product, actor],
      );

      await expect(
        t.q(`select * from rpc_dispatch_transfer($1, $2, current_date, null, null, $3::jsonb)`, [
          mah,
          pil,
          JSON.stringify([{ product_id: product, qty: 3 }]),
        ]),
      ).rejects.toThrow(/Only 2 available/i);
    });
  });

  it("5: reversing a movement restores the balance and leaves both rows visible", async () => {
    await withRollback(async (t) => {
      const mah = await t.locationId("MAH");
      const actor = await t.makeActor("ops_manager", { locationCode: "MAH" });
      const product = await t.makeProduct("Leo Book Rack", 10000);
      await t.asUser(actor);

      const orig = await t.one<{ id: string; unit_selling_price: string }>(
        `insert into stock_movements (movement_type, location_id, product_id, quantity,
                                      unit_selling_price, transaction_date, entered_by)
         values ('origination', $1, $2, 5, 0, current_date, $3)
         returning id, unit_selling_price`,
        [mah, product, actor],
      );
      expect(await t.balance(mah, product)).toBe(5);

      await t.q(
        `insert into stock_movements (movement_type, location_id, product_id, quantity,
                                      unit_selling_price, transaction_date, entered_by,
                                      reverses_movement_id)
         values ('origination', $1, $2, -5, 0, current_date, $3, $4)`,
        [mah, product, actor, orig.id],
      );

      expect(await t.balance(mah, product)).toBe(0);
      const rows = await t.q(
        `select id, quantity, unit_selling_price, reverses_movement_id
           from stock_movements where product_id = $1 order by id`,
        [product],
      );
      expect(rows.rows).toHaveLength(2);
      // reversal copies the stamped value of the row it reverses
      expect(rows.rows[1].unit_selling_price).toBe(orig.unit_selling_price);
      expect(String(rows.rows[1].reverses_movement_id)).toBe(String(orig.id));
    });
  });

  it("6: UPDATE and DELETE on stock_movements fail for every application role", async () => {
    await withRollback(async (t) => {
      const mah = await t.locationId("MAH");
      const actor = await t.makeActor("admin", { locationCode: "MAH" });
      const product = await t.makeProduct("Leo Book Rack", 10000);
      await t.asUser(actor);
      const m = await t.one<{ id: string }>(
        `insert into stock_movements (movement_type, location_id, product_id, quantity,
                                      unit_selling_price, transaction_date, entered_by)
         values ('origination', $1, $2, 5, 0, current_date, $3) returning id`,
        [mah, product, actor],
      );

      await t.asOwner();
      const users: Record<string, string> = {};
      for (const role of ["admin", "ops_manager", "finance", "staff"] as const) {
        users[role] = await t.makeActor(role, { locationCode: "MAH" });
      }

      for (const role of ["admin", "ops_manager", "finance", "staff"] as const) {
        await t.asUser(users[role]);
        await t.expectError(`update stock_movements set quantity = 99 where id = $1`, [m.id]);
        await t.expectError(`delete from stock_movements where id = $1`, [m.id]);
      }
    });
  });
});
