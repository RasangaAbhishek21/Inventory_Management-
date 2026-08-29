import { describe, it, expect } from "vitest";
import { withRollback } from "./helpers";

// Brief §11 — Import. Acceptance test 24.

describe("opening balance import", () => {
  it("24: an unknown product name rejects the whole CSV — nothing is committed", async () => {
    await withRollback(async (t) => {
      const admin = await t.makeActor("admin", { locationCode: "MAH" });
      await t.makeProduct("Known Product", 10000);
      await t.asUser(admin);

      const rows = [
        { location_code: "MAH", product_name: "Known Product", quantity: 5, unit_selling_price: 10000 },
        { location_code: "MAH", product_name: "Does Not Exist", quantity: 3, unit_selling_price: 10000 },
      ];

      const msg = await t.expectError(
        `select rpc_commit_opening_balances(current_date, $1::jsonb, false)`,
        [JSON.stringify(rows)],
      );
      expect(msg).toMatch(/unknown product/i);

      const opening = await t.val<string>(
        `select count(*)::int from stock_movements where movement_type = 'opening'`,
      );
      expect(Number(opening)).toBe(0);
    });
  });

  it("24b: a valid CSV commits every row as opening movements", async () => {
    await withRollback(async (t) => {
      const admin = await t.makeActor("admin", { locationCode: "MAH" });
      const p = await t.makeProduct("Known Product", 10000);
      await t.asUser(admin);

      const rows = [
        { location_code: "MAH", product_name: "Known Product", quantity: 5, unit_selling_price: 10000 },
        { location_code: "GON", product_name: "Known Product", quantity: 2, unit_selling_price: 11000, unit_standard_cost: 7000 },
      ];
      const n = await t.val<string>(
        `select rpc_commit_opening_balances(current_date, $1::jsonb, false)`,
        [JSON.stringify(rows)],
      );
      expect(Number(n)).toBe(2);

      const mah = await t.locationId("MAH");
      expect(await t.balance(mah, p)).toBe(5);
    });
  });
});
