# SID Retainer — Outreach Sequences

_Built 2026-07-31. Vertical: loyalty and retail. Offer: $500/month Signal Integrity retainer._

**Read [prospects.md](prospects.md) first.** The NDA check is a hard gate on everything below.

---

## What was thrown out and why

The trash-review playbook's sequences cannot be sent. Its claims do not survive contact with the build:

| Claim in the old copy | Reality |
|---|---|
| "LangGraph agents just ran a DQ sweep" | No LangGraph system exists. The engine is deterministic JavaScript. |
| "0.634 DQ score", "24 recurring defects" | Invented. The engine outputs exposure ranges, not defect counts or DQ scores. |
| "20.8% of data defects auto-resolved" | No auto-remediation exists anywhere in the product. |
| "$180,000/year saved by Spark runtime optimisation" | Not traceable to any engagement of yours. |
| "$8M recovered from migration baselines" | The $8M is real, but it came from **loyalty campaign performance**, not migration corruption. Re-attributing it is misrepresentation. |
| "37 protected sectors" under the FTA | The figure is **17**. Verified. |

Sending that copy would mean claiming a product capability and a case history that do not exist. The version
below uses only what you can defend when someone asks a follow-up question.

---

## The strategic change: lead with the tool, not the meeting

The old sequence asked for a call in email one. You have something better to offer: a working diagnostic at
**https://sid-site-phi.vercel.app** that needs no signup, no upload, and keeps everything in the recipient's
browser.

That flips the dynamic. You give something before asking for anything, the recipient self-qualifies by
running it, and anyone who replies afterwards is already holding a number. It also means email one is
verifiably true and useful even to someone who never buys.

---

## Version A — use only if the NDA check clears

Specific client figures ($8M, 6% churn, 8.2x ROI) are permitted.

### A1. First touch, email

> **Subject:** The points balance question your app reviews keep asking
>
> Hi [First name],
>
> Twelve of [Company]'s recent app reviews mention points that did not credit or a balance that looked
> wrong. That pattern usually is not a customer service problem, it is a reconciliation gap between what the
> loyalty engine issued and what finance recorded.
>
> I spent two years on the analytics for a 5,300-store loyalty programme across seven Southeast Asian
> markets, where closing that gap was worth $8M in incremental revenue and cut churn 6%.
>
> I built a diagnostic that computes the size of that gap from figures you already have. It takes three
> minutes, needs no signup, and nothing you type leaves your browser: https://sid-site-phi.vercel.app
>
> Worth running it and telling me if the number looks wrong?
>
> Purushottam Kumar

**Why it works.** The app-review line is checkable, specific to them, and impossible to have mass-mailed.
The proof sentence is one line and every figure in it is yours. The ask is to run a free tool, not to give
up 30 minutes.

**Before sending, replace the review claim with what you actually found.** If there are no such reviews,
this email does not apply to that prospect. Do not soften it into a generic opener.

### A2. Second touch, four days later

> **Subject:** Re: The points balance question your app reviews keep asking
>
> Hi [First name],
>
> Quick note on how the diagnostic gets to a number, since that is the part people ask about.
>
> It reconciles three layers: where the reward figure originates, whether the audit trail holds, and where
> the reported number and the computed one diverge. Every line shows its arithmetic, so you can multiply it
> by hand and disagree with a specific step rather than the conclusion.
>
> If the output looks material, I run it monthly as a standing engagement at $500 and track the gap as it
> moves. If it does not, you have a number you did not have, at no cost.
>
> Purushottam

### A3. Close, five days after A2

> **Subject:** Closing the loop
>
> Hi [First name],
>
> I will stop here so I am not cluttering your inbox.
>
> The diagnostic stays up and free whether or not we speak: https://sid-site-phi.vercel.app
>
> If loyalty reconciliation lands on someone else's desk at [Company], I would appreciate the name. If it is
> simply not a problem worth attention this quarter, that is a useful answer too and I will not follow up
> again.
>
> Purushottam

---

## Version B — use if client figures are restricted

Same structure, method and scale described without the client-specific numbers.

### B1. First touch, email

> **Subject:** The points balance question your app reviews keep asking
>
> Hi [First name],
>
> Twelve of [Company]'s recent app reviews mention points that did not credit or a balance that looked
> wrong. That pattern usually is not a customer service problem, it is a reconciliation gap between what the
> loyalty engine issued and what finance recorded.
>
> I spent two years as the analytics lead on a loyalty programme spanning seven Southeast Asian markets and
> several thousand stores, where that gap was the difference between a programme that looked healthy and one
> that was.
>
> I built a diagnostic that computes the size of that gap from figures you already have. It takes three
> minutes, needs no signup, and nothing you type leaves your browser: https://sid-site-phi.vercel.app
>
> Worth running it and telling me if the number looks wrong?
>
> Purushottam Kumar

A2 and A3 need no change: neither contains client-specific figures.

---

## LinkedIn

### Connection request, no pitch

> Hi [First name], I work on loyalty reconciliation, the gap between issued reward value and what finance
> records. Following [Company]'s expansion with interest. Happy to connect.

Nothing else. A pitch inside a connection request gets ignored and burns the contact.

### First message, only after they accept and only if they engaged

> Thanks for connecting, [First name]. I built a free diagnostic that sizes the gap between reported and
> computed reward liability, no signup and nothing leaves your browser:
> https://sid-site-phi.vercel.app
>
> If the number comes out material I am happy to walk through how it got there. If not, ignore me entirely.

---

## Sending rules, non-negotiable

These are deliverability and legal requirements, not style preferences.

1. **Ten to fifteen emails a day, maximum, sent manually at first.** A new sending domain that suddenly
   emits hundreds of cold emails gets classified as spam, and that classification is very hard to reverse.
   You have one professional identity. Do not risk it for volume you cannot service anyway.
2. **Every email personalised on a real, checked fact.** The app-review line must be true for that company.
   If you cannot find one, the prospect is not ready.
3. **Identify yourself properly.** Full name, and a real reply-to address you monitor.
4. **Honour any opt-out immediately and permanently**, including a soft one like "not interested".
5. **Never send from the address you use for job applications.** A spam classification on that address would
   damage the primary goal, which is the consulting role.
6. **Do not buy a scraped contact list.** Poor deliverability, and it puts your only domain at risk.
7. **Twenty clients at $500 is $10K MRR.** At 10–15 emails a day and a realistic 2–5% cold reply rate, the
   arithmetic says this takes months, not the seven days the old playbook promised. Plan for that.

---

## Objection handling, honest answers

| They say | Answer |
|---|---|
| "How is this different from our BI dashboard?" | A dashboard reports what the system recorded. This computes what the same inputs imply and shows the difference. If the two agree, you have learned your reporting is sound. |
| "Can you prove the number?" | No, and the tool says so on the page. At banded inputs it is an Estimate with a stated range. Exact figures narrow it to Refined. Verified needs source documents and a separate agreement. |
| "$500 seems cheap for this." | It is an entry price for a standing monthly reconciliation, not a full audit. The limits are printed in the agreement. |
| "We already did a data quality project." | Then the baseline should reconcile cleanly and this costs you one month to confirm it. |
| "Send me a proposal." | The retainer agreement is one page and already written. Send it same day. Speed is the advantage a solo operator has. |

---

## Open items

- [ ] NDA and non-solicit check **(blocks everything above)**
- [ ] Set up and warm a dedicated sending address, separate from job-application email
- [ ] For each Tier A prospect, find and record the real app-review complaint
- [ ] Decide Version A or Version B once the NDA position is known
