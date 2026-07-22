// Runs every stage gate in GOALS.md and prints a status table.
// A stage is done when its gate is green here — not when the code looks finished.
// Regressions in earlier stages are failures of the current stage.
//
// Usage: node tools/verify.mjs        (browser gates need: node serve.mjs running)
import { spawn } from 'node:child_process';
import http from 'node:http';

const GATES = [
  { id: 'B', name: 'Engine parity vs frozen original', cmd: 'tools/sid_parity.mjs', needsServer: false },
  { id: 'A', name: 'Printed working reproduces printed answer', cmd: 'tools/check-math.mjs', needsServer: true },
  { id: 'C+E', name: 'Config-driven rendering + showIf', cmd: 'tools/check-render.mjs', needsServer: true },
  { id: 'D', name: 'Two-depth consistency', cmd: 'tools/check-depth.mjs', needsServer: true },
  { id: 'G', name: 'Dual-unit reporting (% and $)', cmd: 'tools/check-units.mjs', needsServer: false },
  { id: 'I', name: 'Report gates reject poisoned input', cmd: 'tools/check-report.mjs', needsServer: false }
];

const serverUp = () => new Promise(res => {
  const req = http.get('http://localhost:3000/sid.html', r => { r.resume(); res(r.statusCode === 200); });
  req.on('error', () => res(false));
  req.setTimeout(1500, () => { req.destroy(); res(false); });
});

const run = cmd => new Promise(res => {
  const p = spawn(process.execPath, [cmd], { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  p.stdout.on('data', d => out += d);
  p.stderr.on('data', d => out += d);
  p.on('close', code => res({ code, out }));
  p.on('error', e => res({ code: 1, out: String(e) }));
});

const up = await serverUp();
if (!up) console.log('note: localhost:3000 is not responding — browser gates will be skipped. Start with `node serve.mjs`.\n');

const rows = [];
for (const g of GATES) {
  if (g.needsServer && !up) { rows.push([g.id, g.name, 'SKIP (no server)']); continue; }
  process.stdout.write(`running ${g.id} … `);
  const { code, out } = await run(g.cmd);
  const missing = /Cannot find module/.test(out);
  console.log(missing ? 'not built' : code === 0 ? 'pass' : 'FAIL');
  rows.push([g.id, g.name, missing ? 'NOT BUILT' : code === 0 ? 'PASS' : 'FAIL']);
  if (code !== 0 && !missing) console.log(out.split('\n').filter(l => l.includes('✗') || l.includes('FAIL')).slice(0, 8).join('\n'));
}

const w = [4, Math.max(...rows.map(r => r[1].length)), 16];
console.log('\n' + 'STAGE'.padEnd(w[0] + 2) + 'GATE'.padEnd(w[1] + 2) + 'STATUS');
console.log('-'.repeat(w[0] + w[1] + w[2] + 4));
for (const r of rows) console.log(r[0].padEnd(w[0] + 2) + r[1].padEnd(w[1] + 2) + r[2]);

const failed = rows.filter(r => r[2] === 'FAIL').length;
console.log(failed ? `\n${failed} gate(s) failing\n` : '\nall built gates green\n');
process.exit(failed ? 1 : 0);
