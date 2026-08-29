import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ProductForm } from "../product-form";
import { t } from "@/strings";

const IMAGE_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images`;

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireRole("ops_manager", "admin", "finance");
  const supabase = await createClient();

  const { data: product } = await supabase
    .from("products")
    .select("id, name, category_id, selling_price, standard_cost, image_path")
    .eq("id", id)
    .maybeSingle();
  if (!product) notFound();

  const { data: categories } = await supabase
    .from("product_categories")
    .select("id, name")
    .eq("is_active", true)
    .order("sort_order");

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">
        {t.admin.edit} — {product.name}
      </h1>
      <ProductForm
        product={product}
        role={user.role}
        categories={categories ?? []}
        imageBaseUrl={IMAGE_BASE}
      />
    </div>
  );
}
