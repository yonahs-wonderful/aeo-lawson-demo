import { test, expect } from '@playwright/test';
import { definitions } from '../ledger.js';
const KEY = 'aeo-lawson-training-v2';
async function navigate(page, target) { await page.locator(`#nav [data-page="${target}"]`).click(); }
async function fillFields(form, fields, values) {
  for (const field of fields) {
    const input = form.locator(`[name="${field.name}"]`);
    if (field.type === 'select') await input.selectOption(values[field.name] || '');
    else await input.fill(values[field.name] || '');
  }
}
async function openCase(page, id) { await navigate(page, 'queue'); await page.locator(`[data-case="${id}"]`).click(); }
async function submitRecord(page, definition, overrides = {}) {
  const form = page.locator('#record-form');
  await fillFields(form, definition.fields, { ...definition.values, ...overrides });
  await form.locator('[name="attest"]').check(); await form.locator('button[type=submit]').click();
  await page.locator('#confirm-dialog').click();
}
async function setup(page, id, changes) {
  await navigate(page, 'setup'); await page.locator('#setup-case').selectOption(id);
  const form = page.locator('#setup-form');
  for (const [key, value] of Object.entries(changes)) {
    const input = form.locator(`[name="${key}"]`);
    if (await input.evaluate(el => el.tagName === 'SELECT')) await input.selectOption(value); else await input.fill(value);
  }
  await form.locator('button[type=submit]').click();
}
const browserErrors = [];
test.beforeEach(async ({ page }) => { page.on('pageerror', error => browserErrors.push(error.message)); await page.goto('./'); });
test.afterEach(() => { expect(browserErrors.splice(0)).toEqual([]); });

test('all six UI write-backs, GL release/post, requests, read-back, refresh and reset', async ({ page }) => {
  await expect(page.locator('[data-case]')).toHaveCount(6);
  await navigate(page, 'completion'); await expect(page.locator('#completion-result')).toHaveText('WRITE-BACK INCOMPLETE');
  await navigate(page, 'queue');
  // Old-version data is kept separate when the six-scenario run is reset.
  await page.evaluate(() => localStorage.setItem('aeo-lawson-training-v1', JSON.stringify({ version: 1, marker: 'prior-run' })));
  for (const id of ['FIN-1001', 'FIN-1003', 'FIN-1004', 'FIN-1005', 'FIN-1006']) {
    const d = definitions.find(d => d.id === id); await openCase(page, id); await submitRecord(page, d);
    await expect(page.locator('#status')).toHaveClass('success'); await expect(page.locator('#record-form')).toHaveCount(0);
    await expect(page.locator('#content')).toContainText(d.values.evidence);
  }
  await openCase(page, 'FIN-1002'); await page.locator('#content [data-page=entry]').click();
  const form = page.locator('#journal-form');
  const values = { reference: 'FIN-1002-RECLASS', source: 'SALE-0412-0929-1002', approval: 'CTRL-2026-0930-018', description: 'Reclassify cash to card per manager', debit: '320.00', credit: '319.99' };
  for (const [name, value] of Object.entries(values)) await form.locator(`[name="${name}"]`).fill(value);
  await form.locator('[name=debitAccount]').selectOption('110200'); await form.locator('[name=creditAccount]').selectOption('110100'); await form.locator('[name=attest]').check();
  await form.locator('button[type=submit]').click(); await expect(page.locator('#status')).toContainText('out of balance');
  await form.locator('[name=credit]').fill('320.00'); await form.locator('button[type=submit]').click();
  await expect(page.locator('#content')).toContainText('Saved journal 100241');
  await page.locator('[data-release="100241"]').click(); await page.locator('#confirm-dialog').click();
  await expect(page.locator('#content')).toContainText('Released');
  await navigate(page, 'posting'); await page.locator('#post-journal').selectOption('100241'); await page.locator('#posting-form button[type=submit]').click(); await page.locator('#confirm-dialog').click();
  await expect(page.locator('.report')).toContainText('COMPLETED NORMALLY'); await expect(page.locator('.report')).toContainText('320.00');
  await navigate(page, 'inquiry'); await expect(page.locator('#content')).toContainText('4,100.00'); await expect(page.locator('#content')).toContainText('3,780.00'); await expect(page.locator('#content')).toContainText('82,720.00');
  await expect(page.locator('#content')).toContainText('Pending payments execution');
  await navigate(page, 'requests'); await expect(page.locator('[data-request]')).toHaveCount(4);
  await page.locator('[data-request]').last().click(); await expect(page.locator('#content')).toContainText('PAY-1006-B'); await expect(page.locator('#content')).toContainText('Reversal request');
  await page.reload(); await expect(page.locator('.summary')).toContainText('6 / 6');
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
  expect(saved.audit).toHaveLength(8); expect(saved.requests).toHaveLength(4); expect(saved.journals[0].status).toBe('Posted');
  await navigate(page, 'completion');
  await expect(page.locator('#completion-result')).toHaveText('WRITE-BACK COMPLETE');
  await expect(page.locator('#content')).toContainText('4');
  await expect(page.locator('#content')).toContainText('Pending payments execution');
  await page.screenshot({ path: 'test-results/writeback-complete.png', fullPage: true });
  await page.locator('#content [data-action=refresh]').click();
  await expect(page.locator('#completion-result')).toHaveText('WRITE-BACK COMPLETE');
  await page.locator('#reset').click(); await page.locator('#confirm-dialog').click();
  await expect(page.locator('.summary')).toContainText('0 / 6');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('aeo-lawson-training-v1')).marker)).toBe('prior-run');
});

test('editable handoff money, evidence-unavailable branch, and existing-refund protection', async ({ page }) => {
  await setup(page, 'FIN-1001', { amount: '99.47', settlement: 'CUSTOM-SET-99' }); await expect(page.locator('#status')).toHaveClass('success');
  await openCase(page, 'FIN-1001'); const d = definitions[0];
  await submitRecord(page, d); await expect(page.locator('#status')).toContainText('must match');
  await submitRecord(page, d, { amount: '99.47', settlement: 'CUSTOM-SET-99' }); await expect(page.locator('#status')).toHaveClass('success'); await expect(page.locator('#content')).toContainText('99.47');
  await setup(page, 'FIN-1004', { evidenceStatus: 'Unavailable', evidence: '', explanation: '' }); await expect(page.locator('#status')).toContainText('Explain why');
  await page.locator('#setup-form [name=explanation]').fill('Signed pickup record unavailable.'); await page.locator('#setup-form button[type=submit]').click();
  await openCase(page, 'FIN-1004'); await submitRecord(page, definitions[3], { evidenceStatus: 'Unavailable', evidence: '', explanation: 'Signed pickup record unavailable.' }); await expect(page.locator('#status')).toHaveClass('success');
  await setup(page, 'FIN-1005', { existingStatus: 'Existing refund pending', existingRefund: 'RF-PENDING', action: 'Refund retry request' }); await expect(page.locator('#status')).toContainText('Retry blocked');
  await page.locator('#setup-form [name=action]').selectOption('Escalate to payments'); await page.locator('#setup-form button[type=submit]').click();
  await openCase(page, 'FIN-1005'); await submitRecord(page, definitions[4], { existingStatus: 'Existing refund pending', existingRefund: 'RF-PENDING', action: 'Escalate to payments' });
  await expect(page.locator('#content')).toContainText('Pending payments review');
  await setup(page, 'FIN-1006', { retain: 'PAY-1006-A', target: 'PAY-1006-A' }); await expect(page.locator('#status')).toContainText('never the retained charge');
});

test('legacy desktop appearance remains readable and keyboard labels are usable', async ({ page }) => {
  const rootOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth); expect(rootOverflow).toBe(false);
  await expect(page.getByRole('button', { name: 'Open FIN-1006', exact: true })).toBeVisible();
  await page.getByLabel('Program', { exact: true }).fill('PM01.1'); await page.getByLabel('Program', { exact: true }).press('Enter');
  await expect(page.locator('#title')).toHaveText('Finance / Payments Requests');
  await navigate(page, 'queue'); await page.screenshot({ path: 'test-results/six-scenario-worklist.png', fullPage: true });
  await openCase(page, 'FIN-1006'); await page.screenshot({ path: 'test-results/duplicate-payment-form.png', fullPage: true });
});

test('batch worksheet completes through six amount entries and explicit journal controls', async ({ page }) => {
  await page.goto('./#batch');
  await expect(page.locator('#title')).toHaveText('Approved Write-back Batch');
  for (const d of definitions) {
    await page.getByLabel(`${d.id} ${d.id === 'FIN-1003' ? 'counted / deposited cash' : 'amount'} USD`, { exact: true }).fill(d.values[d.id === 'FIN-1003' ? 'actual' : 'amount']);
  }
  await page.locator('#batch-attest').check();
  await page.getByRole('button', { name: 'Stage approved batch', exact: true }).click();
  await page.getByRole('button', { name: 'Save staged batch', exact: true }).click();
  await expect(page.locator('#status')).toContainText('Batch staged');
  await expect(page.locator('#content')).toContainText('4,100.00 DR');
  await expect(page.locator('#content')).toContainText('Unreleased');
  await page.reload(); await expect(page.locator('#title')).toHaveText('Approved Write-back Batch');
  await page.getByRole('button', { name: 'Release staged journal', exact: true }).click();
  await expect(page.locator('#content')).toContainText('Released');
  await page.getByRole('button', { name: 'Submit GL190 posting', exact: true }).click();
  await page.getByRole('button', { name: 'Post journal', exact: true }).click();
  await expect(page.locator('#content')).toContainText('COMPLETED NORMALLY');
  await expect(page.locator('#content')).toContainText('3,780.00 DR');
  await expect(page.locator('#content')).toContainText('82,720.00 DR');
  await page.getByRole('button', { name: 'Verify write-back completion', exact: true }).click();
  await expect(page.locator('#completion-result')).toHaveText('WRITE-BACK COMPLETE');
  await expect(page.locator('.completion-banner')).toContainText('6 / 6');
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
  expect(saved.requests).toHaveLength(4); expect(saved.journals).toHaveLength(1); expect(saved.audit).toHaveLength(8);
  await page.screenshot({ path: 'test-results/batch-complete.png', fullPage: true });
});

test('batch rejects a mistyped amount without partial writes and carries edited approved facts', async ({ page }) => {
  await setup(page, 'FIN-1001', { amount: '99.47', settlement: 'CUSTOM-SET-99' });
  await navigate(page, 'batch');
  await expect(page.locator('#content')).toContainText('CUSTOM-SET-99');
  for (const d of definitions) await page.locator(`#batch-${d.id}`).fill(d.values[d.id === 'FIN-1003' ? 'actual' : 'amount']);
  await page.locator('#batch-attest').check();
  await page.getByRole('button', { name: 'Stage approved batch', exact: true }).click(); await page.locator('#confirm-dialog').click();
  await expect(page.locator('#status')).toContainText('must match');
  expect(await page.evaluate(key => Object.keys(JSON.parse(localStorage.getItem(key)).records).length, KEY)).toBe(0);
  await page.locator('#batch-FIN-1001').fill('99.47');
  await page.getByRole('button', { name: 'Stage approved batch', exact: true }).click(); await page.locator('#confirm-dialog').click();
  await expect(page.locator('#status')).toContainText('Batch staged');
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
  expect(saved.records['FIN-1001'].values.settlement).toBe('CUSTOM-SET-99');
  expect(saved.records['FIN-1001'].amount).toBe(9947);
  await page.screenshot({ path: 'test-results/batch-worksheet.png', fullPage: true });
});
