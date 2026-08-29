import { describe, it, expect } from "vitest";
import { productSchema, standardCostSchema } from "@/app/(app)/admin/products/schema";

describe("product schema", () => {
  it("accepts a minimal payload with optional fields omitted", () => {
    // The exact shape the 'Add product' form posts when category/cost/image are blank.
    const out = productSchema.parse({ name: "Leo Book Rack", selling_price: "18500" });
    expect(out).toEqual({
      name: "Leo Book Rack",
      category_id: null,
      selling_price: 18500,
      standard_cost: null,
      image_path: null,
    });
  });

  it("keeps supplied optional fields", () => {
    const out = productSchema.parse({
      name: "Leo Book Rack",
      selling_price: "18500",
      standard_cost: "11200",
      category_id: "7c51c050-e3bf-4a52-b776-6d8de16a860e",
      image_path: "products/abc.webp",
    });
    expect(out.standard_cost).toBe(11200);
    expect(out.category_id).toBe("7c51c050-e3bf-4a52-b776-6d8de16a860e");
    expect(out.image_path).toBe("products/abc.webp");
  });

  it("rejects a zero or negative selling price", () => {
    expect(() => productSchema.parse({ name: "X", selling_price: "0" })).toThrow();
  });

  it("standardCostSchema maps blank/undefined to null and parses numbers", () => {
    expect(standardCostSchema.parse(undefined)).toBeNull();
    expect(standardCostSchema.parse("")).toBeNull();
    expect(standardCostSchema.parse("7000")).toBe(7000);
  });
});
