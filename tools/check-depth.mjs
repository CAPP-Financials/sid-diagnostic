// STAGE D GATE — one config, two depths, consistent numbers.
//
// The claim being tested: the front door is the deep report with defaults substituted, NOT
// a reduced version that hides leak paths. Two properties:
//   1. IDENTITY   — with deep-only drivers left at their stated defaults, front total ==
//                   deep total, exactly. If deep introduced leaks the front door omits,
//                   the free estimate would be systematically understating exposure.
//   2. CONTAINMENT— across the full range of deep-only drivers, the DEEP total falls inside
//                   the FRONT DOOR's published band. Direction matters: the front door is the
//                   one making a claim under uncertainty, so its range must cover the answer
//                   you get with real data. (Asserting the reverse is wrong — a deep report
//                   with every input exact has a narrow band that a defaulted front-door
//                   guess can legitimately sit outside.)
//
// Usage: node tools/check-depth.mjs   (browser leg needs: node serve.mjs running)
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const engine  = require('../sid-engine.js');
const banking = require('../domains/banking-fraud.js');
const puppeteer = require('C:/Users/193pu/.claude/skills/gstack/node_modules/puppeteer-core');
const CHROME = 'C:/Users/193pu/.cache/puppeteer/chrome/win64-150.0.7871.24/chrome-win64/chrome.exe';

let failed = 0;
const ok  = m => console.log(`  ✓ ${m}`);
const bad = m => { failed++; console.log(`  ✗ ${m}`); };
const usd = n => '$' + Math.round(n).toLocaleString('en-US');

// deep-only questions and the default the front door falls back to
const DEEP_DEFAULTS = { decline_rate: 12 };

const SCENARIOS = [
  { name: 'mid',     a: { volume: 2000000000,  lag_hrs: 168,  per_hr: 2500,  block: 1.0,  liability: 1.0 } },
  { name: 'severe',  a: { volume: 12000000000, lag_hrs: 720,  per_hr: 35000, block: 1.0,  liability: 1.0 } },
  { name: 'healthy', a: { volume: 250000000,   lag_hrs: 0.25, per_hr: 400,   block: 0.15, liability: 0.1 } },
  { name: 'refined', a: { volume: 3100000000,  lag_hrs: 24,   per_hr: 4200,  block: 0.35, liability: 0.5,
                          incidents: 9, exact_volume: 1, exact_per_hr: 1, exact_incidents: 1 } }
];

console.log('\nStage D.1 — identity: deep at defaults equals front exactly');
for (const s of SCENARIOS) {
  const front = engine.compute(banking, s.a);
  const deep  = engine.compute(banking, { ...s.a, ...DEEP_DEFAULTS });
  front.total === deep.total
    ? ok(`${s.name}: front ${usd(front.total)} == deep-at-defaults`)
    : bad(`${s.name}: front ${usd(front.total)} != deep ${usd(deep.total)} — deep introduces a leak the front door hides`);
}

console.log('\nStage D.2 — containment: the deep answer stays inside the front door\'s published band');
const q = banking.questions.find(x => x.id === 'decline_rate');
for (const s of SCENARIOS) {
  const front = engine.compute(banking, s.a);
  let worst = null;
  for (let dr = q.min; dr <= q.max; dr++) {
    const deep = engine.compute(banking, { ...s.a, decline_rate: dr });
    if (deep.total < front.lo || deep.total > front.hi) { worst = { dr, deep: deep.total }; break; }
  }
  worst
    ? bad(`${s.name}: at decline_rate=${worst.dr} deep ${usd(worst.deep)} escapes the front band ${usd(front.lo)}–${usd(front.hi)}`)
    : ok(`${s.name}: front band ${usd(front.lo)}–${usd(front.hi)} covers every deep outcome`);
}

console.log('\nStage D.3 — the SHIPPED artifacts agree with the engine');
{
  const browser = await puppeteer.launch({ executablePath: CHROME });
  const page = await browser.newPage();
  const read = async (file, picks) => {
    await page.goto(`http://localhost:3000/dist/${file}`, { waitUntil: 'networkidle0' });
    for (const [q, i] of picks) await page.click(`.opt[data-q="${q}"][data-i="${i}"]`);
    await new Promise(r => setTimeout(r, 250));
    return page.evaluate(() => window._sid ? window._sid.total : null);
  };
  // same five front answers in both artifacts; deep's extra questions left unanswered
  const picks = [['volume', 1], ['lag_hrs', 2], ['per_hr', 1], ['block', 0], ['liability', 2]];
  const frontTotal = await read('banking-fraud-front.html', picks);
  const expected = engine.compute(banking, { volume: 2000000000, lag_hrs: 168, per_hr: 2500, block: 1.0, liability: 1.0 }).total;

  frontTotal === expected
    ? ok(`shipped front door total ${usd(frontTotal)} matches the engine exactly`)
    : bad(`shipped front door ${usd(frontTotal)} != engine ${usd(expected)}`);

  const hasMail = await page.evaluate(() => {
    const a = document.getElementById('mail');
    return !!(a && a.getAttribute('href') || '').toString().startsWith('mailto:');
  });
  hasMail ? ok('lead capture present in the shipped artifact') : bad('mailto lead capture missing from shipped artifact');
  await browser.close();
}

console.log(failed ? `\nFAIL — ${failed} check(s)\n` : '\nPASS — one config drives both depths consistently\n');
process.exit(failed ? 1 : 0);
