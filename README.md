# Signal Integrity Diagnostic — Engine

Build, verification, and screenshot-testing harness for the SID engine — the calculation
core behind [signal integrity diagnostics](https://sid-site-phi.vercel.app) that quantify
reconciliation leakage in banking fraud operations, enterprise AI spend, and loyalty
programmes. The live site lives in [sid-site](https://github.com/CAPP-Financials/sid-site);
this repo is where the engine gets built and proven correct before it ships there.

## What the diagnostic does

Each domain (`domains/banking-fraud.js`, `domains/enterprise-ai.js`, `domains/loyalty.js`)
asks 5 questions at the "front door" and produces a headline leakage estimate with a range,
backed by fixed, disclosed arithmetic — no black box. A deeper ~15-question pass narrows
the range without changing the underlying model. Nothing typed is sent anywhere; the report
is computed client-side.

## Why this repo looks the way it does

Most "done" claims in dashboards are self-reported — a developer decides the feature works.
This repo enforces the opposite: **every stage has a done condition a separate script
checks, not a judgement call.** `node tools/verify.mjs` runs every gate and prints PASS/FAIL.
A stage is done when it's green, regardless of how finished the code looks.

That includes:
- **Exact-equality parity testing** — the refactored calculation engine is checked against
  the frozen original across 264 permutations × 10 fields (2,640 assertions), with mutation
  testing to confirm the gate can actually detect a broken change.
- **Golden-case evaluation** — 54/54 answer-sets across 18 golden cases, split into held-out
  cases (deliberately unfittable, to catch overfit configs) and seed cases.
- **Report-gate testing** — invented figures, unknown leak types, stripped caveats, and
  missing bands are each asserted to be rejected before a report can ship.

See [`GOALS.md`](GOALS.md) for the full stage ledger and [`docs/decision-ledger.md`](docs/decision-ledger.md)
for assumptions taken along the way, marked explicitly as assumed rather than presented as fact.

## Running it

```bash
node serve.mjs           # serve locally
node tools/verify.mjs    # run every verification gate
node tools/sid_build.mjs --all   # build artifacts
```

## Stack

Vanilla JS, no framework — deliberately, so the arithmetic stays auditable. Playwright-style
browser checks for rendered output, Node scripts for pure-function parity and unit checks.
