// Generates the logo and app icon files in public/ from the brand spec
// (docs/design/PREP-theme-spec.md, section 6). Run: node scripts/make-icons.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const out = join(import.meta.dirname, "..", "public");
mkdirSync(join(out, "brand"), { recursive: true });

const INDIGO = "#22307A";
const MARIGOLD = "#F4B740";
const PERIWINKLE = "#8E97CC";

// The mark's inner shapes in its own 18 8 90 104 coordinate box.
const bowl = `<rect x="40" y="16" width="60" height="50" rx="18" fill="${MARIGOLD}"/>`;
const tick = (w) =>
  `<path d="M63 41l9 9 16-17" fill="none" stroke="${INDIGO}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const stem = (fill) => `<rect x="28" y="16" width="18" height="88" rx="9" fill="${fill}"/>`;
const lines = (fill, opacity = 1) =>
  `<rect x="54" y="78" width="30" height="9" rx="4.5" fill="${fill}" opacity="${opacity}"/>` +
  `<rect x="54" y="95" width="18" height="9" rx="4.5" fill="${fill}" opacity="${opacity}"/>`;

const markLight = bowl + stem(INDIGO) + tick(8) + lines(INDIGO, 0.45);
const markDark = bowl + stem("#FFFFFF") + tick(8) + lines(PERIWINKLE);
const markTiny = bowl + stem("#FFFFFF"); // 28 px and below

const standalone = (inner) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="18 8 90 104" role="img" aria-label="PREP">${inner}</svg>\n`;

// Mark centred on an indigo square, `share` = mark width as a fraction of the icon.
function onIndigo(size, share, inner, radius = 0) {
  const w = size * share;
  const h = (w * 104) / 90;
  const x = (size - w) / 2;
  const y = (size - h) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
<rect width="${size}" height="${size}" rx="${radius}" fill="${INDIGO}"/>
<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="18 8 90 104">${inner}</svg></svg>`;
}

const png = (svg, file) => sharp(Buffer.from(svg)).png().toFile(join(out, file));

writeFileSync(join(out, "brand", "mark-light.svg"), standalone(markLight));
writeFileSync(join(out, "brand", "mark-dark.svg"), standalone(markDark));

await png(onIndigo(192, 0.54, markDark), "icon-192.png");
await png(onIndigo(512, 0.54, markDark), "icon-512.png");
await png(onIndigo(512, 0.44, markDark), "maskable-512.png");
await png(onIndigo(180, 0.54, markDark), "apple-touch-icon.png");

// Favicon: the 28 px simplified mark on an indigo rounded square (radius 22%).
const favicon = onIndigo(32, 0.56, markTiny, 32 * 0.22);
writeFileSync(join(out, "favicon.svg"), favicon + "\n");
const fav32 = await sharp(Buffer.from(favicon)).png().toBuffer();

// favicon.ico holding one 32x32 PNG (supported by every current browser).
const ico = Buffer.alloc(22);
ico.writeUInt16LE(0, 0); // reserved
ico.writeUInt16LE(1, 2); // type: icon
ico.writeUInt16LE(1, 4); // one image
ico.writeUInt8(32, 6); // width
ico.writeUInt8(32, 7); // height
ico.writeUInt8(0, 8); // palette
ico.writeUInt8(0, 9); // reserved
ico.writeUInt16LE(1, 10); // planes
ico.writeUInt16LE(32, 12); // bits per pixel
ico.writeUInt32LE(fav32.length, 14); // image size
ico.writeUInt32LE(22, 18); // image offset
writeFileSync(join(out, "favicon.ico"), Buffer.concat([ico, fav32]));

// Android notification badge: monochrome white simplified mark, tick cut out.
const badge = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
<defs><mask id="m"><rect width="96" height="96" fill="#fff"/>
<svg x="${(96 - 62) / 2}" y="${(96 - 72) / 2}" width="62" height="72" viewBox="18 8 90 104">${tick(12).replace(INDIGO, "#000")}</svg></mask></defs>
<svg x="${(96 - 62) / 2}" y="${(96 - 72) / 2}" width="62" height="72" viewBox="18 8 90 104" mask="url(#m)">
<rect x="40" y="16" width="60" height="50" rx="18" fill="#fff"/>${stem("#fff")}</svg></svg>`;
await png(badge, "badge-96.png");

console.log("Icons written to public/");
