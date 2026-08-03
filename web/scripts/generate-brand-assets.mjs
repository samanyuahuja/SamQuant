import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDirectory, "..");
const publicDirectory = path.join(root, "public");
const iconDirectory = path.join(publicDirectory, "icons");
const brandDirectory = path.join(publicDirectory, "brand");
const socialDirectory = path.join(publicDirectory, "social");

await Promise.all([
  mkdir(iconDirectory, { recursive: true }),
  mkdir(brandDirectory, { recursive: true }),
  mkdir(socialDirectory, { recursive: true }),
]);

const markPaths = `
  <circle cx="32" cy="32" r="22"/>
  <path d="M20 24.2c3.2-5 18-4.8 20 2.2 2 7-18.2 5.2-17.4 12.4.6 6.8 15.6 7 20.4 1.4"/>
  <path d="m39.4 38.2 12.6 12.6"/>`;

function markSvg(background, foreground) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <rect width="64" height="64" rx="5" fill="${background}"/>
    <g fill="none" stroke="${foreground}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">${markPaths}</g>
  </svg>`;
}

function logoSvg(background, foreground) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="96" viewBox="0 0 420 96">
    <rect width="420" height="96" fill="${background}"/>
    <g transform="translate(12 16)" fill="none" stroke="${foreground}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">${markPaths}</g>
    <text x="91" y="65" fill="${foreground}" font-family="Arial Narrow, Arial, sans-serif" font-size="43" font-weight="600">SamQuant</text>
  </svg>`;
}

await Promise.all([
  writeFile(path.join(brandDirectory, "samquant-mark.svg"), markSvg("#f1efe8", "#111310")),
  writeFile(path.join(brandDirectory, "samquant-logo-light.svg"), logoSvg("#f1efe8", "#111310")),
  writeFile(path.join(brandDirectory, "samquant-logo-dark.svg"), logoSvg("#202421", "#f1efe8")),
]);

const iconSizes = [16, 32, 48];
const iconBuffers = await Promise.all(iconSizes.map(async (size) => {
  const buffer = await sharp(Buffer.from(markSvg("#202421", "#f1efe8"))).resize(size, size).png().toBuffer();
  await writeFile(path.join(iconDirectory, `icon-${size}.png`), buffer);
  return { size, buffer };
}));

await Promise.all([
  sharp(Buffer.from(markSvg("#f1efe8", "#111310"))).resize(180, 180).png().toFile(path.join(iconDirectory, "apple-touch-icon.png")),
  sharp(Buffer.from(markSvg("#202421", "#f1efe8"))).resize(192, 192).png().toFile(path.join(iconDirectory, "pwa-192.png")),
  sharp(Buffer.from(markSvg("#202421", "#f1efe8"))).resize(512, 512).png().toFile(path.join(iconDirectory, "pwa-512.png")),
]);

await writeFile(path.join(root, "src", "app", "favicon.ico"), buildIco(iconBuffers));

const report = JSON.parse(await readFile(path.join(root, "src", "data", "demo-backtest.json"), "utf8"));
const symbol = report.metadata.symbols[0];
const closes = report.market[symbol].map((bar) => bar.close);
const marketPath = buildPath(closes, 1200, 300, 0, 280);

await Promise.all([
  sharp(Buffer.from(socialSvg(1200, 630, marketPath))).png().toFile(path.join(socialDirectory, "open-graph.png")),
  sharp(Buffer.from(socialSvg(1280, 640, marketPath))).png().toFile(path.join(socialDirectory, "github-preview.png")),
]);

function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const entries = Buffer.alloc(images.length * 16);
  let offset = 6 + entries.length;
  images.forEach(({ size, buffer }, index) => {
    const start = index * 16;
    entries.writeUInt8(size === 256 ? 0 : size, start);
    entries.writeUInt8(size === 256 ? 0 : size, start + 1);
    entries.writeUInt8(0, start + 2);
    entries.writeUInt8(0, start + 3);
    entries.writeUInt16LE(1, start + 4);
    entries.writeUInt16LE(32, start + 6);
    entries.writeUInt32LE(buffer.length, start + 8);
    entries.writeUInt32LE(offset, start + 12);
    offset += buffer.length;
  });
  return Buffer.concat([header, entries, ...images.map(({ buffer }) => buffer)]);
}

function buildPath(values, width, height, offsetX, offsetY) {
  const minimum = Math.min(...values);
  const spread = Math.max(...values) - minimum || 1;
  return values.map((value, index) => {
    const x = offsetX + (index / (values.length - 1)) * width;
    const y = offsetY + (1 - (value - minimum) / spread) * height;
    return `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

function socialSvg(width, height, line) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="${width}" height="${height}" fill="#f1efe8"/>
    <g opacity="0.55" stroke="#d0cdc4" stroke-width="1">
      <path d="M0 158H${width}M0 316H${width}M0 474H${width}"/>
      <path d="M${width * 0.25} 0V${height}M${width * 0.5} 0V${height}M${width * 0.75} 0V${height}"/>
    </g>
    <path d="${line}" fill="none" stroke="#486a73" stroke-width="5"/>
    <rect x="56" y="52" width="64" height="64" rx="5" fill="#202421"/>
    <g transform="translate(56 52)" fill="none" stroke="#f1efe8" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">${markPaths}</g>
    <text x="142" y="101" fill="#111310" font-family="Arial Narrow, Arial, sans-serif" font-size="44" font-weight="600">SamQuant</text>
    <text x="56" y="${height - 116}" fill="#111310" font-family="Arial Narrow, Arial, sans-serif" font-size="78" font-weight="600">Test the strategy. Not your luck.</text>
    <text x="58" y="${height - 62}" fill="#486a73" font-family="IBM Plex Mono, monospace" font-size="19">DATA / SIGNAL / ORDER / PORTFOLIO / RISK</text>
  </svg>`;
}
