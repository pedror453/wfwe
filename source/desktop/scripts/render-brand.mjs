// Рендерить фірмову графіку «Кермо» (значок усіх розмірів, бічну панель і заголовок майстра інсталятора) у PNG.
// Далі pack_assets.py збирає з них icon.ico, BMP і license.rtf. Потрібні залежності клієнта: cd ../client && npm ci.
// Використання: node scripts/render-brand.mjs /tmp/kermo-brand
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('../../client/node_modules/@playwright/test');
const out = process.argv[2] || '/tmp/kermo-brand';
mkdirSync(out, { recursive: true });

const mark = (size, invert = false) => {
  const tile = invert ? '#ffffff' : 'url(#g)';
  const stroke = invert ? '#0f766e' : '#ffffff';
  const dot = invert ? '#0f766e' : '#ffffff';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64" fill="none">
  <defs><linearGradient id="g" x1="8" y1="4" x2="56" y2="60" gradientUnits="userSpaceOnUse"><stop stop-color="#14B8A6"/><stop offset="1" stop-color="#0B5F73"/></linearGradient></defs>
  <rect width="64" height="64" rx="16" fill="${tile}"/>
  <circle cx="32" cy="32" r="17" stroke="${stroke}" stroke-width="4.5"/>
  <circle cx="32" cy="32" r="4.5" fill="${dot}"/>
  <path d="M15 31.5h12.5M36.5 31.5H49M32 36.5V49" stroke="${stroke}" stroke-width="4.5" stroke-linecap="round"/>
</svg>`;
};

const FONT = "'Segoe UI','Liberation Sans','DejaVu Sans',Arial,sans-serif";
const sidebar = `<style>
  html,body{margin:0}
  body{width:164px;height:314px;position:relative;overflow:hidden;font-family:${FONT};color:#fff;background:linear-gradient(165deg,#0f766e 0%,#0b5f73 52%,#082f45 100%)}
  .ring{position:absolute;border-radius:50%;border:2px solid rgba(255,255,255,.14)}
  .t{position:absolute;left:20px;top:130px;font-size:31px;font-weight:700;letter-spacing:.4px}
  .s{position:absolute;left:21px;top:172px;font-size:12.5px;line-height:1.4;opacity:.88}
  .l{position:absolute;left:21px;bottom:24px;width:122px;height:2px;background:rgba(255,255,255,.38)}
</style>
<div class="ring" style="width:210px;height:210px;left:-70px;top:196px"></div>
<div class="ring" style="width:130px;height:130px;left:92px;top:246px"></div>
<div style="position:absolute;left:20px;top:32px">${mark(78, true)}</div>
<div class="t">Кермо</div><div class="s">ERP автодилера</div><div class="l"></div>`;

const header = `<style>
  html,body{margin:0}
  body{width:150px;height:57px;position:relative;background:#fff;font-family:${FONT};color:#0b3b4a}
  .t{position:absolute;left:54px;top:9px;font-size:20px;font-weight:700}
  .s{position:absolute;left:55px;top:34px;font-size:10.5px;color:#5b6b82}
</style>
<div style="position:absolute;left:10px;top:10px">${mark(36)}</div>
<div class="t">Кермо</div><div class="s">ERP автодилера</div>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 256, height: 256 } });
for (const s of [16, 24, 32, 48, 64, 128, 256]) {
  await page.setViewportSize({ width: s, height: s });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block}</style>${mark(s)}`);
  await page.screenshot({ path: `${out}/icon-${s}.png`, omitBackground: true });
}
await page.setViewportSize({ width: 164, height: 314 });
await page.setContent(sidebar);
await page.screenshot({ path: `${out}/sidebar.png` });
await page.setViewportSize({ width: 150, height: 57 });
await page.setContent(header);
await page.screenshot({ path: `${out}/header.png` });
await browser.close();
console.log('PNG записано в', out);
