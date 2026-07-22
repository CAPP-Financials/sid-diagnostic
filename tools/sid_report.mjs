// H3 — the gated deep report. The paid deliverable.
//
// Every number in the report is computed by the engine. The LLM writes ONLY narrative, and
// narrative that fails the gates is discarded for the deterministic template. A local model
// (nothing leaves this machine) writes the prose; four deterministic gates decide whether
// that prose ships.
//
//   answers → [det] compute → d → [det] recs+caveats → [LLM] narrative → [det] gate
//           → pass | one retry | deterministic template → HTML report
//
// Determinism: responses cached by sha256(model+prompt), committed. Prompts contain no
// timestamps and use sorted keys, so a rerun reproduces byte-identically without Ollama.
//
// Usage: node tools/sid_report.mjs <domain> <scenario.json|--demo> [--out name] [--no-llm]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const engine = require('../sid-engine.js');

export const CONFIGS = {
  'banking-fraud': require('../domains/banking-fraud.js'),
  'loyalty':       require('../domains/loyalty.js'),
  'enterprise-ai': require('../domains/enterprise-ai.js')
};
const MODEL = 'gemma4:12b';
const OLLAMA = 'http://localhost:11434/api/generate';
const CACHE = path.join(ROOT, 'eval', 'report-cache');

const sig = v => { const x = Math.abs(v); return v.toFixed(x >= 100 ? 0 : x >= 10 ? 1 : 2); };
const usd = n => { if (!Number.isFinite(n)) return '—'; const a = Math.abs(n);
  if (a >= 1e9) return '$' + sig(n / 1e9) + 'B'; if (a >= 1e6) return '$' + sig(n / 1e6) + 'M';
  if (a >= 1e4) return '$' + sig(n / 1e3) + 'K'; return '$' + Math.round(n).toLocaleString('en-US'); };
const pctF = p => (p * 100).toFixed(Math.abs(p * 100) >= 1 ? 2 : 4) + '%';

/* ── the allowed-number set: every figure the prose is permitted to contain ───── */
export function allowedNumbers(r, cfg) {
  const vals = [r.total, r.contingent, r.unmeasurable, r.denominator, r.lo, r.hi,
                r.pct.point * 100, r.pct.lo * 100, r.pct.hi * 100, r.overall];
  for (const L of cfg.leaks) {
    const b = r.byLeak[L.id];
    vals.push(r.leaks[L.id], b.pct.point * 100, b.usd.lo, b.usd.hi, b.pct.lo * 100, b.pct.hi * 100);
  }
  for (const c of cfg.categories) vals.push(r.scores[c.id]);
  return vals.filter(Number.isFinite);
}

/* token → number, handling $5.04M / $5,040,000 / 21.00% / 86.7 */
function parseToken(tok) {
  const m = /^\$?([\d.,]+)\s*([BMK])?%?$/.exec(tok.trim());
  if (!m) return null;
  const n = parseFloat(m[1].replace(/,/g, ''));
  return n * ({ B: 1e9, M: 1e6, K: 1e3 }[m[2]] || 1);
}

/* ── THE FOUR GATES — all deterministic, ground truth is the engine result ────── */
export function gate(narrative, r, cfg, reportHtml) {
  const violations = [];

  // 1. numeric: every $ / % token in the prose must match an allowed value within rounding.
  //    (Deviation from the original spec, recorded: the model's own numbers_used echo is not
  //    trusted — small local models fumble it. Direct checking is stricter.)
  const allowed = allowedNumbers(r, cfg);
  const prose = [narrative.exec_summary || '', ...(narrative.sections || []).map(s => s.prose || '')].join(' ');
  for (const tok of prose.match(/\$[\d.,]+\s*[BMK]?|[\d.,]+\s*%/g) || []) {
    const v = parseToken(tok.replace(/\s+/g, ''));
    if (v === null) continue;
    const ok = allowed.some(a => a === 0 ? Math.abs(v) < 1e-6 : Math.abs(v - a) / Math.abs(a) <= 0.005);
    if (!ok) violations.push(`invented figure "${tok.trim()}" — matches no computed value`);
  }

  // 2. whitelist: the LLM may only write sections for leaks that exist
  const known = new Set(cfg.leaks.map(L => L.id));
  for (const s of narrative.sections || [])
    if (!known.has(s.leak)) violations.push(`section for unknown leak "${s.leak}" — not in the whitelist`);

  // 3. caveat: the FINAL REPORT must carry every triggered rec's caveat verbatim.
  //    Checked at report level because the deterministic renderer owns the caveats — the LLM
  //    can neither add nor remove them, and this proves it.
  if (reportHtml !== undefined) {
    // compare in the same encoding the renderer writes: "P&L" arrives as "P&amp;L", and
    // checking the raw string against escaped HTML reported a phantom missing caveat
    const escd = s => String(s).replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
    for (const L of cfg.leaks) {
      if (!r.leaks[L.id]) continue;
      const c = cfg.recs && cfg.recs[L.id] && cfg.recs[L.id].caveat;
      if (c && !reportHtml.includes(escd(c))) violations.push(`caveat missing verbatim for "${L.id}"`);
    }
    // 4. band + tier stated
    if (!reportHtml.includes(usd(r.lo)) || !reportHtml.includes(usd(r.hi)))
      violations.push('confidence band not stated in the report');
    if (!/Estimate|Refined/.test(reportHtml)) violations.push('confidence tier not stated');
  }
  return violations;
}

/* ── canonical prompt: sorted keys, fixed formatting, no timestamps ───────────── */
export function buildPrompt(r, cfg) {
  /* A 12B model follows an enumerated task far better than an open one: name exactly which
   * sections to write, one id per line, and show the JSON shape with a REAL id. The first
   * attempt at a looser prompt produced a section for "leak_id_not_found_or_invalid_error". */
  const active = cfg.leaks.filter(L => r.leaks[L.id] !== 0);
  const leakLines = active.map(L => {
    const b = r.byLeak[L.id];
    return `${L.id}: ${L.name}. ${usd(r.leaks[L.id])} = ${pctF(b.pct.point)} of ${cfg.denominatorLabel}. ${L.why || ''}`;
  }).join('\n');
  const first = active[0] ? active[0].id : 'example';
  return [
    'You write narrative for a financial diagnostic report. Plain business English. Short',
    'sentences. No hype words (significant, robust, leverage, crucial).',
    '',
    'FIGURES YOU MAY QUOTE (never compute or invent any other number):',
    `headline: ${usd(r.total)}, range ${usd(r.lo)} to ${usd(r.hi)}, ${pctF(r.pct.point)} of ${cfg.denominatorLabel}`,
    r.contingent ? `contingent exposure (kept apart from headline): ${usd(r.contingent)}` : '',
    r.unmeasurable ? `unmeasurable at-risk spend (kept apart): ${usd(r.unmeasurable)}` : '',
    '',
    'THE LINES:',
    leakLines,
    '',
    `TASK: return one JSON object, nothing else, in exactly this shape:`,
    `{"exec_summary": "...", "sections": [{"leak": "${first}", "prose": "..."}]}`,
    `- exec_summary: at most 100 words, addressed to a CFO.`,
    `- sections: one entry per id in this exact list, in this order: ${active.map(L => L.id).join(', ')}`,
    `- each prose: at most 45 words on what that line means operationally.`,
    `- the "leak" field must be copied character-for-character from the list above.`
  ].filter(Boolean).join('\n');
}

const GEN_OPTIONS = { temperature: 0, seed: 42, num_predict: 4096 };

async function callLLM(prompt) {
  fs.mkdirSync(CACHE, { recursive: true });
  /* options are part of the key: hashing only model+prompt replayed responses generated
     under an old token budget, so a budget fix silently never reached the model */
  const key = crypto.createHash('sha256')
    .update(MODEL + '\n' + JSON.stringify(GEN_OPTIONS) + '\n' + prompt).digest('hex');
  const file = path.join(CACHE, key + '.json');
  if (fs.existsSync(file)) return { ...JSON.parse(fs.readFileSync(file, 'utf8')), cached: true };
  const res = await fetch(OLLAMA, {
    method: 'POST',
    /* gemma4 spends hidden thinking tokens from this same budget — the preflight used 48
       tokens to say one word — so the ceiling must leave room for thought AND the JSON */
    body: JSON.stringify({ model: MODEL, prompt, stream: false, format: 'json', options: GEN_OPTIONS })
  });
  if (!res.ok) throw new Error(`ollama ${res.status}`);
  const body = await res.json();
  const out = { model: MODEL, response: body.response };
  fs.writeFileSync(file, JSON.stringify(out, null, 1));
  return out;
}

/* ── deterministic renderer: numbers, recs and caveats are OURS, never the LLM's ── */
export function renderReport(r, cfg, narrative, meta) {
  const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const proseFor = id => {
    const s = narrative && (narrative.sections || []).find(x => x.leak === id);
    return s ? `<p class="prose">${esc(s.prose)}</p>` : '';
  };
  const leakBlocks = cfg.leaks.filter(L => r.leaks[L.id] !== 0).map(L => {
    const b = r.byLeak[L.id]; const rec = (cfg.recs || {})[L.id]; const kind = r.kinds[L.id];
    return `<section class="leak ${kind}">
  <div class="top"><h3>${esc(L.name)}</h3><div class="amt">${usd(r.leaks[L.id])}
    <span class="p">${pctF(b.pct.point)} of ${esc(cfg.denominatorLabel)}${kind !== 'loss' ? ' · ' + kind + ', outside the headline' : ''}</span></div></div>
  ${proseFor(L.id)}
  ${rec ? `<div class="rec"><strong>${esc(rec.t)}.</strong> ${esc(rec.d)}<div class="caveat">${esc(rec.caveat)}</div></div>` : ''}
</section>`;
  }).join('\n');

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Signal Integrity Diagnostic — ${esc(cfg.label)}</title>
<link href="https://fonts.googleapis.com/css2?family=Zilla+Slab:wght@600;700&family=Public+Sans:wght@400;600&family=IBM+Plex+Mono:wght@400;600&display=swap" rel="stylesheet">
<style>
body{background:#E9EDE4;color:#16211C;font:15px/1.65 "Public Sans",system-ui,sans-serif;margin:0}
.wrap{max-width:860px;margin:0 auto;padding:40px 28px}
h1,h2,h3{font-family:"Zilla Slab",Georgia,serif;font-weight:600;line-height:1.15;margin:0}
.mono{font-family:"IBM Plex Mono",monospace;font-variant-numeric:tabular-nums}
.mast{border-bottom:2px solid #16211C;padding-bottom:14px;margin-bottom:22px}
.kicker{font:600 10px "IBM Plex Mono",monospace;letter-spacing:.14em;text-transform:uppercase;color:#5A6560}
h1{font-size:30px;margin:6px 0 2px}
.headline{background:#F6F8F3;border:1px solid rgba(22,33,28,.16);border-top:2px solid #16211C;padding:18px 20px;margin:18px 0}
.big{font:600 34px "IBM Plex Mono",monospace;color:#A32C22}
.range{color:#5A6560;font-size:13px}
.apart{font-size:13px;color:#5A6560;margin-top:6px}
.prose{margin:.5rem 0;max-width:64ch}
section.leak{border-top:1px solid rgba(22,33,28,.16);padding:16px 0}
section.leak .top{display:flex;justify-content:space-between;gap:14px;align-items:baseline}
section.leak h3{font-size:17px}
.amt{font:600 17px "IBM Plex Mono",monospace;color:#A32C22;text-align:right;white-space:nowrap}
.amt .p{display:block;font-weight:400;font-size:11px;color:#5A6560}
section.contingent .amt,section.unmeasurable .amt{color:#5A6560}
.rec{background:#F6F8F3;border:1px solid rgba(22,33,28,.14);padding:10px 12px;margin-top:8px;font-size:13.5px}
.caveat{color:#A32C22;font-size:12.5px;margin-top:6px}
.method{border-top:2px solid #16211C;margin-top:26px;padding-top:12px;color:#5A6560;font-size:12.5px;max-width:70ch}
@media print{body{background:#fff}.wrap{padding:0}}
</style></head><body><div class="wrap">
<div class="mast"><div class="kicker">Signal Integrity Diagnostic · ${esc(cfg.label)} · ${esc(meta.tier)} tier · narrative: ${esc(meta.narrativeSource)}</div>
<h1>What the numbers leave out</h1></div>
${narrative && narrative.exec_summary ? `<p class="prose"><strong>Summary.</strong> ${esc(narrative.exec_summary)}</p>` : ''}
<div class="headline"><div class="kicker">Unrecorded annual exposure</div>
<div class="big mono">${usd(r.total)}</div>
<div class="range mono">Range ${usd(r.lo)} – ${usd(r.hi)} · ${pctF(r.pct.point)} of ${esc(cfg.denominatorLabel)} · Confidence tier: ${esc(meta.tier)}</div>
${r.contingent ? `<div class="apart">Contingent exposure, reported apart from the headline: <span class="mono">${usd(r.contingent)}</span></div>` : ''}
${r.unmeasurable ? `<div class="apart">Spend whose return is unknowable, reported apart: <span class="mono">${usd(r.unmeasurable)}</span></div>` : ''}
</div>
${leakBlocks}
<div class="method">Every figure above is computed by fixed arithmetic from the inputs; the narrative is machine-written on this machine and gated so it can quote only computed figures. Default rates are practitioner estimates, marked in the diagnostic. Where a recommendation is given, the condition under which it fails is stated with it.</div>
</div></body></html>`;
}

/* ── pipeline ─────────────────────────────────────────────────────────────────── */
export async function makeReport(domain, answers, opts = {}) {
  const cfg = CONFIGS[domain];
  if (!cfg) throw new Error(`unknown domain ${domain}`);
  const r = engine.compute(cfg, answers);
  const tier = r.refined ? 'Refined' : 'Estimate';
  const log = [];

  /* ONE CALL PER PIECE. Asked for all sections at once, a 12B model writes the first well
   * and then abbreviates the rest to a bare "leak_2" — the whole narrative failed on its
   * laziness. Decomposed, each call is trivially simple, each piece is gated on its own,
   * and a bad section costs only its own prose, never the report. */
  let narrative = null, source = 'deterministic template';
  if (!opts.noLLM) {
    const pieces = { exec_summary: null, sections: [] };
    let okCount = 0, total = 0;

    const askOne = async (label, prompt, field) => {
      total++;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const res = await callLLM(prompt + (attempt === 2 ? '\nReturn ONLY the JSON object. No text outside it.' : ''));
          const parsed = JSON.parse(res.response);
          /* gemma4 misspells the key — {"pronce": ...}, same typo at temperature 0. The key
             is ceremony; the gates judge the content. Take the requested field, or the value
             of a sole string-valued key when there is exactly one. */
          let text = parsed[field];
          if (typeof text !== 'string') {
            const strKeys = Object.keys(parsed).filter(k => typeof parsed[k] === 'string');
            if (strKeys.length === 1) text = parsed[strKeys[0]];
          }
          if (typeof text !== 'string' || !text.trim()) throw new Error(`no "${field}" string`);
          const v = gate({ exec_summary: text, sections: [] }, r, cfg);   // numeric gate on this piece
          if (v.length === 0) { okCount++; return text; }
          log.push(`${label} attempt ${attempt} rejected: ${v.join('; ')}`);
        } catch (e) { log.push(`${label} attempt ${attempt} failed: ${String(e.message).slice(0, 100)}`); }
      }
      return null;                                        // this piece falls back, alone
    };

    const head = `You write one piece of narrative for a financial diagnostic. Plain business English, short sentences, no hype words. Quote ONLY figures given here, never compute or invent a number.\n`;
    pieces.exec_summary = await askOne('exec_summary',
      head +
      `Headline unrecorded annual loss: ${usd(r.total)}, range ${usd(r.lo)} to ${usd(r.hi)}, ` +
      `${pctF(r.pct.point)} of ${cfg.denominatorLabel}.` +
      (r.contingent ? ` Contingent exposure kept apart from the headline: ${usd(r.contingent)}.` : '') +
      (r.unmeasurable ? ` Unmeasurable at-risk spend kept apart: ${usd(r.unmeasurable)}.` : '') +
      `\nReturn JSON: {"exec_summary": "<at most 90 words, addressed to a CFO>"}`,
      'exec_summary');

    for (const L of cfg.leaks) {
      if (r.leaks[L.id] === 0) continue;
      const b = r.byLeak[L.id];
      const prose = await askOne(L.id,
        head +
        `The line: "${L.name}". Figure: ${usd(r.leaks[L.id])} = ${pctF(b.pct.point)} of ${cfg.denominatorLabel}. ` +
        `Context: ${L.why || ''}\nReturn JSON: {"prose": "<at most 45 words on what this line means operationally>"}`,
        'prose');
      if (prose) pieces.sections.push({ leak: L.id, prose });
    }

    if (okCount > 0) { narrative = pieces; source = `${MODEL} (${okCount}/${total} pieces gated in)`; }
    else log.push('no piece survived the gates — full deterministic template');
  }

  const html = renderReport(r, cfg, narrative, { tier, narrativeSource: source });
  const post = gate(narrative || {}, r, cfg, html);        // report-level gates (caveat, band, tier)
  if (post.length) throw new Error('report-level gate failed: ' + post.join('; '));
  return { html, r, narrative, source, log };
}

/* ── CLI ──────────────────────────────────────────────────────────────────────── */
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const [domain, scenarioArg] = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const noLLM = process.argv.includes('--no-llm');
  const DEMO = {
    'banking-fraud': { volume: 2000000000, lag_hrs: 168, per_hr: 2500, block: 1.0, liability: 1.0,
                       gross_loss: 4200000, recoveries: 900000, exact_gross_loss: 1, exact_recoveries: 1 },
    'enterprise-ai': { spend: 20000000, baseline: 1.00, measure: 0.60, alloc: 0.60, shadow: 'unknown' },
    'loyalty':       { revenue: '12500000', markets: '3', data_migration: 'messy', data_quality: '3',
                       multi_currency: 'manual', fraud_detection: 'none', abuse_types: 'multiple',
                       fraud_threshold: '3', roi_subtract_fraud: 'no', last_audit: 'never',
                       roi_confidence: '4', knowledge_sharing: 'none', cascading: 'never', market_maturity: '4' }
  };
  const answers = (!scenarioArg || scenarioArg === '--demo') ? DEMO[domain]
    : JSON.parse(fs.readFileSync(scenarioArg, 'utf8'));
  const { html, source, log } = await makeReport(domain, answers, { noLLM });
  const outDir = path.join(ROOT, 'reports');
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, `${domain}-report.html`);
  fs.writeFileSync(out, html);
  console.log(`${path.relative(ROOT, out)}  narrative: ${source}`);
  for (const l of log) console.log('  note:', l);
}
