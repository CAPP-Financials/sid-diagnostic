# SID — Multi-Stage Goal System

Every stage has a **done condition a separate checker evaluates**, not a judgement call.
`node tools/verify.mjs` runs every gate and prints PASS/FAIL per stage. If it is green, the
stage is done. If it is red, it is not, regardless of how finished the code looks.

**Bans, enforced:** no stage is "done" on self-report · no subjective condition ("looks good")
· no threshold nobody can recompute · the thing that generates an answer never grades itself.

**Evaluator independence classes:** `tool` = external script computes it · `browser` = asserted
against the real rendered artifact · `human` = requires a person (screenshots only).

---

## Stage ledger

| # | Stage | Done condition (machine-checkable) | Evaluator | Class | Status |
|---|-------|-----------------------------------|-----------|-------|--------|
| A | Front door ships | Printed working reproduces every printed answer within 0.05; leaks sum to headline; headline inside its own range; tier matches inputs. 4 scenarios. | `tools/check-math.mjs` | browser | **PASS** |
| B | Engine extracted | `sidCompute(loyalty, …)` matches the frozen original `recalculate()` on **every field** across ≥40 answer permutations. Zero tolerance — exact equality. | `tools/sid_parity.mjs` | tool | **PASS** (264 perms × 10 fields = 2,640 assertions; mutation-tested) |
| C | Dashboard generic | Result slots render from `CFG.categories`, not 4 hardcoded ids. Config with 3 categories renders 3 rows; config with 5 renders 5. | `tools/check-render.mjs` | browser | **PASS** (banking 3, loyalty 4) |
| D | Transfer proved | One config drives both depths. **Identity:** deep-at-defaults == front exactly (no hidden leak paths). **Containment:** the deep answer falls inside the FRONT door's published band. | `tools/check-depth.mjs` | tool+browser | **PASS** |
| E | Branching works | A `showIf` question does not render until its predicate passes, and contributes zero to every score while hidden. Typed exact values survive re-render. | `tools/check-render.mjs` | tool+browser | **PASS** |
| G | Dual-unit reporting | Denominator cancellation is exactly zero where a leak is linear in the denominator; `%`↔`$` round-trips at full precision; `lo ≤ point ≤ hi` in both units; corner enumeration beats the naive sweep on a synthetic minus-arm case; plausibility flags without clamping. | `tools/check-units.mjs` | tool | **PASS** |
| H | Engine frozen | Four pre-eval bugs fixed with regressions: derive-per-corner, exact-zero, loyalty band, infeasible corners + unearned residual. Engine does not move once Stage F starts. | `tools/check-units.mjs` G.8–G.9 | tool | **PASS** |
| F | Eval rebuilt | **54/54 answer-sets across all 18 golden cases** against expectations independent of the config. Split derived from the configs: 9 held-out (unfittable — no tunable rate constant), 9 seed. Held-out unfittability asserted in `results.json`. Every case rendered and screenshotted; per-run folders; windows of 10. | `eval/sid_eval.mjs` | tool+browser | **PASS** |
| I | Report gates can fail | Invented figure, unknown leak, stripped caveat and missing band are each REJECTED; the genuine figure and the clean report pass the same gates; template fallback complete with no model; narrative reproduces byte-identically from the committed cache. | `tools/check-report.mjs` | tool | **PASS** |

## Screenshot artifacts (the human-class check)

Each stage writes labelled PNGs to `temporary screenshots/`. These are for review, never for
gating — a screenshot cannot prove arithmetic, so no stage passes on one.

- A: `*-empty`, `*-filled`, `*-filled-dark`, `*-mobile`
- Run everything: `node serve.mjs` then `node tools/verify.mjs`. Build artifacts: `node tools/sid_build.mjs --all`.
- C/D/E: `*-loyalty`, `*-banking-front`, `*-banking-deep`, `*-branching`

## Standing rules

1. **Parity before progress.** Stage B's gate is exact equality against the frozen original. A
   refactor of money math that "looks right" is a refactor that is wrong.
2. **A gate that cannot fail is not a gate.** Every assertion must be shown to detect the
   defect it guards — by mutation (Stage B) or by a synthetic fixture that forces divergence
   (Stage G.5). A vacuous pass is a failure.
3. **Every printed calculation must reproduce its printed answer.** This is the product claim;
   Stage A's gate enforces it permanently and runs on every later stage too.
4. **Regressions are stage failures.** `verify.mjs` runs *all* gates, not just the current one.
5. Assumptions carried without confirmation are marked **ASSUMED** in the decision ledger and
   are not presented as fact.

## ASSUMED (defaults taken without asking, per instruction to proceed unblocked)

- Loyalty config must reproduce the original constants exactly — no "improvements" during extraction.
- 40 permutations is sufficient parity coverage (deterministic pure function, full option cross-product on the discriminating fields).
- Banking front-door rates (0.12%, 0.02%, 0.09%) remain practitioner defaults pending real figures.
- Deep configs target ~15 questions; front door stays at 5.
