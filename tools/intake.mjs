// Generate a client intake sheet from a domain config.
// Usage: node tools/intake.mjs <domain> [outfile]
//   node tools/intake.mjs loyalty business/intake-loyalty.html
//
// Generated from the config on purpose: the retainer promises the client fills "the same
// intake sheet each time", and a hand-written sheet drifts from what the engine actually
// needs the moment a question changes. Regenerate after any domain edit.

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');

const domain = process.argv[2] || 'loyalty';
const outArg = process.argv[3] || `business/intake-${domain}.html`;

const cfgPath = path.join(ROOT, 'domains', `${domain}.js`);
if (!fs.existsSync(cfgPath)) {
  console.error(`No config at ${cfgPath}. Available: ${fs.readdirSync(path.join(ROOT, 'domains')).join(', ')}`);
  process.exit(1);
}
const cfg = require(cfgPath);
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// A conditional question is only asked when an earlier answer makes it relevant. Say so on the
// sheet rather than dropping it, otherwise the client silently skips a row the engine wants.
const condNote = q => {
  if (!q.showIf) return '';
  const on = q.showIf.ans || q.showIf.id || 'an earlier answer';
  const src = cfg.questions.find(x => x.id === on);
  return `<span class="cond">only if: ${esc(src ? src.title : on)}</span>`;
};

const rowHtml = (q, i) => {
  const n = String(i + 1).padStart(2, '0');
  let body = '';

  if (q.type === 'options') {
    body += '<div class="opts">' + q.options.map(o =>
      `<label class="opt"><input type="checkbox" name="${esc(q.id)}"> <span><b>${esc(o.l)}</b>${o.desc ? `<i>${esc(o.desc)}</i>` : ''}</span></label>`
    ).join('') + '</div>';
    if (q.exact) {
      body += `<div class="exact"><span class="xlab">${esc(q.exactLabel || 'Exact value')}</span><span class="xin"></span>
        <em class="xnote">Supplying the exact figure moves this line from Estimate to Refined.</em></div>`;
    }
  } else if (q.type === 'slider') {
    body += `<div class="exact"><span class="xlab">Value between ${q.min} and ${q.max}</span><span class="xin short"></span>
      <em class="xnote">Left blank, ${q.default} is assumed and the report says so.</em></div>`;
  } else if (q.type === 'exact-only') {
    body += `<div class="exact"><span class="xlab">${esc(q.exactLabel || q.title)}</span><span class="xin"></span>
      <em class="xnote">Optional. Left blank, a stated default is used.</em></div>`;
  }

  return `<li class="row">
    <span class="n">${n}</span>
    <div class="q">
      <h3>${esc(q.title)} ${condNote(q)}</h3>
      ${q.hint ? `<p class="hint">${esc(q.hint)}</p>` : ''}
      ${body}
    </div>
  </li>`;
};

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 32 32%27><rect width=%2732%27 height=%2732%27 fill=%27%23F6F8F3%27/><rect y=%277%27 width=%2732%27 height=%275%27 fill=%27%23E9EDE4%27/><rect y=%2720%27 width=%2732%27 height=%275%27 fill=%27%23E9EDE4%27/><rect x=%273%27 y=%274%27 width=%273%27 height=%2724%27 fill=%27%23A32C22%27/></svg>">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Monthly intake · ${esc(cfg.label || domain)}</title>
<link href="https://fonts.googleapis.com/css2?family=Zilla+Slab:wght@600;700&family=Public+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
:root{--stock:#E9EDE4;--stock-alt:#DCE3D4;--paper:#F6F8F3;--ink:#16211C;--graphite:#5A6560;
--faint:#8A938C;--variance:#A32C22;--rule:rgba(22,33,28,.16);--rule-soft:rgba(22,33,28,.08)}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{background:var(--stock);color:var(--ink);font-family:"Public Sans",system-ui,sans-serif;
font-size:9.5pt;line-height:1.45;padding:24px 16px 64px;-webkit-font-smoothing:antialiased}
.sheet{width:190mm;max-width:100%;margin:0 auto;background:var(--paper);
border:1px solid var(--rule);padding:12mm 13mm 10mm}
.lab{font-family:"IBM Plex Mono",monospace;font-size:7.5pt;letter-spacing:.18em;
text-transform:uppercase;color:var(--variance);font-weight:600;margin:0}
h1{font-family:"Zilla Slab",Georgia,serif;font-weight:700;font-size:18pt;
line-height:1.06;letter-spacing:-.015em;margin:4px 0 0}
.sub{margin:6px 0 0;color:var(--graphite);max-width:125mm}
hr.hv{border:0;border-top:1.5px solid var(--ink);margin:10px 0 0}
.head{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;padding:8px 0 9px;
border-bottom:1px solid var(--rule)}
.hl{font-family:"IBM Plex Mono",monospace;font-size:6.5pt;letter-spacing:.14em;
text-transform:uppercase;color:var(--faint);margin:0 0 5px}
.hv2{border-bottom:1px dotted var(--faint);height:13px}
ol.rows{list-style:none;margin:12px 0 0;padding:0}
li.row{display:grid;grid-template-columns:18px 1fr;gap:8px;padding:7px 7px;align-items:start;
page-break-inside:avoid}
li.row:nth-child(odd){background:var(--stock)}
.n{font-family:"IBM Plex Mono",monospace;font-size:8pt;color:var(--faint);padding-top:2px}
.q h3{font-family:"Public Sans",sans-serif;font-size:9.5pt;font-weight:600;margin:0}
.cond{font-family:"IBM Plex Mono",monospace;font-size:6.2pt;letter-spacing:.1em;
text-transform:uppercase;color:var(--variance);border:1px solid var(--variance);
border-radius:2px;padding:0 3px;margin-left:5px;white-space:nowrap}
.hint{margin:2px 0 0;font-size:8.2pt;color:var(--graphite);line-height:1.4}
.opts{display:flex;flex-wrap:wrap;gap:4px 14px;margin-top:5px}
.opt{display:flex;align-items:flex-start;gap:5px;font-size:8.5pt;min-width:30%}
.opt input{margin:2px 0 0;flex-shrink:0}
.opt b{font-weight:600}
.opt i{display:block;font-style:normal;font-size:7.6pt;color:var(--graphite)}
.exact{margin-top:6px;display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
.xlab{font-family:"IBM Plex Mono",monospace;font-size:7pt;letter-spacing:.1em;
text-transform:uppercase;color:var(--graphite)}
.xin{flex:1;min-width:45mm;border-bottom:1px solid var(--ink);height:14px}
.xin.short{flex:0 0 26mm;min-width:26mm}
.xnote{font-size:7.4pt;color:var(--faint);font-style:normal;flex-basis:100%}
.foot{margin-top:12px;padding-top:8px;border-top:1px solid var(--rule-soft);
font-family:"IBM Plex Mono",monospace;font-size:7pt;color:var(--faint);line-height:1.6}
@media print{
  @page{size:A4;margin:0}
  body{background:#fff;padding:0}
  .sheet{width:auto;border:0;padding:10mm 12mm}
  li.row:nth-child(odd){-webkit-print-color-adjust:exact;print-color-adjust:exact}
}
@media (max-width:640px){.head{grid-template-columns:1fr}.opt{min-width:100%}}
</style>
</head>
<body>
<div class="sheet">
  <p class="lab">Monthly intake</p>
  <h1>${esc(cfg.label || domain)}</h1>
  <p class="sub">Tick one option per row. Where an exact figure is available, write it in, because
  exact values narrow the range instead of widening it. Rows left blank use a stated default and the
  report says which ones did.</p>
  <hr class="hv">

  <div class="head">
    <div><p class="hl">Client</p><div class="hv2"></div></div>
    <div><p class="hl">Period</p><div class="hv2"></div></div>
    <div><p class="hl">Completed by, date</p><div class="hv2"></div></div>
  </div>

  <ol class="rows">
${cfg.questions.map(rowHtml).join('\n')}
  </ol>

  <p class="foot">
    Return to 193purushottam@gmail.com. Nothing here asks for system access, credentials, or a data
    export. If a figure is genuinely unknown, leave it blank rather than guessing: a blank widens the
    stated range honestly, a guess does not.<br>
    Generated from the ${esc(domain)} configuration. Regenerate after any change to the diagnostic.
  </p>
</div>
</body>
</html>
`;

const out = path.isAbsolute(outArg) ? outArg : path.join(ROOT, outArg);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);

// Self-check: the sheet is worthless if it does not ask for everything the engine reads.
const missing = cfg.questions.filter(q => !html.includes(esc(q.title)));
if (missing.length) {
  console.error(`FAIL: ${missing.length} question(s) missing from sheet: ${missing.map(q => q.id).join(', ')}`);
  process.exit(1);
}
console.log(`${out}\n${cfg.questions.length} questions, ${cfg.questions.filter(q => q.showIf).length} conditional. All present.`);
