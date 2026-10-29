// Checks WCAG contrast of the theme's text/background token pairs in both themes.
// Usage: node scripts/check-contrast.mjs   (exits 1 if any pair is under 4.5:1)
import { readFileSync } from "node:fs";
import { join } from "node:path";

const css = readFileSync(join(import.meta.dirname, "..", "src", "app", "globals.css"), "utf8");

function tokens(selector) {
  const start = css.indexOf(`${selector} {`);
  const body = css.slice(start, css.indexOf("}", start));
  return Object.fromEntries([...body.matchAll(/--([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})/g)].map((m) => [m[1], m[2]]));
}

function luminance(hex) {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const pairs = [
  ["text", "bg"], ["text", "surface"], ["text", "surface-2"],
  ["text-muted", "bg"], ["text-muted", "surface"], ["text-muted", "surface-2"],
  ["primary", "bg"], ["primary", "surface"], ["primary", "primary-soft"],
  ["on-primary", "primary"], ["on-accent", "accent"], ["accent-text", "accent-soft"],
  ["success", "success-soft"], ["warning", "warning-soft"], ["danger", "danger-soft"], ["danger", "surface"],
];

let failed = false;
for (const [theme, selector] of [["light", ":root"], ["dark", ".dark"]]) {
  const t = tokens(selector);
  const light = tokens(":root");
  const get = (name) => t[name] ?? light[name];
  const results = pairs.map(([fg, bg]) => ({ pair: `${fg} on ${bg}`, ratio: contrast(get(fg), get(bg)) }));
  const low = results.filter((r) => r.ratio < 4.5);
  const min = Math.min(...results.map((r) => r.ratio));
  console.log(`${theme}: ${results.length} pairs, lowest ${min.toFixed(2)}:1${low.length ? "  FAIL " + low.map((r) => `${r.pair} ${r.ratio.toFixed(2)}`).join(", ") : ""}`);
  if (low.length) failed = true;
}

const ink = "#141A3D";
const kids = ["#F4B740", "#8E97CC", "#5BD1B3", "#FF8A5B", "#F2A7C3", "#7CC4F2"];
const kidRatios = kids.map((c) => contrast(ink, c));
console.log(`ink on child colours: ${kidRatios.map((r) => r.toFixed(1)).join(", ")}`);
if (kidRatios.some((r) => r < 4.5)) failed = true;

process.exit(failed ? 1 : 0);
