import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getPickerData, getLocations, STORAGE_RENDER_BASE } from "@/lib/capture-data";
import { TransferForm } from "./transfer-form";
import { t } from "@/strings";

export default async function NewTransferPage() {
  const user = await requireUser();

  const [{ products, finishes }, locations] = await Promise.all([
    getPickerData(),
    getLocations(),
  ]);

  if (user.role === "finance") {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">{t.capture.transferTitle}</h1>
        <p className="text-ink-60">{t.errors.forbidden}</p>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: balances } = await supabase
    .from("v_stock_balances")
    .select("location_id, product_id, finish_id, qty_on_hand");

  const isStaff = user.role === "staff";
  const from = isStaff ? (user.homeLocationId ?? locations[0]?.id) : locations[0]?.id;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{t.capture.transferTitle}</h1>
      <TransferForm
        products={products}
        finishes={finishes}
        locations={locations.map((l) => ({ id: l.id, name: l.name }))}
        balances={balances ?? []}
        fromLocationId={from}
        lockFrom={isStaff}
        thumbBaseUrl={STORAGE_RENDER_BASE}
      />
    </div>
  );
}
