import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function CountDispatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await createClient();
  const { data: count } = await supabase
    .from("stock_counts")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  if (!count) notFound();

  const isOps = user.role === "ops_manager" || user.role === "admin";
  if (count.status === "open") redirect(`/counts/${id}/count`);
  redirect(isOps ? `/counts/${id}/review` : "/counts");
}
