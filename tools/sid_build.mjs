// Inlines the engine + one domain config into sid.html and writes a single self-contained
// file to dist/. No bundler: the shipped artifact must open over file:// with no server,
// no network and no build step on the recipient's machine.
//
// Usage: node tools/sid_build.mjs [domain] [depth]
//        node tools/sid_build.mjs --all
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
// normalise line endings on read: an editor or script writing CRLF must not change what builds
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
// domains/banking-fraud.js sets root.SID_BANKING_FRAUD
const globalName = d => 'SID_' + d.replace(/-/g, '_').toUpperCase();

function build(domain, depth) {
  let html = read('sid.html');
  const engine = read('sid-engine.js');
  const config = read(`domains/${domain}.js`);

  // drop every external script tag, then re-inject only what this artifact needs
  html = html.replace(/<script src="sid-engine\.js"><\/script>\s*/, '');
  html = html.replace(/<script src="domains\/[^"]+\.js"><\/script>\s*/g, '');

  // anchor is a regex, not a literal: a CRLF rewrite of sid.html silently broke the literal
  // match and the build emitted a page with no engine and no config, reporting success
  const anchor = /<script>\s*\n\s*var Q = new URLSearchParams/;
  if (!anchor.test(html)) throw new Error(`${domain}-${depth}: inline anchor not found in sid.html`);
  html = html.replace(anchor,
    `<script>\n/* inlined engine */\n${engine}\n</script>\n<script>\n/* inlined config: ${domain} */\n${config}\n</script>\n<script>\nvar Q = new URLSearchParams`);

  // pin domain and depth so the artifact does not depend on query params
  const pin = (re, to, what) => {
    if (!re.test(html)) throw new Error(`${domain}-${depth}: could not pin ${what}`);
    html = html.replace(re, to);
  };
  pin(/var DOMAIN = [^;]+;/, `var DOMAIN = ${JSON.stringify(domain)};`, 'domain');
  pin(/var DEPTH  = [^;]+;/, `var DEPTH  = ${JSON.stringify(depth)};`, 'depth');

  /* Verify the artifact is actually complete BEFORE writing it. Every check below failed to
     fire on the broken build: the src tags were gone, so the old guard passed happily. */
  const problems = [];
  if (/<script src=/.test(html)) problems.push('still references an external script');
  if (!html.includes('root.SIDEngine')) problems.push('engine not inlined');
  if (!html.includes(`root.${globalName(domain)}`)) problems.push(`config ${domain} not inlined`);
  if (!html.includes(`var DOMAIN = ${JSON.stringify(domain)}`)) problems.push('domain not pinned');
  if (problems.length) throw new Error(`${domain}-${depth}: ${problems.join('; ')}`);

  const out = path.join(ROOT, 'dist', `${domain}-${depth}.html`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);
  console.log(`${path.relative(ROOT, out)}  ${(html.length / 1024).toFixed(1)} KB`);
  return out;
}

const args = process.argv.slice(2);
if (args[0] === '--all' || args.length === 0) {
  for (const d of ['banking-fraud', 'loyalty', 'enterprise-ai']) for (const dep of ['front', 'deep']) build(d, dep);
} else {
  build(args[0], args[1] || 'deep');
}
