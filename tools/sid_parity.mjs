// STAGE B GATE — exact parity between the generic engine and the frozen original.
//
// Zero tolerance: every field must match exactly on every permutation. This is money math
// being rewritten; "close enough" is how a refactor silently changes what a client is told.
// Imports the SHIPPED engine and the SHIPPED config — never a copy — so the gate cannot
// drift away from what actually runs.
//
// Usage: node tools/sid_parity.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { frozenRecalculate } = require('./_frozen-recalculate.js');
const engine = require('../sid-engine.js');
const loyalty = require('../domains/loyalty.js');

const OPTS = {
  markets:            ['1', '3', '7', '15'],
  data_migration:     ['none', 'clean', 'partial', 'messy'],
  fraud_detection:    ['none', 'basic', 'advanced', 'unknown'],
  roi_subtract_fraud: ['yes', 'no', 'partially', 'unsure']
};
// cycled deterministically by index so the suite is reproducible run to run
const CYCLE = {
  revenue:          ['500000', '2500000', '12500000', '50000000', '250000000', '750000000'],
  multi_currency:   ['single', 'handled', 'manual', 'issues'],
  abuse_types:      ['none', 'coupon', 'referral', 'multiple'],
  last_audit:       ['never', 'old', 'recent', 'current'],
  knowledge_sharing:['none', 'adhoc', 'structured', 'systematic'],
  cascading:        ['never', 'slow', 'fast', 'instant'],
  data_quality:     ['1', '3', '5', '7', '10'],
  fraud_threshold:  ['1', '3', '5', '8', '10'],
  roi_confidence:   ['1', '4', '6', '9', '10'],
  market_maturity:  ['1', '4', '5', '8', '10']
};

const cases = [];
let i = 0;
for (const m of OPTS.markets)
  for (const dm of OPTS.data_migration)
    for (const fd of OPTS.fraud_detection)
      for (const rsf of OPTS.roi_subtract_fraud) {
        const a = { markets: m, data_migration: dm, fraud_detection: fd, roi_subtract_fraud: rsf };
        for (const [k, vals] of Object.entries(CYCLE)) a[k] = vals[i % vals.length];
        cases.push(a); i++;
      }

// edge cases the cross-product would not reach
cases.push({});                                                        // nothing answered
cases.push({ revenue: '0', markets: '1' });                            // zero revenue
cases.push({ revenue: '750000000', markets: '15' });                   // top multiplier band
cases.push({ revenue: '500000', markets: '3' });                       // lower multiplier band
cases.push({ revenue: '12500000', markets: '1', knowledge_sharing: 'none', cascading: 'never', market_maturity: '1' });
cases.push({ revenue: '12500000', markets: '2' });                     // >1 but below any multiplier
cases.push({ data_quality: '10', fraud_threshold: '10', roi_confidence: '10', market_maturity: '10', markets: '7', revenue: '50000000' });
cases.push({ data_quality: '1',  fraud_threshold: '1',  roi_confidence: '1',  market_maturity: '1',  markets: '7', revenue: '50000000' });

const FIELDS = ['overall', 'dataScore', 'fraudHealth', 'roiScore', 'xmarketScore',
                'fraudLeak', 'dataLeak', 'roiLeak', 'siloLeak', 'totalLeak'];

// map the generic engine's shape onto the frozen oracle's field names
const adapt = r => ({
  overall: r.overall,
  dataScore: r.scores.data, fraudHealth: r.scores.fraud,
  roiScore: r.scores.roi,   xmarketScore: r.scores.xmarket,
  fraudLeak: r.leaks.fraud, dataLeak: r.leaks.data,
  roiLeak: r.leaks.roi,     siloLeak: r.leaks.silo,
  totalLeak: r.total
});

let failed = 0, shown = 0;
for (const a of cases) {
  const want = frozenRecalculate(a);
  const got = adapt(engine.compute(loyalty, a));
  const bad = FIELDS.filter(f => want[f] !== got[f]);
  if (bad.length) {
    failed++;
    if (shown++ < 6) {
      console.log(`\n✗ ${JSON.stringify(a)}`);
      for (const f of bad) console.log(`    ${f}: frozen=${want[f]}  engine=${got[f]}`);
    }
  }
}

console.log(`\n${cases.length} permutations · ${FIELDS.length} fields each = ${cases.length * FIELDS.length} assertions`);
if (failed) {
  console.log(`FAIL — ${failed} permutation(s) diverge from the original engine\n`);
  process.exit(1);
}
console.log('PASS — generic engine reproduces the original loyalty engine exactly\n');
