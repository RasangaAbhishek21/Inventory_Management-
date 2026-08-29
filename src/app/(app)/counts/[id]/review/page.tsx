import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ReviewView } from "./review-view";

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireRole("ops_manager", "admin");
  const supabase = await createClient();

  const { data: count } = await supabase
    .from("stock_counts")
    .select("id, count_ref, location_id, count_date, status")
    .eq("id", id)
    .maybeSingle();
  if (!count) notFound();
  if (count.status === "open") redirect(`/counts/${id}/count`);

  const [{ data: rawLines }, { data: balances }, { data: lateMoves }, { data: postedMoves }] =
    await Promise.all([
      supabase
        .from("stock_count_lines")
        .select("product_id, finish_id, system_qty, counted_qty, variance")
        .eq("stock_count_id", id),
      supabase
        .from("v_stock_balances")
        .select("product_id, finish_id, qty_on_hand, value_at_selling_price")
        .eq("location_id", count.location_id),
      supabase.from("v_count_late_movements").select("movement_id").eq("stock_count_id", id),
      supabase
        .from("stock_movements")
        .select("product_id, finish_id, quantity, unit_selling_price")
        .eq("stock_count_id", id),
    ]);

  const productIds = [...new Set((rawLines ?? []).map((l) => l.product_id))];
  const finishIds = [...new Set((rawLines ?? []).map((l) => l.finish_id).filter(Boolean))] as string[];
  const [{ data: products }, { data: finishes }] = await Promise.all([
    supabase.from("products").select("id, name, selling_price").in("id", productIds.length ? productIds : ["00000000-0000-0000-0000-000000000000"]),
    supabase.from("finishes").select("id, name").in("id", finishIds.length ? finishIds : ["00000000-0000-0000-0000-000000000000"]),
  ]);
  const pName = new Map((products ?? []).map((p) => [p.id, p.name]));
  const pPrice = new Map((products ?? []).map((p) => [p.id, Number(p.selling_price)]));
  const fName = new Map((finishes ?? []).map((f) => [f.id, f.name]));

  const key = (p: string, f: string | null) => `${p}:${f ?? ""}`;
  const avgValue = new Map<string, number>();
  for (const b of balances ?? []) {
    if (b.qty_on_hand !== 0) {
      avgValue.set(key(b.product_id, b.finish_id), Number(b.value_at_selling_price) / b.qty_on_hand);
    }
  }
  const postedImpact = new Map<string, number>();
  for (const m of postedMoves ?? []) {
    const k = key(m.product_id, m.finish_id);
    postedImpact.set(k, (postedImpact.get(k) ?? 0) + m.quantity * Number(m.unit_selling_price));
  }

  const lines = (rawLines ?? [])
    .map((l) => {
      const k = key(l.product_id, l.finish_id);
      const unit = avgValue.get(k) ?? pPrice.get(l.product_id) ?? 0;
      const valueImpact =
        count.status === "posted" && postedImpact.has(k)
          ? postedImpact.get(k)!
          : (l.variance ?? 0) * unit;
      return {
        product: pName.get(l.product_id) ?? "—",
        finish: l.finish_id ? (fName.get(l.finish_id) ?? null) : null,
        system: l.system_qty,
        counted: l.counted_qty,
        variance: l.variance,
        valueImpact,
      };
    })
    .sort((a, b) => Math.abs(b.valueImpact) - Math.abs(a.valueImpact));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="num text-xl font-semibold">{count.count_ref}</h1>
      <ReviewView
        countId={count.id}
        countRef={count.count_ref}
        status={count.status}
        lines={lines}
        hasLateMovements={(lateMoves ?? []).length > 0}
      />
    </div>
  );
}
