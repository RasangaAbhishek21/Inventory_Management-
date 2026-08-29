import { createClient } from "@/lib/supabase/server";

export const STORAGE_PUBLIC_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images`;
export const STORAGE_RENDER_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/render/image/public/product-images`;

/** Active products + finishes for the capture pickers, in one round trip. */
export async function getPickerData() {
  const supabase = await createClient();
  const [products, finishes] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, image_path")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("finishes")
      .select("id, name")
      .eq("is_active", true)
      .order("sort_order")
      .order("name"),
  ]);
  return {
    products: products.data ?? [],
    finishes: finishes.data ?? [],
  };
}

export async function getLocations() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("locations")
    .select("id, name, code, can_originate, is_active")
    .eq("is_active", true)
    .order("name");
  return data ?? [];
}
