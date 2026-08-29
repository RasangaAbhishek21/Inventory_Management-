import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ProductForm } from "../product-form";
import { t } from "@/strings";

const IMAGE_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images`;

export default async function NewProductPage() {
  const user = await requireRole("ops_manager", "admin");
  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("product_categories")
    .select("id, name")
    .eq("is_active", true)
    .order("sort_order");

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">
        {t.admin.add} — {t.admin.products}
      </h1>
      <ProductForm role={user.role} categories={categories ?? []} imageBaseUrl={IMAGE_BASE} />
    </div>
  );
}
