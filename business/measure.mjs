// Measure a document's printed height in mm against A4. Usage: node business/measure.mjs <url>
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/193pu/.claude/skills/gstack/node_modules/');
const puppeteer = require('puppeteer-core');
const CHROME = 'C:/Users/193pu/.cache/puppeteer/chrome/win64-150.0.7871.24/chrome-win64/chrome.exe';

const url = process.argv[2];
const browser = await puppeteer.launch({ executablePath: CHROME });
const page = await browser.newPage();
await page.goto(url, { waitUntil: 'networkidle0' });
await page.emulateMediaType('print');
const mm = await page.evaluate(() => {
  const sheet = document.querySelector('.sheet');
  const px = sheet.getBoundingClientRect().height;
  return { px, mm: px / 3.7795275591 };
});
// A4 = 297mm. Print padding is inside .sheet, so compare the sheet box to the full page.
const A4 = 297;
console.log(`sheet: ${mm.px.toFixed(0)}px = ${mm.mm.toFixed(1)}mm`);
console.log(`A4 page: ${A4}mm  ->  ${mm.mm <= A4 ? 'FITS one page' : `OVERFLOWS by ${(mm.mm - A4).toFixed(1)}mm`}`);
await browser.close();
