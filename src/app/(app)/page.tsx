import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { STORAGE_RENDER_BASE } from "@/lib/capture-data";
import { PageHeader } from "@/components/ui/PageHeader";
import { SpotInventory } from "./spot-inventory";
import { t } from "@/strings";

export default async function SpotInventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser();
  const sp = await searchParams;
  const initialQ = typeof sp.q === "string" ? sp.q : "";
  const supabase = await createClient();

  const [
    { data: balances },
    { data: products },
    { data: categories },
    { data: locations },
    { data: finishes },
    { data: dispatched },
  ] = await Promise.all([
    supabase.from("v_stock_balances").select("location_id, product_id, finish_id, qty_on_hand"),
    supabase.from("products").select("id, name, category_id, image_path"),
    supabase.from("product_categories").select("id, name").order("sort_order"),
    supabase.from("locations").select("id, name, code").eq("is_active", true).order("name"),
    supabase.from("finishes").select("id, name"),
    supabase.from("transfers").select("id").eq("status", "dispatched"),
  ]);

  const dispatchedIds = (dispatched ?? []).map((d) => d.id);
  const { data: transitLines } = dispatchedIds.length
    ? await supabase
        .from("transfer_lines")
        .select("product_id, finish_id, qty_dispatched, qty_received")
        .in("transfer_id", dispatchedIds)
    : { data: [] as { product_id: string; finish_id: string | null; qty_dispatched: number; qty_received: number | null }[] };

  const inTransit = (transitLines ?? []).map((l) => ({
    product_id: l.product_id,
    finish_id: l.finish_id,
    qty: l.qty_dispatched - (l.qty_received ?? 0),
  }));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={t.spot.title} description={t.spot.subtitle} />
      <SpotInventory
        balances={balances ?? []}
        inTransit={inTransit}
        locations={(locations ?? []).map((l) => ({ id: l.id, name: l.name }))}
        productNames={Object.fromEntries((products ?? []).map((p) => [p.id, p.name]))}
        productImages={Object.fromEntries((products ?? []).map((p) => [p.id, p.image_path]))}
        productCategory={Object.fromEntries((products ?? []).map((p) => [p.id, p.category_id]))}
        categories={categories ?? []}
        finishNames={Object.fromEntries((finishes ?? []).map((f) => [f.id, f.name]))}
        thumbBaseUrl={STORAGE_RENDER_BASE}
        initialQ={initialQ}
      />
    </div>
  );
}
