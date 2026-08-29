/**
 * One-off: pull each product's featured image from Shopify (1200px webp), upload it
 * to the app's Supabase Storage `product-images` bucket, and set products.image_path.
 * Only touches products where image_path is null (safe to re-run).
 *
 *   node scripts/import-shopify-images.mjs [--dry] [--limit N]
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL in .env.local.
 * Image URL map: scripts/_shopify-active-images.json  { "<product title>": "<cdn url>" }
 */
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { config as loadEnv } from "dotenv";
import pg from "pg";

loadEnv({ path: ".env.local" });

const DRY = process.argv.includes("--dry");
const limitArg = process.argv.indexOf("--limit");
const LIMIT = limitArg >= 0 ? Number(process.argv[limitArg + 1]) : Infinity;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DB_URL = process.env.SUPABASE_DB_URL;
if (!SUPABASE_URL || !KEY || !DB_URL) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SUPABASE_DB_URL are required");
}

const MAX_BYTES = 2_000_000; // bucket limit
const EXT = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };
const imageUrls = JSON.parse(readFileSync("scripts/_shopify-active-images.json", "utf8"));
// case-insensitive lookup
const urlByName = new Map(Object.entries(imageUrls).map(([k, v]) => [k.toLowerCase(), v]));

async function uploadOne(path, bytes, contentType) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/product-images/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      apikey: KEY,
      "Content-Type": contentType,
      "x-upsert": "true",
      "cache-control": "31536000",
    },
    body: bytes,
  });
  if (!res.ok) throw new Error(`storage ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

async function main() {
  const client = new pg.Client({ connectionString: DB_URL });
  await client.connect();

  const { rows: products } = await client.query(
    `select id, name from products where image_path is null order by name`,
  );

  const summary = { uploaded: 0, noUrl: [], tooBig: [], failed: [] };
  let done = 0;

  for (const p of products) {
    if (done >= LIMIT) break;
    const url = urlByName.get(p.name.toLowerCase());
    if (!url) {
      summary.noUrl.push(p.name);
      continue;
    }
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`fetch ${r.status}`);
      const contentType = (r.headers.get("content-type") || "image/webp").split(";")[0].trim();
      const ext = EXT[contentType] ?? "webp";
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.byteLength > MAX_BYTES) {
        summary.tooBig.push(`${p.name} (${(buf.byteLength / 1e6).toFixed(1)}MB)`);
        continue;
      }
      const path = `products/${randomUUID()}.${ext}`;
      if (!DRY) {
        await uploadOne(path, buf, contentType);
        await client.query(`update products set image_path = $1 where id = $2`, [path, p.id]);
      }
      summary.uploaded++;
      done++;
      if (summary.uploaded % 25 === 0) console.log(`  …${summary.uploaded} uploaded`);
    } catch (e) {
      summary.failed.push(`${p.name}: ${e.message}`);
    }
  }

  await client.end();

  console.log(DRY ? "\nDRY RUN — nothing written.\n" : "");
  console.log(`Products needing an image: ${products.length}`);
  console.log(`Uploaded + linked: ${summary.uploaded}`);
  console.log(`No Shopify URL: ${summary.noUrl.length}`, summary.noUrl.join(", ") || "—");
  console.log(`Over 2MB (skipped): ${summary.tooBig.length}`, summary.tooBig.join(", ") || "—");
  console.log(`Failed: ${summary.failed.length}`);
  summary.failed.forEach((f) => console.log("  " + f));
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
