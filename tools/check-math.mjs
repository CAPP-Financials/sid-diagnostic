// Asserts the printed working reproduces the printed answer.
// The product claim is "the arithmetic is in the open and you can check it" — if a CFO
// checks a line by hand and gets a different number, the page is worse than useless.
// Tests the real shipped artifact through a browser; nothing is reimplemented here.
// Usage: node tools/check-math.mjs   (requires: node serve.mjs running)
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/193pu/.claude/skills/gstack/node_modules/');
const puppeteer = require('puppeteer-core');
const CHROME = 'C:/Users/193pu/.cache/puppeteer/chrome/win64-150.0.7871.24/chrome-win64/chrome.exe';
const URL = process.argv[2] || 'http://localhost:3000/dist/banking-fraud-front.html';

// "$7.6M" / "$400K" / "$1.2B" → number
function parseAbbrev(s) {
  const m = /\$([\d.,]+)\s*([BMK])?/.exec(s);
  if (!m) return NaN;
  const n = parseFloat(m[1].replace(/,/g, ''));
  return n * ({ B: 1e9, M: 1e6, K: 1e3 }[m[2]] || 1);
}

// every domain, not just banking — the factor-rounding bug lived in enterprise-ai and this
// gate never looked there
const DOMAINS = [
  { domain: 'banking-fraud', depth: 'front',
    picks: { volume: 1, lag_hrs: 2, per_hr: 1, block: 0, liability: 2 } },
  { domain: 'enterprise-ai', depth: 'front',
    picks: { spend: 2, baseline: 2, measure: 2, alloc: 2, shadow: 2 } },
  { domain: 'loyalty', depth: 'deep',
    picks: { revenue: 2, markets: 1, data_migration: 3, multi_currency: 2, fraud_detection: 0,
             abuse_types: 3, roi_subtract_fraud: 1, last_audit: 0, knowledge_sharing: 0, cascading: 0 } }
];

const SCENARIOS = [
  { name: 'mid — weekly recon, hard block, unmapped',
    picks: { volume: 1, lag_hrs: 2, per_hr: 1, block: 0, liability: 2 },
    exacts: { reported: 900000, incidents: 18 }, expectTier: 'Estimate' },
  { name: 'severe — monthly settlement, high rate, Tier-1',
    picks: { volume: 2, lag_hrs: 3, per_hr: 3, block: 0, liability: 2 },
    exacts: {}, expectTier: 'Estimate' },
  { name: 'healthy — real-time, tiered blocking, fully mapped',
    picks: { volume: 0, lag_hrs: 0, per_hr: 0, block: 2, liability: 0 },
    exacts: {}, expectTier: 'Estimate' },
  { name: 'refined — all three precision inputs supplied',
    picks: { volume: 1, lag_hrs: 1, per_hr: 1, block: 1, liability: 1 },
    exacts: { volume: 3_100_000_000, per_hr: 4200, incidents: 9 }, expectTier: 'Refined' }
];

let failures = 0, scFailures = 0;
const fail = (s, m) => { failures++; scFailures++; console.log(`  ✗ ${m}`); };
const pass = m => console.log(`  ✓ ${m}`);

const browser = await puppeteer.launch({ executablePath: CHROME });
const page = await browser.newPage();

for (const sc of SCENARIOS) {
  console.log(`\n${sc.name}`);
  scFailures = 0;
  await page.goto(URL, { waitUntil: 'networkidle0' });
  for (const [q, i] of Object.entries(sc.picks)) await page.click(`.opt[data-q="${q}"][data-i="${i}"]`);
  for (const [k, v] of Object.entries(sc.exacts)) await page.type(`#x-${k}`, String(v));
  await new Promise(r => setTimeout(r, 250));

  const d = await page.evaluate(() => ({
    // contingent / unmeasurable leaks carry a figure but are excluded from the headline,
    // so the sum-to-headline check must exclude them too
    leaks: [...document.querySelectorAll('.leak')].map((el, i) => ({
      name: el.querySelector('strong').textContent,
      shown: el.querySelector('.leak-amt').textContent,
      math: el.querySelector('.leak-math').textContent,
      kind: (window._sid && window._sid.kinds) ? window._sid.kinds[Object.keys(window._sid.leaks)[i]] : 'loss'
    })),
    headline: document.getElementById('total').textContent,
    range: document.getElementById('range').textContent,
    tier: document.getElementById('tier-l').textContent
  }));

  if (!d.leaks.length) { fail(sc.name, 'no leaks rendered'); continue; }

  // 1. every working line ends in "= $N", and that N matches the headline figure for the line
  let exactSum = 0;
  for (const l of d.leaks) {
    if (l.kind && l.kind !== 'loss') continue;   // reported apart from the headline by design
    const m = /=\s*\$([\d,]+)\s*$/.exec(l.math.trim());
    if (!m) { fail(sc.name, `${l.name}: working line has no trailing "= $N" — cannot be checked by hand`); continue; }
    const exact = parseFloat(m[1].replace(/,/g, ''));
    exactSum += exact;
    const shown = parseAbbrev(l.shown);
    const drift = exact === 0 ? Math.abs(shown) : Math.abs(shown - exact) / exact;
    if (drift > 0.05) fail(sc.name, `${l.name}: shows ${l.shown} but its own working computes $${m[1]} (${(drift * 100).toFixed(0)}% off)`);
  }

  // 2. leaks must sum to the headline, once the already-recorded figure is added back
  const net = parseAbbrev(d.headline);
  const gross = net + (sc.exacts.reported || 0);
  const sumDrift = exactSum === 0 ? 0 : Math.abs(gross - exactSum) / exactSum;
  if (sumDrift > 0.05) fail(sc.name, `leaks sum to $${exactSum.toLocaleString()} but headline implies $${gross.toLocaleString()}`);

  // 3. the range must bracket the headline and be correctly ordered
  const [lo, hi] = (d.range.match(/\$[\d.,]+\s*[BMK]?/g) || []).slice(0, 2).map(parseAbbrev);
  if (!(lo <= net && net <= hi)) fail(sc.name, `headline ${d.headline} outside its own range ${d.range}`);

  // 4. tier must match what the inputs earn
  if (d.tier !== sc.expectTier) fail(sc.name, `tier is "${d.tier}", expected "${sc.expectTier}"`);

  if (!scFailures) pass(`${d.leaks.length} leaks · headline ${d.headline} · ${d.tier} · working reproduces answer`);
}

/* ── the factors themselves must multiply to the stated result ─────────────────
   Checking only the trailing "= $N" against the headline let a line read
   "$20,000,000 × 0 × 1 = $8,000,000" — internally consistent with the headline, and
   nonsense to the CFO who multiplies it. Parse the factors and do the arithmetic. */
console.log('\nFactor arithmetic — the printed multiplication must actually work');
for (const d of DOMAINS) {
  await page.goto(`http://localhost:3000/sid.html?domain=${d.domain}&depth=${d.depth}`, { waitUntil: 'networkidle0' });
  for (const [q, i] of Object.entries(d.picks)) {
    const sel = `.opt[data-q="${q}"][data-i="${i}"]`;
    if (await page.$(sel)) await page.click(sel);
  }
  await new Promise(r => setTimeout(r, 250));
  const lines = await page.$$eval('.leak', els => els.map(e => ({
    name: e.querySelector('strong').textContent,
    math: e.querySelector('.leak-math').textContent.trim()
  })));
  if (!lines.length) { fail(d.domain, 'no leak lines rendered'); continue; }

  // every leak needs a human name; loyalty shipped "undefined" as its title on every line
  for (const l of lines) {
    /undefined|^\s*$/.test(l.name)
      ? fail(d.domain, `a leak renders its title as "${l.name}" — missing name in config`)
      : pass(`${d.domain}/${l.name}: has a title`);
  }

  for (const l of lines) {
    const m = /^(.*?)=\s*\$([\d,]+)\s*$/.exec(l.math);
    if (!m) { fail(d.domain, `${l.name}: no "= $N" to check`); continue; }
    const stated = parseFloat(m[2].replace(/,/g, ''));
    // split on × and −, strip annotations like "(assumed)"
    const plusPart = m[1].split(/[−-]\s(?=\$)/);
    const evalProduct = expr => expr.split('×').map(t => {
      const s = t.replace(/\(assumed\)/g, '').trim();
      if (/%$/.test(s)) return parseFloat(s) / 100;
      const n = parseFloat(s.replace(/[$,]/g, ''));
      return isNaN(n) ? null : n;
    }).reduce((a, v) => (v === null || a === null ? null : a * v), 1);
    let computed = evalProduct(plusPart[0]);
    if (plusPart[1] !== undefined) { const sub = evalProduct(plusPart[1]); computed = (computed === null || sub === null) ? null : computed - sub; }
    if (computed === null) { fail(d.domain, `${l.name}: a factor is unparseable — "${l.math}"`); continue; }
    computed = Math.max(0, computed);   // leaks are floored at zero
    const drift = stated === 0 ? Math.abs(computed) : Math.abs(computed - stated) / Math.abs(stated);
    drift <= 0.01
      ? pass(`${d.domain}/${l.name}: factors multiply to the stated $${m[2]}`)
      : fail(d.domain, `${l.name}: printed factors give $${Math.round(computed).toLocaleString()}, line states $${m[2]} — "${l.math}"`);
  }
}

await browser.close();
console.log(failures ? `\nFAIL — ${failures} problem(s)\n` : '\nPASS — printed working reproduces every printed answer\n');
process.exit(failures ? 1 : 0);
