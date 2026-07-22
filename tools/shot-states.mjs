// Screenshot the diagnostic in both empty and answered states.
// Usage: node tools/shot-states.mjs [url]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// NOTE: the Temp/puppeteer-test install is broken (puppeteer-core has lib/ + src/ but no
// package.json, so Node cannot resolve it). Use the gstack copy, which is complete.
const require = createRequire('C:/Users/193pu/.claude/skills/gstack/node_modules/');
const puppeteer = require('puppeteer-core');
const CHROME = 'C:/Users/193pu/.cache/puppeteer/chrome/win64-150.0.7871.24/chrome-win64/chrome.exe';

const url = process.argv[2] || 'http://localhost:3000/dist/banking-fraud-front.html';
const dir = path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), 'temporary screenshots');
fs.mkdirSync(dir, { recursive: true });
const stamp = () => fs.readdirSync(dir).filter(f => f.startsWith('screenshot-')).length + 1;

const browser = await puppeteer.launch({ executablePath: CHROME });

async function shot(label, { mobile = false, dark = false, fill = false } = {}) {
  const page = await browser.newPage();
  await page.setViewport(mobile ? { width: 390, height: 844, deviceScaleFactor: 2 } : { width: 1440, height: 900 });
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
  if (dark) await page.click('#theme');
  if (fill) {
    // mid-severity scenario: $500M-$4B, weekly recon, $1-5K/hr, hard block, not re-mapped
    const preferred = { volume: 1, lag_hrs: 2, per_hr: 1, block: 0, liability: 2, recon: 2, fraud_in_pnl: 2, vendor: 2, recon_rule: 1, vendor_plan: 1 };
    for (let pass = 0; pass < 2; pass++) {          // twice: showIf may reveal new rows
      const qs = await page.$$eval('.opt', els => [...new Set(els.map(e => e.dataset.q))]);
      for (const q of qs) {
        const sel = `.opt[data-q="${q}"][data-i="${preferred[q] ?? 0}"]`;
        if (await page.$(sel)) await page.click(sel);
      }
    }
    if (await page.$('#x-reported'))  await page.type('#x-reported', '900000');
    if (await page.$('#x-incidents')) await page.type('#x-incidents', '18');
  }
  // position:sticky renders at the scroll position during a fullPage capture, which floats
  // the rail mid-document and leaves a hole where it belongs. Pin it for review shots only.
  await page.addStyleTag({ content: '.rail-sec{position:static !important; box-shadow:none !important}' });
  await new Promise(r => setTimeout(r, 700));
  const out = path.join(dir, `screenshot-${stamp()}-${label}.png`);
  await page.screenshot({ path: out, fullPage: true });
  await page.close();
  console.log(out);
}

await shot('empty');
await shot('filled', { fill: true });
await shot('filled-dark', { fill: true, dark: true });
await shot('mobile', { mobile: true, fill: true });
await browser.close();
