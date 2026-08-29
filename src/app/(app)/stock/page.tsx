import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CheckStock } from "./check-stock";
import { t } from "@/strings";

export default async function CheckStockPage() {
  await requireUser();
  const supabase = await createClient();

  const [{ data: balances }, { data: products }, { data: locations }, { data: finishes }] =
    await Promise.all([
      supabase
        .from("v_stock_balances")
        .select("location_id, product_id, finish_id, qty_on_hand"),
      supabase.from("products").select("id, name"),
      supabase.from("locations").select("id, name"),
      supabase.from("finishes").select("id, name"),
    ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{t.capture.checkStockTitle}</h1>
      <CheckStock
        balances={balances ?? []}
        productNames={Object.fromEntries((products ?? []).map((p) => [p.id, p.name]))}
        locationNames={Object.fromEntries((locations ?? []).map((l) => [l.id, l.name]))}
        finishNames={Object.fromEntries((finishes ?? []).map((f) => [f.id, f.name]))}
      />
    </div>
  );
}
