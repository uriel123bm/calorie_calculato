/**
 * יוצר קבצי PNG לאייקוני PWA מ־public/icon.svg
 * (מסך הבית, Apple touch, favicon)
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");
const svg = readFileSync(join(publicDir, "icon.svg"));

const out = [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["apple-touch-icon.png", 180],
  ["favicon-32.png", 32],
];

for (const [name, size] of out) {
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(join(publicDir, name));
  console.log("wrote", name, size);
}
