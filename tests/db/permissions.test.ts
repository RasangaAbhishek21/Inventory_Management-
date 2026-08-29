import { describe, it, expect } from "vitest";
import { withRollback } from "./helpers";

// Brief §11 — Permissions. Acceptance tests 7-11. The DATABASE refuses these, not the UI.

describe("permissions (RLS)", () => {
  it("7: a staff user cannot insert an adjustment", async () => {
    await withRollback(async (t) => {
      const mah = await t.locationId("MAH");
      const staff = await t.makeActor("staff", { locationCode: "MAH" });
      const product = await t.makeProduct("Perm Table", 10000);
      const reason = await t.reasonId("Count correction — surplus");
      await t.asUser(staff);
      await expect(
        t.q(
          `insert into stock_movements (movement_type, location_id, product_id, quantity,
                                        unit_selling_price, transaction_date, entered_by, reason_id)
           values ('adjustment', $1, $2, 1, 0, current_date, $3, $4)`,
          [mah, product, staff, reason],
        ),
      ).rejects.toThrow(/row-level security|violates/i);
    });
  });

  it("8: a staff user at MAH cannot insert any movement at GON", async () => {
    await withRollback(async (t) => {
      const gon = await t.locationId("GON");
      const staff = await t.makeActor("staff", { locationCode: "MAH" });
      const product = await t.makeProduct("Perm Table", 10000);
      await t.asUser(staff);
      await expect(
        t.q(
          `insert into stock_movements (movement_type, location_id, product_id, quantity,
                                        unit_selling_price, transaction_date, entered_by)
           values ('origination', $1, $2, 5, 0, current_date, $3)`,
          [gon, product, staff],
        ),
      ).rejects.toThrow(/row-level security|violates/i);
    });
  });

  it("9: a staff user cannot originate at Piliyandala Showroom", async () => {
    await withRollback(async (t) => {
      const pil = await t.locationId("PIL");
      const staff = await t.makeActor("staff", { locationCode: "PIL" });
      const product = await t.makeProduct("Perm Table", 10000);
      await t.asUser(staff);
      await expect(
        t.q(
          `insert into stock_movements (movement_type, location_id, product_id, quantity,
                                        unit_selling_price, transaction_date, entered_by)
           values ('origination', $1, $2, 5, 0, current_date, $3)`,
          [pil, product, staff],
        ),
      ).rejects.toThrow(/row-level security|violates/i);
    });
  });

  it("10: a staff user cannot open, post or cancel a stock count", async () => {
    await withRollback(async (t) => {
      const mah = await t.locationId("MAH");
      const ops = await t.makeActor("ops_manager", { locationCode: "MAH" });
      const staff = await t.makeActor("staff", { locationCode: "MAH" });
      const product = await t.makeProduct("Perm Table", 10000);

      await t.asUser(ops);
      await t.q(
        `insert into stock_movements (movement_type, location_id, product_id, quantity,
                                      unit_selling_price, transaction_date, entered_by)
         values ('origination', $1, $2, 5, 0, current_date, $3)`,
        [mah, product, ops],
      );
      const count = await t.one<{ id: string }>(
        `select id from rpc_open_stock_count($1, current_date)`,
        [mah],
      );
      const line = await t.one<{ id: string }>(
        `select id from stock_count_lines where stock_count_id = $1`,
        [count.id],
      );
      await t.q(`select rpc_set_count_line($1, 5, null)`, [line.id]);
      await t.q(`select rpc_submit_stock_count($1)`, [count.id]);

      await t.asUser(staff);
      expect(await t.expectError(`select rpc_open_stock_count($1, current_date)`, [mah])).toMatch(
        /Operations Manager/i,
      );
      expect(await t.expectError(`select rpc_post_stock_count($1)`, [count.id])).toMatch(
        /Operations Manager/i,
      );
      expect(await t.expectError(`select rpc_cancel_stock_count($1, null::text)`, [count.id])).toMatch(
        /Operations Manager/i,
      );
    });
  });

  it("11: a finance user cannot insert any movement, but can read every report", async () => {
    await withRollback(async (t) => {
      const mah = await t.locationId("MAH");
      const finance = await t.makeActor("finance", { locationCode: "MAH" });
      const product = await t.makeProduct("Perm Table", 10000);
      const reason = await t.reasonId("Count correction — surplus");
      await t.asUser(finance);

      // Every movement type is refused for finance. +qty types are caught by RLS;
      // the insert being refused is the invariant, whichever layer catches it.
      for (const mt of ["origination", "return"] as const) {
        const msg = await t.expectError(
          `insert into stock_movements (movement_type, location_id, product_id, quantity,
                                        unit_selling_price, transaction_date, entered_by)
           values ($4::text, $1, $2, 1, 0, current_date, $3)`,
          [mah, product, finance, mt],
        );
        expect(msg).toMatch(/row-level security|violates/i);
      }
      expect(
        await t.expectError(
          `insert into stock_movements (movement_type, location_id, product_id, quantity,
                                        unit_selling_price, transaction_date, entered_by, reason_id)
           values ('adjustment', $1, $2, 1, 0, current_date, $3, $4)`,
          [mah, product, finance, reason],
        ),
      ).toMatch(/row-level security|violates/i);

      // reads: none of these should error
      for (const view of [
        "v_stock_balances",
        "v_in_transit",
        "v_open_variances",
        "v_adjustment_exceptions",
        "v_stock_accuracy",
      ]) {
        await t.q(`select * from ${view} limit 1`);
      }
      await t.q(`select * from fn_stock_balances(current_date) limit 1`);
    });
  });
});
