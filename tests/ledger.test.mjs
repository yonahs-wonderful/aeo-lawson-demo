import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState, definitions, cents, validDate, configureHandoff, getHandoff, saveWriteback, journalPlan, saveJournal, releaseJournal, postJournal } from '../ledger.js';
const input = (s, id, overrides = {}) => ({ ...getHandoff(s, id).values, attest: true, ...overrides });
const journalInput = s => { const p = journalPlan(s); return { ...p, debit: (p.amount / 100).toFixed(2), credit: (p.amount / 100).toFixed(2), description: 'Reclassify verified payment method', attest: true }; };
const unchangedOnError = (s, action) => { const before = JSON.stringify(s); assert.throws(action); assert.equal(JSON.stringify(s), before); };

test('six exact customer scenarios replace the old accounting-upload fixture', () => {
  const s = initialState(); assert.equal(s.version, 2); assert.equal(s.handoffs.length, 6);
  assert.deepEqual(definitions.map(d => d.id), ['FIN-1001', 'FIN-1002', 'FIN-1003', 'FIN-1004', 'FIN-1005', 'FIN-1006']);
  assert.match(definitions[5].title, /Duplicate charge/);
});
test('all six workflows save facts, route requests correctly and change only the authorized GL accounts', () => {
  const s = initialState(), base = { ...s.balances };
  for (const id of ['FIN-1001', 'FIN-1003', 'FIN-1004', 'FIN-1005', 'FIN-1006']) saveWriteback(s, id, input(s, id));
  assert.deepEqual(s.balances, base); assert.equal(s.requests.length, 4);
  assert.equal(s.records['FIN-1001'].status, 'Timing explained — settlement matched');
  assert.equal(s.records['FIN-1003'].status, 'Pending finance review');
  assert.equal(s.records['FIN-1004'].status, 'Pending payments review');
  assert.equal(s.records['FIN-1005'].status, 'Pending payments execution');
  assert.equal(s.records['FIN-1006'].status, 'Pending payments execution');
  const j = saveJournal(s, journalInput(s));
  assert.deepEqual(s.balances, base); unchangedOnError(s, () => postJournal(s, j.id));
  releaseJournal(s, j.id); assert.deepEqual(s.balances, base); postJournal(s, j.id);
  assert.equal(s.balances['110200'], base['110200'] + 32000); assert.equal(s.balances['110100'], base['110100'] - 32000);
  assert.equal(Object.values(s.balances).reduce((a, b) => a + b), Object.values(base).reduce((a, b) => a + b));
  assert.equal(Object.keys(s.records).length, 6); assert.equal(s.audit.length, 8);
  assert.equal(s.records['FIN-1002'].values.recordedTender, 'Cash'); assert.equal(s.records['FIN-1002'].values.actualTender, 'Card');
  unchangedOnError(s, () => postJournal(s, j.id)); unchangedOnError(s, () => saveJournal(s, journalInput(s)));
  for (const id of ['FIN-1001', 'FIN-1003', 'FIN-1004', 'FIN-1005', 'FIN-1006']) unchangedOnError(s, () => saveWriteback(s, id, input(s, id)));
  const restored = JSON.parse(JSON.stringify(s)); assert.equal(restored.journals[0].status, 'Posted'); assert.equal(restored.requests[3].values.target, 'PAY-1006-B');
});
test('edited handoff amounts and tender accounts propagate without seeded amount restrictions', () => {
  const s = initialState(); configureHandoff(s, 'FIN-1002', input(s, 'FIN-1002', { amount: '467.89', actualTender: 'Gift card' }));
  const p = journalPlan(s); assert.equal(p.amount, 46789); assert.equal(p.debitAccount, '110300');
  const j = saveJournal(s, journalInput(s)); releaseJournal(s, j.id); postJournal(s, j.id);
  assert.equal(s.balances['110300'], 146789); assert.equal(s.balances['110100'], 363211);
  configureHandoff(s, 'FIN-1001', input(s, 'FIN-1001', { amount: '99.47', settlement: 'MY-SET-99' }));
  const r = saveWriteback(s, 'FIN-1001', input(s, 'FIN-1001')); assert.equal(r.amount, 9947); assert.equal(r.values.settlement, 'MY-SET-99');
});
test('amounts, references and attestation must match the current manager handoff', () => {
  const s = initialState();
  for (const id of ['FIN-1001', 'FIN-1003', 'FIN-1004', 'FIN-1005', 'FIN-1006']) unchangedOnError(s, () => saveWriteback(s, id, input(s, id, { attest: false })));
  unchangedOnError(s, () => saveWriteback(s, 'FIN-1001', input(s, 'FIN-1001', { amount: '1.00' })));
  unchangedOnError(s, () => saveWriteback(s, 'FIN-1001', input(s, 'FIN-1001', { settlement: 'WRONG' })));
  unchangedOnError(s, () => saveWriteback(s, 'FIN-1002', input(s, 'FIN-1002')));
});
test('cash variance requires signed evidence, reason and explanation and never posts a write-off', () => {
  const s = initialState();
  for (const f of ['countRef', 'reason', 'explanation', 'evidence']) unchangedOnError(s, () => saveWriteback(s, 'FIN-1003', input(s, 'FIN-1003', { [f]: '' })));
  configureHandoff(s, 'FIN-1003', input(s, 'FIN-1003', { expected: '100.00', actual: '0.00', explanation: 'Signed count confirms no cash; finance to investigate.' }));
  const balances = { ...s.balances }, r = saveWriteback(s, 'FIN-1003', input(s, 'FIN-1003'));
  assert.equal(r.amount, 10000); assert.equal(r.status, 'Pending finance review'); assert.deepEqual(s.balances, balances); assert.equal(s.journals.length, 0);
});
test('chargeback unavailable-evidence branch requires an explanation and preserves the deadline', () => {
  const s = initialState();
  unchangedOnError(s, () => configureHandoff(s, 'FIN-1004', input(s, 'FIN-1004', { evidenceStatus: 'Unavailable', evidence: '', explanation: '' })));
  configureHandoff(s, 'FIN-1004', input(s, 'FIN-1004', { evidenceStatus: 'Unavailable', evidence: '', explanation: 'Pickup signature cannot be located.' }));
  saveWriteback(s, 'FIN-1004', input(s, 'FIN-1004')); assert.equal(s.requests[0].values.deadline, '2026-10-23'); assert.equal(s.requests[0].values.explanation, 'Pickup signature cannot be located.');
});
test('pending and unknown refunds block retries; completed refunds can only be linked', () => {
  for (const status of ['Existing refund pending', 'Existing refund completed', 'Unable to determine']) {
    const s = initialState(); unchangedOnError(s, () => configureHandoff(s, 'FIN-1005', input(s, 'FIN-1005', { existingStatus: status, existingRefund: 'RF-FOUND', action: 'Refund retry request' })));
  }
  const pending = initialState(); configureHandoff(pending, 'FIN-1005', input(pending, 'FIN-1005', { existingStatus: 'Existing refund pending', existingRefund: 'RF-PENDING', action: 'Escalate to payments' }));
  saveWriteback(pending, 'FIN-1005', input(pending, 'FIN-1005')); assert.equal(pending.requests[0].status, 'Pending payments review');
  const completed = initialState(); configureHandoff(completed, 'FIN-1005', input(completed, 'FIN-1005', { existingStatus: 'Existing refund completed', existingRefund: 'RF-COMPLETED', action: 'Link existing refund' }));
  const r = saveWriteback(completed, 'FIN-1005', input(completed, 'FIN-1005')); assert.equal(r.status, 'Resolved — existing refund linked'); assert.equal(completed.requests.length, 0);
});
test('duplicate customer charge requires distinct payment records and targets only the nonretained charge', () => {
  const s = initialState();
  for (const override of [{ target: 'PAY-1006-A' }, { retain: 'NOT-A-PAYMENT' }, { paymentB: 'PAY-1006-A' }]) unchangedOnError(s, () => configureHandoff(s, 'FIN-1006', input(s, 'FIN-1006', override)));
  configureHandoff(s, 'FIN-1006', input(s, 'FIN-1006', { retain: 'PAY-1006-B', target: 'PAY-1006-A', action: 'Refund request', amount: '75.25' }));
  const r = saveWriteback(s, 'FIN-1006', input(s, 'FIN-1006')); assert.equal(r.values.retain, 'PAY-1006-B'); assert.equal(r.values.target, 'PAY-1006-A'); assert.equal(r.amount, 7525); assert.equal(s.journals.length, 0);
});
test('GL posting requires finance authorization, balanced exact amounts and correct accounts', () => {
  const s = initialState();
  for (const change of [{ credit: '319.99' }, { debit: '1', credit: '1' }, { date: '2026-10-01' }, { approval: 'WRONG' }, { debitAccount: '110100' }, { attest: false }, { caseId: 'FIN-1006' }]) unchangedOnError(s, () => saveJournal(s, { ...journalInput(s), ...change }));
  configureHandoff(s, 'FIN-1002', input(s, 'FIN-1002', { approval: '' })); unchangedOnError(s, () => saveJournal(s, journalInput(s)));
});
test('saved or drafted work locks handoff changes', () => {
  const s = initialState(); saveWriteback(s, 'FIN-1001', input(s, 'FIN-1001')); unchangedOnError(s, () => configureHandoff(s, 'FIN-1001', input(s, 'FIN-1001', { amount: '99' })));
  saveJournal(s, journalInput(s)); unchangedOnError(s, () => configureHandoff(s, 'FIN-1002', input(s, 'FIN-1002', { amount: '99' })));
});
test('invalid currency and dates are rejected without floating-point rounding', () => {
  for (const v of ['-1', 'abc', '1.001', 'Infinity', '1e3', '', '0', '9007199254740992']) assert.throws(() => cents(v));
  assert.equal(cents('467.89'), 46789); assert.equal(cents('0.01'), 1); assert.equal(cents('0', true), 0);
  assert.equal(validDate('2026-02-30'), false); assert.equal(validDate('2026-10-01'), true);
});

test('completion verifies current handoffs, posted GL, linked requests and balances without mutation', async () => {
  const { completionReport } = await import('../ledger.js');
  const s = initialState(); assert.equal(completionReport(s).complete, false);
  saveWriteback(s, 'FIN-1001', input(s, 'FIN-1001'));
  assert.equal(completionReport(s).verified, 1);
  for (const id of ['FIN-1003', 'FIN-1004', 'FIN-1005', 'FIN-1006']) saveWriteback(s, id, input(s, id));
  const j = saveJournal(s, journalInput(s)); releaseJournal(s, j.id);
  assert.equal(completionReport(s).complete, false);
  postJournal(s, j.id);
  const before = JSON.stringify(s), r = completionReport(s);
  assert.equal(r.complete, true); assert.equal(r.verified, 6); assert.equal(r.pending, 4); assert.equal(r.posted, 1);
  assert.deepEqual(completionReport(s), r); assert.equal(JSON.stringify(s), before);
  for (const corrupt of [
    x => { x.records['FIN-1002'].values.amount = '1.00'; },
    x => { x.handoffs[0].revision++; },
    x => { x.requests[0].values.expected = '1.00'; },
    x => { x.requests[0].status = 'Executed'; },
    x => { x.journals[0].status = 'Released'; },
    x => { x.journals[0].debitAccount = '110300'; },
    x => { x.balances['110100']++; },
    x => { x.records['FIN-1006'].requestId = 'MISSING'; },
    x => { x.requests.push({ ...x.requests[0] }); }
  ]) { const broken = structuredClone(s); corrupt(broken); assert.equal(completionReport(broken).complete, false); }
});
