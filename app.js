import { VERSION, STORAGE_KEY as BASE_STORAGE_KEY, runContext, restoreRun, definitions, accounts, initialState, money, caseAmount, getDefinition, getHandoff, configureHandoff, saveWriteback, journalPlan, saveJournal, releaseJournal, postJournal, completionReport, stageBatch } from './ledger.js?v=5';
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let state, context, storageError = '', handoffError = '';
try { context = runContext(location.search); state = restoreRun(context, localStorage.getItem(context.key)); }
catch (error) { state = initialState(); handoffError = error.message; }
const STORAGE_KEY = context?.key || BASE_STORAGE_KEY;
let page = location.hash === '#batch' ? 'batch' : 'queue', selectedCase = 'FIN-1002', selectedJournal = null, selectedRequest = null, filter = '';
const titles = { batch: ['Approved Write-back Batch', 'WB10.1 · Training extension'], completion: ['Write-back Completion', 'WB99.1 · Verification'], queue: ['Reconciliation Worklist', 'RC01.1 · Training extension'], setup: ['Training Handoff Setup', 'DEMO · Confirmed-input fixtures'], entry: ['Journal Entry', 'GL40.1'], control: ['Journal Control', 'GL45.1'], posting: ['Journal Posting', 'GL190'], requests: ['Finance / Payments Requests', 'PM01.1 · Training extension'], inquiry: ['Account Analysis', 'GL95.1'], audit: ['Journal / Change Log', 'GL42.1 · Training view'] };
const badge = text => `<span class="badge ${text.startsWith('Posted') || text.startsWith('Timing explained') || text.startsWith('Resolved') ? 'done' : text === 'Released' ? 'released' : ''}">${esc(text)}</span>`;
function message(text, type = '') { $('#status').textContent = text; $('#status').className = type; $('#footer-status').textContent = type === 'error' ? 'Validation error' : text; }
function commit(operation, success) {
  if (handoffError) { message(handoffError, 'error'); return null; }
  try {
    const copy = structuredClone(state), result = operation(copy);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(copy)); }
    catch { storageError = 'Changes are in memory only; browser storage is unavailable. Keep this tab open.'; }
    state = copy; render(); message(storageError || success, storageError ? 'error' : 'success'); return result;
  } catch (error) { message(error.message, 'error'); return null; }
}
function go(target) { history.replaceState(null, '', target === 'batch' ? '#batch' : location.pathname + location.search); page = target; filter = ''; render(); window.scrollTo(0, 0); }
function render() {
  if (handoffError) { $('#title').textContent = 'Approved handoff unavailable'; $('#content').innerHTML = `<div class="notice">${esc(handoffError)} No business records have been changed.</div>`; message(handoffError, 'error'); return; }
  const [title, code] = titles[page];
  $('#title').textContent = title; $('#crumb').textContent = title; $('#formcode').textContent = code;
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  $('#content').innerHTML = ({ batch: batchView, completion: completionView, queue: queueView, setup: setupView, entry: entryView, control: controlView, posting: postingView, requests: requestsView, inquiry: inquiryView, audit: auditView }[page])();
  message(storageError || `Ready. Two-case review · Run ${context.runId}`); bind();
}
const toolbar = (extra = '') => `<div class="toolbar"><button data-action="refresh">Inquire / Refresh</button><button data-action="export">Export records</button>${extra}<span class="right">Company 100 · Store 0427 · USD</span></div>`;
function dataTable(rows) { return `<dl class="keyval">${rows.map(([key, value]) => `<dt>${esc(key)}</dt><dd>${esc(value || '—')}</dd>`).join('')}</dl>`; }
function valuesPanel(id, values, title = 'Saved values') {
  return `<div class="panel"><div class="panel-title">${esc(title)}</div><div class="panel-body">${dataTable(getDefinition(id).fields.map(f => [f.label, values[f.name]]))}</div></div>`;
}
function queueView() {
  const count = Object.keys(state.records).length, pending = state.requests.length;
  return `${toolbar('<button class="primary" data-page="batch">Open batch worksheet</button><button data-page="setup">Training handoff setup</button><button class="primary" data-page="completion">Verify write-back completion</button>')}
    <div class="summary"><div><strong>2</strong><span>Confirmed manager handoffs</span></div><div><strong>${count} / 2</strong><span>Write-backs saved</span></div><div><strong>${pending}</strong><span>Pending finance / payments</span></div><div><strong>${state.journals.filter(j => j.status === 'Posted').length}</strong><span>GL adjustments posted</span></div></div>
    <div class="notice"><b>Manager reconciliation is complete.</b> Enter the confirmed facts into the appropriate destination below. Saved requests remain pending review or execution. The payment-method journal requires its separate finance posting authorization.</div>
    <div class="scrolltable"><table><thead><tr><th>Case</th><th>Manager reconciliation</th><th>Amount / variance USD</th><th>Destination</th><th>Write-back status</th><th></th></tr></thead><tbody>${definitions.map(d => {
      const h = getHandoff(state, d.id), record = state.records[d.id], j = state.journals.find(j => j.caseId === d.id);
      return `<tr class="${selectedCase === d.id ? 'selected-row' : ''}"><td class="mono">${d.id}</td><td>${d.title}</td><td class="num">${money(caseAmount(h.values))}</td><td>${d.destination}</td><td>${badge(record?.status || (j ? `Journal ${j.status.toLowerCase()}` : 'Ready for entry'))}</td><td><button data-case="${d.id}" aria-label="Open ${d.id}">Open</button></td></tr>`;
    }).join('')}</tbody></table></div>
    <h2 class="section-label">${selectedCase} — ${getDefinition(selectedCase).title}</h2>${handoffView()}${writebackEditor()}`;
}
function handoffView() {
  const d = getDefinition(selectedCase), h = getHandoff(state, selectedCase);
  return `<div class="detail-grid"><div class="panel"><div class="panel-title">Confirmed store-manager handoff · revision ${h.revision}</div><div class="panel-body">${dataTable([['Store / manager', `0427 / ${h.manager} (synthetic)`], ['Confirmed at', h.confirmedAt], ['Outcome', h.revision === 1 ? d.manager : 'Updated training handoff confirmed. Use the exact values in the adjacent panel.'], ['Destination', d.destination]])}<p>${d.instruction}</p></div></div>${valuesPanel(selectedCase, h.values, 'Verified inputs — copy these values into the destination')}</div>`;
}
function inputField(f, value = '', prefix = '') {
  const id = `${prefix}${f.name}`, required = f.optional ? '' : 'required';
  let input;
  if (f.type === 'select') input = `<select id="${id}" name="${f.name}" ${required}><option value="">Select...</option>${f.options.map(o => `<option value="${esc(o)}" ${o === value ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  else if (f.type === 'textarea') input = `<textarea id="${id}" name="${f.name}" rows="3" maxlength="2000" ${required}>${esc(value)}</textarea>`;
  else input = `<input id="${id}" name="${f.name}" type="${f.type === 'date' ? 'date' : 'text'}" ${f.type === 'money' ? 'inputmode="decimal"' : ''} value="${esc(value)}" maxlength="2000" autocomplete="off" ${required}>`;
  return `<label for="${id}">${esc(f.label)}${f.optional ? '' : ' <span class="required">*</span>'}</label>${input}`;
}
function savedRecordView(record) {
  return `<h2 class="section-label">Saved write-back ${record.id}</h2><div class="state-message">${badge(record.status)} · USD ${money(record.amount)}<br>Saved ${esc(record.savedAt)} · handoff revision ${record.handoffRevision}${record.journalId ? ` · Journal ${record.journalId}` : ''}${record.requestId ? ` · Request ${record.requestId}` : ''}</div>${valuesPanel(record.caseId, record.values)}${record.requestId ? `<button data-request="${record.requestId}">Reopen saved request</button>` : record.journalId ? `<button data-journal="${record.journalId}">Reopen saved journal</button>` : '<button data-page="audit">Verify change log</button>'}`;
}
function writebackEditor() {
  const d = getDefinition(selectedCase), record = state.records[selectedCase];
  if (record) return savedRecordView(record);
  if (selectedCase === 'FIN-1002') {
    const p = journalPlan(state), j = state.journals.find(j => j.caseId === selectedCase);
    return `<h2 class="section-label">Approved tender reclassification</h2><div class="panel"><div class="panel-body">${dataTable([['Reference', p.reference], ['Debit account', `${p.debitAccount} — ${accounts[p.debitAccount]}`], ['Credit account', `${p.creditAccount} — ${accounts[p.creditAccount]}`], ['Amount USD', money(p.amount)], ['Posting date', p.date], ['Finance authorization', p.approval || 'NOT PROVIDED — posting blocked']])}</div></div>${j ? `<button data-journal="${j.id}">Open journal ${j.id} (${j.status})</button>` : '<button class="primary" data-page="entry">Enter approved reclassification</button>'}`;
  }
  return `<h2 class="section-label">Destination entry — ${d.destination}</h2><form id="record-form" class="panel"><div class="panel-title">${d.action}</div><div class="panel-body"><div class="formgrid">${d.fields.map(f => inputField(f)).join('')}</div>${selectedCase === 'FIN-1003' ? '<p class="caption">Variance (expected less actual): <b id="cash-variance">—</b> USD. Finance review does not authorize a write-off.</p>' : ''}${selectedCase === 'FIN-1004' ? '<p class="caption">Available evidence requires a document reference. If unavailable, select Unavailable and enter the manager’s explanation.</p>' : ''}${selectedCase === 'FIN-1005' ? '<p class="caption">Retry requires No existing refund. Pending or unknown refunds must be escalated. Completed refunds must be linked.</p>' : ''}<label class="checkline"><input type="checkbox" name="attest" required> I checked these values against the current confirmed manager handoff.</label><button class="primary" type="submit">${d.action}</button></div></form>`;
}

function batchView() {
  const report = completionReport(state), journal = state.journals.find(j => j.caseId === 'FIN-1002');
  const tender = getHandoff(state, 'FIN-1002'), cash = getHandoff(state, 'FIN-1003'), cashRecord = state.records['FIN-1003'];
  const pending = !journal || !cashRecord;
  return `${toolbar('<button data-page="queue">Detailed worklist</button><button data-page="completion">Verify write-back completion</button>')}
    <div class="notice"><b>Two manager-approved write-backs · Run ${esc(context.runId)}</b><br>Enter the journal amount and description, then the deposited amount, count-sheet reference and manager explanation. Save the entries, release the journal and post it with GL190. The cash shortage remains pending finance review.</div>
    <form id="batch-form"><section class="entry-packet"><h2>1 · Incorrect payment method — $58.00</h2><p>Sale <b>${esc(tender.values.sale)}</b> · Cash → Card · Finance authorization <b>${esc(tender.values.approval)}</b></p><p class="caption">Evidence: ${esc(tender.values.evidence)} · Manager ${esc(tender.manager)} confirmed ${esc(tender.confirmedAt)}</p>
      <div class="formgrid">${inputField({name:'FIN-1002',label:'FIN-1002 journal amount USD',type:'money'}, journal ? tender.values.amount : '', 'batch-')}${inputField({name:'journalDescription',label:'Journal description'}, journal?.description || '', 'batch-')}</div>
      <p>${journal ? `Saved journal ${esc(journal.id)} · <b>${esc(journal.status)}</b>` : 'Awaiting operator entry. Debit card clearing 110200; credit cash clearing 110100. Total assets unchanged.'}</p></section>
    <section class="entry-packet"><h2>2 · Cash deposit short — $49.99</h2><p>Expected <b>$${esc(cash.values.expected)}</b> · Deposited <b>$${esc(cash.values.actual)}</b> · Bag <b>${esc(cash.values.bag)}</b></p>
      <details><summary>Approved count-sheet evidence and manager explanation</summary><p>Count-sheet reference: <b>${esc(cash.values.countRef)}</b></p><p>Reason: ${esc(cash.values.reason)}</p><p class="approved-explanation">${esc(cash.values.explanation)}</p><p>Evidence: ${esc(cash.values.evidence)}</p></details>
      <div class="formgrid">${inputField({name:'FIN-1003',label:'FIN-1003 counted / deposited cash USD',type:'money'}, cashRecord ? cash.values.actual : '', 'batch-')}${inputField({name:'countRef',label:'Count-sheet evidence reference'}, cashRecord?.values.countRef || '', 'batch-')}${inputField({name:'explanation',label:'Manager explanation for finance review',type:'textarea'}, cashRecord?.values.explanation || '', 'batch-')}</div>
      <p>${cashRecord ? `${esc(cashRecord.id)} · ${esc(cashRecord.requestId)} · <b>Pending finance review</b>` : 'No cash write-off or payment will be posted.'}</p></section>
    ${pending ? '<label class="checkline"><input id="batch-attest" name="attest" type="checkbox" required> I reviewed both approved handoffs and checked my entered values.</label><button class="primary" type="submit">Save entered write-backs</button>' : '<p class="state-message">Both destinations saved. Complete journal release and GL190 posting below.</p>'}</form>
    ${journal ? `<h2 class="section-label">Journal controls · GL40.1 / GL45.1 / GL190</h2>${dataTable([['Journal', journal.id], ['Status', journal.status], ['Source / reference', `${journal.source} / ${journal.reference}`], ['Finance authorization', journal.approval], ['Debit / credit USD', `${journal.debitAccount} ${money(journal.debit)} / ${journal.creditAccount} ${money(journal.credit)}`]])}${journal.status === 'Unreleased' ? '<p><button class="primary" id="batch-release">Release staged journal</button></p>' : journal.status === 'Released' ? '<p><button class="primary" id="batch-post">Submit GL190 posting</button></p>' : '<p class="state-message">GL190 · COMPLETED NORMALLY · 2 posted lines · 0 exceptions</p>'}` : ''}
    <h2 class="section-label">Saved balance inquiry · GL95.1</h2><div class="batch-balances">${Object.entries(accounts).map(([id, label]) => `<span>${id} ${label}: <b>${money(Math.abs(state.balances[id]))} ${state.balances[id] < 0 ? 'CR' : 'DR'}</b></span>`).join('')}</div>`;
}

function completionView() {
  const report = completionReport(state);
  return `${toolbar('<button data-page="queue">Return to worklist</button><button data-page="inquiry">Verify balances</button><button data-page="requests">Review pending requests</button>')}
    <section class="completion-banner ${report.complete ? 'verified' : ''}" aria-label="Write-back result">
      <div class="completion-code">WB99.1 · COMPANY 100 / STORE 0427</div>
      <h2 id="completion-result">${report.complete ? 'WRITE-BACK COMPLETE' : 'WRITE-BACK INCOMPLETE'}</h2>
      <p>${report.verified} / 2 destinations verified against current manager-approved handoffs.</p>
      <p>${report.complete ? 'All approved write-backs are recorded. The back-office entry task is complete.' : 'Finish the missing entries or resolve the verification failures below.'}</p>
    </section>
    <div class="summary"><div><strong>${report.verified} / 2</strong><span>Verified write-backs</span></div><div><strong>${report.posted}</strong><span>GL journals posted</span></div><div><strong>${report.pending}</strong><span>Requests still pending</span></div></div>
    <div class="notice"><b>Completion means data entry and routing are complete.</b> Pending requests still require finance / payments review or execution. No refund, reversal, chargeback response or cash write-off is executed here. Synthetic training records; state is local to this browser.</div>
    ${report.issues.map(x => `<div class="state-message">${esc(x)}</div>`).join('')}
    <table><thead><tr><th>Case</th><th>Verification</th><th>Saved record</th><th>Journal / request</th><th>Amount USD</th><th>Destination status</th><th></th></tr></thead><tbody>${report.cases.map(c => `<tr><td>${c.id}</td><td>${c.verified ? 'VERIFIED' : 'INCOMPLETE'}</td><td>${esc(c.recordId || '—')}</td><td>${esc(c.link || '—')}</td><td class="num">${c.verified ? money(c.amount) : '—'}</td><td>${esc(c.status || c.reason)}</td><td><button data-review-case="${c.id}">Review ${c.id}</button></td></tr>`).join('')}</tbody></table>
    <p class="caption">Verification checks saved values, handoff revisions, request links, journal posting and account balances. Reopening this screen does not submit additional records.</p>`;
}
function setupView() {
  const d = getDefinition(selectedCase), h = getHandoff(state, selectedCase), locked = context.imported || state.records[selectedCase] || state.journals.some(j => j.caseId === selectedCase);
  return `${toolbar('<button data-page="queue">Return to worklist</button>')}<div class="notice"><b>Demo preparation only.</b> Set the synthetic manager-approved values before the back-office run. Amounts and transaction references are editable. Saved work locks its handoff; use Reset training data before preparing another run. This screen simulates an upstream handoff; it does not connect to the manager portal.</div><label for="setup-case">Handoff to configure</label> <select id="setup-case">${definitions.map(x => `<option value="${x.id}" ${x.id === selectedCase ? 'selected' : ''}>${x.id} — ${x.title}</option>`).join('')}</select><h2 class="section-label">${d.id} · ${d.title}</h2>${locked ? '<div class="state-message">This handoff has saved work and cannot be edited. Reset the training run to change its inputs.</div>' : ''}<form id="setup-form"><fieldset ${locked ? 'disabled' : ''}><legend>Confirmed values · revision ${h.revision}</legend><div class="formgrid">${d.fields.map(f => inputField(f, h.values[f.name], 'setup-')).join('')}</div><p class="caption">Use synthetic evidence references. The downstream agent must copy these values, including cents. A blank finance authorization blocks GL posting.</p><button class="primary" type="submit">Save confirmed training handoff</button></fieldset></form>`;
}
const steps = current => `<div class="steps">${['1 · Enter journal', '2 · Release journal', '3 · Run GL190 posting', '4 · Verify balances'].map((text, i) => `<div class="${i < current ? 'complete' : i === current ? 'current' : ''}">${text}</div>`).join('')}</div>`;
function entryView() {
  const p = journalPlan(state), j = state.journals.find(j => j.caseId === p.caseId);
  const fields = [['caseId', 'Case', p.caseId, true], ['company', 'Company', '100'], ['unit', 'Accounting unit', '0427'], ['date', 'Posting date', p.date], ['reference', 'Correction reference', ''], ['source', 'Original sale reference', ''], ['approval', 'Finance posting authorization', ''], ['description', 'Journal description', '']];
  return `${steps(0)}${toolbar('<button data-page="queue">Return to worklist</button>')}<div class="notice"><b>FIN-1002 · ${money(p.amount)} USD.</b> Source ${esc(p.source)}. Reference ${p.reference}. Debit ${p.debitAccount} ${accounts[p.debitAccount]}; credit ${p.creditAccount} ${accounts[p.creditAccount]}. Date ${p.date}. Finance authorization: ${esc(p.approval || 'NOT PROVIDED — posting blocked')}.</div>${j ? `<div class="state-message">Journal ${j.id} already exists (${j.status}). <button class="link" data-journal="${j.id}">Open saved journal</button></div>` : ''}<form id="journal-form"><div class="panel"><div class="panel-title">Normal journal — tender reclassification</div><div class="panel-body"><div class="formgrid">${fields.map(([name, label, value, readonly]) => `<label for="${name}">${label} <span class="required">*</span></label><input id="${name}" name="${name}" value="${esc(value)}" ${name === 'date' ? 'type="date"' : ''} ${readonly ? 'readonly' : ''} required maxlength="2000">`).join('')}</div></div></div><div class="tabs"><span class="selected">Transaction Lines</span><span>USD · Clearing reclassification</span></div><div class="scrolltable"><table class="lines"><thead><tr><th>Line</th><th>Accounting unit</th><th>Account</th><th>Debit USD</th><th>Credit USD</th></tr></thead><tbody>${[1, 2].map(n => `<tr><td>${n}</td><td>0427</td><td><select name="${n === 1 ? 'debitAccount' : 'creditAccount'}" aria-label="Line ${n} account" required><option value="">Select account...</option>${Object.entries(accounts).map(([code, label]) => `<option value="${code}">${code} — ${label}</option>`).join('')}</select></td><td>${n === 1 ? '<input class="amount" name="debit" aria-label="Line 1 debit amount" inputmode="decimal" required>' : '0.00'}</td><td>${n === 2 ? '<input class="amount" name="credit" aria-label="Line 2 credit amount" inputmode="decimal" required>' : '0.00'}</td></tr>`).join('')}</tbody></table></div><div class="totals">Debit: <b id="debit-total">0.00</b> Credit: <b id="credit-total">0.00</b> Difference: <b id="difference">0.00</b></div><label class="checkline"><input type="checkbox" name="attest" required> These values match the confirmed handoff and finance posting authorization.</label><button class="primary" type="submit" ${j ? 'disabled' : ''}>Add journal</button><p class="caption">Add and Release do not change balances. Post the released journal with GL190. Revenue is unchanged by a tender reclassification.</p></form>`;
}
function journalDetail(j) {
  return `<h2 class="section-label">Saved journal ${j.id}</h2><div class="panel"><div class="panel-body">${dataTable([['Status', j.status], ['Case / reference', `${j.caseId} / ${j.reference}`], ['Original sale', j.source], ['Posting date', j.date], ['Finance authorization', j.approval], ['Description', j.description], ['Posted at', j.postedAt]])}</div></div><table><thead><tr><th>Line</th><th>Account</th><th>Description</th><th>Debit USD</th><th>Credit USD</th></tr></thead><tbody><tr><td>1</td><td>${j.debitAccount}</td><td>${accounts[j.debitAccount]}</td><td class="num">${money(j.debit)}</td><td class="num">0.00</td></tr><tr><td>2</td><td>${j.creditAccount}</td><td>${accounts[j.creditAccount]}</td><td class="num">0.00</td><td class="num">${money(j.credit)}</td></tr></tbody></table><p class="caption">Difference: 0.00 USD. Saved handoff revision ${j.revision}.</p>${j.status === 'Unreleased' ? `<button class="primary" data-release="${j.id}">Release journal</button>` : j.status === 'Released' ? '<button class="primary" data-page="posting">Continue to Journal Posting</button>' : '<button class="primary" data-page="inquiry">Verify account balances</button>'}`;
}
function controlView() {
  const j = state.journals.find(j => j.id === selectedJournal);
  return `${steps(1)}${toolbar('<button data-page="entry">Journal Entry</button>')}<form id="search-form" class="filter"><label for="journal-search">Reference / journal</label><input id="journal-search" value="${esc(filter)}" placeholder="FIN-1002-RECLASS"><button type="submit">Search</button></form><table><thead><tr><th>Journal</th><th>Case / reference</th><th>Posting date</th><th>Debit / credit USD</th><th>Status</th><th></th></tr></thead><tbody>${state.journals.filter(j => `${j.id} ${j.reference}`.toLowerCase().includes(filter.toLowerCase())).map(j => `<tr><td>${j.id}</td><td>${j.caseId} / ${j.reference}</td><td>${j.date}</td><td class="num">${money(j.debit)}</td><td>${badge(j.status)}</td><td><button data-journal="${j.id}">Open journal</button></td></tr>`).join('') || '<tr><td colspan="6" class="empty">No journals found. Use GL40.1 for the approved payment-method adjustment.</td></tr>'}</tbody></table>${j ? journalDetail(j) : '<p class="caption">Open a saved journal to review its header and lines before release.</p>'}`;
}
function postingView() {
  const released = state.journals.filter(j => j.status === 'Released'), posted = state.journals.filter(j => j.status === 'Posted');
  return `${steps(2)}${toolbar('<button data-page="control">Journal Control</button>')}<div class="panel"><div class="panel-title">GL190 — Journal Posting</div><div class="panel-body"><form id="posting-form"><label for="post-journal">Released journal</label> <select id="post-journal" name="journal" required><option value="">Select released journal...</option>${released.map(j => `<option value="${j.id}">${j.id} / ${j.reference} / USD ${money(j.debit)}</option>`).join('')}</select><p class="caption">Company 100 / Unit 0427 / Open period 10-2026. Posts only the selected released journal, updates both clearing accounts and records the corrected payment classification.</p><button class="primary" type="submit" ${released.length ? '' : 'disabled'}>Submit posting job</button></form></div></div>${!released.length && !posted.length ? '<div class="notice">No released journals. Enter and release the approved tender reclassification first.</div>' : ''}${posted.map(j => `<div class="report">PROGRAM        GL190 — Journal Posting\nSTATUS         COMPLETED NORMALLY\nJOURNAL        ${j.id}\nREFERENCE      ${j.reference}\nDEBIT          ${j.debitAccount} ${money(j.debit)} USD\nCREDIT         ${j.creditAccount} ${money(j.credit)} USD\nPOSTED LINES   2\nEXCEPTIONS     0\nPOSTED AT      ${j.postedAt}\nSOURCE         ${esc(j.source)} — original retained\nRECONCILIATION FIN-1002 — payment method corrected</div><p><button data-journal="${j.id}">Reopen saved journal</button> <button class="primary" data-page="inquiry">Verify balances</button></p>`).join('')}`;
}
function requestsView() {
  const r = state.requests.find(r => r.id === selectedRequest);
  return `${toolbar('<button data-page="queue">Return to worklist</button>')}<div class="notice"><b>Saved submissions only.</b> These requests are pending with finance or payments. This training system does not execute refunds, reversals, write-offs or chargeback responses.</div><div class="scrolltable"><table><thead><tr><th>Request</th><th>Case</th><th>Requested action</th><th>Amount USD</th><th>Status</th><th></th></tr></thead><tbody>${state.requests.map(r => `<tr><td>${r.id}</td><td>${r.caseId}</td><td>${esc(r.action)}</td><td class="num">${money(r.amount)}</td><td>${badge(r.status)}</td><td><button data-request="${r.id}">Open request</button></td></tr>`).join('') || '<tr><td colspan="6" class="empty">No finance or payments requests submitted.</td></tr>'}</tbody></table></div>${r ? `<h2 class="section-label">Saved request ${r.id}</h2><div class="state-message">${badge(r.status)} · ${esc(r.destination)} · Created ${r.createdAt}</div>${valuesPanel(r.caseId, r.values, 'Read-back verification — submitted request values')}` : '<p class="caption">Open a request to verify its exact submitted amounts, references, evidence and routing.</p>'}`;
}
function inquiryView() {
  const base = initialState().balances;
  return `${toolbar()}<div class="notice">Illustrative clearing-account balances. Only posted GL journals change these balances. Saving settlement evidence, cash-review submissions, refund requests, chargeback evidence or reversal requests has no automatic GL impact.</div><table><thead><tr><th>Account</th><th>Description</th><th>Opening training balance</th><th>Posted debit</th><th>Posted credit</th><th>Current balance</th></tr></thead><tbody>${Object.entries(accounts).map(([code, label]) => {
    const dr = state.journals.filter(j => j.status === 'Posted' && j.debitAccount === code).reduce((n, j) => n + j.debit, 0), cr = state.journals.filter(j => j.status === 'Posted' && j.creditAccount === code).reduce((n, j) => n + j.credit, 0), balance = state.balances[code];
    return `<tr><td>${code}</td><td>${label}</td><td class="num">${money(base[code])} DR</td><td class="num">${money(dr)}</td><td class="num">${money(cr)}</td><td class="num">${money(Math.abs(balance))} ${balance < 0 ? 'CR' : 'DR'}</td></tr>`;
  }).join('')}</tbody></table><h2 class="section-label">Source / classification inquiry</h2><table><thead><tr><th>Original POS sale</th><th>Original classification retained</th><th>Current accounting classification</th><th>Correcting journal</th></tr></thead><tbody><tr><td>${esc(getHandoff(state, 'FIN-1002').values.sale)}</td><td>${esc(getHandoff(state, 'FIN-1002').values.recordedTender)}</td><td>${esc(state.records['FIN-1002'] ? getHandoff(state, 'FIN-1002').values.actualTender : getHandoff(state, 'FIN-1002').values.recordedTender)}</td><td>${state.records['FIN-1002']?.journalId || 'Not posted'}</td></tr></tbody></table><h2 class="section-label">Write-back verification</h2><table><thead><tr><th>Case</th><th>Saved record</th><th>Status</th><th>Linked journal / request</th></tr></thead><tbody>${definitions.map(d => { const r = state.records[d.id]; return `<tr><td>${d.id}</td><td>${r?.id || '—'}</td><td>${badge(r?.status || 'Ready for entry')}</td><td>${r?.journalId || r?.requestId || '—'}</td></tr>`; }).join('')}</tbody></table>`;
}
function auditView() {
  return `${toolbar()}<table><thead><tr><th>Timestamp UTC</th><th>Operator</th><th>Case</th><th>Action</th><th>Details</th></tr></thead><tbody>${[...state.audit].reverse().map(a => `<tr><td class="mono">${a.at.replace('T', ' ').slice(0, 19)}</td><td>${a.operator}</td><td>${a.caseId}</td><td>${a.event}</td><td>${esc(a.detail)}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">No changes in this training run.</td></tr>'}</tbody></table><p class="caption">Changes persist in this browser profile. Reset clears this demo run only. Earlier runs are retained separately.</p>`;
}
function modal(title, body, confirm, label = 'Confirm') {
  const dialog = $('#dialog');
  $('#dialog-content').innerHTML = `<div class="dialog-title">${esc(title)}</div><div class="dialog-body">${body}</div><div class="dialog-actions"><button id="cancel-dialog">${confirm ? 'Cancel' : 'Close'}</button>${confirm ? `<button class="primary" id="confirm-dialog">${esc(label)}</button>` : ''}</div>`;
  $('#cancel-dialog').onclick = () => dialog.close();
  if (confirm) $('#confirm-dialog').onclick = () => { dialog.close(); confirm(); };
  dialog.showModal();
}
function bind() {
  if ($('#batch-form')) {
    if (state.journals.length) for (const name of ['FIN-1002','journalDescription']) $('#batch-form').elements[name].readOnly = true;
    if (state.records['FIN-1003']) for (const name of ['FIN-1003','countRef','explanation']) $('#batch-form').elements[name].readOnly = true;
    const revisions = Object.fromEntries(state.handoffs.map(h => [h.id, h.revision]));
    $('#batch-form').onsubmit = e => {
      e.preventDefault(); const data = Object.fromEntries(new FormData(e.target));
      modal('Confirm approved batch', 'Save the entered journal amount/description and deposited amount/count-sheet reference/manager explanation? Existing verified work is retained. New finance / payments requests remain pending. The correcting journal is added as Unreleased; no balances change yet.', () => commit(s => stageBatch(s, data, revisions, data.attest), 'Batch staged. Review and release the correcting journal.'), 'Save write-backs');
    };
  }
  if ($('#batch-release')) $('#batch-release').onclick = () => {
    const j = state.journals.find(j => j.caseId === 'FIN-1002');
    // A distinct operator action after reviewing the saved header and balanced lines.
    commit(s => releaseJournal(s, j.id), `Journal ${j.id} released. GL190 posting is still required.`);
  };
  if ($('#batch-post')) $('#batch-post').onclick = () => {
    const j = state.journals.find(j => j.caseId === 'FIN-1002');
    modal('Submit GL190 — Journal Posting', `Journal ${j.id} / ${j.reference}<br>Authorization ${esc(j.approval)}<br>Debit ${j.debitAccount}: USD ${money(j.debit)}<br>Credit ${j.creditAccount}: USD ${money(j.credit)}<br>Post this released journal and update the clearing balances?`, () => commit(s => postJournal(s, j.id), `GL190 completed normally. Journal ${j.id} posted.`), 'Post journal');
  }

  document.querySelectorAll('[data-review-case]').forEach(b => b.onclick = () => { selectedCase = b.dataset.reviewCase; go('queue'); });
  document.querySelectorAll('#content [data-page]').forEach(b => b.onclick = () => go(b.dataset.page));
  document.querySelectorAll('[data-case]').forEach(b => b.onclick = () => { selectedCase = b.dataset.case; render(); $('#content .section-label').scrollIntoView({ block: 'start' }); });
  document.querySelectorAll('[data-journal]').forEach(b => b.onclick = () => { selectedJournal = b.dataset.journal; go('control'); });
  document.querySelectorAll('[data-request]').forEach(b => b.onclick = () => { selectedRequest = b.dataset.request; go('requests'); });
  document.querySelectorAll('[data-release]').forEach(b => b.onclick = () => { const j = state.journals.find(j => j.id === b.dataset.release); modal('Release journal', `Release journal ${j.id}, USD ${money(j.debit)}? Balances will change only when GL190 posts it.`, () => commit(s => releaseJournal(s, j.id), 'Journal released. Continue to GL190.'), 'Release journal'); });
  document.querySelectorAll('[data-action]').forEach(b => b.onclick = () => { if (b.dataset.action === 'refresh') { render(); message('Inquiry completed. Current records displayed.'); } else download(); });
  if ($('#setup-case')) $('#setup-case').onchange = e => { selectedCase = e.target.value; render(); };
  if ($('#setup-form')) $('#setup-form').onsubmit = e => { e.preventDefault(); const data = Object.fromEntries(new FormData(e.target)); commit(s => configureHandoff(s, selectedCase, data), 'Confirmed training handoff saved. Copy these values into the destination.'); };
  if ($('#record-form')) {
    $('#record-form').onsubmit = e => {
      e.preventDefault(); const data = Object.fromEntries(new FormData(e.target)), id = selectedCase;
      modal('Confirm destination write-back', `Save ${id} to ${esc(getDefinition(id).destination)}?<br>This records the handoff or creates a pending request. It does not execute a payment or write off a shortage.`, () => commit(s => saveWriteback(s, id, data), 'Write-back saved. Reopen the saved record to verify its exact values.'), 'Save write-back');
    };
    if (selectedCase === 'FIN-1003') $('#record-form').oninput = e => { const f = e.currentTarget, expected = Number(f.elements.expected.value), actual = Number(f.elements.actual.value); $('#cash-variance').textContent = f.elements.expected.value && f.elements.actual.value && Number.isFinite(expected - actual) ? money(Math.round((expected - actual) * 100)) : '—'; };
  }
  if ($('#journal-form')) {
    const form = $('#journal-form');
    form.onsubmit = e => { e.preventDefault(); const data = Object.fromEntries(new FormData(form)); const j = commit(s => saveJournal(s, data), 'Journal saved.'); if (j) { selectedJournal = j.id; go('control'); message(`Journal ${j.id} saved as Unreleased. Verify the lines before release.`, 'success'); } };
    form.oninput = () => { const dr = Number(form.elements.debit.value) || 0, cr = Number(form.elements.credit.value) || 0; $('#debit-total').textContent = money(Math.round(dr * 100)); $('#credit-total').textContent = money(Math.round(cr * 100)); $('#difference').textContent = money(Math.round((dr - cr) * 100)); };
  }
  if ($('#search-form')) $('#search-form').onsubmit = e => { e.preventDefault(); filter = $('#journal-search').value; selectedJournal = null; render(); };
  if ($('#posting-form')) $('#posting-form').onsubmit = e => { e.preventDefault(); const id = new FormData(e.target).get('journal'), j = state.journals.find(j => j.id === id); if (!j) return; modal('Submit GL190 — Journal Posting', `Journal ${j.id} / ${j.reference}<br>Debit ${j.debitAccount}: USD ${money(j.debit)}<br>Credit ${j.creditAccount}: USD ${money(j.credit)}<br>Post the approved tender reclassification?`, () => commit(s => postJournal(s, id), `GL190 completed normally. Journal ${id} posted; payment classification corrected.`), 'Post journal'); };
}
function download() { const a = document.createElement('a'), url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })); a.href = url; a.download = 'aeo-two-case-ledger.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
document.querySelectorAll('#nav [data-page]').forEach(b => b.onclick = () => go(b.dataset.page));
$('#go').onclick = () => { const codes = { 'WB10.1': 'batch', 'WB99.1': 'completion', 'RC01.1': 'queue', 'GL40.1': 'entry', 'GL45.1': 'control', GL190: 'posting', 'GL95.1': 'inquiry', 'GL42.1': 'audit', 'PM01.1': 'requests', DEMO: 'setup' }; const code = $('#program').value.trim().toUpperCase(); if (codes[code]) go(codes[code]); else message('Unknown program. Use RC01.1, GL40.1, GL45.1, GL190, GL95.1, GL42.1, PM01.1 or DEMO.', 'error'); };
$('#program').onkeydown = e => { if (e.key === 'Enter') $('#go').click(); };
$('#new-run').hidden = context?.imported === true;
$('#new-run').onclick = () => { const url = new URL(location.href); url.search = ''; url.searchParams.set('run', crypto.randomUUID()); url.hash = 'batch'; location.href = url.href; };
$('#reset').onclick = () => modal('Reset two-case training data', 'Restore the two example handoffs and clear this demo run’s journals, write-backs, requests and change log? Other browser profiles and version 1 data are unaffected.', () => { commit(s => { Object.assign(s, initialState()); }, 'Two example handoffs restored.'); selectedCase = 'FIN-1002'; selectedJournal = null; selectedRequest = null; go('queue'); }, 'Reset data');
$('#help').onclick = () => modal('Two-case training help', `<ol class="help-list"><li>Use Training handoff setup to prepare exact synthetic amounts and approved facts.</li><li>Open each case in the worklist. Copy its verified values into the destination form.</li><li>FIN-1002 uses GL40.1 → GL45.1 → GL190, then GL95.1 for balance verification.</li><li>Cash variances and disputes remain pending review. Refund / reversal requests remain pending execution.</li><li>Reopen saved records or requests to verify amounts, references, evidence and statuses.</li><li>Reset training data before another run. Each demo run has separate saved records. Reopening the same run resumes safely.</li></ol><p>The worklist, handoff setup and payments queues are illustrative training extensions. No payments are executed and no real customer data is used.</p><a href="https://docs.infor.com/lwsnapps/10.1/en-us/lwsncsolh/glhs/gl40_1.html" target="_blank" rel="noopener">Lawson GL40.1 documentation</a>`);
window.addEventListener('hashchange', () => { if (location.hash === '#batch') go('batch'); });
window.addEventListener('storage', e => { if (e.key === STORAGE_KEY) { try { const next = JSON.parse(e.newValue); if (next?.version === VERSION) { state = next; render(); message('Records refreshed from another tab.'); } } catch { message('Stored data could not be read. Reset training data.', 'error'); } } });
render();
