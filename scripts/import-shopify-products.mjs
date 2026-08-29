/**
 * One-off: import the store's ACTIVE Shopify products into the inventory app.
 * Pulls only name + category + price (no variants, no quantities). Category comes
 * from Shopify's productType, with a taxonomy fallback. Existing products (matched
 * by name, case-insensitive) are left untouched.
 *
 *   node scripts/import-shopify-products.mjs [--dry]
 *
 * Data: scripts/_shopify-active-products.json — rows of [title, productType, taxonomy, priceLKR]
 */
import { readFileSync } from "node:fs";
import { config as loadEnv } from "dotenv";
import pg from "pg";

loadEnv({ path: ".env.local" });
const DRY = process.argv.includes("--dry");
const DB_URL = process.env.SUPABASE_DB_URL;
if (!DB_URL) throw new Error("SUPABASE_DB_URL missing in .env.local");

const JUNK_TAXONOMY = new Set(["", "Uncategorized", "Furniture", "Home & Garden"]);

/** productType (preferred) or a taxonomy fallback -> a clean category name, or null. */
function categoryFor(productType, taxonomy) {
  let pt = (productType ?? "").trim();
  if (pt.toLowerCase() === "sto") pt = "Storage";
  if (pt) return pt;

  const tx = (taxonomy ?? "").trim();
  if (JUNK_TAXONOMY.has(tx)) return null;
  if (/wardrobe/i.test(tx)) return "Wardrobe";
  return tx;
}

const rows = JSON.parse(readFileSync("scripts/_shopify-active-products.json", "utf8"));
const products = rows.map(([name, productType, taxonomy, price]) => ({
  name: String(name).trim(),
  category: categoryFor(productType, taxonomy),
  price: Number(price),
}));

const categories = [...new Set(products.map((p) => p.category).filter(Boolean))].sort();

async function main() {
  const client = new pg.Client({ connectionString: DB_URL });
  await client.connect();
  await client.query("begin");

  const summary = { categoriesUpserted: 0, inserted: 0, skipped: [], deactivated: [] };
  try {
    // 1. categories
    const catId = new Map();
    for (const name of categories) {
      const { rows: r } = await client.query(
        `insert into product_categories (name, sort_order, is_active)
         values ($1, 100, true)
         on conflict (name) do update set is_active = true
         returning id, (xmax = 0) as inserted`,
        [name],
      );
      catId.set(name, r[0].id);
      if (r[0].inserted) summary.categoriesUpserted++;
    }

    // 2. products
    for (const p of products) {
      const { rows: existing } = await client.query(
        `select id from products where lower(name) = lower($1) limit 1`,
        [p.name],
      );
      if (existing.length) {
        summary.skipped.push(p.name);
        continue;
      }
      await client.query(
        `insert into products (name, category_id, selling_price) values ($1, $2, $3)`,
        [p.name, p.category ? catId.get(p.category) : null, p.price],
      );
      summary.inserted++;
    }

    // 3. tidy seeded categories that ended up with no products
    const { rows: dead } = await client.query(
      `update product_categories set is_active = false
       where is_active
         and name in ('Dressing Tables')
         and not exists (select 1 from products where category_id = product_categories.id)
       returning name`,
    );
    summary.deactivated = dead.map((d) => d.name);

    if (DRY) {
      await client.query("rollback");
      console.log("DRY RUN — rolled back.");
    } else {
      await client.query("commit");
    }
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    await client.end();
  }

  console.log(`Categories in Shopify feed (${categories.length}):`, categories.join(", "));
  console.log(`Categories created: ${summary.categoriesUpserted}`);
  console.log(`Products inserted: ${summary.inserted}`);
  console.log(`Skipped (already in app): ${summary.skipped.length}`, summary.skipped.join(", ") || "—");
  console.log(`Seeded categories deactivated (0 products): ${summary.deactivated.join(", ") || "—"}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
