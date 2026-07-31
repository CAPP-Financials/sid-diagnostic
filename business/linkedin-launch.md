# LinkedIn launch post — Signal Integrity Diagnostic

_Drafted 2026-07-31. Checked against the beinghuman checklist, notes at the bottom._

Post the primary version. The alternates are there if you want a different angle, not to be posted as a series.

---

## Primary

> Most loyalty programmes I have worked on could tell you what they issued. Far fewer could tell you what
> that was actually worth once the reporting caught up.
>
> That gap is where the money hides. Points issued but never costed properly, rewards recorded gross when
> the P&L needed net, discrepancies small enough per transaction that nobody escalates them and large enough
> in aggregate to change a business case.
>
> I built a diagnostic that computes the size of that gap from figures you already have. Pick your domain,
> answer under twenty questions, and it returns a range with the arithmetic printed next to it, so you can
> multiply it by hand and argue with a specific line rather than the conclusion.
>
> It is free, there is no signup, and nothing you type leaves your browser. It will not tell you it is 90%
> confident, because a questionnaire cannot be, and it says so on the page.
>
> https://sid-site-phi.vercel.app
>
> I would rather hear it is wrong than hear nothing. If you run it and the number looks off, tell me which
> line broke and I will fix it.

**Why this shape.** The opening is an observation from work you actually did, not a statistic. The honest
limits ("it will not tell you it is 90% confident") are the most credible thing in the post, because nobody
launching a tool says that. The close asks for criticism, which invites the comments that make a post
travel and matches how you want to come across publicly.

**Do not add hashtags beyond two, and do not add an image.** The link preview is the image.

---

## Alternate A, the build angle

> I spent the last few weeks building something I kept wishing existed while working on loyalty analytics.
>
> When a programme reports its reward liability, that number comes from a chain of assumptions, and every
> link in the chain is a place where the figure can quietly stop matching reality. Most tools will give you
> a score. I wanted one that showed the arithmetic, so the person reading it can find the step they
> disagree with.
>
> It covers three domains, takes about three minutes, needs no signup, and runs entirely in your browser.
> The uncertainty is computed from the ranges you enter rather than asserted as a flat percentage, which
> turned out to be the hardest part to get right.
>
> https://sid-site-phi.vercel.app
>
> Curious what breaks. Tell me where it is wrong.

---

## Alternate B, the shortest version

> Built a thing. It computes the gap between what your loyalty programme reports and what the same figures
> imply, and it shows its working so you can check it by hand.
>
> Free, no signup, nothing leaves your browser. Three minutes.
>
> https://sid-site-phi.vercel.app
>
> Tell me where it is wrong.

---

## Comment replies, prepared

People will ask these. Having answers ready is the difference between a post that converts and one that
just gets likes.

**"How accurate is it?"**
> At banded inputs it is an Estimate, and the range is wide on purpose. Typing exact figures narrows it.
> It cannot reach high confidence from a questionnaire and it does not claim to, that would need your actual
> source documents.

**"What is it built on?"**
> Deterministic JavaScript for all the structure, scoring, and every dollar calculation. A local language
> model touches only the written narrative, and that is gated against the computed numbers so it cannot
> invent a figure. Nothing is sent anywhere.

**"Do you consult on this?"**
> Yes, I run it as a monthly engagement where the gap gets tracked as it moves rather than measured once.
> Happy to send details. The diagnostic stays free either way.

**"Can it do [other industry]?"**
> Three domains today. The engine is config-driven, so a new domain is a configuration rather than a
> rebuild. Tell me which one and what the leak looks like there.

---

## Posting notes

- Best window for an India-based professional audience is Tuesday to Thursday, 8 to 10am IST.
- Reply to every comment in the first two hours. That is what decides reach.
- Do not edit the post in the first hour, it suppresses distribution.
- Send it to ten people directly before posting. Early engagement matters more than the post text.

---

## beinghuman check

Ran against the checklist. What was found and changed while drafting:

- **Zero banned buzzwords** in the final text. No *delve, testament, pivotal, crucial, robust, showcase,
  landscape, intricate, fostering*.
- **No em dashes.** Also matches your communication-style rule for professional writing.
- **Cut one instance of negative parallelism.** An earlier draft opened "It is not a dashboard, it is a
  reconciliation." Replaced with the plain observation about issued versus worth.
- **Cut a rule-of-three.** A draft line read "clear, honest, and defensible." Removed entirely.
- **No inline-header bullet lists** in the post text. The bold labels appear only in this working file, not
  in anything you paste.
- **No "In conclusion" wrap-up** and no formulaic closing section.
- **Kept** the specific and slightly odd details, the nineteen questions, the three minutes, the note that
  computing uncertainty from input ranges was the hardest part. Concrete specifics are the strongest defence
  against sounding machine-smoothed, and that last one is true.
- **Kept** plain *is* and *has* throughout rather than *serves as* or *represents*.

Question counts verified against the domain configs on 2026-07-31: banking-fraud 19, loyalty 15,
enterprise-ai 18. The post says "under twenty" because it covers all three. If you write a loyalty-specific
version later, "fifteen questions" is accurate and the specificity is worth more than the round number.
