/**
 * Generates the PWA icons into public/icons/ from an inline SVG.
 *   node scripts/gen-icons.mjs
 * Re-run if the mark changes. Output is committed so a plain build needs no sharp.
 */
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const YELLOW = "#f7c517";
const INK = "#1a1a1a";

// "H47" in near-black. `scale` shrinks the mark for the maskable safe zone.
const mark = (size, scale) => {
  const f = Math.round(size * 0.34 * scale);
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${YELLOW}"/>
  <text x="50%" y="50%" dy="0.35em" text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif" font-weight="700"
        font-size="${f}" fill="${INK}" letter-spacing="${-f * 0.04}">H47</text>
</svg>`;
};

await mkdir("public/icons", { recursive: true });

const jobs = [
  ["icon-192.png", 192, 1],
  ["icon-512.png", 512, 1],
  ["icon-maskable-512.png", 512, 0.66],
];

for (const [name, size, scale] of jobs) {
  await sharp(Buffer.from(mark(size, scale))).png().toFile(`public/icons/${name}`);
  console.log("wrote public/icons/" + name);
}
