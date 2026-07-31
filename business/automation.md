# SID Retainer — Automation Plan

_Written 2026-07-31. Read this before building any of it._

## The recommendation: build none of it yet

You have zero clients. Every automation below is speculative until a specific pain is felt, and building
ahead of that pain is how the last two years of this vault filled up with half-finished systems.

This document exists so that when a bottleneck does appear, the decision is already made and you build the
right thing in an afternoon rather than redesigning under pressure.

Each item has a **trigger**. Build it when the trigger fires, not before.

---

## Why not automate outreach, specifically

This is the one the old playbook wanted first, and it is the one to build last or never.

1. **Volume works against you here.** The plan in `outreach.md` is 10 to 15 personalised emails a day, each
   built on a real checked fact about that company. That is not a workload that needs automating, it is a
   workload that needs doing. Automation only pays off above a few hundred sends a day, and at that volume
   the personalisation that makes the email work is gone.
2. **You have one professional identity and it is doing double duty.** The same name is applying for
   Strategy and GenAI consulting roles at Accenture, Deloitte, ZS, and BCG. A domain or address flagged for
   bulk cold mail is very hard to rehabilitate, and the damage lands on the primary goal, not the side one.
3. **You cannot service the volume anyway.** Twenty clients at $500 is the target. Twenty is reachable by
   hand. A sequencer that books forty discovery calls you cannot run is a liability.
4. **The bottleneck is not sending.** It is the NDA check, then finding ten qualified names. Neither is
   solved by software.

If you later want sequencing, use a tool built for it rather than assembling one in n8n. Instantly or
Lemlist handle warm-up, throttling, and bounce management, which are the parts that actually matter and the
parts a hand-rolled pipeline gets wrong.

---

## Build order, with triggers

### 1. Outreach pipeline tracking
**Trigger: the first day you send outreach.**
**Build: a spreadsheet. Not software.**

Columns: company, person, title, score from the `prospects.md` rubric, the specific app-review complaint
found, date of each touch, reply, outcome, next action date.

A spreadsheet is the correct tool at this scale and stays correct until roughly a hundred live conversations.
Do not build a CRM. Do not build a Notion system with relations and rollups. The tracking is not the work.

---

### 2. Invoice generation
**Trigger: client number three, or the first month you send more than five invoices.**
**Build: a small Node script, roughly an hour of work.**

At one or two clients, filling `invoice.html` by hand takes five minutes a month and the error rate is low
because you are paying attention. By five clients it is a chore, and the failure mode is expensive: a wrong
invoice number or billing period means a payment that does not reconcile, which means a follow-up email and
a delayed collection.

Design when you build it:
- `clients.json` holds one record per client: legal name, contact, address, tax id, domain, start date, fee.
- The script reads a billing period, walks the client list, and writes one filled invoice per client.
- Fill by adding `data-f="field_name"` attributes to the placeholder spans in `invoice.html` and replacing
  on that attribute. Do not do string replacement on the visible placeholder text, it will break the moment
  the copy changes.
- Invoice numbers come from a counter in a file, never from a date or a hash. They must be sequential and
  gap-free for accounting.
- Node built-ins only. No template engine, no dependency.

Leave one runnable check: assert that generating the same period twice produces identical output, and that
invoice numbers never repeat.

---

### 3. The monthly delivery cycle
**Trigger: client number five.**
**This is the automation that actually decides whether the business works.**

Twenty clients means twenty monthly cycles: chase intake, re-run the engine, produce a drift report, hold a
call, send an updated file. That is the real capacity ceiling of a $500/month product, and it arrives long
before acquisition becomes the constraint.

What to automate, in order of payoff:
1. **Intake chase.** A scheduled reminder to the client on day 1 of their cycle, and an escalation to you on
   day 3 if figures have not arrived. This is the single highest-value piece: the retainer agreement says
   the cycle does not run without intake, so a missed intake is a month of revenue delivering nothing.
2. **Engine re-run.** The engine is already deterministic and already scriptable. Feed it the month's
   answers, produce the output, diff against the stored baseline.
3. **Drift report assembly.** The diff from step 2 rendered into the report format. The report generator
   already exists in the project.
4. **Never automate the review call or the interpretation.** That is the product.

Trigger.dev is the right host, it is already in the stack and the ledger already chose managed cloud over
self-hosted. Use one scheduled task per client cycle with an idempotency key on client plus period, so a
retry cannot double-send.

---

### 4. Lead sourcing
**Trigger: honestly, probably never.**

The `prospects.md` sourcing method is four manual research passes: vendor case-study pages, job postings,
platform-change announcements, app-review mining. The app-review pass is the one that produces the opening
line that makes the email land, and reading reviews for a signal you can name in a sentence is judgement
work. A scraper returns rows; you need the one specific complaint worth quoting.

Ten qualified names is an afternoon of research, once. Revisit only if you are sourcing hundreds a month,
which is a different business from the one described here.

---

## What is already automated and worth keeping

- `business/measure.mjs` — checks the invoice and retainer still fit one A4 page. Run after any edit to
  either document. This one earns its keep now, because a two-page contract is a real defect you would not
  otherwise notice until a client saw it.
- The SID engine itself, its parity, units, math, and depth checks, and the report generator. All predate
  this work and all still pass.

---

## The honest summary

Nothing here is a blocker on revenue. The blockers are, in order:

1. The NDA and non-solicit check
2. Ten qualified named prospects
3. Sending the first fifteen emails

None of those three is a software problem. Build item 2 above when a third client makes it hurt, and item 3
when a fifth client makes it urgent.
