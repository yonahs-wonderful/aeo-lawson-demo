# AEO Lawson-style six-scenario write-back demo (v2)

Public site: https://yonahs-wonderful.github.io/aeo-lawson-demo/

A static legacy-style destination for a computer-use agent after a store manager has reconciled six payment exceptions. All records are synthetic. No authentication or real payment execution. The UI is inspired by Lawson Portal; the reconciliation worklist, handoff setup and payments queues are illustrative extensions, not verified AEO or Infor screens.

## Six manager handoffs and resulting write-backs

| Case | Scenario | Default USD | Destination / saved outcome |
| --- | --- | ---: | --- |
| FIN-1001 | Late settlement after a system outage | 245.50 | Reconciliation record: Timing explained — settlement matched. No GL journal. |
| FIN-1002 | Incorrect payment method recorded | 320.00 | Lawson GL: reclassify cash clearing to card clearing after separate finance authorization. |
| FIN-1003 | Cash shortage or deposit mismatch | 640.00 variance | Finance exception register: Pending finance review. No automatic write-off. |
| FIN-1004 | Customer dispute / chargeback | 210.00 | Payments dispute queue: Pending payments review, with evidence or an unavailable-evidence explanation and the response deadline. |
| FIN-1005 | Return accepted, refund missing | 180.00 | Payments refund queue: retry request or escalation after the existing-refund check; completed refunds can only be linked. |
| FIN-1006 | Duplicate charge / unsuccessful void | 125.00 | Payments reversal queue: pending refund/reversal request targeting only the charge the manager says to remove. |

FIN-1006 is a duplicate customer payment, not a duplicate accounting-upload reversal. Version 2 replaces the old three-scenario worklist. Its case IDs follow the six scenarios above.

## Preparing different amounts and facts

1. Open **Training Handoff Setup** (program **DEMO**).
2. Select a case, edit its synthetic confirmed amount, transaction references, evidence references and approved facts.
3. Save the confirmed handoff. These values become the input contract for that case.
4. Return to the worklist. The computer-use agent must enter matching values into the destination form; the form starts blank.

Amounts are not restricted to the sample numbers. References and classifications are also editable in setup. The downstream form validates against the current confirmed handoff so that wrong amounts, references or actions are rejected.

Setup simulates the upstream handoff; it is not connected to a real store-manager portal. It is intended for demo preparation, not for the downstream agent to alter its instructions. A case with a saved write-back or draft journal is locked against handoff changes. Reset the run before configuring a new version.

## Computer-use run

Open the worklist (**RC01.1**) and read each case’s confirmed values. Use those exact values in its destination entry form, check the handoff attestation, save/submit, then confirm. Reopen the saved record or request and compare the saved amounts, transaction references, evidence and status. **Write-backs saved** counts recorded handoffs; it does not mean all payment exceptions are financially resolved.

### FIN-1001: late settlement

Enter the original sale, amount, outage record, matched settlement reference, settlement date, daily-cutoff reason and evidence references. Default settlement is October 1, 2026, after the September 30 daily cutoff. Save the settlement match. No payment request or GL adjustment is created.

### FIN-1002: payment-method journal

The worklist provides the authorized journal plan. Defaults:

| Field | Value |
| --- | --- |
| Case | FIN-1002 |
| Company / unit | 100 / 0412 |
| Date / open training period | 2026-09-30 / 09-2026 |
| Correction reference | FIN-1002-RECLASS |
| Original sale | SALE-0412-0929-1002 |
| Finance posting authorization | CTRL-2026-0930-018 |
| Description | Reclassify cash to card per manager |
| Debit | 110200 Card clearing / 320.00 |
| Credit | 110100 Cash clearing / 320.00 |

1. In **GL40.1**, enter the plan, both lines and the handoff attestation; **Add journal**.
2. In **GL45.1**, review the saved journal header and lines; **Release journal** and confirm.
3. In **GL190**, select the released journal; **Submit posting job**, then **Post journal**.
4. Check **COMPLETED NORMALLY**, two posted lines and zero exceptions. Reopen the saved journal.
5. In **GL95.1**, verify cash clearing changes from 4,100.00 DR to 3,780.00 DR and card clearing from 82,400.00 DR to 82,720.00 DR. Total clearing assets are unchanged. The original Cash classification is retained alongside the current Card accounting classification and correcting journal.

For other configured tenders/amounts, use the updated plan. Account mappings: Cash 110100, Card 110200, Gift card 110300. Only the separately authorized method reclassification posts a journal. A blank finance authorization blocks posting. Unbalanced, wrong-amount, wrong-reference, wrong-account and duplicate journals are rejected. Add and Release never change balances.

### FIN-1003: cash / deposit mismatch

Enter comparison basis, expected and actual cash, signed count-sheet or deposit-record reference, selected reason, manager explanation and evidence references. Default expected 4,100.00 less actual 3,460.00 gives a 640.00 shortage. Actual cash may be zero. An overage is also supported; expected and actual are preserved. The variance is submitted for finance review. There is no write-off or GL impact.

### FIN-1004: dispute / chargeback

Enter sale, amount, dispute reference and response deadline. If pickup/sale evidence is Available, a document reference is required. If Unavailable, the manager’s explanation is required. Default response deadline is 2026-10-23. Submission creates a pending payments-review request; it does not respond to the processor or mark the chargeback won.

### FIN-1005: missing refund

Enter sale, return receipt, amount, the existing-refund lookup reference and its result, evidence and explanation.

- **No existing refund:** a Refund retry request or Escalate to payments action is permitted.
- **Existing refund pending / Unable to determine:** a retry is blocked; escalate to payments.
- **Existing refund completed:** supply its reference and Link existing refund; no new payment request.

The action must match the configured manager-approved handoff. Retry requests stay Pending payments execution. Escalations stay Pending payments review. The mock never issues a second refund.

### FIN-1006: duplicate charge / failed void

Enter the sale, amount, both payment records, payment to retain, other payment to refund/reverse, approved action, evidence and manager explanation. Default: retain PAY-1006-A and request reversal of PAY-1006-B. Both charge references remain in the saved record. Same-reference payments, invalid retained references or targeting the retained payment are rejected. Requests stay Pending payments execution; no real reversal or GL posting occurs.

## Read-back and persistence

- **Finance / Payments Requests (PM01.1):** reopen submitted requests to verify exact values and pending status. The default run produces four requests: cash review, chargeback review, refund retry and duplicate-payment reversal.
- **Account Analysis (GL95.1):** verify balances, original/current tender classification and each case’s saved write-back ID, status and linked journal/request.
- **Journal / Change Log (GL42.1 training view):** records setup changes, writes, journal add/release/post with UTC timestamps.
- **Export records:** downloads all confirmed handoffs, saved write-backs, journals, pending requests, balances and audit events as JSON.
- **Reset training data:** restores all six default handoffs and clears this v2 run after confirmation.
- localStorage key: `aeo-lawson-training-v2`. Data survives reload in the same browser profile. Different browsers have independent runs. Original v1 data is retained separately; it is not interpreted using the new case mapping.
- No server-side storage or connection to the upstream manager portal. Browser storage must be available for persistence between visits.

Inputs are ordinary labeled HTML fields with stable IDs/names. No sign-in, canvas, shadow DOM or iframes. Program navigation accepts RC01.1, GL40.1, GL45.1, GL190, GL95.1, GL42.1, PM01.1 and DEMO.

## Development and validation

```sh
npm ci
npm test
npm run test:browser
npm start
```

Production has no build step or runtime dependencies. GitHub Pages serves the root of main; `.nojekyll` disables Jekyll. Browser tests use Playwright with installed Google Chrome. Set `DEMO_URL` to test the public deployment instead of localhost.

Validation covers all six UI workflows, saved-record read-back, GL balances and posting transitions, edited handoff amounts, available/unavailable dispute evidence, existing-refund safeguards, duplicate-payment targeting, duplicate-submission prevention, refresh persistence, reset and separation from v1 storage. Screenshots are generated under ignored `test-results/`.

## Why this interface

Research checked October 20, 2026:

- AEO Financial Reporting VISION, hosted May 2022, page 7: “The Lawson GL is the company book of record for GL data.” https://andouc.org/wp-content/uploads/2022/05/ANDOUC_AEOEnterprise_Cressey.pdf#page=7
- AEO Staff Accountant posting, September 15, 2026: Lawson / Oracle ERP experience and Cadency reconciliation / journal-entry experience preferred. This corroborates relevance, not the exact production version or integration. https://hcml.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_2/job/32068
- Infor GL40.1 documentation: journal definition and release. The companion library lists Journal Control GL45.1, Journal Posting GL190, Account Analysis GL95.1 and Journal Entry Log GL42.1. https://docs.infor.com/lwsnapps/10.1/en-us/lwsncsolh/glhs/gl40_1.html
- Nogalis Lawson Portal Helpful User Guide, July 16, 2019: compact gray forms, program-code navigation and toolbar conventions. Blue navigation styling also follows historic Lawson Portal screenshots. https://www.nogalis.com/2019/07/16/lawson-portal-helpful-user-guide/
