# SID — Commercial pack

Everything needed to sell and deliver the Signal Integrity Diagnostic as a $500/month retainer.
Built 2026-07-31.

## Files

| File | What it is | Status |
|---|---|---|
| [retainer.html](retainer.html) | The contract. One page A4, $500/month, three-month initial term. | Ready, needs placeholders filled |
| [invoice.html](invoice.html) | Monthly invoice, billed in advance. | Ready, needs your bank and PAN details |
| [prospects.md](prospects.md) | ICP, scoring rubric, sourcing method, ten named candidates. | Ready |
| [outreach.md](outreach.md) | Email and LinkedIn sequences. Version B is operative. | Ready to send |
| [signal-check.md](signal-check.md) | Per-prospect research method. The opening line depends on it. | Run before any email |
| [linkedin-launch.md](linkedin-launch.md) | Launch post for the free diagnostic, plus prepared replies. | Ready to post |
| [automation.md](automation.md) | What to automate and when. Recommendation is not yet. | Reference |
| [measure.mjs](measure.mjs) | Checks the contract and invoice still fit one A4 page. | Run after any edit |
| sow-one-time-SUPERSEDED.html | The earlier one-time engagement version. Superseded by the retainer. | Do not send |

## Before anything goes out

1. **Outreach is unblocked.** Version B is the operative copy and uses no client-specific figures, and the
   Tier A2 prospect list is a competitor platform's roster, so no non-solicit exposure attaches. Nothing
   waits on the EasyRewardz paperwork. Read that agreement anyway before ever using Version A.
2. **Fill the placeholders.** Every dotted field in the two HTML documents is empty on purpose. Nothing is
   pre-filled with real account or tax data.
3. **Confirm your GST position** and whether this counts as an export of services. The tax line on the
   invoice is a placeholder, not advice.
4. **Both documents are signed in your personal name**, not Capp Financial Services. That entity does not
   exist yet, and naming it on a contract or payment document would misstate the counterparty.

## Printing

Chrome, A4, 100% scale, background graphics on. The green banding needs backgrounds enabled. The orange
"before sending" banner is screen-only and does not print.

Verify fit after any edit:

```
node serve.mjs                                    # from the sid project root
node business/measure.mjs http://localhost:3000/business/retainer.html
node business/measure.mjs http://localhost:3000/business/invoice.html
```

Both should report FITS one page. Current headroom is about 11mm each.

## The arithmetic

Twenty clients at $500/month is $10,000 MRR. Each client commits $1,500 over the three-month initial term.
At 10 to 15 personalised emails a day and a realistic 2 to 5% cold reply rate, reaching twenty takes months,
not the seven days the original playbook claimed. The documents are built for that timeline.
