// J5 — live verification against the deployed Vercel URL, not localhost.
// Round 1: every page loads clean. Every front door fills and matches the engine.
// One deep flow end-to-end. Mobile viewport. Mailto correctness. Sample report renders.
//
// Usage: node tools/verify-live.mjs <base-url>
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/193pu/.claude/skills/gstack/node_modules/puppeteer-core');
const CHROME = 'C:/Users/193pu/.cache/puppeteer/chrome/win64-150.0.7871.24/chrome-win64/chrome.exe';
const engine = require('../sid-engine.js');
const CONFIGS = {
  'banking-fraud': require('../domains/banking-fraud.js'),
  'enterprise-ai': require('../domains/enterprise-ai.js'),
  'loyalty':       require('../domains/loyalty.js')
};

const BASE = process.argv[2];
if (!BASE) { console.error('usage: node tools/verify-live.mjs <base-url>'); process.exit(2); }

const STAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const OUT = path.join(process.cwd(), '.tmp', 'live-verify', STAMP);
fs.mkdirSync(OUT, { recursive: true });

let failed = 0;
const log = [];
const ok  = m => { log.push(`PASS  ${m}`); console.log(`  ✓ ${m}`); };
const bad = m => { failed++; log.push(`FAIL  ${m}`); console.log(`  ✗ ${m}`); };

const SCENARIOS = {
  'banking-fraud': { volume: 2000000000, lag_hrs: 168, per_hr: 2500, block: 1.0, liability: 1.0 },
  'enterprise-ai': { spend: 20000000, baseline: 1.00, measure: 0.60, alloc: 0.60, shadow: 'unknown' },
  'loyalty':       { revenue: '12500000', markets: '3', data_migration: 'messy', data_quality: '3',
                     multi_currency: 'manual', fraud_detection: 'none', abuse_types: 'multiple',
                     fraud_threshold: '3', roi_subtract_fraud: 'no', last_audit: 'never',
                     roi_confidence: '4', knowledge_sharing: 'none', cascading: 'never', market_maturity: '4' }
};
// index-of-option-value per domain, in question order, for clicking front-door options
const PICKS = {
  'banking-fraud': [['volume', 2000000000], ['lag_hrs', 168], ['per_hr', 2500], ['block', 1.0], ['liability', 1.0]],
  'enterprise-ai': [['spend', 20000000], ['baseline', 1.00], ['measure', 0.60], ['alloc', 0.60], ['shadow', 'unknown']],
  'loyalty': [['revenue', '12500000'], ['markets', '3'], ['data_migration', 'messy'],
              ['fraud_detection', 'none'], ['roi_subtract_fraud', 'no']]
};

async function freshPage(browser, viewport) {
  const page = await browser.newPage();
  await page.setViewport(viewport || { width: 1440, height: 900 });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message.split('\n')[0]));
  page.on('requestfailed', r => errs.push(`request failed: ${r.url()} (${r.failure()?.errorText})`));
  return { page, errs };
}

async function clickByValue(page, qid, val) {
  return page.evaluate((qid, val) => {
    const btns = [...document.querySelectorAll(`.opt[data-q="${qid}"]`)];
    for (const b of btns) {
      const i = +b.dataset.i;
      const q = window.CFG ? window.CFG.questions.find(x => x.id === qid) : null;
      if (q && q.options[i] && String(q.options[i].v) === String(val)) { b.click(); return true; }
    }
    return false;
  }, qid, val);
}

console.log(`\nLive verification round — ${BASE}\nartifacts: ${OUT}\n`);
const browser = await puppeteer.launch({ executablePath: CHROME });

/* ── 1. every page loads, zero console errors ─────────────────────────────── */
console.log('1 — page load + console cleanliness');
const PAGES = ['index.html',
  'sid.html?domain=banking-fraud&depth=front', 'sid.html?domain=banking-fraud&depth=deep',
  'sid.html?domain=enterprise-ai&depth=front', 'sid.html?domain=enterprise-ai&depth=deep',
  'sid.html?domain=loyalty&depth=front', 'sid.html?domain=loyalty&depth=deep',
  'sample-report.html'];
for (const p of PAGES) {
  const { page, errs } = await freshPage(browser);
  const t0 = Date.now();
  let httpOk = true;
  page.on('response', r => { if (r.url() === `${BASE}/${p.split('?')[0]}` && !r.ok()) httpOk = false; });
  await page.goto(`${BASE}/${p}`, { waitUntil: 'networkidle0', timeout: 30000 });
  const ms = Date.now() - t0;
  const shotName = p.replace(/[?&=]/g, '_') + '.png';
  await page.screenshot({ path: path.join(OUT, '1-load-' + shotName), fullPage: true });
  await page.close();
  (httpOk && errs.length === 0) ? ok(`${p} loaded clean (${ms}ms)`) : bad(`${p}: ${errs.join('; ') || 'bad http'}`);
}

/* ── 2. front doors: fill all 5, headline must match the engine ─────────────── */
console.log('\n2 — front-door math matches the engine, live');
for (const domain of Object.keys(SCENARIOS)) {
  const { page, errs } = await freshPage(browser);
  await page.goto(`${BASE}/sid.html?domain=${domain}&depth=front`, { waitUntil: 'networkidle0' });
  for (const [qid, val] of PICKS[domain]) {
    const clicked = await clickByValue(page, qid, val);
    if (!clicked) bad(`${domain}: could not click option ${qid}=${val} (selector/value mismatch live)`);
  }
  await new Promise(r => setTimeout(r, 300));
  const liveTotal = await page.evaluate(() => window._sid ? window._sid.total : null);
  // Expected value must be computed from ONLY the answers the front door actually collects
  // (PICKS), never the full deep scenario — the front door leaves deep-only fields at their
  // engine default by design, so comparing against a fully-answered scenario is the wrong
  // oracle and reports a false mismatch on any domain whose front door asks fewer than all
  // its questions (loyalty: 5 of 14).
  const frontAnswers = Object.fromEntries(PICKS[domain]);
  const wantTotal = engine.compute(CONFIGS[domain], frontAnswers).total;
  await page.screenshot({ path: path.join(OUT, `2-frontdoor-${domain}.png`), fullPage: true });
  await page.close();
  if (errs.length) bad(`${domain} front door: console errors ${errs.join('; ')}`);
  liveTotal === wantTotal
    ? ok(`${domain} front door: live total ${liveTotal.toLocaleString()} == engine ${wantTotal.toLocaleString()}`)
    : bad(`${domain} front door: live total ${liveTotal} != engine ${wantTotal}`);
}

/* ── 3. full deep flow, end to end — ALL THREE DOMAINS ───────────────────────── */
console.log('\n3 — full deep diagnostic end-to-end (all 3 domains)');
const EXPECTED_LEAKS = { 'banking-fraud': 6, 'enterprise-ai': 8, 'loyalty': 4 };
for (const domain of Object.keys(SCENARIOS)) {
  const { page, errs } = await freshPage(browser);
  await page.goto(`${BASE}/sid.html?domain=${domain}&depth=deep`, { waitUntil: 'networkidle0' });
  // click every visible option's first choice, rebuilding after each pass to catch showIf reveals.
  // 5 passes (not 3): a showIf chain (e.g. recon -> recon_rule) needs one pass per hop to
  // fully converge, and this round must prove convergence, not just run some clicks.
  let rowCounts = [];
  for (let pass = 0; pass < 5; pass++) {
    const qs = await page.$$eval('.opt', els => [...new Set(els.map(e => e.dataset.q))]);
    for (const q of qs) {
      const sel = `.opt[data-q="${q}"][data-i="0"]`;
      if (await page.$(sel)) await page.click(sel);
    }
    await new Promise(r => setTimeout(r, 150));
    rowCounts.push(await page.$$eval('.row', els => els.length));
  }
  const converged = rowCounts[3] === rowCounts[4];
  await new Promise(r => setTimeout(r, 300));
  const state = await page.evaluate(() => ({
    total: window._sid ? window._sid.total : null,
    rows: document.querySelectorAll('.row').length,
    leaks: document.querySelectorAll('.leak').length,
    ctaVisible: !document.getElementById('cta').hidden
  }));
  await page.screenshot({ path: path.join(OUT, `3-deep-e2e-${domain}.png`), fullPage: true });
  await page.close();
  errs.length === 0 ? ok(`${domain} deep flow: no console errors`) : bad(`${domain} deep flow errors: ${errs.join('; ')}`);
  converged ? ok(`${domain} deep flow: row count converged at ${rowCounts[4]} across 5 passes`)
            : bad(`${domain} deep flow: row count still changing (${rowCounts.join('→')}) — showIf not settling`);
  Number.isFinite(state.total) ? ok(`${domain} deep flow: computed total ${state.total.toLocaleString()}`) : bad(`${domain} deep flow: no total computed`);
  state.leaks === EXPECTED_LEAKS[domain]
    ? ok(`${domain} deep flow: all ${state.leaks} leak lines rendered`)
    : bad(`${domain} deep flow: ${state.leaks} leak lines, expected ${EXPECTED_LEAKS[domain]}`);
  state.ctaVisible ? ok(`${domain} deep flow: lead-capture CTA visible`) : bad(`${domain} deep flow: CTA never appeared`);
}

/* ── 4. mobile viewport ───────────────────────────────────────────────────────── */
console.log('\n4 — mobile viewport (390x844)');
for (const domain of ['banking-fraud']) {
  const { page, errs } = await freshPage(browser, { width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 });
  await page.goto(`${BASE}/sid.html?domain=${domain}&depth=front`, { waitUntil: 'networkidle0' });
  for (const [qid, val] of PICKS[domain]) await clickByValue(page, qid, val);
  await new Promise(r => setTimeout(r, 300));
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
  await page.screenshot({ path: path.join(OUT, `4-mobile-${domain}.png`), fullPage: true });
  await page.close();
  errs.length === 0 ? ok(`mobile ${domain}: no console errors`) : bad(`mobile ${domain}: ${errs.join('; ')}`);
  !overflow ? ok(`mobile ${domain}: no horizontal overflow`) : bad(`mobile ${domain}: horizontal scroll present`);
}

/* ── 5. mailto correctness ───────────────────────────────────────────────────── */
console.log('\n5 — mailto lead capture');
{
  const { page, errs } = await freshPage(browser);
  await page.goto(`${BASE}/sid.html?domain=banking-fraud&depth=front`, { waitUntil: 'networkidle0' });
  for (const [qid, val] of PICKS['banking-fraud']) await clickByValue(page, qid, val);
  await new Promise(r => setTimeout(r, 300));
  const href = await page.evaluate(() => { const a = document.getElementById('mail'); return a ? a.getAttribute('href') : null; });
  await page.close();
  href && href.startsWith('mailto:193purushottam@gmail.com') ? ok('mailto targets 193purushottam@gmail.com')
    : bad(`mailto href wrong or missing: ${href}`);
  href && /body=/.test(href) && decodeURIComponent(href).includes('$') ? ok('mailto body carries computed figures')
    : bad('mailto body missing computed figures');
}

/* ── 6. showIf branching, both directions, live ──────────────────────────────── */
console.log('\n6 — showIf branching live, both hidden and revealed');
const SHOWIF_CASES = [
  { domain: 'banking-fraud', depth: 'deep', gate: 'recon', dependent: 'recon_rule',
    hideVal: 'auto', showVal: 'manual', base: {} },
  { domain: 'banking-fraud', depth: 'deep', gate: 'vendor', dependent: 'vendor_plan',
    hideVal: 'few', showVal: 'most', base: {} },
  { domain: 'enterprise-ai', depth: 'deep', gate: 'kill', dependent: 'kill_why',
    hideVal: 'stop', showVal: 'drift', base: {} },
  { domain: 'loyalty', depth: 'deep', gate: 'markets', dependent: 'knowledge_sharing',
    hideVal: '1', showVal: '3', base: {} }
];
for (const c of SHOWIF_CASES) {
  const { page, errs } = await freshPage(browser);
  await page.goto(`${BASE}/sid.html?domain=${c.domain}&depth=${c.depth}`, { waitUntil: 'networkidle0' });
  const rowPresent = async id => page.$$eval('.row', (els, id) => els.some(e => e.dataset.q === id), id);

  const hidClicked = await clickByValue(page, c.gate, c.hideVal);
  await new Promise(r => setTimeout(r, 250));
  const hiddenState = await rowPresent(c.dependent);

  const showClicked = await clickByValue(page, c.gate, c.showVal);
  await new Promise(r => setTimeout(r, 250));
  const shownState = await rowPresent(c.dependent);
  await page.close();

  const tag = `${c.domain}/${c.dependent}`;
  (hidClicked && showClicked) ? ok(`${tag}: both gate options clickable`) : bad(`${tag}: could not click gate option live`);
  !hiddenState ? ok(`${tag}: hidden when ${c.gate}=${c.hideVal}`) : bad(`${tag}: WRONGLY VISIBLE when ${c.gate}=${c.hideVal}`);
  shownState ? ok(`${tag}: revealed when ${c.gate}=${c.showVal}`) : bad(`${tag}: did not appear when ${c.gate}=${c.showVal}`);
  errs.length === 0 ? ok(`${tag}: no console errors`) : bad(`${tag}: ${errs.join('; ')}`);
}

/* ── 7. exact-value $/% toggle, live, full round-trip ───────────────────────── */
console.log('\n7 — exact-value $/% toggle, live round-trip');
{
  const { page, errs } = await freshPage(browser);
  await page.goto(`${BASE}/sid.html?domain=banking-fraud&depth=front`, { waitUntil: 'networkidle0' });
  for (const [qid, val] of PICKS['banking-fraud']) await clickByValue(page, qid, val);
  await new Promise(r => setTimeout(r, 200));

  const typeInto = async (sel, val) => { await page.click(sel); await page.type(sel, String(val)); };
  await typeInto('#x-reported', '900000');
  await new Promise(r => setTimeout(r, 200));
  const beforeTier = await page.evaluate(() => document.getElementById('tier-l').textContent);
  const dollarVal = await page.evaluate(() => document.getElementById('x-reported').value);

  // scrollIntoView before click: page.click() alone can leave the button under the sticky
  // header, a known issue surfaced during Stage G/E build (see check-render.mjs)
  const toggled = await page.evaluate(() => {
    const btn = document.querySelector('.ub[data-u="reported"][data-unit="pct"]');
    if (!btn) return false;
    btn.scrollIntoView({ block: 'center' }); btn.click(); return true;
  });
  await new Promise(r => setTimeout(r, 250));
  const pctVal = await page.evaluate(() => document.getElementById('x-reported').value);

  const backToggled = await page.evaluate(() => {
    const btn = document.querySelector('.ub[data-u="reported"][data-unit="usd"]');
    if (!btn) return false;
    btn.scrollIntoView({ block: 'center' }); btn.click(); return true;
  });
  await new Promise(r => setTimeout(r, 250));
  const roundTripVal = await page.evaluate(() => document.getElementById('x-reported').value);
  await page.screenshot({ path: path.join(OUT, '7-toggle-roundtrip.png'), fullPage: true });
  await page.close();

  errs.length === 0 ? ok('toggle test: no console errors') : bad(`toggle test errors: ${errs.join('; ')}`);
  toggled ? ok('toggle: $ -> % button clicked') : bad('toggle: % button not found/clickable');
  (toggled && Number(pctVal) > 0 && Number(pctVal) < 1) ? ok(`toggle: converted to fraction ${pctVal} (of volume)`)
    : bad(`toggle: expected a small fraction, got "${pctVal}"`);
  backToggled ? ok('toggle: % -> $ button clicked') : bad('toggle: $ button not found/clickable');
  Number(roundTripVal) === Number(dollarVal)
    ? ok(`toggle: round-trip exact ($${dollarVal} -> ... -> $${roundTripVal})`)
    : bad(`toggle: round-trip drifted ($${dollarVal} -> $${roundTripVal})`);
}

/* ── 8. plausibility banner, live, firing + non-firing, all domains ──────────── */
console.log('\n8 — plausibility banner live (fire + no-fire), all domains');
const PLAUS = [
  { domain: 'banking-fraud', depth: 'front', label: 'edge-case extreme',
    picks: [['volume', 250000000], ['lag_hrs', 720], ['per_hr', 35000], ['block', 1.0], ['liability', 1.0]],
    expectFire: true },
  { domain: 'banking-fraud', depth: 'front', label: 'ordinary',
    picks: PICKS['banking-fraud'], expectFire: false },
  // loyalty's front door only asks 5 of 14 fields (the rest default), so a front-door-only
  // scenario cannot reach the 17.87% true ceiling verified above (max with all 5 front
  // fields worsened is 13.37%, under the 15% threshold) — the FIRE case must use deep depth
  // with every field pushed to its worst value, confirmed by direct engine computation first
  { domain: 'loyalty', depth: 'deep', label: 'worst-case saturation',
    picks: [['revenue', '500000'], ['markets', '15'], ['data_migration', 'messy'], ['data_quality', 1],
            ['multi_currency', 'issues'], ['fraud_detection', 'unknown'], ['abuse_types', 'multiple'],
            ['fraud_threshold', 1], ['roi_subtract_fraud', 'no'], ['last_audit', 'never'],
            ['roi_confidence', 1], ['knowledge_sharing', 'none'], ['cascading', 'never'], ['market_maturity', 1]],
    expectFire: true },
  { domain: 'loyalty', depth: 'front', label: 'ordinary',
    picks: PICKS['loyalty'], expectFire: false }
];
for (const c of PLAUS) {
  const { page, errs } = await freshPage(browser);
  await page.goto(`${BASE}/sid.html?domain=${c.domain}&depth=${c.depth}`, { waitUntil: 'networkidle0' });
  for (const [qid, val] of c.picks) {
    const clicked = await clickByValue(page, qid, val);
    if (!clicked) {
      // slider-type questions (data_quality, fraud_threshold, roi_confidence, market_maturity)
      // are not .opt buttons; set them via their range input directly
      await page.evaluate((qid, val) => {
        const inp = document.querySelector(`input[data-s="${qid}"]`);
        if (inp) { inp.value = val; inp.dispatchEvent(new Event('input', { bubbles: true })); }
      }, qid, val);
    }
  }
  await new Promise(r => setTimeout(r, 300));
  const state = await page.evaluate(() => ({
    warnHidden: document.getElementById('warn').hidden,
    warnText: document.getElementById('warn').textContent,
    total: window._sid ? window._sid.total : null,
    // sum only LOSS-kind leaks — contingent/unmeasurable are correctly excluded from `total`
    // by design (Stage H2), so summing every leak id here compared apples to oranges
    lossSum: window._sid ? Object.entries(window._sid.leaks)
      .filter(([id]) => (window._sid.kinds[id] || 'loss') === 'loss')
      .reduce((a, [, v]) => a + v, 0) : null,
    pctPoint: window._sid ? window._sid.pct.point : null
  }));
  await page.screenshot({ path: path.join(OUT, `8-plaus-${c.domain}-${c.label.replace(/\s+/g, '_')}.png`), fullPage: true });
  await page.close();
  const tag = `${c.domain}/${c.label}`;
  errs.length === 0 ? ok(`${tag}: no console errors`) : bad(`${tag}: ${errs.join('; ')}`);
  const fired = !state.warnHidden;
  fired === c.expectFire
    ? ok(`${tag}: banner ${c.expectFire ? 'fired' : 'silent'} as expected (${(state.pctPoint * 100).toFixed(2)}%)` + (fired ? ` — "${state.warnText.slice(0, 60)}..."` : ''))
    : bad(`${tag}: banner ${fired ? 'fired' : 'silent'} at ${(state.pctPoint * 100).toFixed(2)}%, expected ${c.expectFire ? 'fire' : 'silent'}`);
  state.total === state.lossSum
    ? ok(`${tag}: total unaltered by banner (equals sum of LOSS leaks, contingent/unmeasurable correctly excluded)`)
    : bad(`${tag}: total ${state.total} != loss-leak sum ${state.lossSum} — banner may be clamping`);
}

/* ── 9. session isolation across sequential domain loads in one tab ──────────── */
console.log('\n9 — session isolation across sequential domain loads');
{
  const { page, errs } = await freshPage(browser);
  const seq = ['banking-fraud', 'enterprise-ai', 'loyalty'];
  let bleed = false, details = [];
  for (const domain of seq) {
    await page.goto(`${BASE}/sid.html?domain=${domain}&depth=front`, { waitUntil: 'networkidle0' });
    const pressedCount = await page.$$eval('.opt[aria-pressed="true"]', els => els.length);
    const totalAtLoad = await page.evaluate(() => document.getElementById('total').textContent);
    details.push(`${domain}: ${pressedCount} pre-selected, total="${totalAtLoad}"`);
    if (pressedCount !== 0 || totalAtLoad !== '—') bleed = true;
    for (const [qid, val] of PICKS[domain]) await clickByValue(page, qid, val);
    await new Promise(r => setTimeout(r, 150));
  }
  await page.close();
  errs.length === 0 ? ok('session isolation: no console errors across 3 sequential loads') : bad(`session isolation errors: ${errs.join('; ')}`);
  !bleed ? ok(`session isolation: each domain loaded empty (${details.join(' | ')})`)
         : bad(`session isolation: state bled across loads (${details.join(' | ')})`);
}

await browser.close();
fs.writeFileSync(path.join(OUT, 'results.md'),
  `# Live verification — ${BASE}\n${STAMP}\n\n${log.filter(l => l.startsWith('FAIL')).length} failing / ${log.length} checks\n\n` +
  log.map(l => '- ' + l).join('\n') + '\n');
console.log(`\n${failed === 0 ? 'ALL CHECKS PASS' : `${failed} FAILING`} — artifacts + results.md in ${OUT}\n`);
process.exit(failed ? 1 : 0);
