// STAGE F — the eval.
//
// Scores every answer-set against an INDEPENDENT expectation, renders each one through the
// real diagnostic page, and writes everything into a fresh per-run folder in windows of ten
// so a run stays readable instead of piling into a wall.
//
// Independence: expectations come from eval/cases.js (hand-written arithmetic, or the frozen
// oracle for loyalty) — never from the domain config being tested.
//
// Usage: node eval/sid_eval.mjs        (needs: node serve.mjs running)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const engine = require('../sid-engine.js');
const { answerSets, CASES, SCOREABLE, TOTAL_GOLDEN, isFittable } = require('./cases.js');
const puppeteer = require('C:/Users/193pu/.claude/skills/gstack/node_modules/puppeteer-core');
const CHROME = 'C:/Users/193pu/.cache/puppeteer/chrome/win64-150.0.7871.24/chrome-win64/chrome.exe';

const CONFIGS = {
  'banking-fraud': require('../domains/banking-fraud.js'),
  'loyalty':       require('../domains/loyalty.js'),
  'enterprise-ai': require('../domains/enterprise-ai.js')
};
// depth at which each domain's answer-sets satisfy the page's ready() check
const DEPTH = { 'banking-fraud': 'front', 'enterprise-ai': 'front', 'loyalty': 'deep' };
const WINDOW = 10;
const TOL = 0.005;                       // 0.5% — covers display rounding, nothing more

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const RUN = path.join(ROOT, 'eval', 'runs', stamp);
const usd = n => '$' + Math.round(n).toLocaleString('en-US');
const pct = n => (n * 100).toFixed(3) + '%';

/* ── invariants every result must satisfy, regardless of expected value ───────── */
function invariants(r, cfg) {
  const bad = [];
  const fin = (v, n) => { if (!Number.isFinite(v)) bad.push(`${n} is ${v}`); };
  fin(r.total, 'total'); fin(r.pct.point, 'pct.point');
  for (const [u, b] of [['usd', r.usd], ['pct', r.pct]]) {
    fin(b.lo, `${u}.lo`); fin(b.hi, `${u}.hi`);
    if (!(b.lo <= b.point + 1e-6)) bad.push(`${u}: lo ${b.lo} > point ${b.point}`);
    if (!(b.point <= b.hi + 1e-6)) bad.push(`${u}: point ${b.point} > hi ${b.hi}`);
  }
  for (const L of cfg.leaks) {
    if (r.leaks[L.id] < 0) bad.push(`${L.id} is negative (${r.leaks[L.id]})`);
    const bl = r.byLeak[L.id];
    if (!(bl.pct.lo <= bl.pct.point + 1e-9 && bl.pct.point <= bl.pct.hi + 1e-9))
      bad.push(`${L.id}: pct band unordered`);
  }
  if (r.rangedTruncated > 0) bad.push(`${r.rangedTruncated} ranged input(s) dropped — band understated`);
  // contingent and unmeasurable carry a figure but must never reach the headline
  const lossSum = cfg.leaks.filter(L => (L.kind || 'loss') === 'loss')
                           .reduce((t, L) => t + r.leaks[L.id], 0);
  if (r.total !== lossSum) bad.push(`total ${r.total} != sum of loss leaks ${lossSum}`);
  // where every leak is a portion of the denominator, the total cannot exceed it
  const allPortions = cfg.leaks.filter(L => (L.kind || 'loss') === 'loss')
                                .every(L => (L.mul || []).some(t => t.ans === cfg.denominator));
  if (allPortions && r.pct.hi > 1.0001) bad.push(`upper bound ${pct(r.pct.hi)} exceeds the denominator`);
  return bad;
}

/* ── drive the REAL page with an answer-set and read back what it displays ────── */
async function render(page, set, shotPath) {
  const url = `http://localhost:3000/sid.html?domain=${set.domain}&depth=${DEPTH[set.domain]}`;
  await page.goto(url, { waitUntil: 'networkidle0' });
  const shown = await page.evaluate(a => {
    for (const k in a) {
      if (k.startsWith('exact_') || k.startsWith('_')) continue;
      if (a['exact_' + k]) exact[k] = { value: a[k], unit: 'usd' };
      else picked[k] = a[k];
    }
    build(); recalc();
    const t = document.getElementById('total');
    return {
      headline: t ? t.textContent : null,
      pctLine: (document.getElementById('totalpct') || {}).textContent || '',
      total: window._sid ? window._sid.total : null,
      leaks: window._sid ? window._sid.leaks : null,
      warn: !document.getElementById('warn').hidden
    };
  }, set.answers);
  await page.evaluate(() => { const s = document.querySelector('.rail-sec'); if (s) s.style.position = 'static'; });
  await new Promise(r => setTimeout(r, 250));
  await page.screenshot({ path: shotPath, fullPage: true });
  return shown;
}

/* ── window board + index, generated then screenshotted ──────────────────────── */
const shell = (title, body) => `<!doctype html><meta charset="utf-8"><title>${title}</title>
<style>
body{background:#E9EDE4;color:#16211C;font:14px/1.6 "Public Sans",system-ui,sans-serif;margin:0;padding:28px}
h1{font:600 22px "Zilla Slab",Georgia,serif;margin:0 0 4px}
.sub{color:#5A6560;font-size:13px;margin-bottom:18px}
table{border-collapse:collapse;width:100%;background:#F6F8F3}
th,td{border:1px solid rgba(22,33,28,.16);padding:7px 9px;text-align:left;font-size:12.5px}
th{background:#DCE3D4;font:600 11px "IBM Plex Mono",monospace;letter-spacing:.08em;text-transform:uppercase}
td.n{font-family:"IBM Plex Mono",monospace;font-variant-numeric:tabular-nums;text-align:right}
tr.fail td{background:#A32C221a}
.ok{color:#2F5D50;font-weight:600}.no{color:#A32C22;font-weight:600}
</style>${body}`;

async function board(page, file, html) {
  fs.writeFileSync(file + '.html', html);
  await page.goto('file:///' + file.replace(/\\/g, '/') + '.html', { waitUntil: 'networkidle0' });
  await page.screenshot({ path: file + '.png', fullPage: true });
}

/* ── run ─────────────────────────────────────────────────────────────────────── */
const sets = answerSets();
fs.mkdirSync(path.join(RUN, 'failures'), { recursive: true });
console.log(`\nrun ${stamp} — ${sets.length} answer-sets, ${CASES.length} cases, windows of ${WINDOW}\n`);

const browser = await puppeteer.launch({ executablePath: CHROME });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });

const rows = [];
for (let w = 0; w * WINDOW < sets.length; w++) {
  const wid = 'w' + String(w + 1).padStart(2, '0');
  const dir = path.join(RUN, wid);
  fs.mkdirSync(dir, { recursive: true });
  const slice = sets.slice(w * WINDOW, (w + 1) * WINDOW);
  console.log(`${wid}`);

  for (let i = 0; i < slice.length; i++) {
    const s = slice[i];
    const cfg = CONFIGS[s.domain];
    const name = `case-${String(i + 1).padStart(2, '0')}-${s.caseId}-${s.label}`;
    const shot = path.join(dir, name + '.png');

    const r = engine.compute(cfg, s.answers);
    const want = s.expect(s.answers);
    const got = r.leaks[s.leak];
    const relErr = want === 0 ? Math.abs(got) : Math.abs(got - want) / Math.abs(want);
    const inv = invariants(r, cfg);

    let shown = null, renderErr = null;
    try { shown = await render(page, s, shot); }
    catch (e) { renderErr = e.message.split('\n')[0]; }

    const problems = [...inv];
    if (relErr > TOL) problems.push(`expected ${usd(want)}, engine gave ${usd(got)}`);
    if (renderErr) problems.push(`render failed: ${renderErr}`);
    else if (shown && shown.total !== r.total) problems.push(`page shows total ${usd(shown.total)}, engine ${usd(r.total)}`);
    else if (!fs.existsSync(shot)) problems.push('no screenshot written');

    const pass = problems.length === 0;
    if (!pass && fs.existsSync(shot)) fs.copyFileSync(shot, path.join(RUN, 'failures', name + '.png'));

    rows.push({ window: wid, case: s.caseId, split: s.split, domain: s.domain, leak: s.leak,
                label: s.label, want, got, relErr, pctOfDenom: r.byLeak[s.leak].pct.point,
                pass, problems, shot: path.relative(RUN, shot) });
    console.log(`  ${pass ? '✓' : '✗'} ${s.caseId}/${s.label}  ${usd(got)}  ${pass ? '' : '— ' + problems[0]}`);
  }

  const wr = rows.filter(r => r.window === wid);
  await board(page, path.join(dir, 'board'), shell(`${wid} — SID eval`, `
    <h1>${wid} · ${wr.filter(r => r.pass).length}/${wr.length} pass</h1>
    <div class="sub">run ${stamp} · expectations are independent of the config under test</div>
    <table><tr><th>case</th><th>split</th><th>domain</th><th>leak</th><th>variant</th>
    <th>expected</th><th>engine</th><th>err</th><th>% of denom</th><th>result</th></tr>
    ${wr.map(r => `<tr class="${r.pass ? '' : 'fail'}"><td>${r.case}</td><td>${r.split}</td><td>${r.domain}</td>
      <td>${r.leak}</td><td>${r.label}</td><td class="n">${usd(r.want)}</td><td class="n">${usd(r.got)}</td>
      <td class="n">${(r.relErr * 100).toFixed(2)}%</td><td class="n">${pct(r.pctOfDenom)}</td>
      <td class="${r.pass ? 'ok' : 'no'}">${r.pass ? 'PASS' : r.problems.join('; ')}</td></tr>`).join('')}
    </table>`));
}

/* ── split-aware summary, with n stated honestly ─────────────────────────────── */
const seedRows = rows.filter(r => r.split === 'seed');
const holdRows = rows.filter(r => r.split === 'holdout');
const nCases = s => new Set(rows.filter(r => r.split === s).map(r => r.case)).size;
const summary = {
  ranAt: new Date().toISOString(), run: stamp,
  answerSets: rows.length, cases: CASES.length,
  coverage: { scoreable: SCOREABLE, totalGolden: TOTAL_GOLDEN },
  heldOutFittable: CASES.filter(c => c.split === 'holdout' && c.fittable).map(c => c.id),
  v0_seed:   { cases: nCases('seed'),    answerSets: seedRows.length, pass: seedRows.filter(r => r.pass).length },
  v2_holdout:{ cases: nCases('holdout'), answerSets: holdRows.length, pass: holdRows.filter(r => r.pass).length },
  failures: rows.filter(r => !r.pass).map(r => ({ case: r.case, label: r.label, problems: r.problems }))
};
fs.writeFileSync(path.join(RUN, 'results.json'), JSON.stringify(summary, null, 2));

const HEADLINE_MIN_CASES = 5;
const heldFittable = summary.heldOutFittable;
const md = `# SID eval — ${stamp}

${rows.filter(r => r.pass).length}/${rows.length} answer-sets pass, across ${CASES.length} cases.

## What each number is allowed to claim

- **v0 (seed, fittable)** — ${summary.v0_seed.pass}/${summary.v0_seed.answerSets} across ${summary.v0_seed.cases} cases.
  These leaks contain a rate constant chosen by judgment, so they *could* have been tuned to
  pass. **Consistency check, not a generalization claim.**
- **v2 (held out, unfittable)** — ${summary.v2_holdout.pass}/${summary.v2_holdout.answerSets} across ${summary.v2_holdout.cases} cases.
  ${summary.v2_holdout.cases >= HEADLINE_MIN_CASES
    ? `Meets the ${HEADLINE_MIN_CASES}-case floor.`
    : `**No headline claim** — n = ${summary.v2_holdout.cases}, below the ${HEADLINE_MIN_CASES}-case floor.`}

## Why the held-out set is legitimate

A leak is *fittable* when it contains a rate constant chosen by judgment — that is the only
thing tunable. A leak whose factors are all answers has **zero degrees of freedom**: its rule
pre-exists in the golden dataset and the config is a transcription, so reading it while
authoring cannot fit anything to it. The split is computed from the configs, not declared.

${heldFittable.length === 0
  ? '**Verified: no held-out case contains a tunable rate constant.**'
  : `**BROKEN — these held-out cases are fittable: ${heldFittable.join(', ')}**`}

Literals marked \`fixed\` (250 working days) are arithmetic facts, not judgments, and do not
make a leak fittable.

**What this actually measures:** implementation fidelity on unfittable specifications. Stronger
than consistency, still weaker than predicting real client outcomes — which only the
precision-floor loop fed by post-call debriefs can do.

## Coverage

All **${SCOREABLE} of ${TOTAL_GOLDEN}** golden cases are scored. Two carry a dollar figure but are
deliberately excluded from the headline total:

- **C15 (contingent)** — concentration *exposure* if a shared dependency fails. No
  vendor-failure probability is invented, so it is not an expected annual loss.
- **C16 (unmeasurable)** — spend whose true return is unknowable. Unmeasured shadow use makes
  the official number wrong in a direction nobody can determine; calling it a loss would be a guess.

Adding either to the headline would inflate it by category error.

## Independence

Expected values come from hand-written arithmetic in \`eval/cases.js\`, or for loyalty from
\`tools/_frozen-recalculate.js\`, which predates the config entirely. No expectation is read
from the domain config under test.

## Failures

${summary.failures.length === 0 ? 'None.' : summary.failures.map(f => `- **${f.case}/${f.label}** — ${f.problems.join('; ')}`).join(String.fromCharCode(10))}
`;
fs.writeFileSync(path.join(RUN, 'results.md'), md);

await board(page, path.join(RUN, 'index'), shell(`SID eval ${stamp}`, `
  <h1>SID eval · ${rows.filter(r => r.pass).length}/${rows.length} pass</h1>
  <div class="sub">run ${stamp} · ${CASES.length} cases · windows of ${WINDOW}</div>
  <table><tr><th>window</th><th>answer-sets</th><th>pass</th><th>fail</th></tr>
  ${[...new Set(rows.map(r => r.window))].map(w => {
    const wr = rows.filter(r => r.window === w);
    return `<tr class="${wr.every(r => r.pass) ? '' : 'fail'}"><td>${w}</td><td class="n">${wr.length}</td>
      <td class="n ok">${wr.filter(r => r.pass).length}</td><td class="n no">${wr.filter(r => !r.pass).length}</td></tr>`;
  }).join('')}
  </table>
  <div class="sub" style="margin-top:18px">v0 seed ${summary.v0_seed.pass}/${summary.v0_seed.answerSets}
  (${summary.v0_seed.cases} cases) · v2 held-out ${summary.v2_holdout.pass}/${summary.v2_holdout.answerSets}
  (${summary.v2_holdout.cases} cases) · coverage ${SCOREABLE}/${TOTAL_GOLDEN} golden cases scored</div>`));

await browser.close();
const failed = rows.filter(r => !r.pass).length;
console.log(`\n${rows.length - failed}/${rows.length} pass · artifacts in eval/runs/${stamp}`);
if (failed) console.log(`${failed} failing — see failures/ and results.md\n`);
process.exit(failed ? 1 : 0);
