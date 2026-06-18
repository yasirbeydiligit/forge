/**
 * Generates PWA icons (PNG) from an inline SVG logo.
 * Run with: node scripts/generate-icons.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = resolve(__dirname, "../public/icons");

const BG = "#2f8a5b";
const ACCENT = "#f4f1e9";

function dumbbell(scale = 1) {
  // Drawn around a 512 viewbox, centred for maskable scaling.
  return `
    <g transform="translate(256 256) scale(${scale}) translate(-256 -256)"
       stroke="${ACCENT}" stroke-width="34" stroke-linecap="round" fill="none">
      <line x1="180" y1="256" x2="332" y2="256" />
      <line x1="152" y1="196" x2="152" y2="316" />
      <line x1="118" y1="222" x2="118" y2="290" />
      <line x1="360" y1="196" x2="360" y2="316" />
      <line x1="394" y1="222" x2="394" y2="290" />
    </g>`;
}

function svg({ rounded = true, scale = 1 } = {}) {
  const radius = rounded ? 112 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${radius}" fill="${BG}" />
  ${dumbbell(scale)}
</svg>`;
}

async function main() {
  await mkdir(iconsDir, { recursive: true });

  const baseSvg = svg({ rounded: true, scale: 1 });
  const maskableSvg = svg({ rounded: false, scale: 0.66 });

  await writeFile(resolve(iconsDir, "icon.svg"), baseSvg);

  const targets = [
    { svg: baseSvg, size: 192, name: "icon-192.png" },
    { svg: baseSvg, size: 512, name: "icon-512.png" },
    { svg: baseSvg, size: 180, name: "apple-touch-icon.png" },
    { svg: maskableSvg, size: 512, name: "icon-maskable-512.png" },
  ];

  for (const t of targets) {
    await sharp(Buffer.from(t.svg))
      .resize(t.size, t.size)
      .png()
      .toFile(resolve(iconsDir, t.name));
    console.log(`✓ ${t.name} (${t.size}px)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
