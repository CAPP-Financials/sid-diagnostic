# SID — Decision Ledger

Append-only. Every decision carries a confidence and a link to the artifact that proves it.
**Rule: nothing ships below 85% confidence without being flagged as a bet.**

| # | Decision | Confidence | Verify at |
|---|---|---|---|
| 1 | Kill the 1,250-problem atlas as a product; keep it as reference. A problem list has no buyer and no defensibility — the value is a transferable method plus proof it can be acted on. | 92% | [problem-statement reference](../../GBPA/GBPA-problem-statement-reference.md) |
| 2 | SID (Signal Integrity Diagnostic) is the transferable method, generalized from loyalty to banking-fraud and enterprise-AI. Not a new invention — the LeakageIQ PRD already declared SID "a universal diagnostic methodology" and never walked it. | 90% | [LeakageIQ PRD §2.3](../../leakage-iq/docs/LeakageIQ_Live_Capstone_PRD.md) |
| 3 | Golden dataset = 18 cases, 3 domains × 3 SID layers. Bottom-up: Signal Capture (back office) diagnosed before Signal Audit before Distortion Detection. | 88% | [golden dataset v0](../../GBPA/GBPA-golden-dataset-v0.md) |
| 4 | Back-office is scoped as *signal-origin integrity* (Layer 0), NOT as an automation service. Automation is a later upsell, a different method. Mixing them would break the one-method transfer thesis. | 87% | golden dataset, Layer 0 |
| 5 | The LLM never runs end-to-end. Deterministic code owns structure, scoring, and all dollar math; the LLM touches only narrative synthesis, gated against deterministic ground truth. | 95% | gate spec, day 21 |
| 6 | **Do not quote a "1–2% per-step error rate."** It is well-defined only at the numeric seam (where the gate makes it ~0%). Narrative is gated binary pass/fail, which is stricter. Quoting a percentage for prose does not survive a CFO's question. | 90% | AI Specification, day 21 |
| 7 | Config-driven engine with two render depths (front door / deep), not two products. One config, one `depth` flag. | 88% | two-depth proof, day 20 |
| 8 | No config generator until three domain configs exist by hand. Automating an unfelt pain is speculative. | 90% | day 36+ |
| 9 | **Existing eval harness: reuse the machinery, rebuild the data.** `eval.mjs` is dependency-free, cache is 237 committed files, determinism verified. But n=6 labels, v0 extracts zero (no baseline), single unverified labeler, and the corpus measures text extraction — irrelevant to SID. | 93% | verified by inspection 2026-07-21; [results.json](../../Demo/AI_system/eval/results.json) |
| 10 | Golden dataset splits 12 seed / 6 held-out before any config authoring. Using all 18 for both config and eval is train-on-test — the same contamination `Demo/AI_system/eval/results.md` confessed at v2.2→v2.4. | 94% | `eval/holdout.json`, day 31 |
| 11 | **No headline metric ships on n<30.** Each held-out case expands to ≥5 synthetic answer-sets; every result reports its interval. This is the specific failure of the prior harness. | 92% | day 40 |
| 12 | Confidence is tiered and stated in the UI at all times: Estimate (banded inputs) → Refined (exact values supplied) → Verified (client documents, paid). **Never claim 90% at the free tier** — a band-input diagnostic mathematically cannot reach it. ~~Fixed widths ±40–55% / ±15–25%~~ **superseded by #18**: the interval is now computed from input ranges, not asserted. | 91% | front door |
| 13 | Guided consultative mode ships as a declarative `showIf` predicate on questions, not a conversational engine. **Flagged as a partial:** delivers adaptive question display, not LLM-driven root-cause probing. Full version would put an LLM in the question loop, contradicting decision #5. | 78% — **BET** | day 14; revisit if a client wants deeper probing |
| 14 | Isolated storage, DPA, and the document pipeline are **client-triggered, not calendar-triggered.** A solo operator holding a bank's fraud data without an entity, insurance, or counsel review accepts liability dwarfing a $3–8K fee. Client #1: data never moves. | 89% | client-triggered block |
| 15 | Trigger.dev managed cloud over self-hosted. Self-hosting adds ops burden with zero benefit at this scale. Revisit only if a contract forbids third-party processors. | 85% | when pipeline is built |
| 16 | Design direction: green-bar accounting ledger, not any of the three AI-default looks. Signature element is the **variance rail** (what you think vs what's measured), replacing the generic health-score ring. | 80% — **BET** | screenshot review, day 5 |
| 17 | Lead capture pre-backend is a `mailto:` with results pre-filled. Zero infrastructure, and the prospect initiating contact is a stronger signal than a silent form submit. | 86% | front door, day 5 |

| 18 | Uncertainty is **propagated from input ranges**, not asserted as a flat percentage. A banded answer ("$500M–$4B") genuinely is a range; typing an exact value collapses it. `residual` (25%) covers only the practitioner rate constants. | 90% | Stage D gate — the flat ±45% failed containment and was provably indefensible |
| 19 | Both depths compute the **same leak paths**. Deep supplies real drivers where the front door falls back to a stated default. A front door hiding leak paths would understate exposure and make the two-depth gate unsatisfiable. | 92% | `tools/check-depth.mjs` D.1 identity |
| 20 | Containment direction: the **deep answer must fall inside the FRONT door's band**, not the reverse. The front door is the party making a claim under uncertainty, so its range must cover the answer real data produces. | 88% | `tools/check-depth.mjs` D.2 |
| 21 | Display the interval, never a "±N%". Input ranges are multiplicative so the interval is asymmetric; a ± figure implies a symmetry it does not have. | 90% | rail + range text |
| 22 | Frozen oracle (`tools/_frozen-recalculate.js`) is **kept, not deleted** after parity passes — deviation from the plan. It costs nothing and makes Stage B re-runnable as a permanent regression gate. | 87% | `tools/sid_parity.mjs` |

| 23 | **Percentages are reported against processed volume, with dollars alongside.** A leak linear in the denominator has a % that is arithmetically independent of the volume estimate — over-blocking is 0.1000% and liability 0.0900% across an 8× volume range. The old wide band was an artifact of forcing everything into dollars. | 93% | `tools/check-units.mjs` G.1 |
| 24 | **Auto unit priority.** Each leak leads with whichever unit has the narrower relative spread; the other shows alongside. No per-domain config, self-correcting for new domains. | 89% | G.2 |
| 25 | **Corner enumeration replaces the lo/hi sweep.** The old sweep put every factor at its low end including inside the `minus` arm — a larger subtraction makes the total smaller, so it was not a lower bound. Proven on a synthetic case: corner lo −$150,000 vs naive $250,000. | 92% | G.5 |
| 26 | **"exact" is claimed only for input-driven spread, never post-residual.** "0.100% of volume" is exact given the model; the model's rate is still a practitioner estimate. Conflating the two would repeat the false-precision mistake this work removed. | 91% | `naturalUnit()` in `sid-engine.js` |
| 27 | **Entered unit is authoritative; the counterpart is derived fresh each render.** Never derived from a rounded display — "0.10%" converted back is not the dollars that produced it. | 90% | G.3 + `check-render.mjs` toggle test |
| 28 | Dual-unit entry offered only where a percentage is meaningful (`reported`). Volume is the denominator, per-hour is a rate, incidents is a count — a "%" of those is nonsense. | 88% | `banking-fraud.js` `units:` |

| 29 | **Engine frozen before the eval.** Four bugs fixed pre-freeze: derive-per-corner, exact-zero fallthrough, loyalty degenerate band, infeasible corners. Fixing math while an eval scores it is fitting the model to the corpus — the trap `v1` exists to expose. | 94% | `check-units.mjs` G.8 + G.9 |
| 30 | **`derive()` runs per corner, from raw answers.** Deriving once at the point froze the auto-scaled rate and reported a $0 band where the true span was $8,467,200 — false precision on the option a prospect is most likely to pick. | 93% | G.8 |
| 31 | **An explicit `0` beats the default; `num()` unchanged.** The fix lives in `factor()` gated on `exact_<id>`, because `num()`'s falsy-fallback is exactly what Stage B parity replicates from the frozen original. | 91% | G.8 + parity still green |
| 32 | **Corners must be physically possible.** Two disjoint shares of one budget both at maximum sum past the whole, producing a 140%-of-spend upper bound. Domains declare `feasible(answers)`; rejected corners are counted, not hidden. | 90% | G.9 |
| 33 | **Rate residual is charged only to leaks containing a bare rate constant**, and weighted by their share of the total. A leak built entirely from answered values has no practitioner rate in it, so charging it 25% invents uncertainty. This is what pushed the bound past 100%. | 89% | G.9 |
| 34 | Enterprise-AI uses `plausibleMax: 0.85`, far above banking's 0.05. A large wasted share is the documented norm here (MIT: 95% of pilots reach no P&L), so a 5% threshold would fire constantly and mean nothing. | 87% | `enterprise-ai.js` |

| 35 | **Eval expectations must be independent of the config under test.** `eval/cases.js` uses hand-written arithmetic from each dollar_rule, or the frozen oracle for loyalty. A test computing its expectation from the thing under test proves only that the code equals itself. | 94% | `eval/cases.js` |
| 36 | **Coverage stated as a gap, not a pass.** Only 10 of 18 golden cases are dollar leaks and can be scored; the other 8 exist as score deltas and are untested. `results.md` says so. | 92% | `eval/runs/*/results.md` |
| 37 | **No generalization claim from n=3.** Held-out is 3 independent cases. Adding answer-set variants would not fix it — variants are one case at different magnitudes, not independent samples. The eval refuses the headline rather than padding n. | 93% | `results.md` |
| 38 | **`sid_build` verifies its own output.** It silently emitted pages with no engine and no config after a CRLF rewrite broke its literal anchor, and reported success because its only guard checked for absent `<script src=` tags. Now regex-anchored, line-ending agnostic, and asserts engine + config + pinned domain are present before writing. | 93% | `tools/sid_build.mjs` |
| 39 | **The working line must survive being multiplied by hand.** `nf()` rounded a 0.40 share to "0", printing `$20,000,000 × 0 × 1 = $8,000,000`. `check-math` only compared the trailing result to the headline, so it passed. It now parses the printed factors and multiplies them, across all three domains. | 95% | `check-math.mjs` factor arithmetic |
| 40 | **Presentation fields are load-bearing.** Loyalty shipped `undefined` as every leak title and raw config ids as every question label — correct arithmetic, unshippable page. Titles are now asserted, not assumed. | 90% | `check-math.mjs` leak-title check |
| 41 | Denominator wording comes from config (`denominatorLabel`, `anchorLabel`). Hardcoding "volume" labelled AI spend and loyalty reward value as "volume" — wrong in front of a client. | 91% | all three configs |

| 42 | **One LLM call per narrative piece, never one call for the whole report.** Asked for everything at once, gemma4:12b writes the first section well and abbreviates the rest to a bare "leak_2". Decomposed, every piece is trivially simple, each is gated alone, and a bad section costs its own prose — never the report. | 92% | `sid_report.mjs` |
| 43 | **The numeric gate checks prose directly against the allowed set** — deviation from the plan's `numbers_used` echo, recorded: a 12B model fumbles the echo, and the direct check is stricter anyway. Poison-tested both directions: "$9.99M" rejected, the genuine headline passes. | 91% | `check-report.mjs` I.1 |
| 44 | **Generation options are part of the cache key.** Hashing only model+prompt replayed responses generated under an old token budget, so a budget fix silently never reached the model. | 93% | `sid_report.mjs` `callLLM` |
| 45 | **Gate comparisons happen in the renderer's encoding.** "P&L" arrives as "P&amp;L" in HTML; comparing raw strings reported a phantom missing caveat. The gate caught its own harness bug — the check now escapes identically. | 90% | `check-report.mjs` |
| 46 | **Tolerate the model's key, gate the content.** gemma4:12b writes `{"pronce": ...}` at temperature 0, deterministically. The field name is ceremony; a sole string-valued key is accepted and the gates judge what it contains. | 88% | `sid_report.mjs` |
| 47 | **Report provenance is printed in the masthead** — "gemma4:12b (7/7 pieces gated in)" or "deterministic template". A client can always see whether prose was machine-written and how much of it survived the gates. | 90% | report HTML |
| 48 | Known limit, disclosed not hidden: the gates protect every NUMBER; they do not verify prose LOGIC. A 12B model occasionally garbles causality in otherwise clean prose. The trade bought total data locality — nothing leaves the machine. | 89% | report review |

## Open bets to resolve

- **#13** — is `showIf` enough "guided consultative," or does the deep tier need real probing?
- **#16** — does the ledger direction land, or read as too austere for a CFO audience? Screenshot review decides.

## Non-technical items on the critical path (not build tasks, still blockers)

- [ ] **Rotate leaked credentials** — live `OPENROUTER_API_KEY` in `references/data/llm-council/llm-council-master/.env`; also `Demo/Newsletter Automation/.env` + `credentials.json` + `token.json`, and `Demo/Website Building/.env`. Manual action, cannot be automated away.
- [ ] **Ability to invoice** — entity, bank account, invoice template, SOW. If a prospect says yes on day 12 and billing takes three weeks, that is three weeks of a 13-week runway.
- [ ] **The list of 10 named people.** Largest single risk in the plan and the only one that is not technical.
