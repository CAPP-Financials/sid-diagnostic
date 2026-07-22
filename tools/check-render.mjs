// STAGE C + E GATE.
//   C — the dashboard is generated from CFG.categories, not four hardcoded slots.
//       A 3-category config must render 3 rows; a 4-category config must render 4.
//   E — a showIf question does not render until its predicate passes, and contributes
//       ZERO to every score while hidden. "Asked and skipped" must differ from "answered".
//
// Usage: node tools/check-render.mjs   (requires: node serve.mjs running)
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/193pu/.claude/skills/gstack/node_modules/puppeteer-core');
const engine  = require('../sid-engine.js');
const banking = require('../domains/banking-fraud.js');
const CHROME = 'C:/Users/193pu/.cache/puppeteer/chrome/win64-150.0.7871.24/chrome-win64/chrome.exe';
const BASE = process.argv[2] || 'http://localhost:3000/sid.html';

let failed = 0;
const ok   = m => console.log(`  ✓ ${m}`);
const bad  = m => { failed++; console.log(`  ✗ ${m}`); };
const eq   = (got, want, m) => got === want ? ok(`${m} (${got})`) : bad(`${m}: got ${got}, expected ${want}`);

/* ── E, engine level: a hidden question must not score ───────────────────────── */
console.log('\nStage E — hidden questions contribute nothing (engine)');
{
  // liability 0.1 (-20) deliberately leaves headroom: with liability 1.0 both sides clamp
  // to 100 and the assertion passes vacuously whether or not showIf works.
  const base = { volume: 2000000000, lag_hrs: 168, per_hr: 2500, block: 1.0, liability: 0.1, recon: 'auto' };
  // recon_rule only shows when recon != 'auto'. Answering it while hidden must change nothing.
  const hidden  = engine.compute(banking, { ...base, recon_rule: 'improv' });
  const notSet  = engine.compute(banking, base);
  eq(JSON.stringify(hidden.scores), JSON.stringify(notSet.scores),
     'answering a hidden question leaves scores identical');

  // and when the predicate passes, it must actually apply
  const shown = engine.compute(banking, { ...base, recon: 'manual', recon_rule: 'improv' });
  const shownNo = engine.compute(banking, { ...base, recon: 'manual' });
  shown.scores.capture !== shownNo.scores.capture
    ? ok(`once visible it scores (capture ${shownNo.scores.capture} → ${shown.scores.capture})`)
    : bad('visible showIf question had no effect — predicate or delta wiring is broken');
}

const browser = await puppeteer.launch({ executablePath: CHROME });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });

const answerAll = async () => {
  const qs = await page.$$eval('.opt', els => {
    const seen = {}; els.forEach(e => { if (!(e.dataset.q in seen)) seen[e.dataset.q] = 0; });
    return Object.keys(seen);
  });
  for (const q of qs) {
    const sel = `.opt[data-q="${q}"][data-i="0"]`;
    if (await page.$(sel)) await page.click(sel);
  }
};

/* ── C: category rows are generated from config ──────────────────────────────── */
console.log('\nStage C — dashboard rows generated from CFG.categories');
for (const [domain, expected] of [['banking-fraud', 3], ['loyalty', 4], ['enterprise-ai', 3]]) {
  await page.goto(`${BASE}?domain=${domain}&depth=deep`, { waitUntil: 'networkidle0' });
  await answerAll(); await answerAll();           // twice: showIf may reveal new rows
  await new Promise(r => setTimeout(r, 200));
  const n = await page.$$eval('.cat', e => e.length);
  eq(n, expected, `${domain} renders one row per category`);
}

/* ── depth filtering ─────────────────────────────────────────────────────────── */
console.log('\nDepth filtering — front door shows only front questions');
{
  const frontExpected = banking.questions.filter(q => q.depth === 'front').length;
  await page.goto(`${BASE}?domain=banking-fraud&depth=front`, { waitUntil: 'networkidle0' });
  const n = await page.$$eval('.row', e => e.length);
  eq(n, frontExpected, 'front depth renders only front-tagged questions');

  await page.goto(`${BASE}?domain=banking-fraud&depth=deep`, { waitUntil: 'networkidle0' });
  const deepN = await page.$$eval('.row', e => e.length);
  deepN > n ? ok(`deep renders more rows than front (${deepN} > ${n})`)
            : bad(`deep (${deepN}) should render more rows than front (${n})`);
}

/* ── E, DOM level: the row appears only once its predicate passes ────────────── */
console.log('\nStage E — showIf row appears only when its predicate passes (DOM)');
{
  await page.goto(`${BASE}?domain=banking-fraud&depth=deep`, { waitUntil: 'networkidle0' });
  const present = () => page.$$eval('.row', els => els.map(e => e.dataset.q).includes('recon_rule'));

  await page.click('.opt[data-q="recon"][data-i="0"]');           // 'auto'
  await new Promise(r => setTimeout(r, 150));
  (await present()) ? bad('recon_rule visible while recon = auto') : ok('hidden while recon = auto');

  await page.click('.opt[data-q="recon"][data-i="2"]');           // 'manual'
  await new Promise(r => setTimeout(r, 150));
  (await present()) ? ok('appears once recon = manual') : bad('recon_rule did not appear when predicate passed');
}

/* ── typing an exact value must survive re-render ─────────────────────────────── */
console.log('\nExact-value entry — multi-digit input is not mangled by re-render');
{
  await page.goto(`${BASE}?domain=banking-fraud&depth=front`, { waitUntil: 'networkidle0' });
  for (const [q, i] of [['volume', 1], ['lag_hrs', 2], ['per_hr', 1], ['block', 0], ['liability', 2]])
    await page.click(`.opt[data-q="${q}"][data-i="${i}"]`);
  await page.type('#x-incidents', '18');
  await page.type('#x-reported', '900000');
  await new Promise(r => setTimeout(r, 200));
  const v = await page.evaluate(() => ({
    incidents: document.getElementById('x-incidents').value,
    reported:  document.getElementById('x-reported').value
  }));
  eq(v.incidents, '18', 'incidents field holds what was typed');
  eq(v.reported, '900000', 'reported field holds what was typed');

  // and the engine must actually see the typed values
  const seen = await page.evaluate(() => window._sid && window._sid.precisionCount);
  seen >= 1 ? ok(`engine registered ${seen} precision input(s)`) : bad('typed exact values never reached the engine');
}

/* ── $/% toggle converts and round-trips in the real page ─────────────────────── */
console.log('\nUnit toggle — converts the figure and round-trips exactly');
{
  await page.goto(`${BASE}?domain=banking-fraud&depth=front`, { waitUntil: 'networkidle0' });
  for (const [q, i] of [['volume', 1], ['lag_hrs', 2], ['per_hr', 1], ['block', 0], ['liability', 2]])
    await page.click(`.opt[data-q="${q}"][data-i="${i}"]`);
  await page.type('#x-reported', '900000');
  await new Promise(r => setTimeout(r, 200));

  // NOTE: page.click() scrolls first, which can slide the target under the sticky header
  // and land the click on the header instead. Centre it the way a reader would, then click.
  const tap = async unit => {
    await page.evaluate(u => {
      const el = document.querySelector(`.ub[data-u="reported"][data-unit="${u}"]`);
      el.scrollIntoView({ block: 'center' }); el.click();
    }, unit);
    await new Promise(r => setTimeout(r, 200));
  };
  const read = () => page.evaluate(() => ({
    v: document.getElementById('x-reported').value,
    d: document.getElementById('der-reported').textContent.trim(),
    t: document.getElementById('total').textContent
  }));

  const start = await read();
  await tap('pct');
  const asPct = await read();
  Number(asPct.v) === 900000 / 2000000000
    ? ok(`$900,000 → ${asPct.v} as a share of volume, showing "${asPct.d}"`)
    : bad(`toggle to % gave ${asPct.v}, expected ${900000 / 2000000000}`);
  asPct.t === start.t ? ok('headline unchanged by the unit switch — same quantity, different unit')
                      : bad(`headline moved on unit switch: ${start.t} → ${asPct.t}`);
  await tap('usd');
  const back = await read();
  Number(back.v) === 900000 ? ok('round-trips back to $900,000 exactly')
                            : bad(`round-trip returned ${back.v}, expected 900000`);
}

await browser.close();
console.log(failed ? `\nFAIL — ${failed} check(s)\n` : '\nPASS — rendering is config-driven and showIf is honoured\n');
process.exit(failed ? 1 : 0);
