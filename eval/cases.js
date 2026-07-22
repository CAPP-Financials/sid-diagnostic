/* SID eval case library — all 18 golden cases.
 *
 * INDEPENDENCE. `expect()` is arithmetic written from the case's stated dollar_rule, or for
 * loyalty from the frozen oracle which predates the config entirely. No expectation is ever
 * read back out of the domain config: a test that computes its expectation from the thing
 * under test proves only that the code equals itself.
 *
 * THE SPLIT IS DERIVED, NOT DECLARED. A leak is *fittable* if it contains a rate constant
 * chosen by judgment (0.0009, 0.15) — that is the only thing that could be tuned to make
 * cases pass. A leak whose factors are all answers has zero degrees of freedom: its rule
 * pre-exists in the golden dataset and the config is a transcription, so reading it while
 * authoring cannot contaminate anything. Those become the held-out set.
 *
 * Literals marked `fixed` (250 working days) are arithmetic facts, not judgments, and do not
 * make a leak fittable.
 *
 * WHAT THIS MEASURES: implementation fidelity on unfittable specifications. Stronger than
 * consistency, still weaker than predicting real client outcomes — only the precision-floor
 * loop fed by post-call debriefs can do that.
 */
const { createRequire } = require('node:module');
const req = createRequire(__filename);
const { frozenRecalculate } = req('../tools/_frozen-recalculate.js');

const CONFIGS = {
  'banking-fraud': req('../domains/banking-fraud.js'),
  'loyalty':       req('../domains/loyalty.js'),
  'enterprise-ai': req('../domains/enterprise-ai.js')
};

/** a judgment-chosen rate makes a leak fittable; a `fixed` arithmetic fact does not */
function isFittable(leak) {
  return [].concat(leak.mul || [], leak.minus || [])
    .some(t => t.lit !== undefined && t.lit !== 1 && !t.fixed);
}
function splitFor(domain, leakId) {
  const L = CONFIGS[domain].leaks.find(l => l.id === leakId);
  if (!L) throw new Error(`unknown leak ${domain}/${leakId}`);
  return isFittable(L) ? 'seed' : 'holdout';
}

const bank = o => ({ volume: 2000000000, lag_hrs: 168, per_hr: 2500, block: 1.0, liability: 1.0, ...o });
const loy  = o => ({ revenue: '12500000', markets: '3', data_migration: 'messy', data_quality: '3',
  multi_currency: 'manual', fraud_detection: 'none', abuse_types: 'multiple', fraud_threshold: '3',
  roi_subtract_fraud: 'no', last_audit: 'never', roi_confidence: '4',
  knowledge_sharing: 'none', cascading: 'never', market_maturity: '4', ...o });
const ent  = o => ({ spend: 20000000, baseline: 1.00, measure: 0.60, alloc: 0.60, shadow: 'unknown', ...o });
const ex   = (a, k, v) => ({ ...a, [k]: v, ['exact_' + k]: 1 });

/* answer-value helper mirroring the engine's `parseFloat(v) || def` fallback, so expectations
   reproduce defaulting behaviour without importing engine code */
const A = (a, k, def) => (a['exact_' + k] !== undefined && isFinite(parseFloat(a[k])))
  ? parseFloat(a[k]) : (parseFloat(a[k]) || def || 0);

const RAW = [
  /* ── banking-fraud ─────────────────────────────────────────────────────────── */
  { id: 'C7', domain: 'banking-fraud', leak: 'window', name: 'Fraud loss measured post-settlement',
    expect: a => A(a, 'lag_hrs') * A(a, 'per_hr') * A(a, 'incidents', 12),
    variants: [
      { label: 'weekly-recon',   answers: bank({}) },
      { label: 'monthly-settle', answers: ex(bank({ lag_hrs: 720, per_hr: 12000 }), 'incidents', 20) },
      { label: 'real-time',      answers: ex(bank({ lag_hrs: 0.25, per_hr: 400 }), 'incidents', 4) } ] },

  { id: 'C14', domain: 'banking-fraud', leak: 'overblock', name: 'False-positive over-blocking',
    expect: a => Math.max(0, A(a, 'volume') * A(a, 'decline_rate', 12) * 0.0001 * A(a, 'block') - A(a, 'volume') * 0.0002),
    variants: [
      { label: 'hard-block',    answers: bank({}) },
      { label: 'tiered',        answers: bank({ block: 0.15 }) },
      { label: 'step-up-large', answers: bank({ block: 0.35, volume: 12000000000 }) } ] },

  { id: 'C3', domain: 'banking-fraud', leak: 'liability', name: 'Post-2026 liability mismeasurement',
    expect: a => A(a, 'volume') * 0.0009 * A(a, 'liability'),
    variants: [
      { label: 'unmapped',     answers: bank({}) },
      { label: 'partial',      answers: bank({ liability: 0.5, volume: 250000000 }) },
      { label: 'mapped-tier1', answers: bank({ liability: 0.1, volume: 12000000000 }) } ] },

  { id: 'C2', domain: 'banking-fraud', leak: 'exception_drift', name: 'Back-office exception drift',
    expect: a => A(a, 'exceptions_pd', 120) * A(a, 'exception_cost', 250) * A(a, 'misresolve_rate', 0.04) * 250,
    variants: [
      { label: 'assumed',      answers: bank({}) },
      { label: 'high-volume',  answers: ex(ex(bank({ exception_cost: 900 }), 'exceptions_pd', 500), 'misresolve_rate', 0.09) },
      { label: 'tight-ops',    answers: ex(ex(bank({ exception_cost: 40 }), 'exceptions_pd', 25), 'misresolve_rate', 0.01) } ] },

  { id: 'C8', domain: 'banking-fraud', leak: 'gross_net_gap', name: 'Fraud drag the P&L never shows',
    expect: a => Math.max(0, A(a, 'gross_loss', 0) - A(a, 'recoveries', 0)),
    variants: [
      { label: 'gross-only',   answers: ex(ex(bank({}), 'gross_loss', 4200000), 'recoveries', 900000) },
      { label: 'well-recovered', answers: ex(ex(bank({}), 'gross_loss', 1000000), 'recoveries', 950000) },
      { label: 'recovery-exceeds', answers: ex(ex(bank({}), 'gross_loss', 500000), 'recoveries', 800000) } ] },  // floors at 0

  { id: 'C15', domain: 'banking-fraud', leak: 'vendor_exposure', name: 'Shared-infrastructure concentration exposure',
    expect: a => A(a, 'volume') * A(a, 'shared_dep_share', 0.35) * 0.002,
    variants: [
      { label: 'assumed',   answers: bank({}) },
      { label: 'heavily-shared', answers: ex(bank({}), 'shared_dep_share', 0.75) },
      { label: 'isolated',  answers: ex(bank({ volume: 250000000 }), 'shared_dep_share', 0.10) } ] },

  /* ── loyalty — the frozen oracle is the independent expectation ─────────────── */
  { id: 'C12', domain: 'loyalty', leak: 'fraud', name: 'Incentive abuse and coupon stacking',
    expect: a => frozenRecalculate(a).fraudLeak,
    variants: [
      { label: 'no-detection', answers: loy({}) },
      { label: 'advanced',     answers: loy({ fraud_detection: 'advanced', abuse_types: 'none' }) },
      { label: 'global',       answers: loy({ markets: '15', revenue: '250000000' }) } ] },

  { id: 'C1', domain: 'loyalty', leak: 'data', name: 'Data foundation rot',
    expect: a => frozenRecalculate(a).dataLeak,
    variants: [
      { label: 'messy-migration', answers: loy({}) },
      { label: 'clean',           answers: loy({ data_migration: 'clean', data_quality: '9', multi_currency: 'handled' }) },
      { label: 'enterprise',      answers: loy({ revenue: '750000000', markets: '7' }) } ] },

  { id: 'C6', domain: 'loyalty', leak: 'roi', name: 'ROI inflated by unsubtracted fraud',
    expect: a => frozenRecalculate(a).roiLeak,
    variants: [
      { label: 'never-audited', answers: loy({}) },
      { label: 'disciplined',   answers: loy({ roi_subtract_fraud: 'yes', last_audit: 'current', roi_confidence: '9' }) },
      { label: 'unsure',        answers: loy({ roi_subtract_fraud: 'unsure', revenue: '50000000' }) } ] },

  { id: 'C13', domain: 'loyalty', leak: 'silo', name: 'Cross-market knowledge silos',
    expect: a => frozenRecalculate(a).siloLeak,
    variants: [
      { label: 'no-sharing',    answers: loy({}) },
      { label: 'systematic',    answers: loy({ knowledge_sharing: 'systematic', cascading: 'instant', market_maturity: '9' }) },
      { label: 'single-market', answers: loy({ markets: '1' }) } ] },   // `when` gates it to zero

  /* ── enterprise-ai ─────────────────────────────────────────────────────────── */
  { id: 'C5', domain: 'enterprise-ai', leak: 'unprovable', name: 'No baseline captured before pilot',
    expect: a => A(a, 'spend') * A(a, 'pilot_share', 0.40) * A(a, 'baseline'),
    variants: [
      { label: 'no-baseline', answers: ent({}) },
      { label: 'measured',    answers: ent({ baseline: 0.10 }) },
      { label: 'known-share', answers: ex(ent({ spend: 100000000 }), 'pilot_share', 0.65) } ] },

  { id: 'C9', domain: 'enterprise-ai', leak: 'untraced', name: 'ROI measured on usage, not EBIT',
    expect: a => A(a, 'spend') * A(a, 'deployed_share', 0.35) * A(a, 'measure'),
    variants: [
      { label: 'usage-only',  answers: ent({}) },
      { label: 'ebit-traced', answers: ent({ measure: 0.05 }) },
      { label: 'known-share', answers: ex(ent({ spend: 2000000 }), 'deployed_share', 0.50) } ] },

  { id: 'C18', domain: 'enterprise-ai', leak: 'misallocated', name: 'Budget in front-office, ROI in back-office',
    expect: a => A(a, 'spend') * A(a, 'alloc') * 0.15,
    variants: [
      { label: 'front-heavy', answers: ent({}) },
      { label: 'back-heavy',  answers: ent({ alloc: 0.20 }) },
      { label: 'small-spend', answers: ent({ alloc: 0.40, spend: 250000 }) } ] },

  { id: 'C4', domain: 'enterprise-ai', leak: 'unfit_input', name: 'Pilots judged on unfit data',
    /* complement of C5 — the pilot spend that DOES have a baseline */
    expect: a => A(a, 'spend') * A(a, 'pilot_share', 0.40) * (1 - A(a, 'baseline')) * A(a, 'data_ready', 0.45),
    variants: [
      { label: 'no-baseline-so-zero', answers: ent({}) },                       // baseline 1.0 → exactly 0
      { label: 'measured-unfit',      answers: ent({ baseline: 0.10, data_ready: 0.80 }) },
      { label: 'measured-and-fit',    answers: ent({ baseline: 0.10, data_ready: 0.10 }) } ] },

  { id: 'C10', domain: 'enterprise-ai', leak: 'idle', name: 'Deployed and idle',
    expect: a => A(a, 'spend') * A(a, 'idle_share', 0.12),
    variants: [
      { label: 'assumed',   answers: ent({}) },
      { label: 'high-idle', answers: ex(ent({}), 'idle_share', 0.28) },
      { label: 'low-idle',  answers: ex(ent({ spend: 100000000 }), 'idle_share', 0.05) } ] },

  { id: 'C11', domain: 'enterprise-ai', leak: 'agent_washed', name: 'Agent-washed spend, wrong benchmark',
    expect: a => A(a, 'spend') * A(a, 'agent_share', 0.18) * A(a, 'agent_real', 0.55) * 0.40,
    variants: [
      { label: 'assumed',    answers: ent({}) },
      { label: 'relabelled', answers: ex(ent({ agent_real: 0.85 }), 'agent_share', 0.35) },
      { label: 'genuine',    answers: ex(ent({ agent_real: 0.15 }), 'agent_share', 0.10) } ] },

  { id: 'C17', domain: 'enterprise-ai', leak: 'feedback_debt', name: 'Re-correcting the same output',
    expect: a => A(a, 'correction_hrs', 1800) * A(a, 'blended_rate', 85),
    variants: [
      { label: 'assumed',   answers: ent({}) },
      { label: 'heavy',     answers: ex(ex(ent({}), 'correction_hrs', 9000), 'blended_rate', 150) },
      { label: 'light',     answers: ex(ex(ent({}), 'correction_hrs', 300), 'blended_rate', 50) } ] },

  { id: 'C16', domain: 'enterprise-ai', leak: 'shadow_unknown', name: 'Spend whose real return is unknowable',
    expect: a => A(a, 'spend') * A(a, 'shadow_share', 0.15),
    variants: [
      { label: 'assumed',     answers: ent({}) },
      { label: 'widespread',  answers: ex(ent({}), 'shadow_share', 0.32) },
      { label: 'measured',    answers: ex(ent({ shadow: 'measured' }), 'shadow_share', 0.06) } ] }
];

// split is computed from the config, never hand-written
const CASES = RAW.map(c => ({ ...c, split: splitFor(c.domain, c.leak),
                              fittable: isFittable(CONFIGS[c.domain].leaks.find(l => l.id === c.leak)),
                              kind: (CONFIGS[c.domain].leaks.find(l => l.id === c.leak).kind) || 'loss' }));

function answerSets() {
  const out = [];
  for (const c of CASES)
    for (const v of c.variants)
      out.push({ caseId: c.id, domain: c.domain, leak: c.leak, split: c.split, kind: c.kind,
                 fittable: c.fittable, name: c.name, label: v.label, answers: v.answers, expect: c.expect });
  return out;
}

module.exports = { CASES, answerSets, isFittable, CONFIGS,
  TOTAL_GOLDEN: 18, SCOREABLE: CASES.length };
