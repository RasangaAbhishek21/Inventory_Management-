import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getPickerData, getLocations, STORAGE_RENDER_BASE } from "@/lib/capture-data";
import { AdjustmentForm, type AdjustmentPrefill } from "./adjustment-form";
import { t } from "@/strings";

export default async function AdjustmentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("ops_manager", "admin");
  const sp = await searchParams;
  const fromVariance = typeof sp.from_variance === "string" ? sp.from_variance : null;

  const supabase = await createClient();
  const [{ products, finishes }, locations, reasonsRes] = await Promise.all([
    getPickerData(),
    getLocations(),
    supabase
      .from("adjustment_reasons")
      .select("id, label, requires_note, is_system, is_active")
      .eq("is_active", true),
  ]);
  const reasons = (reasonsRes.data ?? [])
    .filter((r) => !r.is_system)
    .map((r) => ({ id: r.id, label: r.label, requires_note: r.requires_note }));

  let prefill: AdjustmentPrefill | undefined;
  if (fromVariance) {
    const { data: v } = await supabase
      .from("v_open_variances")
      .select("transfer_id, transfer_ref, to_location_id, product_id, finish_id, shortfall")
      .eq("transfer_id", fromVariance)
      .limit(1)
      .maybeSingle();
    const product = v ? products.find((p) => p.id === v.product_id) : undefined;
    if (v && product) {
      prefill = {
        transfer_id: v.transfer_id,
        transfer_ref: v.transfer_ref,
        location_id: v.to_location_id,
        product,
        finish_id: v.finish_id,
        quantity: v.shortfall,
      };
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t.adjust.title}</h1>
        <Link href="/adjustments/variances" className="text-sm text-ink-60 underline">
          {t.adjust.openVariances}
        </Link>
      </div>
      <AdjustmentForm
        products={products}
        finishes={finishes}
        locations={locations.map((l) => ({ id: l.id, name: l.name }))}
        reasons={reasons}
        thumbBaseUrl={STORAGE_RENDER_BASE}
        prefill={prefill}
      />
    </div>
  );
}
