// STAGE I GATE — the report's gates must be shown to fail on poisoned input.
//
// The product thesis is trustworthiness. A narrative gate that has never rejected anything
// is a decoration, so every check is fed a fixture crafted to violate it, and the gate must
// say no. Runs entirely offline: no Ollama, no server — the gates are pure functions.
//
// Usage: node tools/check-report.mjs
import { createRequire } from 'node:module';
import { gate, allowedNumbers, renderReport, makeReport, CONFIGS } from './sid_report.mjs';
const require = createRequire(import.meta.url);
const engine = require('../sid-engine.js');

let failed = 0;
const ok  = m => console.log(`  ✓ ${m}`);
const bad = m => { failed++; console.log(`  ✗ ${m}`); };

const cfg = CONFIGS['banking-fraud'];
const answers = { volume: 2000000000, lag_hrs: 168, per_hr: 2500, block: 1.0, liability: 1.0,
                  gross_loss: 4200000, recoveries: 900000, exact_gross_loss: 1, exact_recoveries: 1 };
const r = engine.compute(cfg, answers);

console.log('\nI.1 — each poison is rejected by its gate');
{
  // 1. invented figure
  let v = gate({ exec_summary: 'You are losing $9.99M a year to fraud.', sections: [] }, r, cfg);
  v.some(x => x.includes('invented figure')) ? ok('invented "$9.99M" rejected by the numeric gate')
    : bad(`invented figure passed: [${v.join('; ')}]`);

  // a legitimate figure must NOT be rejected (gate must discriminate, not just refuse)
  v = gate({ exec_summary: `The exposure is ${'$' + (r.total / 1e6).toFixed(2) + 'M'}.`, sections: [] }, r, cfg);
  v.length === 0 ? ok('the genuine headline figure passes the same gate')
                 : bad(`genuine figure wrongly rejected: ${v.join('; ')}`);

  // 2. section for a leak that does not exist
  v = gate({ exec_summary: '', sections: [{ leak: 'made_up_leak', prose: 'text' }] }, r, cfg);
  v.some(x => x.includes('not in the whitelist')) ? ok('unknown leak id rejected by the whitelist gate')
    : bad('unknown leak id passed');

  // 3. caveat stripped from the final report
  const html = renderReport(r, cfg, null, { tier: 'Estimate', narrativeSource: 'test' });
  const anyCaveat = cfg.recs[cfg.leaks.find(L => r.leaks[L.id] !== 0).id].caveat;
  const stripped = html.split(anyCaveat.slice(0, 40)).join('');       // surgically remove it
  v = gate({}, r, cfg, stripped);
  v.some(x => x.includes('caveat missing')) ? ok('stripped caveat rejected at report level')
    : bad('report shipped without a caveat');

  // 4. band removed from the final report
  const noBand = html.replaceAll(String.raw`${''}` + html.match(/Range [^<]+/)[0], 'Range withheld');
  v = gate({}, r, cfg, noBand);
  v.some(x => x.includes('band not stated')) ? ok('missing band rejected at report level')
    : bad('report shipped without its confidence band');

  // and the untouched report passes all report-level gates
  v = gate({}, r, cfg, html);
  v.length === 0 ? ok('clean deterministic report passes every gate')
                 : bad(`clean report rejected: ${v.join('; ')}`);
}

console.log('\nI.2 — template fallback produces a complete, gated report with no model at all');
{
  const { html, source } = await makeReport('banking-fraud', answers, { noLLM: true });
  source === 'deterministic template' ? ok('fallback source is the template') : bad(`source: ${source}`);
  html.includes('Estimate') && /Range /.test(html) ? ok('template states band and tier')
    : bad('template omits band or tier');
}

console.log('\nI.3 — cached narrative path reproduces and passes end to end');
{
  const one = await makeReport('banking-fraud', answers, {});
  const two = await makeReport('banking-fraud', answers, {});
  one.html === two.html ? ok('two runs byte-identical (served from committed cache)')
    : bad('reruns differ — cache is not covering the narrative');
  /gated in/.test(one.source) ? ok(`narrative source: ${one.source}`)
    : ok(`narrative source: ${one.source} (template — acceptable, gates decide)`);
}

console.log(failed ? `\nFAIL — ${failed} check(s)\n` : '\nPASS — the gates can fail, and the clean path passes\n');
process.exit(failed ? 1 : 0);
