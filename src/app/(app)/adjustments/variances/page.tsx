import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { OpenVariances } from "./open-variances";
import { t } from "@/strings";

export default async function OpenVariancesPage() {
  await requireRole("ops_manager", "admin", "finance");
  const supabase = await createClient();

  const [{ data: rows }, { data: reasons }] = await Promise.all([
    supabase
      .from("v_open_variances")
      .select(
        "transfer_id, transfer_ref, to_location, line_id, product, finish_id, shortfall, shortfall_value",
      )
      .order("transfer_ref"),
    supabase
      .from("adjustment_reasons")
      .select("id, label, is_system, is_active")
      .eq("is_active", true),
  ]);

  const finishIds = [
    ...new Set((rows ?? []).map((r) => r.finish_id).filter(Boolean)),
  ] as string[];
  const { data: finishes } = await supabase
    .from("finishes")
    .select("id, name")
    .in("id", finishIds.length ? finishIds : ["00000000-0000-0000-0000-000000000000"]);
  const fName = new Map((finishes ?? []).map((f) => [f.id, f.name]));

  const byTransfer = new Map<
    string,
    {
      transfer_id: string;
      transfer_ref: string;
      to_location: string;
      lines: {
        line_id: string;
        product: string;
        finish: string | null;
        shortfall: number;
        shortfall_value: number;
      }[];
    }
  >();
  for (const r of rows ?? []) {
    const g = byTransfer.get(r.transfer_id) ?? {
      transfer_id: r.transfer_id,
      transfer_ref: r.transfer_ref,
      to_location: r.to_location,
      lines: [],
    };
    g.lines.push({
      line_id: r.line_id,
      product: r.product,
      finish: r.finish_id ? (fName.get(r.finish_id) ?? null) : null,
      shortfall: r.shortfall,
      shortfall_value: r.shortfall_value,
    });
    byTransfer.set(r.transfer_id, g);
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{t.adjust.openVariances}</h1>
      <OpenVariances
        groups={[...byTransfer.values()]}
        reasons={(reasons ?? [])
          .filter((r) => !r.is_system)
          .map((r) => ({ id: r.id, label: r.label }))}
      />
    </div>
  );
}
