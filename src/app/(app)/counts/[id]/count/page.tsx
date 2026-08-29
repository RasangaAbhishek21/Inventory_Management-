import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getPickerData, STORAGE_RENDER_BASE } from "@/lib/capture-data";
import { CounterView } from "./counter-view";

export default async function CounterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const isOps = user.role === "ops_manager" || user.role === "admin";
  const supabase = await createClient();

  const { data: count } = await supabase
    .from("stock_counts")
    .select("id, count_ref, location_id, count_date, status")
    .eq("id", id)
    .maybeSingle();
  if (!count) notFound();

  if (count.status !== "open") {
    redirect(isOps ? `/counts/${id}/review` : "/counts");
  }
  if (user.role === "staff" && count.location_id !== user.homeLocationId) {
    redirect("/counts");
  }

  // Blind view — never carries system_qty (brief §4.5, test 18).
  const { data: rawLines } = await supabase
    .from("v_count_lines_blind")
    .select("id, product_id, finish_id, counted_qty")
    .eq("stock_count_id", id);

  const [{ products, finishes }] = await Promise.all([getPickerData()]);
  const pName = new Map(products.map((p) => [p.id, p.name]));
  const fName = new Map(finishes.map((f) => [f.id, f.name]));

  const lines = (rawLines ?? [])
    .map((l) => ({
      line_id: l.id,
      product: pName.get(l.product_id) ?? "—",
      finish: l.finish_id ? (fName.get(l.finish_id) ?? null) : null,
      counted: l.counted_qty,
    }))
    .sort((a, b) => a.product.localeCompare(b.product) || (a.finish ?? "").localeCompare(b.finish ?? ""));

  const { data: loc } = await supabase
    .from("locations")
    .select("name")
    .eq("id", count.location_id)
    .maybeSingle();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="num text-xl font-semibold">{count.count_ref}</h1>
        <p className="text-ink-60">
          {loc?.name} · {count.count_date}
        </p>
      </div>
      <CounterView
        countId={count.id}
        isOps={isOps}
        initialLines={lines}
        products={products}
        finishes={finishes}
        thumbBaseUrl={STORAGE_RENDER_BASE}
      />
    </div>
  );
}
