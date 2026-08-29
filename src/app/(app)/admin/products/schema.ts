import { z } from "zod";

/** missing key / "" / undefined -> null; otherwise the trimmed string. */
const nullableText = z
  .string()
  .optional()
  .transform((v) => {
    const s = (v ?? "").trim();
    return s === "" ? null : s;
  });

/** missing key / "" -> null; otherwise a non-negative number. */
const nullableMoney = z
  .string()
  .optional()
  .transform((v, ctx) => {
    const s = (v ?? "").trim();
    if (s === "") return null;
    const n = Number(s);
    if (!Number.isFinite(n) || n < 0) {
      ctx.addIssue({ code: "custom", message: "must be a non-negative number" });
      return z.NEVER;
    }
    return n;
  });

/**
 * Product create/update payload. The "Add product" form omits category / cost / image
 * entirely when they are blank, so those must accept a missing key === "" === null.
 */
export const productSchema = z.object({
  name: z.string().trim().min(1).max(120),
  category_id: nullableText.refine(
    (v) => v === null || /^[0-9a-f-]{36}$/i.test(v),
    "invalid category",
  ),
  selling_price: z.coerce.number().refine((n) => n > 0, "must be greater than zero"),
  standard_cost: nullableMoney,
  image_path: nullableText,
});

export const standardCostSchema = nullableMoney;
