/* Loyalty domain config — the ORIGINAL scoring constants from
 * leakage-iq/landing-page/diagnostic.html `recalculate()`, plus UI content.
 *
 * Every score delta, weight, base, clamp, leak rate and multiplier below is a faithful
 * transcription. None of it is improved, rounded or tidied: its job is to prove the generic
 * engine reproduces the known-good engine exactly (Stage B). A "better" number here would
 * silently break the one gate that makes the refactor trustworthy.
 *
 * Titles, hints and option labels ARE new. Without them the page rendered raw config ids
 * ("revenue", "500000"), which is fine for a test fixture and unshippable to a client.
 *
 * Slider defaults match recalculate()'s `|| n` fallbacks, which are the oracle — not the
 * STEPS `default:` values, which are only the UI's initial handle position.
 *
 * abuse_types 'none' stands in for the original 'none_known'; both fall through to no delta
 * in the frozen oracle, so the substitution is behaviourally identical.
 */
(function (root) {
  var CFG = {
    id: 'loyalty',
    label: 'Loyalty · Reward Programme',
    noun: 'loyalty programme',
    contact: '193purushottam@gmail.com',
    denominator: 'revenue',
    denominatorLabel: 'reward program value',
    anchorLabel: 'Books show',
    /* The model's own ceiling is ~19% of reward value once every category saturates and the
       market multipliers apply. Above 15%, an input is almost certainly wrong. */
    plausibleMax: 0.15,
    band: { precisionInputs: ['revenue'], residual: 0.25 },
    refinedAt: 1,

    categories: [
      { id: 'data',    label: 'Data Foundation',       layer: 0, base: 70, weight: 0.30, clamp: [5, 100],
        blurb: 'Whether the numbers the programme reports can be trusted at all.' },
      { id: 'fraud',   label: 'Fraud Exposure',        layer: 2, base: 50, weight: 0.30, clamp: [5, 100], invert: true,
        blurb: 'What is actively draining reward value while it is being issued.' },
      { id: 'roi',     label: 'ROI Integrity',         layer: 1, base: 60, weight: 0.25, clamp: [5, 100],
        blurb: 'Whether reported campaign returns survive contact with the fraud number.' },
      { id: 'xmarket', label: 'Cross-Market Learning', layer: 2, base: 50, weight: 0.15, clamp: [5, 100],
        blurb: 'Whether a failure found once is prevented everywhere, or rediscovered.',
        // original hard-sets 80 and skips the whole delta block when markets <= 1
        fallback: { when: { ans: 'markets', def: 1, op: '<=', v: 1 }, score: 80 } }
    ],

    questions: [
      { id: 'revenue', type: 'options', depth: 'front', exact: true, cols: 3,
        exactLabel: 'Exact annual reward value (USD)',
        title: 'Annual reward program value',
        hint: 'Total value of points, rewards and incentives issued in the last full year.',
        options: [
          { v: '500000',    l: 'Under $1M',     desc: 'Small program', range: [250000, 1000000] },
          { v: '2500000',   l: '$1M – $5M',     desc: 'Growing',       range: [1000000, 5000000] },
          { v: '12500000',  l: '$5M – $25M',    desc: 'Mid-market',    range: [5000000, 25000000] },
          { v: '50000000',  l: '$25M – $100M',  desc: 'Large',         range: [25000000, 100000000] },
          { v: '250000000', l: '$100M – $500M', desc: 'Enterprise',    range: [100000000, 500000000] },
          { v: '750000000', l: '$500M+',        desc: 'Global scale',  range: [500000000, 1500000000] } ] },

      { id: 'markets', type: 'options', depth: 'front',
        title: 'Number of markets or countries',
        hint: 'A single-market programme cannot leak value through cross-market silos.',
        options: [
          { v: '1',  l: '1',       desc: 'Single market' },
          { v: '3',  l: '2 – 5',   desc: 'Regional' },
          { v: '7',  l: '6 – 10',  desc: 'Multi-region' },
          { v: '15', l: '10+',     desc: 'Global' } ] },

      { id: 'data_migration', type: 'options', depth: 'front',
        title: 'Data migration status',
        hint: 'Layer 0. Has loyalty data moved between systems in the last three years?',
        options: [
          { v: 'none',    l: 'No migration',    desc: 'Same system', d: { data:  +5 } },
          { v: 'clean',   l: 'Clean migration', desc: 'Validated',   d: { data: +10 } },
          { v: 'partial', l: 'Partial issues',  desc: 'Some gaps',   d: { data: -15 } },
          { v: 'messy',   l: 'Known problems',  desc: 'Unresolved',  d: { data: -30 } } ] },

      { id: 'data_quality', type: 'slider', depth: 'deep', pivot: 5, default: 5, k: { data: 5 }, min: 1, max: 10,
        title: 'How confident are you in your customer data quality?',
        hint: '1 = we know there are major issues, 10 = validated and audited.' },

      { id: 'multi_currency', type: 'options', depth: 'deep',
        title: 'Multi-currency handling',
        options: [
          { v: 'single',  l: 'Single currency', desc: 'No conversion' },
          { v: 'handled', l: 'Handled well',    desc: 'Automated',    d: { data:  +5 } },
          { v: 'manual',  l: 'Manual process',  desc: 'Spreadsheets', d: { data: -10 } },
          { v: 'issues',  l: 'Known issues',    desc: 'Mismatches',   d: { data: -20 } } ] },

      { id: 'fraud_detection', type: 'options', depth: 'front',
        title: 'Current fraud detection capability',
        hint: 'Layer 2. What is actively watching for incentive abuse?',
        options: [
          { v: 'none',     l: 'None',           desc: 'No detection',  d: { fraud: +30 } },
          { v: 'basic',    l: 'Basic rules',    desc: 'Manual review', d: { fraud: +10 } },
          { v: 'advanced', l: 'Advanced',       desc: 'ML-based',      d: { fraud: -20 } },
          { v: 'unknown',  l: 'Don’t know', desc: 'Unsure',        d: { fraud: +20 } } ] },

      { id: 'abuse_types', type: 'options', depth: 'deep',
        title: 'Which abuse types have you encountered?',
        options: [
          { v: 'none',     l: 'None known',     desc: 'Or unmonitored' },
          { v: 'coupon',   l: 'Coupon abuse',   desc: 'Stacking or sharing', d: { fraud:  +8 } },
          { v: 'referral', l: 'Referral fraud', desc: 'Fake referrals',      d: { fraud:  +8 } },
          { v: 'multiple', l: 'Multiple types', desc: 'Several vectors',     d: { fraud: +15 } } ] },

      { id: 'fraud_threshold', type: 'slider', depth: 'deep', pivot: 5, default: 3, k: { fraud: -4 }, min: 1, max: 10,
        title: 'Do you have business-calibrated fraud thresholds?',
        hint: '1 = block everything suspicious, 10 = nuanced rules that protect high-value customers.' },

      { id: 'roi_subtract_fraud', type: 'options', depth: 'front',
        title: 'Does your ROI calculation subtract fraud losses?',
        hint: 'Layer 1, case C6. ROI reported gross allocates budget on a number that is not real.',
        options: [
          { v: 'yes',       l: 'Yes',       desc: 'Fraud-adjusted', d: { roi: +20 } },
          { v: 'no',        l: 'No',        desc: 'Not adjusted',   d: { roi: -25 } },
          { v: 'partially', l: 'Partially', desc: 'Some campaigns', d: { roi:  -5 } },
          { v: 'unsure',    l: 'Unsure',    desc: 'Not certain',    d: { roi: -15 } } ] },

      { id: 'last_audit', type: 'options', depth: 'deep',
        title: 'Last independent audit of the programme',
        options: [
          { v: 'never',   l: 'Never',           desc: 'No audit', d: { roi: -20 } },
          { v: 'old',     l: '12+ months',      desc: 'Outdated', d: { roi: -10 } },
          { v: 'recent',  l: '6 – 12 months', desc: 'Recent',   d: { roi:  +5 } },
          { v: 'current', l: 'Under 6 months',  desc: 'Current',  d: { roi: +15 } } ] },

      { id: 'roi_confidence', type: 'slider', depth: 'deep', pivot: 5, default: 4, k: { roi: 4 }, min: 1, max: 10,
        title: 'How confident are you that reported campaign ROI is accurate?',
        hint: '1 = just a number on a dashboard, 10 = independently validated.' },

      { id: 'knowledge_sharing', type: 'options', depth: 'deep',
        showIf: { ans: 'markets', def: 1, op: '>', v: 1 },
        title: 'How do markets share learnings?',
        hint: 'Only relevant with more than one market.',
        options: [
          { v: 'none',       l: 'They don’t', desc: 'Siloed',          d: { xmarket: -25 } },
          { v: 'adhoc',      l: 'Ad hoc',          desc: 'Informal',        d: { xmarket: -10 } },
          { v: 'structured', l: 'Structured',      desc: 'Regular reviews', d: { xmarket: +10 } },
          { v: 'systematic', l: 'Systematic',      desc: 'Automated',       d: { xmarket: +25 } } ] },

      { id: 'cascading', type: 'options', depth: 'deep',
        showIf: { ans: 'markets', def: 1, op: '>', v: 1 },
        title: 'When one market finds a problem, how quickly do the others benefit?',
        options: [
          { v: 'never',   l: 'They don’t', desc: 'Rediscovered',   d: { xmarket: -20 } },
          { v: 'slow',    l: 'Months',          desc: 'Eventually',     d: { xmarket:  -8 } },
          { v: 'fast',    l: 'Weeks',           desc: 'Process exists', d: { xmarket: +10 } },
          { v: 'instant', l: 'Days',            desc: 'Automated',      d: { xmarket: +20 } } ] },

      { id: 'market_maturity', type: 'slider', depth: 'deep', pivot: 5, default: 4, k: { xmarket: 4 }, min: 1, max: 10,
        showIf: { ans: 'markets', def: 1, op: '>', v: 1 },
        title: 'How consistent is programme quality across markets?',
        hint: '1 = wildly inconsistent, 10 = identical standards.' },

      { id: 'reported', type: 'exact-only', depth: 'front', exact: true, units: ['usd', 'pct'],
        exactLabel: 'Leakage already recognised',
        title: 'How much of this has the P&L already recognised as loss?',
        hint: 'Optional. Sets the left anchor, so the variance is what the books have not yet caught.' }
    ],

    /* name / why / case are presentation only — without them the page rendered "undefined"
       as the title of every loyalty leak line. */
    leaks: [
      { id: 'fraud', cat: 'fraud', case: 'C12', name: 'Incentive abuse and coupon stacking',
        why: 'Rules not calibrated to customer value let reward value leak out the bottom.',
        mul: [ { ans: 'revenue' }, { lit: 0.03  }, { score: 'fraud',   pivot: 50 } ] },
      { id: 'data',  cat: 'data', case: 'C1', name: 'Data foundation rot',
        why: 'Migration gaps and manual currency handling make every downstream metric unreliable.',
        mul: [ { ans: 'revenue' }, { lit: 0.02  }, { score: 'data',    pivot: 50 } ] },
      { id: 'roi',   cat: 'roi', case: 'C6', name: 'ROI inflated by unsubtracted fraud',
        why: 'ROI reported gross means budget is allocated on a number that is not real.',
        mul: [ { ans: 'revenue' }, { lit: 0.015 }, { score: 'roi',     pivot: 50 } ] },
      { id: 'silo',  cat: 'xmarket', case: 'C13', name: 'Cross-market knowledge silos',
        why: 'A failure found in one market is re-discovered rather than prevented in the next.',
        mul: [ { ans: 'revenue' }, { lit: 0.01  }, { score: 'xmarket', pivot: 50 } ],
        when: { ans: 'markets', def: 1, op: '>', v: 1 } }
    ],

    /* Recommendations for the gated report; caveats verbatim from the golden dataset. */
    recs: {
      fraud: { t: 'Replace blunt fraud rules with value-calibrated ones',
               d: 'Rules tuned to customer value stop the abuse without blocking the customers the programme exists to keep.',
               caveat: 'Where this fails: power-user behaviour that looks like abuse — the heaviest legitimate users trip naive rules first.' },
      data:  { t: 'Reconcile and establish a trusted baseline before any detection',
               d: 'Detection built on unreconciled data detects noise; the first work is making the data trustworthy.',
               caveat: 'Where this fails: data that is clean but in the wrong unit — points and currency reconciling perfectly against the wrong thing.' },
      roi:   { t: 'Report fraud-adjusted ROI',
               d: 'Subtract fraud and data failures from campaign returns so budget is allocated on a real number.',
               caveat: 'Where this fails: when the fraud estimate itself is unreliable, adjustment over-corrects and buries genuinely good campaigns.' },
      silo:  { t: 'Stand up a shared failure registry with a cascade-speed metric',
               d: 'A failure found once should be prevented everywhere; measure how fast learnings actually cross markets.',
               caveat: 'Where this fails: a market-specific failure wrongly generalized — not every local lesson transfers.' }
    },

    multipliers: [
      { when: { ans: 'markets', def: 1, op: '>=', v: 7 }, apply: { fraud: 1.3,  data: 1.4 } },
      { when: { ans: 'markets', def: 1, op: '>=', v: 3 }, apply: { fraud: 1.15, data: 1.2 } }
    ]
  };
  root.SID_LOYALTY = CFG;
  if (typeof module !== 'undefined' && module.exports) module.exports = CFG;
})(typeof globalThis !== 'undefined' ? globalThis : this);
