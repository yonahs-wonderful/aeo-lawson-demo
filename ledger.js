export const VERSION = 2;
export const STORAGE_KEY = 'aeo-lawson-training-v2';
export const money = value => (value / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const accounts = { '110100': 'Cash clearing', '110200': 'Card clearing', '110300': 'Gift card clearing' };
const tenderAccount = { Cash: '110100', Card: '110200', 'Gift card': '110300' };
const field = (name, label, type = 'text', options = null, optional = false) => ({ name, label, type, options, optional });
const sale = field('sale', 'Original sale reference');
const amount = field('amount', 'Amount USD', 'money');
const evidence = field('evidence', 'Evidence document reference(s)');
export const definitions = [
  { id: 'FIN-1001', title: 'Late settlement after a system outage', destination: 'Reconciliation record', action: 'Save settlement match',
    instruction: 'Record the matched settlement and daily-cutoff explanation. No journal or payment request is needed.',
    fields: [sale, amount, field('outage', 'Outage record'), field('settlement', 'Matched settlement reference'), field('settlementDate', 'Settlement date', 'date'), field('reason', 'Resolution reason', 'select', ['Payment settled after daily cutoff']), evidence],
    values: { sale: 'SALE-0412-0930-1001', amount: '245.50', outage: 'INC-0930-POS-017', settlement: 'SET-1001-0412-1001', settlementDate: '2026-10-01', reason: 'Payment settled after daily cutoff', evidence: 'RECEIPT-1001 / OUTAGE-017 / SETTLEMENT-1001' },
    manager: 'The sale occurred on September 30 during the outage. The processor confirms settlement on October 1, after the daily cutoff.' },
  { id: 'FIN-1002', title: 'Incorrect payment method recorded', destination: 'Lawson GL reclassification', action: 'Enter approved reclassification',
    instruction: 'Reclassify the approved amount from the recorded tender clearing account to the actual tender clearing account. Revenue and total assets remain unchanged.',
    fields: [sale, amount, field('recordedTender', 'Recorded payment method', 'select', ['Cash', 'Card', 'Gift card']), field('actualTender', 'Actual payment method', 'select', ['Cash', 'Card', 'Gift card']), field('approval', 'Finance posting authorization', 'text', null, true), evidence],
    values: { sale: 'SALE-0412-0929-1002', amount: '320.00', recordedTender: 'Cash', actualTender: 'Card', approval: 'CTRL-2026-0930-018', evidence: 'POS-1002 / PROCESSOR-CARD-1002' },
    manager: 'The POS classified the payment as cash. The payment record shows a completed card sale. Finance authorized the tender reclassification.' },
  { id: 'FIN-1003', title: 'Cash shortage or deposit mismatch', destination: 'Finance exception register', action: 'Submit cash / deposit review',
    instruction: 'Record expected and actual cash, signed evidence, reason and manager explanation. Submit the remaining variance to finance; this does not write off a shortage.',
    fields: [field('basis', 'Comparison basis', 'select', ['Cash count', 'Bank deposit']), field('expected', 'Expected cash / deposit USD', 'money'), field('actual', 'Counted / deposited USD', 'money'), field('countRef', 'Signed count sheet / deposit record'), field('reason', 'Manager-selected reason', 'select', ['Unexplained shortage', 'Deposit timing', 'Count correction', 'Bank deposit discrepancy']), field('explanation', 'Manager explanation', 'textarea'), evidence],
    values: { basis: 'Cash count', expected: '4100.00', actual: '3460.00', countRef: 'SIGNED-COUNT-0412-0930', reason: 'Unexplained shortage', explanation: 'Drawer recounted and safe pickups checked. The $640 shortage remains unexplained and requires finance review.', evidence: 'SIGNED-COUNT-0412-0930 / SAFE-PICKUPS-0930' },
    manager: 'The signed recount and safe-pickup checks are complete. The shortage remains outstanding; manager confirmation does not authorize a write-off.' },
  { id: 'FIN-1004', title: 'Customer dispute / chargeback', destination: 'Payments dispute queue', action: 'Submit dispute evidence',
    instruction: 'Send the evidence package or unavailable-evidence explanation to the payments team. Submission does not mean the chargeback has been won or reversed.',
    fields: [sale, amount, field('dispute', 'Dispute / chargeback reference'), field('deadline', 'Processor response deadline', 'date'), field('evidenceStatus', 'Pickup / sale evidence', 'select', ['Available', 'Unavailable']), field('evidence', 'Pickup / sale evidence reference(s)', 'text', null, true), field('explanation', 'Explanation if evidence unavailable', 'textarea', null, true)],
    values: { sale: 'SALE-0412-0927-1004', amount: '210.00', dispute: 'CB-2026-1004', deadline: '2026-10-23', evidenceStatus: 'Available', evidence: 'SIGNED-PICKUP-1004 / RECEIPT-1004', explanation: '' },
    manager: 'The store confirmed the sale and supplied signed pickup evidence. The payments team must respond to the processor before the recorded deadline.' },
  { id: 'FIN-1005', title: 'Return accepted, refund missing', destination: 'Payments refund queue', action: 'Submit refund resolution',
    instruction: 'Record the existing-refund check before requesting a retry. Pending or uncertain refunds must be escalated. A completed refund can only be linked, not retried.',
    fields: [sale, field('returnRef', 'Return receipt'), amount, field('checkRef', 'Existing-refund check reference'), field('existingStatus', 'Existing-refund check result', 'select', ['No existing refund', 'Existing refund pending', 'Existing refund completed', 'Unable to determine']), field('existingRefund', 'Existing refund reference (if found)', 'text', null, true), field('action', 'Approved next action', 'select', ['Refund retry request', 'Escalate to payments', 'Link existing refund']), evidence, field('explanation', 'Manager explanation', 'textarea')],
    values: { sale: 'SALE-0412-0920-8831', returnRef: 'RET-0412-0928-108', amount: '180.00', checkRef: 'REFUND-LOOKUP-20261001-108', existingStatus: 'No existing refund', existingRefund: '', action: 'Refund retry request', evidence: 'RETURN-RECEIPT-180 / PROCESSOR-LOOKUP-108', explanation: 'Return accepted. Finance checked the original card and processor history; no existing refund was found. Request a payments-team retry.' },
    manager: 'The return was accepted. The existing-refund check found no completed or pending refund. A retry request is authorized for the payments team.' },
  { id: 'FIN-1006', title: 'Duplicate charge / unsuccessful void', destination: 'Payments reversal queue', action: 'Submit duplicate-payment request',
    instruction: 'Retain the manager-confirmed valid charge and target only the other payment for refund or reversal. Both original payment records must remain visible.',
    fields: [sale, amount, field('paymentA', 'Payment record A'), field('paymentB', 'Payment record B'), field('retain', 'Payment to retain'), field('target', 'Payment to refund / reverse'), field('action', 'Approved next action', 'select', ['Refund request', 'Reversal request']), evidence, field('explanation', 'Manager explanation', 'textarea')],
    values: { sale: 'SALE-0412-0929-1006', amount: '125.00', paymentA: 'PAY-1006-A', paymentB: 'PAY-1006-B', retain: 'PAY-1006-A', target: 'PAY-1006-B', action: 'Reversal request', evidence: 'RECEIPT-1006 / PAYMENT-A / PAYMENT-B / VOID-FAILED-1006', explanation: 'Payment A is the valid sale. Payment B was charged again and its void failed. Retain A and request reversal of B only.' },
    manager: 'Payment A is the valid charge. Payment B is the duplicate and the void failed. The manager confirmed which payment to retain.' }
];
const now = () => new Date().toISOString();
const requireThat = (condition, message) => { if (!condition) throw Error(message); };
export function cents(value, allowZero = false) {
  const text = String(value).trim();
  requireThat(/^\d+(\.\d{1,2})?$/.test(text), 'Enter a valid USD amount with at most two decimal places.');
  const [whole, fraction = ''] = text.split('.');
  const n = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  requireThat(Number.isSafeInteger(n) && (allowZero ? n >= 0 : n > 0), allowZero ? 'Amount must be zero or greater.' : 'Amount must be greater than zero.');
  return n;
}
export function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function initialState() {
  return { version: VERSION, handoffs: definitions.map(d => ({ id: d.id, values: { ...d.values }, manager: 'Jamie Parker', confirmedAt: '2026-10-01T14:20:00Z', revision: 1 })),
    records: {}, journals: [], requests: [], audit: [], balances: { '110100': 410000, '110200': 8240000, '110300': 100000 }, nextJournal: 100241, nextRecord: 10001, nextRequest: 70001 };
}
export function getDefinition(id) {
  const d = definitions.find(d => d.id === id);
  requireThat(d, 'Unknown reconciliation case.'); return d;
}
export function getHandoff(state, id) {
  const h = state.handoffs.find(h => h.id === id);
  requireThat(h, 'Verified handoff not found.'); return h;
}
export function caseAmount(values) { return values.amount ? cents(values.amount) : Math.abs(cents(values.expected) - cents(values.actual, true)); }
function normalize(id, data) {
  const d = getDefinition(id), result = {};
  for (const f of d.fields) {
    const value = String(data[f.name] ?? '').trim();
    requireThat(value.length <= 2000, `${f.label} is too long.`);
    requireThat(f.optional || value, `${f.label} is required.`);
    if (value && f.type === 'money') cents(value, f.name === 'actual');
    if (value && f.type === 'date') requireThat(validDate(value), `${f.label} must be a valid date.`);
    if (value && f.options) requireThat(f.options.includes(value), `Select a permitted ${f.label.toLowerCase()}.`);
    result[f.name] = value;
  }
  if (id === 'FIN-1001') requireThat(result.settlementDate > '2026-09-30', 'Settlement must be after the September 30 daily cutoff.');
  if (id === 'FIN-1002') requireThat(result.recordedTender !== result.actualTender, 'Actual and recorded payment methods must differ.');
  if (id === 'FIN-1003') requireThat(cents(result.expected) !== cents(result.actual, true), 'There is no cash variance to submit.');
  if (id === 'FIN-1004') {
    requireThat(result.evidenceStatus !== 'Available' || result.evidence, 'Pickup / sale evidence reference is required when evidence is available.');
    requireThat(result.evidenceStatus !== 'Unavailable' || result.explanation, 'Explain why pickup / sale evidence is unavailable.');
  }
  if (id === 'FIN-1005') {
    const found = ['Existing refund pending', 'Existing refund completed'].includes(result.existingStatus);
    requireThat(!found || result.existingRefund, 'Enter the existing refund reference.');
    requireThat(result.existingStatus !== 'No existing refund' || !result.existingRefund, 'A no-refund result cannot include an existing refund reference.');
    requireThat(result.action !== 'Refund retry request' || result.existingStatus === 'No existing refund', 'Retry blocked: an existing, pending or uncertain refund must not be retried.');
    requireThat(result.action !== 'Link existing refund' || result.existingStatus === 'Existing refund completed', 'Only a completed refund can be linked as resolved.');
    requireThat(result.existingStatus !== 'Existing refund completed' || result.action === 'Link existing refund', 'A completed refund must be linked; do not request another refund.');
  }
  if (id === 'FIN-1006') {
    requireThat(result.paymentA !== result.paymentB, 'The two payment records must be different.');
    requireThat([result.paymentA, result.paymentB].includes(result.retain), 'Retained payment must be payment A or B.');
    requireThat([result.paymentA, result.paymentB].includes(result.target) && result.target !== result.retain, 'Refund / reversal target must be the other payment, never the retained charge.');
  }
  return result;
}
function log(state, event, caseId, detail) { state.audit.push({ at: now(), operator: 'FINOPS01', event, caseId, detail }); }
export function configureHandoff(state, id, data) {
  const h = getHandoff(state, id), values = normalize(id, data);
  requireThat(!state.records[id] && !state.journals.some(j => j.caseId === id), 'This handoff has saved work. Reset training data before changing its approved inputs.');
  h.values = values; h.revision++; h.confirmedAt = now();
  log(state, 'HANDOFF_SETUP', id, `Training handoff revision ${h.revision} saved. Verified amount USD ${money(caseAmount(values))}.`);
}
export function validateWriteback(state, id, data) {
  requireThat(!state.records[id], 'A write-back already exists for this case. Reopen the saved record; duplicate submission is blocked.');
  requireThat(data.attest === true || data.attest === 'on', 'Confirm that the values match the approved manager handoff.');
  const values = normalize(id, data), h = getHandoff(state, id);
  for (const f of getDefinition(id).fields) {
    const expected = h.values[f.name] || '', actual = values[f.name];
    requireThat(f.type === 'money' ? cents(expected, f.name === 'actual') === cents(actual, f.name === 'actual') : expected === actual, `${f.label} must match the current verified handoff. Update Training handoff setup first if the demo inputs changed.`);
  }
  return values;
}
export function saveWriteback(state, id, data) {
  requireThat(id !== 'FIN-1002', 'Payment-method corrections must be entered and posted through the journal screens.');
  const values = validateWriteback(state, id, data);
  let status, request = null, destination = getDefinition(id).destination;
  if (id === 'FIN-1001') status = 'Timing explained — settlement matched';
  if (id === 'FIN-1003') status = 'Pending finance review';
  if (id === 'FIN-1004') status = 'Pending payments review';
  if (id === 'FIN-1005') status = values.action === 'Link existing refund' ? 'Resolved — existing refund linked' : values.action === 'Refund retry request' ? 'Pending payments execution' : 'Pending payments review';
  if (id === 'FIN-1006') status = 'Pending payments execution';
  if ([ 'FIN-1003', 'FIN-1004', 'FIN-1006' ].includes(id) || (id === 'FIN-1005' && values.action !== 'Link existing refund')) {
    request = { id: `REQ-${state.nextRequest++}`, caseId: id, destination, action: values.action || (id === 'FIN-1003' ? 'Review cash / deposit variance' : 'Review chargeback evidence'), status, amount: caseAmount(values), values: { ...values }, createdAt: now() };
    state.requests.push(request);
  }
  const record = { id: `WB-${state.nextRecord++}`, caseId: id, status, destination, amount: caseAmount(values), values, requestId: request?.id || null, handoffRevision: getHandoff(state, id).revision, savedAt: now() };
  state.records[id] = record;
  log(state, 'WRITE_BACK', id, `${record.id} • ${status} • USD ${money(record.amount)}${request ? ` • ${request.id}` : ''}. No GL posting or payment execution.`);
  return record;
}
export function journalPlan(state) {
  const h = getHandoff(state, 'FIN-1002');
  return { caseId: h.id, company: '100', unit: '0412', date: '2026-09-30', reference: `${h.id}-RECLASS`, source: h.values.sale, approval: h.values.approval,
    debitAccount: tenderAccount[h.values.actualTender], creditAccount: tenderAccount[h.values.recordedTender], amount: cents(h.values.amount), revision: h.revision };
}
export function validateJournal(state, data, existingId = null) {
  const p = journalPlan(state);
  requireThat(!state.records[p.caseId], 'This reclassification has already been posted. Duplicate posting is blocked.');
  requireThat(p.approval, 'Finance posting authorization is required. Manager confirmation alone does not authorize a GL adjustment.');
  for (const key of ['caseId', 'company', 'unit', 'date', 'reference', 'source', 'approval', 'debitAccount', 'creditAccount']) requireThat(String(data[key] || '').trim() === String(p[key]), `${key} must match the approved reclassification instructions.`);
  requireThat(String(data.description || '').trim(), 'Journal description is required.');
  requireThat(!state.journals.some(j => j.reference === p.reference && j.id !== existingId), 'This correction reference already exists. Open it in Journal Control.');
  const debit = cents(data.debit), credit = cents(data.credit);
  requireThat(debit === credit, 'Journal is out of balance. Debit must equal credit.');
  requireThat(debit === p.amount, `Journal must match the verified amount of USD ${money(p.amount)}.`);
  requireThat(data.attest === true || data.attest === 'on', 'Confirm that the values match the approved manager handoff.');
  return { ...p, description: String(data.description).trim(), debit, credit };
}
export function saveJournal(state, data) {
  const checked = validateJournal(state, data), j = { ...checked, id: String(state.nextJournal++), status: 'Unreleased', createdAt: now() };
  state.journals.push(j); log(state, 'ADD', j.caseId, `Journal ${j.id} • ${j.reference} • USD ${money(j.debit)}. No balance change.`); return j;
}
function journalFor(state, id, status) {
  const j = state.journals.find(j => j.id === id);
  requireThat(j && j.status === status, `Select an ${status.toLowerCase()} journal. Duplicate or out-of-order operations are blocked.`);
  validateJournal(state, { ...j, debit: (j.debit / 100).toFixed(2), credit: (j.credit / 100).toFixed(2), attest: true }, id); return j;
}
export function releaseJournal(state, id) { const j = journalFor(state, id, 'Unreleased'); j.status = 'Released'; log(state, 'RELEASE', j.caseId, `Journal ${id} released. No balance change.`); }
export function postJournal(state, id) {
  const j = journalFor(state, id, 'Released');
  requireThat(Number.isSafeInteger(state.balances[j.debitAccount] + j.debit) && Number.isSafeInteger(state.balances[j.creditAccount] - j.credit), 'Account balance exceeds the supported amount range.');
  j.status = 'Posted'; j.postedAt = now();
  state.balances[j.debitAccount] += j.debit; state.balances[j.creditAccount] -= j.credit;
  const record = { id: `WB-${state.nextRecord++}`, caseId: j.caseId, status: 'Posted — payment method corrected', destination: 'Lawson GL reclassification', amount: j.debit, values: { ...getHandoff(state, j.caseId).values }, journalId: id, handoffRevision: j.revision, savedAt: j.postedAt };
  state.records[j.caseId] = record;
  log(state, 'POST', j.caseId, `GL190 completed • ${id} • debit ${j.debitAccount} / credit ${j.creditAccount} USD ${money(j.debit)} • payment classification corrected. Original POS reference retained.`); return record;
}

// Revalidate saved destinations against the current handoffs and linked ledger entries.
// This is a training integrity check, not proof of payment execution.
export function completionReport(state) {
  const cases = definitions.map(d => {
    const r = state.records?.[d.id];
    try {
      requireThat(r && r.id && r.savedAt, 'Write-back has not been saved.');
      const h = getHandoff(state, d.id);
      requireThat(h.manager && h.confirmedAt, 'Manager confirmation is missing.');
      requireThat(r.caseId === d.id && r.handoffRevision === h.revision, 'Saved handoff revision does not match.');
      const scratch = initialState(); scratch.handoffs = structuredClone(state.handoffs);
      let expected;
      if (d.id === 'FIN-1002') {
        const linked = state.journals.filter(j => j.caseId === d.id);
        requireThat(linked.length === 1, 'Expected exactly one correcting journal.');
        const j = linked[0];
        requireThat(j.status === 'Posted' && j.postedAt && r.journalId === j.id, 'Correcting journal must be posted.');
        const checked = validateJournal(scratch, { ...j, debit: (j.debit / 100).toFixed(2), credit: (j.credit / 100).toFixed(2), attest: true });
        requireThat(j.revision === checked.revision, 'Journal handoff revision does not match.');
        const replay = saveJournal(scratch, { ...j, debit: (j.debit / 100).toFixed(2), credit: (j.credit / 100).toFixed(2), attest: true });
        releaseJournal(scratch, replay.id); expected = postJournal(scratch, replay.id);
        requireThat(!r.requestId, 'GL record has an unexpected payment request.');
      } else {
        expected = saveWriteback(scratch, d.id, { ...r.values, attest: true });
        const linked = state.requests.filter(q => q.caseId === d.id);
        requireThat(linked.length === (expected.requestId ? 1 : 0), 'Saved request count does not match the approved action.');
        requireThat(!r.journalId, 'Unexpected GL journal on a non-GL case.');
        if (expected.requestId) {
          const q = linked[0], eq = scratch.requests[0];
          requireThat(q.id === r.requestId && q.createdAt, 'Linked request is missing.');
          for (const k of ['caseId', 'destination', 'action', 'status', 'amount']) requireThat(q[k] === eq[k], 'Linked request does not match the saved write-back.');
          validateWriteback(initialWithHandoffs(state), d.id, { ...q.values, attest: true });
        } else requireThat(!r.requestId, 'Unexpected request link.');
      }
      for (const k of ['caseId', 'destination', 'status', 'amount']) requireThat(r[k] === expected[k], 'Saved destination details do not match.');
      const values = normalize(d.id, r.values);
      for (const f of d.fields) {
        requireThat(f.type === 'money' ? cents(values[f.name], f.name === 'actual') === cents(h.values[f.name], f.name === 'actual') : values[f.name] === h.values[f.name], 'Saved values do not match the current handoff.');
      }
      return { id: d.id, verified: true, recordId: r.id, link: r.journalId || r.requestId || 'Settlement match', status: r.status, amount: r.amount };
    } catch (error) { return { id: d.id, verified: false, reason: error.message, recordId: r?.id || null }; }
  });
  const issues = [];
  try {
    requireThat(Object.keys(state.records).every(id => definitions.some(d => d.id === id)), 'Unexpected write-back record.');
    requireThat(state.journals.every(j => j.caseId === 'FIN-1002'), 'Unexpected GL journal.');
    requireThat(state.requests.every(q => definitions.some(d => d.id === q.caseId)), 'Unexpected payment request.');
    for (const items of [Object.values(state.records), state.journals, state.requests]) requireThat(new Set(items.map(r => r.id)).size === items.length, 'Duplicate saved identifiers.');
    const balances = initialState().balances;
    for (const j of state.journals.filter(j => j.status === 'Posted')) { balances[j.debitAccount] += j.debit; balances[j.creditAccount] -= j.credit; }
    requireThat(Object.keys(balances).every(k => state.balances[k] === balances[k]), 'Account balances do not match posted journals.');
  } catch (error) { issues.push(error.message); }
  return { complete: cases.every(c => c.verified) && !issues.length, verified: cases.filter(c => c.verified).length, cases, issues, pending: state.requests.length, posted: state.journals.filter(j => j.status === 'Posted').length };
}
function initialWithHandoffs(state) { const s = initialState(); s.handoffs = structuredClone(state.handoffs); return s; }
