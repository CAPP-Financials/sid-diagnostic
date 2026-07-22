// Screenshot a localhost URL. Usage: node screenshot.mjs <url> [label] [--mobile]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire('C:/Users/193pu/.claude/skills/gstack/node_modules/');
const puppeteer = require('puppeteer-core');
const CHROME = 'C:/Users/193pu/.cache/puppeteer/chrome/win64-150.0.7871.24/chrome-win64/chrome.exe';

const args = process.argv.slice(2);
const mobile = args.includes('--mobile');
const [url, label] = args.filter(a => a !== '--mobile');
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'temporary screenshots');
fs.mkdirSync(dir, { recursive: true });
const n = fs.readdirSync(dir).filter(f => f.startsWith('screenshot-')).length + 1;
const out = path.join(dir, `screenshot-${n}${label ? '-' + label : ''}.png`);

const browser = await puppeteer.launch({ executablePath: CHROME });
const page = await browser.newPage();
await page.setViewport(mobile ? { width: 390, height: 844, deviceScaleFactor: 2 } : { width: 1440, height: 900 });
await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
// scroll through the page so IntersectionObserver reveals fire, then return to top
await page.evaluate(async () => {
  document.documentElement.style.scrollBehavior = 'auto';
  for (let y = 0; y < document.body.scrollHeight; y += 500) { scrollTo({ top: y, behavior: 'instant' }); await new Promise(r => setTimeout(r, 90)); }
  scrollTo({ top: 0, behavior: 'instant' });
});
await new Promise(r => setTimeout(r, 900));
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log(out);
