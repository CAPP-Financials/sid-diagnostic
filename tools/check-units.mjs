// STAGE G GATE — dual-unit reporting is correct, and the band is a true interval.
//
// The load-bearing claim: a leak whose every term is linear in the denominator has a
// percentage that does NOT depend on the denominator estimate. If that is false, the whole
// dual-unit idea collapses back to a presentation trick. Asserted directly, not trusted.
//
// Usage: node tools/check-units.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const engine  = require('../sid-engine.js');
const banking = require('../domains/banking-fraud.js');
const loyalty = require('../domains/loyalty.js');

let failed = 0, scFailed = 0;
const ok  = m => console.log(`  ✓ ${m}`);
const bad = m => { failed++; scFailed++; console.log(`  ✗ ${m}`); };
const EPS = engine.EPS;

const termsOf = L => [].concat(L.mul || [], L.minus || []);
// a leak is denominator-linear when every product arm contains exactly one denominator term
const isDenomLinear = (L, d) =>
  (L.mul || []).filter(t => t.ans === d).length === 1 &&
  (!L.minus || (L.minus || []).filter(t => t.ans === d).length === 1);
const hasNoDenom = (L, d) => termsOf(L).every(t => t.ans !== d);

/* ── 1. cancellation ─────────────────────────────────────────────────────────── */
console.log('\nG.1 — denominator cancellation (only the denominator ranged)');
{
  // pin every other ranged driver so the denominator is the sole source of spread
  // Stage H added ranged drivers; every one must be pinned or the denominator is not the
  // sole source of spread and the cancellation assertion means nothing
  const a = { volume: 2000000000, lag_hrs: 168, per_hr: 2500, block: 1.0, liability: 1.0,
              incidents: 12, decline_rate: 12, exceptions_pd: 120, misresolve_rate: 0.04,
              exception_cost: 250, shared_dep_share: 0.35, gross_loss: 0, recoveries: 0,
              exact_per_hr: 1, exact_incidents: 1, exact_exceptions_pd: 1,
              exact_misresolve_rate: 1, exact_shared_dep_share: 1, exact_exception_cost: 1 };
  const r = engine.compute(banking, a);
  if (r.rangedInputs.join(',') !== banking.denominator)
    bad(`fixture leaked extra ranged inputs: ${r.rangedInputs.join(',')} — cancellation test would be meaningless`);
  else ok(`only "${banking.denominator}" is ranged, so any residual spread is real`);

  for (const L of banking.leaks) {
    const n = r.byLeak[L.id].natural;
    if (r.byLeak[L.id].natural.inputSpreadPct === undefined) continue;
    if (isDenomLinear(L, banking.denominator)) {
      n.inputSpreadPct < EPS
        ? ok(`${L.id}: linear in ${banking.denominator} → % spread ${n.inputSpreadPct.toExponential(1)} (cancels)`)
        : bad(`${L.id}: linear in ${banking.denominator} but % spread is ${n.inputSpreadPct.toExponential(2)} — cancellation broken`);
    } else if (hasNoDenom(L, banking.denominator)) {
      n.inputSpreadUsd < EPS
        ? ok(`${L.id}: independent of ${banking.denominator} → $ spread ${n.inputSpreadUsd.toExponential(1)} (exact in dollars)`)
        : bad(`${L.id}: no ${banking.denominator} term but $ spread is ${n.inputSpreadUsd.toExponential(2)}`);
    }
  }
}

/* ── 2. natural unit leads with whatever is actually known ───────────────────── */
console.log('\nG.2 — natural unit picks the tighter side');
{
  // Stage H added ranged drivers; every one must be pinned or the denominator is not the
  // sole source of spread and the cancellation assertion means nothing
  const a = { volume: 2000000000, lag_hrs: 168, per_hr: 2500, block: 1.0, liability: 1.0,
              incidents: 12, decline_rate: 12, exceptions_pd: 120, misresolve_rate: 0.04,
              exception_cost: 250, shared_dep_share: 0.35, gross_loss: 0, recoveries: 0,
              exact_per_hr: 1, exact_incidents: 1, exact_exceptions_pd: 1,
              exact_misresolve_rate: 1, exact_shared_dep_share: 1, exact_exception_cost: 1 };
  const r = engine.compute(banking, a);
  for (const L of banking.leaks) {
    const n = r.byLeak[L.id].natural;
    const want = n.spreadPct <= n.spreadUsd ? 'pct' : 'usd';
    n.unit === want ? ok(`${L.id}: leads with ${n.unit}`) : bad(`${L.id}: leads with ${n.unit}, tighter is ${want}`);
  }
}

/* ── 3. round-trip, at full precision ────────────────────────────────────────── */
console.log('\nG.3 — %↔$ round-trips at full precision (entered unit is authoritative)');
{
  const denom = 2000000000;
  for (const pct of [0.001, 0.0009, 0.000123456789, 0.0425]) {
    const asPct = engine.resolveExact({ value: pct, unit: 'pct' }, denom);
    const back  = engine.resolveExact({ value: asPct.usd, unit: 'usd' }, denom);
    back.pct === pct
      ? ok(`${(pct * 100).toFixed(6)}% → $${asPct.usd.toLocaleString()} → back exactly`)
      : bad(`${pct} round-tripped to ${back.pct} (drift ${Math.abs(back.pct - pct).toExponential(2)})`);
  }
  for (const usd of [900000, 1234567.89, 42]) {
    const asUsd = engine.resolveExact({ value: usd, unit: 'usd' }, denom);
    const back  = engine.resolveExact({ value: asUsd.pct, unit: 'pct' }, denom);
    back.usd === usd
      ? ok(`$${usd.toLocaleString()} → ${(asUsd.pct * 100).toFixed(6)}% → back exactly`)
      : bad(`$${usd} round-tripped to $${back.usd}`);
  }
  // the failure mode this guards: deriving from a ROUNDED display
  const rounded = parseFloat((0.000123456789 * 100).toFixed(2)) / 100;   // "0.01%"
  rounded !== 0.000123456789
    ? ok('deriving from a rounded display would lose precision — confirms provenance must be stored')
    : bad('rounding fixture did not actually round; test is vacuous');
}

/* ── 4. interval ordering ────────────────────────────────────────────────────── */
console.log('\nG.4 — lo ≤ point ≤ hi in both units, every scenario');
{
  const SC = [
    { n: 'mid',     a: { volume: 2000000000,  lag_hrs: 168,  per_hr: 2500,  block: 1.0,  liability: 1.0 } },
    { n: 'severe',  a: { volume: 12000000000, lag_hrs: 720,  per_hr: 35000, block: 1.0,  liability: 1.0 } },
    { n: 'healthy', a: { volume: 250000000,   lag_hrs: 0.25, per_hr: 400,   block: 0.15, liability: 0.1 } },
    { n: 'auto',    a: { volume: 2000000000,  lag_hrs: 24,   per_hr: 'auto',block: 0.35, liability: 0.5 } }
  ];
  for (const s of SC) {
    const r = engine.compute(banking, s.a);
    const bads = [];
    for (const [u, b] of [['usd', r.usd], ['pct', r.pct]])
      if (!(b.lo <= b.point + 1e-6 && b.point <= b.hi + 1e-6)) bads.push(`${u} ${b.lo}/${b.point}/${b.hi}`);
    for (const L of banking.leaks) {
      const bl = r.byLeak[L.id];
      for (const [u, b] of [['usd', bl.usd], ['pct', bl.pct]])
        if (!(b.lo <= b.point + 1e-6 && b.point <= b.hi + 1e-6)) bads.push(`${L.id}.${u}`);
    }
    bads.length ? bad(`${s.n}: ordering violated — ${bads.join(', ')}`) : ok(`${s.n}: ordered in both units`);
  }
}

/* ── 5. corner enumeration beats the old single sweep where a minus arm exists ── */
console.log('\nG.5 — corner enumeration finds a true lower bound (the minus-arm bug)');
{
  // reproduce the OLD approach: every factor at its low end, including inside `minus`
  const naiveLo = (cfg, ans) => {
    const r = engine.compute(cfg, ans);
    const ranges = {};
    for (const q of cfg.questions) {
      if (ans['exact_' + q.id]) continue;
      if (q.options) { const o = q.options.find(o => String(o.v) === String(ans[q.id])); if (o && o.range) ranges[q.id] = o.range; }
      else if (q.range) ranges[q.id] = q.range;
    }
    for (const L of cfg.leaks) for (const t of [].concat(L.mul || [], L.minus || []))
      if (t.ans !== undefined && t.range && ans[t.ans] === undefined) ranges[t.ans] = t.range;
    const lowAns = { ...ans };
    for (const k in ranges) lowAns[k] = ranges[k][0];
    return engine.compute(cfg, lowAns).total;
  };
  const a = { volume: 2000000000, lag_hrs: 168, per_hr: 2500, block: 1.0, liability: 1.0 };
  const r = engine.compute(banking, a);
  const naive = naiveLo(banking, a);
  r.usdInput.lo <= naive + 1e-6
    ? ok(`corner lo $${Math.round(r.usdInput.lo).toLocaleString()} ≤ naive sweep $${Math.round(naive).toLocaleString()}`)
    : bad(`corner lo $${Math.round(r.usdInput.lo)} EXCEEDS naive $${Math.round(naive)} — not a lower bound`);

  /* The two coincide on the live config, because the minus arm's only ranged input
   * (volume) also appears in the mul arm, so both move together. That makes the check
   * above pass without proving anything. Force the divergence on a synthetic config where
   * the minus arm has its OWN ranged input — this is the case the old sweep got wrong. */
  const synth = {
    id: 'synthetic-minus', denominator: 'vol',
    categories: [{ id: 'x', layer: 0, label: 'X', base: 50, weight: 1, clamp: [5, 100] }],
    questions: [{ id: 'vol', type: 'options', options: [{ v: 1000000, range: [500000, 2000000] }] },
                { id: 'offset', type: 'exact-only', range: [0, 400000] }],
    leaks: [{ id: 'net', mul: [{ ans: 'vol' }, { lit: 0.5 }], minus: [{ ans: 'offset', def: 0, range: [0, 400000] }] }],
    multipliers: []
  };
  const sa = { vol: 1000000 };
  const sr = engine.compute(synth, sa);
  const sNaive = naiveLo(synth, sa);
  // true minimum: vol at its low (250,000) minus offset at its HIGH (400,000), floored by nothing
  sr.usdInput.lo < sNaive - 1
    ? ok(`synthetic: corner lo $${Math.round(sr.usdInput.lo).toLocaleString()} < naive $${Math.round(sNaive).toLocaleString()} — the old sweep genuinely missed the minimum`)
    : bad(`synthetic: corner lo ${Math.round(sr.usdInput.lo)} did not beat naive ${Math.round(sNaive)} — G.5 still vacuous`);
}

/* ── 6. plausibility flags without altering the number ───────────────────────── */
console.log('\nG.6 — implausible share flags loudly and changes nothing');
{
  // tiny volume against a large fixed-dollar loss window drives % far past the threshold
  const a = { volume: 250000000, lag_hrs: 720, per_hr: 35000, block: 1.0, liability: 1.0,
              incidents: 12, exact_incidents: 1, exact_per_hr: 1, decline_rate: 12 };
  const r = engine.compute(banking, a);
  r.pct.point > banking.plausibleMax
    ? ok(`fixture reaches ${(r.pct.point * 100).toFixed(1)}% of volume, past the ${(banking.plausibleMax * 100)}% threshold`)
    : bad(`fixture only reached ${(r.pct.point * 100).toFixed(2)}% — cannot test the flag`);
  r.implausible ? ok('flag raised') : bad('flag not raised above threshold');
  // the reported figure must be untouched by the flag
  const sum = banking.leaks.filter(L => (L.kind || 'loss') === 'loss').reduce((s, L) => s + r.leaks[L.id], 0);
  r.total === sum ? ok(`total $${r.total.toLocaleString()} equals the sum of its parts — not clamped`)
                  : bad(`total ${r.total} != sum of leaks ${sum} — something clamped`);
  r.largestLeak ? ok(`names the largest contributor: ${r.largestLeak}`) : bad('no largest-leak attribution for the warning');
}

/* ── 7. a second domain gets percentages for free ────────────────────────────── */
console.log('\nG.7 — the mechanism is config-driven, not banking-specific');
{
  const r = engine.compute(loyalty, { revenue: '12500000', markets: '3', data_migration: 'messy',
                                      fraud_detection: 'none', roi_subtract_fraud: 'no' });
  r.denominatorId === 'revenue' ? ok('loyalty reports against revenue') : bad(`loyalty denominator is ${r.denominatorId}`);
  r.pct.point > 0 ? ok(`loyalty total = ${(r.pct.point * 100).toFixed(3)}% of revenue ($${r.total.toLocaleString()})`)
                  : bad('loyalty produced no percentage');
}

/* ── 8. regressions for the three bugs found before the eval froze the engine ─── */
console.log('\nG.8 — regressions (bugs found 2026-07-21, pre-eval freeze)');
{
  // BUG 1: a value derived from a ranged input must be re-derived at every corner
  const a = { volume: 2000000000, lag_hrs: 168, per_hr: 'auto', block: 1.0, liability: 1.0,
              incidents: 12, exact_incidents: 1 };
  const r = engine.compute(banking, a);
  const lo = engine.compute(banking, { ...a, volume: 500000000 }).byLeak.window.usd.point;
  const hi = engine.compute(banking, { ...a, volume: 4000000000 }).byLeak.window.usd.point;
  const got = r.byLeak.window.usdInput.hi - r.byLeak.window.usdInput.lo;
  Math.abs(got - (hi - lo)) < 1
    ? ok(`auto-scaled rate tracks volume across corners (band $${Math.round(got).toLocaleString()})`)
    : bad(`auto-scale band is $${Math.round(got).toLocaleString()}, should span $${Math.round(hi - lo).toLocaleString()} — derive() is not running per corner`);
  got > 0 ? ok('band is non-zero, so the "Don\'t know" path reports real uncertainty')
          : bad('band collapsed to zero — false precision on the most likely answer');

  // BUG 2: an explicit zero is not the default
  const base = { volume: 2000000000, lag_hrs: 168, per_hr: 2500, block: 1.0, liability: 1.0 };
  const zero = engine.compute(banking, { ...base, incidents: 0, exact_incidents: 1 }).leaks.window;
  const dflt = engine.compute(banking, base).leaks.window;
  zero === 0 && dflt !== 0
    ? ok(`exact 0 → $0, absent → $${dflt.toLocaleString()} (default) — they differ`)
    : bad(`exact 0 gave $${zero}, absent gave $${dflt} — falsy-zero fallthrough still present`);

  // BUG 3: loyalty reports a real interval
  const L = engine.compute(loyalty, { revenue: '12500000', markets: '3', data_migration: 'messy',
                                      fraud_detection: 'none', roi_subtract_fraud: 'no' });
  L.usd.lo < L.usd.point && L.usd.point < L.usd.hi
    ? ok(`loyalty interval $${Math.round(L.usd.lo).toLocaleString()} < $${L.usd.point.toLocaleString()} < $${Math.round(L.usd.hi).toLocaleString()}`)
    : bad(`loyalty band is degenerate (${L.usd.lo}/${L.usd.point}/${L.usd.hi}) — implies certainty it has not earned`);

  // truncation must be visible, never silent
  r.rangedTruncated === 0 ? ok('no ranged inputs dropped (truncation flag exposed and clear)')
                          : bad(`${r.rangedTruncated} ranged input(s) silently dropped`);
}

/* ── 9. corners must be physically possible, and residual must be earned ─────── */
console.log('\nG.9 — feasible corners only, and rate residual charged only where a rate exists');
{
  const ai = require('../domains/enterprise-ai.js');
  const a = { spend: 20000000, baseline: 1.00, measure: 0.60, alloc: 0.60, shadow: 'unknown' };
  const r = engine.compute(ai, a);

  // every leak here is a portion of spend, so the total cannot exceed the spend
  /* The bound only holds where every LOSS leak is proportional to the denominator. Stage H
     added feedback_debt (hours x rate), an absolute figure unrelated to spend, so a small
     budget with a large correction bill can legitimately exceed 100%. Assert the precondition
     rather than the conclusion. */
  const lossLeaks = ai.leaks.filter(L => (L.kind || 'loss') === 'loss');
  const allProportional = lossLeaks.every(L => (L.mul || []).some(t => t.ans === ai.denominator));
  if (allProportional) {
    r.pct.hi <= 1.0001
      ? ok(`upper bound ${(r.pct.hi * 100).toFixed(2)}% of spend — cannot lose more than was spent`)
      : bad(`upper bound ${(r.pct.hi * 100).toFixed(2)}% exceeds the denominator`);
  } else {
    const abs = lossLeaks.filter(L => !(L.mul || []).some(t => t.ans === ai.denominator)).map(L => L.id);
    ok(`bound check N/A: ${abs.join(', ')} are absolute figures, not portions of ${ai.denominator}`);
  }

  r.cornersSkipped > 0
    ? ok(`${r.cornersSkipped} of ${r.cornersEvaluated} corners rejected as physically impossible`)
    : bad('no corners rejected — the feasibility predicate is not being applied');

  // a leak with no bare rate constant must carry no rate residual
  const noRate = ai.leaks.find(L => ![].concat(L.mul || [], L.minus || []).some(t => t.lit !== undefined && t.lit !== 1));
  const withRate = ai.leaks.find(L => [].concat(L.mul || [], L.minus || []).some(t => t.lit !== undefined && t.lit !== 1));
  if (!noRate || !withRate) { bad('fixture needs one leak with a rate constant and one without'); }
  else {
    const nb = r.byLeak[noRate.id], wb = r.byLeak[withRate.id];
    const nSpread = nb.pct.hi - nb.pct.lo, nInput = nb.pctInput.hi - nb.pctInput.lo;
    Math.abs(nSpread - nInput) < 1e-12
      ? ok(`${noRate.id}: no rate constant → band equals pure input spread, no residual added`)
      : bad(`${noRate.id}: band widened beyond its inputs despite having no rate constant`);
    (wb.pct.hi - wb.pct.lo) > (wb.pctInput.hi - wb.pctInput.lo) - 1e-12
      ? ok(`${withRate.id}: has a rate constant → residual applied`)
      : bad(`${withRate.id}: rate constant present but no residual applied`);
  }
}

console.log(failed ? `\nFAIL — ${failed} check(s)\n` : '\nPASS — dual-unit reporting is correct in both directions\n');
process.exit(failed ? 1 : 0);
