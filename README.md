# AEO Lawson Financials training replica

Public, static, Lawson-inspired legacy finance mock for a computer-use demonstration. Synthetic data only. No authentication, production integrations, or external API calls. This is not an Infor product or a verified replica of AEO's implementation.

## Live site

https://yonahs-wonderful.github.io/aeo-lawson-demo/

## Why this interface

Research checked October 20, 2026:

- AEO Financial Reporting VISION, hosted May 2022, page 7: “The Lawson GL is the company book of record for GL data.” https://andouc.org/wp-content/uploads/2022/05/ANDOUC_AEOEnterprise_Cressey.pdf#page=7
- AEO Staff Accountant posting, September 15, 2026: Lawson / Oracle ERP experience and Cadency reconciliation / journal-entry experience preferred. This corroborates relevance, not the exact production version or integration. https://hcml.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_2/job/32068
- Infor GL40.1 documentation: journal definition and release. The companion library lists Journal Control GL45.1, Journal Posting GL190, Account Analysis GL95.1 and Journal Entry Log GL42.1. https://docs.infor.com/lwsnapps/10.1/en-us/lwsncsolh/glhs/gl40_1.html
- Nogalis Lawson Portal Helpful User Guide, July 16, 2019: compact gray forms, program-code navigation and toolbar conventions. Blue navigation styling also follows historic Lawson Portal screenshots. https://www.nogalis.com/2019/07/16/lawson-portal-helpful-user-guide/

The worklist (RC01.1), deposit maintenance (RC02.1), refund-reference maintenance (RC03.1), cross-record updates and simplified change-log presentation are invented training extensions. They do not claim to be actual Lawson screens or AEO workflows. The September 2026 calendar period, account numbers, approvals, manager and transaction identifiers are illustrative. Cadency is not reproduced.

## Computer-use task: approved duplicate correction

Start at the worklist. All store-manager confirmation and finance approval evidence is already available. Read FIN-1001 and click **Enter approved correction**, or open **Journal Entry GL40.1**.

| Field | Exact value |
| --- | --- |
| Company | 100 |
| Accounting unit | 0412 |
| Posting date | 2026-09-30 |
| Reference | FIN-1001-REVERSAL |
| Approval reference | CTRL-2026-0930-017 |
| Original transaction | GL-0412-0929-B02-DUP |
| Description | Reverse duplicate sales upload B02 |
| Line 1 account / debit | 400100 Net sales / 1200.00 |
| Line 2 account / credit | 110200 Card clearing / 1200.00 |

1. Add the journal. It receives journal number 100241 and status Unreleased.
2. In **Journal Control GL45.1**, review saved header and lines, then **Release journal** and confirm. No balance changes occur yet.
3. In **Journal Posting GL190**, select journal 100241, submit the job and confirm **Post journal**.
4. Verify job status COMPLETED NORMALLY, two posted lines and zero exceptions.
5. Reopen the saved journal through Journal Control. Verify Posted status and the exact reference, accounts and amounts.
6. In **Account Analysis GL95.1**, verify net sales activity is $82,400 CR and card-clearing sales debit activity is $82,400 DR. These are selected activity totals, not the full trial balance or final cash-clearing balance. The original duplicate is retained and linked to the correction. FIN-1001 is Corrected.

Unbalanced journals, wrong amounts, approval references, dates, entities, accounts and duplicate references are rejected. Posted journals cannot be posted a second time. No new customer payment is initiated.

## Additional maintenance tasks

**FIN-1002:** Open its worklist row. Correct bag D0412-O930 to **D0412-0930**, enter handoff **2026-10-01**, choose **Deposit in transit**, check the handoff attestation, then update and confirm. The $750 remains in transit awaiting a bank match. No GL change.

**FIN-1004:** Open its worklist row. Enter original sale **SALE-0412-0920-8831**, refund amount **180.00**, processor reference **RF-0929-1042-180**, check the attestation, then save and confirm. This matches the existing refund. No second refund or GL change.

After all three tasks, the worklist shows 3 / 3 handoffs processed and 1 posted correction. The change log contains ADD, RELEASE, POST, UPDATE and MATCH events.

## State, reset and automation

- Browser localStorage key: `aeo-lawson-training-v1`.
- State survives refreshes in the same browser profile. Independent browsers/profiles have separate training runs. No server-side persistence or shared state.
- **Reset training data** opens a confirmation and restores the three initial handoffs. Reset before each demo.
- Inputs use ordinary HTML, visible labels, native select controls and stable IDs. No canvas, shadow DOM, iframes, sign-in or custom select menus.
- **Program** navigation accepts RC01.1, RC02.1, RC03.1, GL40.1, GL45.1, GL190, GL95.1 and GL42.1.
- **Export records** downloads the current synthetic ledger and audit log as JSON.
- Browser storage must be enabled. Keep the same profile throughout one run.

## Development and deployment

No build step or production dependencies.

```sh
npm test
npm start
```

GitHub Pages serves the root of the main branch. `.nojekyll` disables Jekyll processing.

Validation: Node business-logic tests cover posting transitions, exact balance changes, reference deduplication, invalid inputs and non-journal updates. Browser verification covered the unbalanced error, successful add/release/post, both reference-maintenance forms, all three resolved statuses, five audit events and refresh persistence.
