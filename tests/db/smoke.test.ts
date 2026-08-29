import { describe, it, expect } from "vitest";
import { withRollback } from "./helpers";

describe("db harness smoke", () => {
  it("connects, seeds an actor, inserts a movement, rolls back", async () => {
    await withRollback(async (t) => {
      const mah = await t.locationId("MAH");
      expect(mah).toBeTruthy();

      const staff = await t.makeActor("staff", { locationCode: "MAH" });
      const product = await t.makeProduct("Smoke Rack", 10000);

      await t.asUser(staff);
      const role = await t.val<string>("select auth_role()");
      expect(role).toBe("staff");

      await t.q(
        `insert into stock_movements (movement_type, location_id, product_id, quantity,
                                      unit_selling_price, transaction_date, entered_by)
         values ('origination', $1, $2, 5, 0, current_date, $3)`,
        [mah, product, staff],
      );
      expect(await t.balance(mah, product)).toBe(5);
    });
  }, 30000);
});
