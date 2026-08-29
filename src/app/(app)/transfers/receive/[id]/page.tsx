import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { STORAGE_RENDER_BASE } from "@/lib/capture-data";
import { ReceiveForm } from "./receive-form";
import { t } from "@/strings";

export default async function ReceiveOnePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  if (user.role === "finance") redirect("/");
  const supabase = await createClient();

  const { data: transfer } = await supabase
    .from("transfers")
    .select("id, transfer_ref, status, to_location_id, from_location_id")
    .eq("id", id)
    .maybeSingle();
  if (!transfer) notFound();

  if (transfer.status !== "dispatched") {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">{transfer.transfer_ref}</h1>
        <p className="text-ink-60">{t.errors.notFound}</p>
      </div>
    );
  }
  if (user.role === "staff" && transfer.to_location_id !== user.homeLocationId) {
    redirect("/transfers/receive");
  }

  const { data: rawLines } = await supabase
    .from("transfer_lines")
    .select("id, product_id, finish_id, qty_dispatched")
    .eq("transfer_id", id);

  const productIds = [...new Set((rawLines ?? []).map((l) => l.product_id))];
  const finishIds = [...new Set((rawLines ?? []).map((l) => l.finish_id).filter(Boolean))] as string[];
  const [{ data: products }, { data: finishes }] = await Promise.all([
    supabase.from("products").select("id, name, image_path").in("id", productIds.length ? productIds : ["00000000-0000-0000-0000-000000000000"]),
    supabase.from("finishes").select("id, name").in("id", finishIds.length ? finishIds : ["00000000-0000-0000-0000-000000000000"]),
  ]);
  const pName = new Map((products ?? []).map((p) => [p.id, p.name]));
  const pImage = new Map((products ?? []).map((p) => [p.id, p.image_path]));
  const fName = new Map((finishes ?? []).map((f) => [f.id, f.name]));

  const lines = (rawLines ?? []).map((l) => {
    const image = pImage.get(l.product_id);
    return {
      line_id: l.id,
      product: pName.get(l.product_id) ?? "—",
      finish: l.finish_id ? (fName.get(l.finish_id) ?? null) : null,
      qty_dispatched: l.qty_dispatched,
      imageUrl: image ? `${STORAGE_RENDER_BASE}/${image}?width=128&height=128&resize=cover` : null,
    };
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="num text-xl font-semibold">{transfer.transfer_ref}</h1>
      <ReceiveForm transferId={transfer.id} transferRef={transfer.transfer_ref} lines={lines} />
    </div>
  );
}
