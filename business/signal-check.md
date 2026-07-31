# The signal check — per-prospect research, 10 minutes each

_Written 2026-07-31. Run this once per prospect before writing a single word of the email._

The first email opens with a specific, checkable observation about that company. Everything else in the
sequence is boilerplate. **This research is the email.** Without it you are sending a template, and a
template from an unknown individual asking a CFO-adjacent person for attention gets deleted.

Budget ten minutes per prospect. Ten prospects is under two hours.

---

## Why app reviews specifically

A loyalty reconciliation gap is invisible from outside a company, with one exception. When issued points
and recorded points diverge, **customers notice before finance does**, because the customer is looking at a
balance that does not match what they think they earned. They then write it in a review.

So a public review saying "my points did not credit" is downstream evidence of exactly the failure the
diagnostic computes. It is the only free, public, verifiable signal of an internal reconciliation problem
that exists. That is why the email leads with it.

It also solves the credibility problem. You are not claiming to know their business. You are quoting their
own customers back to them, which is unarguable.

---

## Where to look, in order

**1. Google Play reviews.** Highest volume for Indian D2C, and the most searchable.
Go to the app's Play Store listing, open all reviews, and sort by Most Recent. Play lets you filter by star
rating — use 1 and 2 star.

**2. Apple App Store reviews.** Lower volume in India but often more detailed. Worth a pass if Play is thin.

**3. Trustpilot and MouthShut.** For brands with a weak app but strong web commerce. MouthShut in particular
skews Indian and long-form.

**4. Twitter/X search.** `from:` nothing, just `"<brand>" points` or `"<brand>" cashback` and sort by
Latest. Public complaints to a brand handle are often more specific than reviews, and they carry a date.

**5. Reddit.** `site:reddit.com "<brand>" points` in a normal web search. Indian D2C brands come up in
r/IndianFashionAddicts, r/IndiaInvestments, r/SkincareAddictionIndia and similar.

---

## What to search for

Inside reviews, look for these terms. They map to specific leak paths in the diagnostic:

| Search term | What it usually indicates | Diagnostic layer |
|---|---|---|
| "points not credited", "points missing" | Issue-to-record gap. The clearest signal there is. | Layer 0, signal capture |
| "points expired", "expiry" complaints | Expiry policy applied inconsistently, or liability released early | Layer 1 |
| "balance wrong", "balance showing zero" | Reconciliation failure between systems, often post-migration | Layer 0 |
| "cashback not received", "reward not applied" | Earn rule and redemption rule disagreeing | Layer 1 |
| "coupon", "code not working", "used twice" | Abuse or stacking control gaps | Layer 2, fraud exposure |
| "app shows different", "website vs app" | Two systems, two answers, nobody reconciling them | Layer 0, highest value signal |
| "after the update", "since the new app" | A migration event, which is the strongest buying trigger | Layer 0 |

**"App shows different from website" and "since the new app" are the two best finds.** Both mean two systems
are disagreeing, which is precisely what the diagnostic is built to size. If you find either, lead with it.

---

## What counts, and what does not

**Counts as signal:**
- Specific, recent (last 6 months), and about the mechanics of points or rewards
- Repeated across more than one reviewer, since one angry customer is an anecdote
- Mentions a number ("2,400 points missing") — quote it directly, numbers are memorable

**Does not count, do not use:**
- Generic anger about delivery, product quality, or customer service. Unrelated to your work and it makes
  the email look like you skimmed.
- A single review from two years ago
- Anything about pricing being too high
- Reviews complaining the programme is stingy. That is a design choice, not a reconciliation failure, and
  saying otherwise makes you look like you do not know the difference.

**If you find nothing after ten minutes, that prospect is not ready.** Move on. Do not soften the opener
into something generic to make the email sendable. A generic opener converts near zero and burns the
contact permanently.

---

## Turning the find into the opening line

Keep the structure, swap the specifics. The line has three parts: **count, what they said, what it means.**

> [Count] of [Company]'s recent app reviews mention [the specific thing]. That pattern usually is not a
> customer service problem, it is a reconciliation gap between what the loyalty engine issued and what
> finance recorded.

Worked example, if you found four reviews about post-update balance changes:

> Four of Zouk's recent Play Store reviews mention points balances changing after the app update. That
> pattern usually is not a customer service problem, it is a reconciliation gap between what the loyalty
> engine issued and what finance recorded.

Stronger variant, when you have a direct quote with a number in it:

> A reviewer on Zouk's Play Store listing last month wrote that 2,400 points vanished after the app update,
> and three others describe the same thing. That is not usually a support issue, it is the loyalty engine
> and the books disagreeing.

**Rules for this line:**
- Never inflate the count. If it is three, say three. If someone checks and finds two, you have lost.
- Name the platform (Play Store, Trustpilot) so it is verifiable in one click.
- Never paste a customer's username or any personal detail. Quote the complaint, not the person.
- Do not link the review. It reads as an attack. Let them find it.

---

## Recording it

Add these columns to the tracking sheet, alongside the ones in `prospects.md`:

| Column | Example |
|---|---|
| Signal found | Points vanished after app update |
| Source | Google Play, 1-star, Jun 2026 |
| Count | 4 |
| Exact quote | "2,400 points just disappeared after the update" |
| Signal score | 3 of the `prospects.md` rubric (migration event) |
| Date checked | 2026-08-02 |

The date checked matters. A signal older than about two months is stale, and quoting a stale complaint to
someone who has since fixed it makes you look careless.

---

## Finding the named person

Separate task, same sitting. About three minutes per company.

1. LinkedIn search: company name plus one of `loyalty`, `CRM`, `retention`, `customer data`, `growth`.
   In Indian D2C the title is often **Head of Growth** or **Head of Retention** rather than Head of Loyalty,
   because the function sits under growth marketing. Search both.
2. At the smaller end of the Tier A2 list, the founder still owns this personally. Approaching the founder
   is correct there and not a fallback.
3. Cross-check the person is current. LinkedIn lags departures by months. If their most recent post or
   activity is over a year old, find someone else.
4. **One person per company.** Emailing two people at the same company on the same day is the fastest way
   to look automated.

**On getting the address.** Do not buy a scraped list, for the deliverability and domain reasons in
`outreach.md`. Most Indian D2C brands use a predictable format (`first@brand.com` or
`first.last@brand.com`) which is usually visible on their own contact or press page. If you cannot work it
out, LinkedIn message them instead. A LinkedIn message that lands beats an email that bounces, and a bounce
on a young sending domain costs more than the one contact.

---

## The ten to run this on

From `prospects.md` Tier A2, in order:

- [ ] Plum
- [ ] Pilgrim
- [ ] XYXX
- [ ] Innovist
- [ ] Zouk
- [ ] Bonkers Corner
- [ ] R for Rabbit
- [ ] Ugaoo
- [ ] Headphone Zone
- [ ] Deconstruct

Expect roughly half to produce a usable signal. That is normal and it is why the list is ten rather than
five. The ones that produce nothing are not failures, they are correctly disqualified before you spent an
email on them.
