/* Banking / settlement & fraud domain config.
 *
 * ONE config, TWO depths. `depth:'front'` questions render in both; `depth:'deep'` render
 * only in the full diagnostic.
 *
 * Critical property: BOTH depths compute the SAME leak paths. The deep tier does not reveal
 * extra losses — it supplies real drivers where the front door falls back to a stated default
 * (see `def:` on the factors below). A front door that hid whole leak paths would make its
 * own number dishonest, and would make the two-depth gate unsatisfiable.
 *
 * Cases: C2, C3, C7, C14, C15 from GBPA-golden-dataset-v0.md.
 */
(function (root) {
  var CFG = {
    id: 'banking-fraud',
    label: 'Banking · Settlement & Fraud',
    noun: 'fraud & settlement operations',
    contact: '193purushottam@gmail.com',
    /* Percentages are taken against processed volume. Chosen because it is already
     * collected and because leaks linear in volume cancel it exactly — their % is
     * independent of the volume estimate, which is the strongest claim this tool makes.
     * Not revenue: that needs a second input and loses the cancellation property. */
    denominator: 'volume',
    denominatorLabel: 'volume',
    anchorLabel: 'P&L shows',
    /* Above this share of volume, flag loudly — never clamp. An implausible output almost
     * always means a bad input, and that is worth surfacing, not hiding. */
    plausibleMax: 0.05,
    // No flat percentage. The interval is propagated from the input ranges below; `residual`
    // only covers uncertainty in the practitioner rate constants, which no input range captures.
    band: { precisionInputs: ['volume', 'per_hr', 'incidents'], residual: 0.25 },
    refinedAt: 3,

    categories: [
      { id: 'capture', layer: 0, label: 'Signal Capture',       base: 60, weight: 0.35, clamp: [5, 100], invert: true,
        blurb: 'Where the numbers originate. Small errors here compound into every figure above them.' },
      { id: 'audit',   layer: 1, label: 'Signal Audit',         base: 55, weight: 0.35, clamp: [5, 100], invert: true,
        blurb: 'Whether the recorded numbers are accurate once captured.' },
      { id: 'distort', layer: 2, label: 'Distortion Detection', base: 50, weight: 0.30, clamp: [5, 100], invert: true,
        blurb: 'What is actively corrupting the signal while it is being measured.' }
    ],

    questions: [
      /* ── front door: five questions, each one a driver of a dollar rule ── */
      { id: 'volume', type: 'options', depth: 'front', exact: true,
        exactLabel: 'Exact annual volume (USD)',
        title: 'Annual card and payment volume processed',
        hint: 'Total value settled across all channels in the last full year.',
        options: [
          { v: 250000000,   l: 'Under $500M', desc: 'Regional', range: [50000000, 500000000] },
          { v: 2000000000,  l: '$500M – $4B', desc: 'National', range: [500000000, 4000000000] },
          { v: 12000000000, l: '$4B – $20B',  desc: 'Tier-1', range: [4000000000, 20000000000] },
          { v: 35000000000, l: 'Over $20B',   desc: 'Global', range: [20000000000, 80000000000] } ] },

      { id: 'lag_hrs', type: 'options', depth: 'front',
        title: 'Time from a fraudulent transaction to it appearing in your loss numbers',
        hint: 'Not when it is written off — when it first becomes visible to anyone watching.',
        options: [
          { v: 0.25, l: 'Real-time', desc: 'Streaming detection', d: { audit: -20 } },
          { v: 24,   l: 'Next day',  desc: 'Daily batch',         d: { audit:  +5 } },
          { v: 168,  l: 'Weekly',    desc: 'Batch reconciliation',d: { audit: +20 } },
          { v: 720,  l: 'Monthly',   desc: 'Post-settlement',     d: { audit: +30 } } ] },

      { id: 'per_hr', type: 'options', depth: 'front', exact: true,
        exactLabel: 'Exact loss per incident-hour (USD)',
        title: 'During an active fraud incident, roughly what leaves per hour',
        hint: 'If this is genuinely unknown, say so — it is scaled from your volume instead, and the range widens to show that.',
        options: [
          { v: 400,   l: 'Under $1K',  desc: '', range: [100, 1000] },
          { v: 2500,  l: '$1K – $5K',  desc: '', range: [1000, 5000] },
          { v: 12000, l: '$5K – $20K', desc: '', range: [5000, 20000] },
          { v: 35000, l: 'Over $20K',  desc: '', range: [20000, 100000] },
          { v: 'auto', l: 'Don’t know', desc: 'Scale from volume', d: { audit: +10 } } ] },

      { id: 'block', type: 'options', depth: 'front',
        title: 'A transaction looks risky on a high-value customer. What happens?',
        hint: 'This decides how much good revenue the fraud rules stop alongside the fraud.',
        options: [
          { v: 1.0,  l: 'Hard block',     desc: 'One rule for everyone', d: { distort: +25 } },
          { v: 0.35, l: 'Step-up auth',   desc: 'Challenge, not block',  d: { distort:  -5 } },
          { v: 0.15, l: 'Tiered by value',desc: 'Calibrated to LTV',     d: { distort: -20 } },
          { v: 0.80, l: 'Don’t know',desc: 'No stated policy',      d: { distort: +18 } } ] },

      { id: 'liability', type: 'options', depth: 'front',
        title: 'Has fraud liability exposure been re-mapped to the 2026 mandate?',
        hint: 'Liability on system-breach fraud shifted toward the institution. Coverage assumed under prior terms may no longer hold.',
        options: [
          { v: 0.1, l: 'Fully re-mapped', desc: 'Reviewed and updated', d: { capture: -20 } },
          { v: 0.5, l: 'Partially',       desc: 'Started, incomplete',  d: { capture:  +5 } },
          { v: 1.0, l: 'No, or unsure',   desc: 'Still on prior terms', d: { capture: +25 } } ] },

      /* ── deep only: supply real drivers where the front door assumes ── */
      { id: 'incidents', type: 'exact-only', depth: 'front', exact: true,
        exactLabel: 'Incidents per year (if known)',
        range: [4, 26],
        title: 'How many active fraud incidents in a typical year?',
        hint: 'Optional. Left blank, the calculation assumes 12 — roughly one a month — and says so on the line it affects.' },

      /* The only exact field where a percentage is meaningful. Volume is the denominator,
       * per-hour is a rate, incidents is a count — a "%" of any of those is nonsense, so
       * they stay single-unit rather than offering a toggle that produces garbage. */
      { id: 'reported', type: 'exact-only', depth: 'front', exact: true, units: ['usd', 'pct'],
        exactLabel: 'Reported annual fraud loss',
        title: 'What does your P&L currently record as annual fraud loss?',
        hint: 'Optional, and the most useful number here. It sets the left anchor of the reconciliation, so the variance becomes the gap between your books and the computed exposure.' },

      { id: 'recon', type: 'options', depth: 'deep',
        title: 'How are settlement exceptions resolved day to day?',
        hint: 'Layer 0. The back office runs the most operations, so it accumulates the most small errors.',
        options: [
          { v: 'auto',   l: 'Automated rules', desc: 'Codified, logged',        d: { capture: -20 } },
          { v: 'mixed',  l: 'Mixed',           desc: 'Rules plus judgement',    d: { capture:  +5 } },
          { v: 'manual', l: 'Hand-resolved',   desc: 'Operator by operator',    d: { capture: +25 } } ] },

      { id: 'recon_rule', type: 'options', depth: 'deep',
        showIf: { ans: 'recon', op: '!=', v: 'auto' },
        title: 'When an operator hits an exception with no rule, what happens?',
        hint: 'Only relevant where exceptions are not fully automated.',
        options: [
          { v: 'escalate', l: 'Escalated',   desc: 'Owner assigned',     d: { capture: -10 } },
          { v: 'improv',   l: 'Improvised',  desc: 'Each one decides',   d: { capture: +20 } },
          { v: 'unknown',  l: 'No idea',     desc: 'Not tracked',        d: { capture: +25 } } ] },

      { id: 'fraud_in_pnl', type: 'options', depth: 'deep',
        title: 'Does the P&L show fraud net of recoveries, or does fraud sit only in ops?',
        hint: 'Layer 1, case C8 — gross and net confusion hides the true drag.',
        options: [
          { v: 'net',   l: 'Net, in the P&L', desc: 'Recoveries applied', d: { audit: -20 } },
          { v: 'gross', l: 'Gross only',      desc: 'No recovery line',   d: { audit: +12 } },
          { v: 'ops',   l: 'Sits in ops',     desc: 'Never reaches P&L',  d: { audit: +25 } } ] },

      { id: 'decline_rate', type: 'slider', depth: 'deep',
        pivot: 12, default: 12, k: { distort: 1.2 },
        min: 2, max: 40,
        title: 'Of every 10,000 transactions, how many are declined and never retried?',
        hint: 'Sets the over-blocking rate directly instead of using the 12-in-10,000 default.' },

      { id: 'vendor', type: 'options', depth: 'deep',
        title: 'How many of your critical processing dependencies are shared with peer institutions?',
        hint: 'Layer 2, case C15 — correlated failure risk is invisible until it is not.',
        options: [
          { v: 'few',     l: 'Few or none',  desc: 'Mostly isolated',   d: { distort: -15 } },
          { v: 'some',    l: 'Some',         desc: 'Partly shared',     d: { distort:  +8 } },
          { v: 'most',    l: 'Most',         desc: 'Heavily shared',    d: { distort: +22 } },
          { v: 'unknown', l: 'Not mapped',   desc: 'Never assessed',    d: { distort: +25 } } ] },

      { id: 'vendor_plan', type: 'options', depth: 'deep',
        showIf: { ans: 'vendor', op: '!=', v: 'few' },
        title: 'Is there a tested failover for the shared dependencies?',
        hint: 'Only asked where dependencies are actually shared.',
        options: [
          { v: 'tested',   l: 'Tested',      desc: 'Exercised in the last year', d: { distort: -15 } },
          { v: 'onpaper',  l: 'On paper',    desc: 'Documented, never run',      d: { distort: +10 } },
          { v: 'none',     l: 'None',        desc: 'No failover',                d: { distort: +20 } } ] },

      /* ── Stage H drivers for C2, C8, C15. Deep-tier; the front door falls back to the
         stated `def` on each leak factor, per decision #19. ── */

      { id: 'exceptions_pd', type: 'exact-only', depth: 'deep', exact: true, range: [20, 600],
        exactLabel: 'Exceptions per day',
        title: 'Settlement exceptions hand-resolved per day',
        hint: 'Case C2. Optional — 120/day assumed, stated on the line it affects.' },

      { id: 'exception_cost', type: 'options', depth: 'deep',
        title: 'Cost when an exception is resolved the wrong way',
        hint: 'Case C2. Rework, downstream correction, and the write-off that follows.',
        options: [
          { v: 40,  l: 'Under $100',  desc: 'Minor rework',     range: [10, 100],   d: { capture:  -8 } },
          { v: 250, l: '$100 – $500', desc: 'Correction chain', range: [100, 500],  d: { capture:  +8 } },
          { v: 900, l: 'Over $500',   desc: 'Write-off',        range: [500, 2000], d: { capture: +18 } } ] },

      { id: 'misresolve_rate', type: 'exact-only', depth: 'deep', exact: true, range: [0.01, 0.12],
        exactLabel: 'Share resolved wrongly',
        title: 'Share of hand-resolved exceptions that turn out to be wrong',
        hint: 'Case C2. Optional — 4% assumed if unknown.' },

      { id: 'gross_loss', type: 'exact-only', depth: 'deep', exact: true, units: ['usd', 'pct'],
        exactLabel: 'Gross fraud loss',
        title: 'Gross annual fraud loss, before any recovery',
        hint: 'Case C8. With recoveries below, this gives the net drag the P&L should show.' },

      { id: 'recoveries', type: 'exact-only', depth: 'deep', exact: true, units: ['usd', 'pct'],
        exactLabel: 'Recovered during the year',
        title: 'How much of that gross loss was recovered?',
        hint: 'Case C8. Gross minus recoveries is the figure that belongs in the P&L.' },

      { id: 'shared_dep_share', type: 'exact-only', depth: 'deep', exact: true, range: [0.10, 0.80],
        exactLabel: 'Share on shared infrastructure',
        title: 'Share of processing running on infrastructure shared with peer institutions',
        hint: 'Case C15. Optional — 35% assumed. Drives exposure, never an expected loss.' }
    ],

    /* Identical in both depths. `def:` is what the front door falls back to. */
    leaks: [
      { id: 'window', cat: 'audit', case: 'C7',
        name: 'Invisible loss window',
        mul: [ { ans: 'lag_hrs' }, { ans: 'per_hr' }, { ans: 'incidents', def: 12, range: [4, 26] } ],
        why: 'Loss trued up after settlement means the exposure window is invisible while it is open.' },

      { id: 'overblock', cat: 'distort', case: 'C14',
        name: 'Over-blocking, net of fraud prevented',
        mul:   [ { ans: 'volume' }, { ans: 'decline_rate', def: 12, range: [2, 40] }, { lit: 0.0001 }, { ans: 'block' } ],
        minus: [ { ans: 'volume' }, { lit: 0.0002 } ],
        floor: 0,
        why: 'Blunt thresholds stop fraud by also stopping revenue. The customers lost do not appear in the fraud number.' },

      { id: 'liability', cat: 'capture', case: 'C3',
        name: 'Unhedged liability share',
        mul: [ { ans: 'volume' }, { lit: 0.0009 }, { ans: 'liability' } ],
        why: 'Liability believed to sit with the network or the customer may now sit with the institution.' },

      { id: 'exception_drift', cat: 'capture', case: 'C2',
        name: 'Back-office exception drift',
        mul: [ { ans: 'exceptions_pd', def: 120, range: [20, 600] },
               { ans: 'exception_cost', def: 250, range: [100, 500] },
               { ans: 'misresolve_rate', def: 0.04, range: [0.01, 0.12] },
               { lit: 250, fixed: true } ],   // working days per year — a fact, not a tuned rate
        why: 'Operators improvising on exceptions make small inconsistent calls that accumulate into a wrong risk picture.' },

      { id: 'gross_net_gap', cat: 'audit', case: 'C8',
        name: 'Fraud drag the P&L never shows',
        /* Pure arithmetic on two supplied figures — no rate constant, so it cannot be fitted. */
        mul:   [ { ans: 'gross_loss', def: 0 } ],
        minus: [ { ans: 'recoveries', def: 0 } ],
        floor: 0,
        why: 'Fraud sitting in operations, reported gross, never reaches the P&L as the net drag it actually is.' },

      { id: 'vendor_exposure', cat: 'distort', case: 'C15', kind: 'contingent',
        name: 'Shared-infrastructure concentration exposure',
        /* Deliberately NOT an expected annual loss: nobody can source a credible vendor-failure
           probability, so none is invented. This is volume-at-risk if a shared dependency fails,
           reported separately and excluded from the headline total. */
        mul: [ { ans: 'volume' }, { ans: 'shared_dep_share', def: 0.35, range: [0.10, 0.80] }, { lit: 0.002 } ],
        why: 'Several institutions depending on the same tier-3 provider means correlated failure that no single risk register shows.' }
    ],

    multipliers: [],

    /* Recommendations, one per leak, for the gated report. `caveat` is the golden dataset's
     * edge_case_where_fix_fails and is rendered VERBATIM — it doubles as the gate's
     * required-inclusion ground truth, so the LLM can never recommend a fix while omitting
     * where that fix breaks. */
    recs: {
      window:          { t: 'Move fraud loss to a real-time signal',
                         d: 'Batch reconciliation leaves the exposure window invisible while it is open; a streaming loss signal closes it.',
                         caveat: 'Where this fails: real-time flags that reverse on later context, such as a legitimate chargeback, read as fraud until settlement catches up.' },
      overblock:       { t: 'Calibrate blocking thresholds to customer value',
                         d: 'Blunt thresholds stop fraud by also stopping revenue; tier the response to the customer relationship.',
                         caveat: 'Where this fails: a high-value customer who genuinely is committing fraud — tiering by value raises exposure to exactly that case.' },
      liability:       { t: 'Re-map liability exposure to the current mandate',
                         d: 'Coverage assumed under prior terms may no longer hold now that system-breach liability sits with the institution.',
                         caveat: 'Where this fails: jurisdiction-specific carve-outs can leave pockets where the old terms still apply.' },
      exception_drift: { t: 'Codify the exception rules and measure drift',
                         d: 'Every hand-resolved exception without a rule is an operator improvising; codify the common cases and track the residual rate.',
                         caveat: 'Where this fails: a genuinely novel exception that the codified rule mislabels as routine drift.' },
      gross_net_gap:   { t: 'Put a net fraud-loss line in the P&L',
                         d: 'Gross loss less recoveries is the true drag; while it sits in operations the board never sees it.',
                         caveat: 'Where this fails: recoveries lag the loss period and distort any single reporting window.' },
      vendor_exposure: { t: 'Map shared dependencies and quantify the correlated exposure',
                         d: 'Concentration on shared tier-3 infrastructure is invisible to any single risk register until it is mapped.',
                         caveat: 'Where this fails: a dependency that looks shared but is actually isolated — mapping must verify, not assume.' }
    },

    /* "Don't know" on the hourly rate becomes a volume-scaled estimate rather than a zero.
     * Stated openly on the line it affects; it also widens the range via the `auto` flag. */
    derive: function (a) {
      if (a.per_hr === 'auto' || a.per_hr === undefined && a.volume) {
        if (a.per_hr === 'auto') { a.per_hr = (parseFloat(a.volume) || 0) * 1.2e-6; a._auto = 1; }
      }
      return a;
    }
  };
  root.SID_BANKING_FRAUD = CFG;
  if (typeof module !== 'undefined' && module.exports) module.exports = CFG;
})(typeof globalThis !== 'undefined' ? globalThis : this);
