// Rasterize the app icon SVG to PNG sizes. Run: node scripts/gen-icons.mjs
import { readFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import sharp from "sharp";

const src = readFileSync(new URL("../assets/icon.svg", import.meta.url), "utf8");
const outPath = fileURLToPath(new URL("../public/icons/", import.meta.url));
mkdirSync(outPath, { recursive: true });

const [head, body] = src.split("<!--MOTIF-->");
const motif = body.replace(/<\/svg>\s*$/, "");

async function render(svg, size, file) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(file);
  console.log("wrote", file);
}

// Plain icon: full-bleed square artwork; the OS rounds corners.
const plain = head + motif + "</svg>";
await render(plain, 512, join(outPath, "icon-512.png"));
await render(plain, 192, join(outPath, "icon-192.png"));

// Maskable: keep the motif inside the ~60% safe zone (scale about center).
const maskable =
  head + `<g transform="translate(512,512) scale(0.82) translate(-512,-512)">` + motif + `</g></svg>`;
await render(maskable, 512, join(outPath, "icon-maskable-512.png"));
await render(maskable, 180, join(outPath, "apple-touch-icon.png"));
