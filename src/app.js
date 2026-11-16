/* MAYAACC 2.0 — Renderer UI. Fresh theme + dashboard, all features from the
   original single-file HTML preserved (see docs/FEATURE_CHECKLIST.md).
   PC only, keyboard-first, offline. No voice. */
(function () {
  'use strict';
  window.__mayaaccErrors = [];
  window.addEventListener('error', (e) => { window.__mayaaccErrors.push(String(e.message || e.error || 'error')); });
  const E = window.MayaEngine;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  let state = null;
  let currentView = 'dashboard';
  let currentVchType = 'Sales';
  let currentMasterKind = 'Ledger';
  let currentReport = 'trial';
  let dataFilePath = '';

  const LS_KEY = 'mayaacc_fresh_state_v2';

  // ---------- persistence ----------
  async function loadState() {
    if (window.mayaaccDesktop) {
      try {
        const r = await window.mayaaccDesktop.loadData();
        dataFilePath = r.file || '';
        if (r.json) { state = E.deserialize(r.json); return; }
      } catch (e) { /* fall through to localStorage */ }
    }
    try {
      const raw = localStorage.getItem(LS_KEY);
      state = raw ? E.deserialize(raw) : E.seedState();
    } catch (e) { state = E.seedState(); }
  }
  async function saveState() {
    const json = E.serialize(state);
    if (window.mayaaccDesktop) {
      try { await window.mayaaccDesktop.saveData(json); } catch (e) { /* fallback below */ }
    }
    try { localStorage.setItem(LS_KEY, json); } catch (e) {}
  }
  function co() { return E.activeCompany(state); }

  // ---------- navigation ----------
  const TITLES = { dashboard: ['Dashboard', 'Overview'], gateway: ['Gateway of Tally', 'Keyboard navigation'], masters: ['Masters', 'Create / Alter'], vouchers: ['Vouchers', 'Sales • Purchase • Payment • Receipt • Journal • Contra • Credit / Debit Note'], reports: ['Reports', 'Day Book • Trial Balance • P&L • Balance Sheet'], inventory: ['Inventory / Stock', 'Stock • Godown • BOM'], gst: ['GST', 'Calculation & reports only — NOT filing'], payroll: ['Payroll', 'Basic'], einvoice: ['e-Invoice', 'Record & print only'], data: ['Backup / Data', 'Local file • pen drive / Google Drive'], help: ['Shortcuts & Help', 'Tally-style keys'] };
  function showView(name, sub) {
    currentView = name;
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const el = $('view-' + name); if (el) el.classList.add('active');
    document.querySelectorAll('#mainNav button').forEach(b => b.classList.toggle('active', b.dataset.nav === name && (!b.dataset.sub || b.dataset.sub === sub)));
    const t = TITLES[name] || [name, ''];
    $('viewTitle').textContent = t[0]; $('viewCrumb').textContent = t[1];
    if (name === 'dashboard') renderDashboard();
    if (name === 'gateway') renderGateway();
    if (name === 'masters') renderMasters();
    if (name === 'vouchers') { renderVouchers(); if (sub && E.VOUCHER_TYPES.includes(sub)) setVchType(sub); }
    if (name === 'reports') { renderReportTabs(); if (sub) { currentReport = sub; renderReport(); } }
    if (name === 'inventory') renderInventory();
    if (name === 'gst') renderGst();
    if (name === 'payroll') renderPayroll();
    if (name === 'data') renderData();
  }
  document.querySelectorAll('#mainNav button').forEach(b => b.addEventListener('click', () => showView(b.dataset.nav, b.dataset.sub)));
  $('btnQuickSale').addEventListener('click', () => showView('vouchers', 'Sales'));

  // ---------- dashboard ----------
  function kpiCard(label, val, sub, cls) {
    return '<div class="kpi-card ' + (cls || '') + '"><div class="lbl">' + esc(label) + '</div><div class="val">' + esc(val) + '</div><div class="sub">' + esc(sub || '') + '</div></div>';
  }
  function renderDashboard() {
    const c = co(); if (!c) return;
    $('sbCompany').textContent = c.name;
    $('sbCompanySub').textContent = (c.state || '') + (c.gstin ? ' • GSTIN ' + c.gstin : '');
    $('topCompany').textContent = c.name;
    $('topDate').textContent = E.fmtDate(new Date());
    const k = E.dashboardKPIs(state);
    $('kpiGrid').innerHTML =
      kpiCard('Total Sales', E.inr(k.sales), k.voucherCount + ' vouchers', 'teal') +
      kpiCard('Total Purchase', E.inr(k.purchase), 'Stock in', '') +
      kpiCard('Receipts', E.inr(k.receipts), 'Cash / Bank in', 'green') +
      kpiCard('Payments', E.inr(k.payments), 'Cash / Bank out', 'red') +
      kpiCard('Cash Balance', E.inr(k.cash), 'Cash-in-Hand', '') +
      kpiCard('Bank Balance', E.inr(k.bank), 'All bank ledgers', '') +
      kpiCard('Receivables (Debtors)', E.inr(k.receivables), 'To receive', 'amber') +
      kpiCard('Payables (Creditors)', E.inr(k.payables), 'To pay', 'red');
    $('quickActions').innerHTML = '';
    [['+ New Sale', 'Sales'], ['+ New Purchase', 'Purchase'], ['+ Payment', 'Payment'], ['+ Receipt', 'Receipt'], ['Day Book', 'daybook'], ['Trial Balance', 'trial']].forEach(([label, target]) => {
      const b = document.createElement('button'); b.className = 'btn primary'; b.textContent = label;
      b.addEventListener('click', () => {
        if (E.VOUCHER_TYPES.includes(target)) showView('vouchers', target);
        else { showView('reports', target); }
      });
      $('quickActions').appendChild(b);
    });
    $('lowStockBox').innerHTML = k.lowStock.length
      ? k.lowStock.map(s => '<div>⚠️ <b>' + esc(s.item.name) + '</b> — Qty ' + s.qty + ' (reorder ' + (s.item.reorderLevel || 0) + ')</div>').join('')
      : '<p class="muted">No low-stock items. Stock value: <b>' + E.inr(k.stockValue) + '</b></p>';
    $('recentBox').innerHTML = k.recent.length
      ? '<table><tr><th>Date</th><th>Type</th><th>No.</th><th>Party</th><th class="num">Amount</th></tr>' +
        k.recent.map(v => '<tr><td>' + esc(E.fmtDate(v.date)) + '</td><td>' + esc(v.type) + '</td><td>' + esc(v.no) + '</td><td>' + esc(v.party || '—') + '</td><td class="num">' + E.inr(v.total) + '</td></tr>').join('') + '</table>'
      : '<p class="muted">No vouchers yet. Create your first Sale from Quick Actions.</p>';
    $('moneyBox').innerHTML = '<table><tr><th></th><th class="num">Amount</th></tr>' +
      '<tr><td>Sales</td><td class="num">' + E.inr(k.sales) + '</td></tr>' +
      '<tr><td>Purchase</td><td class="num">' + E.inr(k.purchase) + '</td></tr>' +
      '<tr><td>Receipts</td><td class="num">' + E.inr(k.receipts) + '</td></tr>' +
      '<tr><td>Payments</td><td class="num">' + E.inr(k.payments) + '</td></tr>' +
      '<tr class="total"><td>Trial Balance</td><td class="num">' + (k.trial.balanced ? '<span class="badge green">Balanced ✓</span>' : '<span class="badge red">Not balanced</span>') + ' Dr ' + E.inr(k.trial.totalDr) + ' = Cr ' + E.inr(k.trial.totalCr) + '</td></tr></table>';
  }

  // ---------- gateway ----------
  const GATEWAY = [
    ['Dashboard', 'dashboard'], ['Masters — Create / Alter', 'masters'],
    ['Vouchers — Sales', 'vouchers:Sales'], ['Vouchers — Purchase', 'vouchers:Purchase'],
    ['Vouchers — Payment', 'vouchers:Payment'], ['Vouchers — Receipt', 'vouchers:Receipt'],
    ['Vouchers — Journal / Contra / Credit / Debit Note', 'vouchers:Journal'],
    ['Day Book', 'reports:daybook'], ['Trial Balance', 'reports:trial'],
    ['Profit & Loss', 'reports:pl'], ['Balance Sheet', 'reports:bs'],
    ['Ledger Display', 'reports:ledger'], ['Stock Summary', 'reports:stock'],
    ['Inventory', 'inventory'], ['GST', 'gst'], ['Payroll', 'payroll'], ['e-Invoice', 'einvoice'],
    ['Backup / Data', 'data'], ['Shortcuts & Help', 'help'],
  ];
  function renderGateway() {
    const box = $('gatewayList'); box.innerHTML = '';
    GATEWAY.forEach(([label, target], i) => {
      const b = document.createElement('button'); b.textContent = (i + 1) + '. ' + label; b.dataset.target = target;
      if (i === 0) b.classList.add('sel');
      b.addEventListener('click', () => openGateway(target));
      box.appendChild(b);
    });
  }
  function openGateway(target) {
    const [view, sub] = target.split(':');
    showView(view, sub);
  }

  // ---------- masters ----------
  const MASTER_KINDS = ['Ledger', 'Group', 'Stock Item', 'Stock Group', 'Godown', 'Unit', 'Cost Centre', 'Voucher Type'];
  function renderMasters() {
    const c = co(); if (!c) return;
    $('companyList').innerHTML = state.companies.map(x =>
      '<div style="padding:8px;border:1px solid var(--line);border-radius:8px;margin:6px 0">' +
      '<b>' + esc(x.name) + '</b> <span class="muted small">' + esc(x.state || '') + (x.gstin ? ' • ' + esc(x.gstin) : '') + '</span> ' +
      (x.id === state.activeCompanyId ? '<span class="badge green">Active</span>' : ' <button class="btn" data-open-co="' + x.id + '">Open</button>') +
      '</div>').join('');
    document.querySelectorAll('[data-open-co]').forEach(b => b.addEventListener('click', async () => {
      state.activeCompanyId = b.dataset.openCo; await saveState(); renderDashboard(); renderMasters();
    }));
    $('masterTabs').innerHTML = '';
    MASTER_KINDS.forEach(k => {
      const b = document.createElement('button'); b.className = 'btn' + (k === currentMasterKind ? ' primary' : ''); b.textContent = k;
      b.addEventListener('click', () => { currentMasterKind = k; $('masterKind').textContent = k; renderMasters(); });
      $('masterTabs').appendChild(b);
    });
    $('masterKind').textContent = currentMasterKind;
    const rows = masterRows(c, currentMasterKind);
    $('masterList').innerHTML = rows.length
      ? '<table><tr><th>Name</th><th>Group / Parent</th><th class="num">Opening / Value</th></tr>' +
        rows.map(r => '<tr><td>' + esc(r.name) + '</td><td>' + esc(r.group || '') + '</td><td class="num">' + esc(r.value == null ? '—' : r.value) + '</td></tr>').join('') + '</table>'
      : '<p class="muted">No records yet.</p>';
    $('ledgerDatalist').innerHTML = c.ledgers.map(l => '<option value="' + esc(l.name) + '">').join('');
  }
  function masterRows(c, kind) {
    switch (kind) {
      case 'Ledger': return c.ledgers.map(l => ({ name: l.name, group: l.group, value: E.inr(l.opening || 0) }));
      case 'Group': return c.groups.map(g => ({ name: g.name, group: g.nature, value: '' }));
      case 'Stock Item': return c.stockItems.map(s => ({ name: s.name, group: s.group || '', value: s.qty + ' ' + (s.unit || '') + ' @ ' + E.inr(s.rate || 0) }));
      case 'Stock Group': return c.stockGroups.map(s => ({ name: s.name, group: s.parent || '', value: '' }));
      case 'Godown': return c.godowns.map(g => ({ name: g.name, group: g.address || '', value: '' }));
      case 'Unit': return c.units.map(u => ({ name: u.name, group: u.symbol || '', value: '' }));
      case 'Cost Centre': return c.costCentres.map(x => ({ name: x.name, group: x.parent || '', value: '' }));
      case 'Voucher Type': return c.voucherTypes.map(v => ({ name: v.name, group: v.numbering || '', value: '' }));
      default: return [];
    }
  }
  $('btnAddCompany').addEventListener('click', async () => {
    const name = $('newCoName').value.trim(); if (!name) { alert('Company name is required'); return; }
    const coNew = E.newCompany(name, { state: $('newCoState').value.trim(), gstin: $('newCoGstin').value.trim() });
    state.companies.push(coNew); state.activeCompanyId = coNew.id;
    $('newCoName').value = ''; $('newCoState').value = ''; $('newCoGstin').value = '';
    await saveState(); renderMasters(); renderDashboard();
  });
  $('btnAddMaster').addEventListener('click', async () => {
    const c = co(); const name = $('masterName').value.trim(); if (!name) { alert('Name is required'); return; }
    const grp = $('masterGroup').value.trim(); const val = Number($('masterValue').value) || 0;
    if (currentMasterKind === 'Ledger') c.ledgers.push({ id: E.uid('led'), name, group: grp || 'Sundry Debtors', opening: val });
    else if (currentMasterKind === 'Group') c.groups.push({ id: E.uid('grp'), name, nature: 'Asset', parent: grp });
    else if (currentMasterKind === 'Stock Item') c.stockItems.push({ id: E.uid('stk'), name, group: grp, unit: 'Nos', rate: val, qty: 0, openingQty: 0, reorderLevel: 0, hsn: '' });
    else if (currentMasterKind === 'Stock Group') c.stockGroups.push({ id: E.uid('sg'), name, parent: grp });
    else if (currentMasterKind === 'Godown') c.godowns.push({ id: E.uid('gd'), name, address: grp });
    else if (currentMasterKind === 'Unit') c.units.push({ id: E.uid('un'), name, symbol: grp || name });
    else if (currentMasterKind === 'Cost Centre') c.costCentres.push({ id: E.uid('cc'), name, parent: grp });
    else if (currentMasterKind === 'Voucher Type') c.voucherTypes.push({ id: E.uid('vt'), name, numbering: 'Auto' });
    $('masterName').value = ''; $('masterGroup').value = ''; $('masterValue').value = '';
    await saveState(); renderMasters();
  });

  // ---------- vouchers ----------
  function renderVouchers() {
    const c = co(); if (!c) return;
    $('vchTypeTabs').innerHTML = '';
    E.VOUCHER_TYPES.forEach(t => {
      const b = document.createElement('button'); b.className = 'btn' + (t === currentVchType ? ' primary' : ''); b.textContent = t;
      b.addEventListener('click', () => setVchType(t)); $('vchTypeTabs').appendChild(b);
    });
    $('vchTypeLabel').textContent = currentVchType;
    if (!$('vchDate').value) $('vchDate').value = E.todayISO();
    $('vchPreview').textContent = 'GST ' + ($('vchGstRate').value || 0) + '% • ' + ($('vchInter').value === 'yes' ? 'IGST' : 'CGST + SGST');
    $('voucherList').innerHTML = c.vouchers.length
      ? '<table><tr><th>Date</th><th>Type</th><th>No.</th><th>Party</th><th class="num">Total</th><th>Narration</th></tr>' +
        [...c.vouchers].reverse().map(v => '<tr><td>' + esc(E.fmtDate(v.date)) + '</td><td>' + esc(v.type) + '</td><td>' + esc(v.no) + '</td><td>' + esc(v.party || '—') + '</td><td class="num">' + E.inr(v.total) + '</td><td>' + esc(v.narration || '') + '</td></tr>').join('') + '</table>'
      : '<p class="muted">No vouchers yet.</p>';
    $('ledgerDatalist').innerHTML = c.ledgers.map(l => '<option value="' + esc(l.name) + '">').join('');
  }
  function setVchType(t) { currentVchType = t; renderVouchers(); }
  ['vchGstRate', 'vchInter'].forEach(id => $(id).addEventListener('change', renderVouchers));
  async function saveVoucher() {
    const c = co();
    try {
      const v = E.addVoucher(state, c.id, {
        type: currentVchType, date: $('vchDate').value || E.todayISO(),
        party: $('vchParty').value.trim() || 'Cash', cashBank: $('vchCashBank').value.trim() || 'Cash',
        amount: Number($('vchAmount').value) || 0, gstRate: Number($('vchGstRate').value) || 0,
        isInterState: $('vchInter').value === 'yes', narration: $('vchNarration').value.trim(),
      });
      // Auto-create party ledger if it was a new name (Tally-style: create on the fly).
      if ($('vchParty').value.trim() && !E.ledgerByName(c, $('vchParty').value.trim())) {
        c.ledgers.push({ id: E.uid('led'), name: $('vchParty').value.trim(), group: 'Sundry Debtors', opening: 0 });
      }
      await saveState();
      $('vchMsg').innerHTML = '<div class="alert ok">Saved: ' + esc(v.type) + ' No. ' + esc(v.no) + ' — ' + E.inr(v.total) + ' (Dr = Cr balanced ✓)</div>';
      $('vchAmount').value = ''; $('vchNarration').value = '';
      renderVouchers(); renderDashboard();
    } catch (e) {
      $('vchMsg').innerHTML = '<div class="alert err">' + esc(e.message) + '</div>';
    }
  }
  $('btnSaveVoucher').addEventListener('click', saveVoucher);

  // ---------- reports ----------
  const REPORTS = [['daybook', 'Day Book'], ['trial', 'Trial Balance'], ['pl', 'Profit & Loss'], ['bs', 'Balance Sheet'], ['ledger', 'Ledger Display'], ['stock', 'Stock Summary'], ['gst', 'GST Summary']];
  function renderReportTabs() {
    $('reportTabs').innerHTML = '';
    REPORTS.forEach(([key, label]) => {
      const b = document.createElement('button'); b.className = 'btn' + (key === currentReport ? ' primary' : ''); b.textContent = label;
      b.addEventListener('click', () => { currentReport = key; renderReport(); });
      $('reportTabs').appendChild(b);
    });
    if (!$('repFrom').value) { $('repFrom').value = co().fyStart || '2026-04-01'; $('repTo').value = E.todayISO(); }
  }
  function renderReport() {
    const c = co(); const from = $('repFrom').value, to = $('repTo').value;
    let html = '';
    if (currentReport === 'daybook') {
      const rows = E.dayBook(c, from, to);
      html = '<h3>Day Book — ' + esc(E.fmtDate(from)) + ' to ' + esc(E.fmtDate(to)) + '</h3>' +
        (rows.length ? '<table><tr><th>Date</th><th>Type</th><th>No.</th><th>Party</th><th class="num">Amount</th></tr>' + rows.map(v => '<tr><td>' + esc(E.fmtDate(v.date)) + '</td><td>' + esc(v.type) + '</td><td>' + esc(v.no) + '</td><td>' + esc(v.party || '') + '</td><td class="num">' + E.inr(v.total) + '</td></tr>').join('') + '</table>' : '<p class="muted">No vouchers in this period.</p>');
    } else if (currentReport === 'trial') {
      const t = E.trialBalance(c);
      html = '<h3>Trial Balance</h3><table><tr><th>Ledger</th><th>Group</th><th class="num">Debit</th><th class="num">Credit</th></tr>' +
        t.rows.map(r => '<tr><td>' + esc(r.ledger) + '</td><td>' + esc(r.group) + '</td><td class="num">' + E.inr(r.debit) + '</td><td class="num">' + E.inr(r.credit) + '</td></tr>').join('') +
        '<tr class="total"><td colspan="2">Total ' + (t.balanced ? '✓ Balanced' : '✗ NOT balanced') + '</td><td class="num">' + E.inr(t.totalDr) + '</td><td class="num">' + E.inr(t.totalCr) + '</td></tr></table>';
    } else if (currentReport === 'pl') {
      const p = E.profitAndLoss(c);
      html = '<h3>Profit &amp; Loss</h3><table><tr><th></th><th class="num">Amount</th></tr>' +
        '<tr><td>Net Sales</td><td class="num">' + E.inr(p.netSales) + '</td></tr><tr><td>Net Purchase</td><td class="num">' + E.inr(p.netPurchase) + '</td></tr>' +
        '<tr><td>Direct Expenses</td><td class="num">' + E.inr(p.directExp) + '</td></tr><tr><td>Gross Profit</td><td class="num">' + E.inr(p.grossProfit) + '</td></tr>' +
        '<tr><td>Indirect Expenses</td><td class="num">' + E.inr(p.indirectExp) + '</td></tr><tr class="total"><td>Net Profit</td><td class="num">' + E.inr(p.netProfit) + '</td></tr></table>';
    } else if (currentReport === 'bs') {
      const b = E.balanceSheet(c);
      html = '<h3>Balance Sheet</h3><table><tr><th></th><th class="num">Amount</th></tr>' +
        '<tr><td>Total Assets</td><td class="num">' + E.inr(b.assets) + '</td></tr><tr><td>Total Liabilities + Capital + Profit</td><td class="num">' + E.inr(b.liabilities) + '</td></tr>' +
        '<tr class="total"><td>Status</td><td class="num">' + (b.balanced ? 'Balanced ✓' : 'Check — difference ' + E.inr(Math.abs(b.assets - b.liabilities))) + '</td></tr></table>';
    } else if (currentReport === 'ledger') {
      const first = c.ledgers[0];
      const d = first ? E.ledgerDisplay(c, first.id, from, to) : null;
      html = '<h3>Ledger Display — ' + esc(first ? first.name : '—') + '</h3><p class="muted small">First ledger shown here; use Masters to see all ledgers. Opening: ' + E.inr(d ? d.opening : 0) + ' • Closing: ' + E.inr(d ? d.closing : 0) + '</p>' +
        (d && d.entries.length ? '<table><tr><th>Date</th><th>Type</th><th class="num">Debit</th><th class="num">Credit</th><th class="num">Running</th></tr>' + d.entries.map(e => '<tr><td>' + esc(E.fmtDate(e.date)) + '</td><td>' + esc(e.type) + ' ' + esc(e.no) + '</td><td class="num">' + E.inr(e.debit) + '</td><td class="num">' + E.inr(e.credit) + '</td><td class="num">' + E.inr(e.running) + '</td></tr>').join('') + '</table>' : '<p class="muted">No entries for this ledger in the period.</p>');
    } else if (currentReport === 'stock') {
      const s = E.stockSummary(c);
      html = '<h3>Stock Summary — Total value ' + E.inr(s.totalValue) + '</h3>' +
        (s.rows.length ? '<table><tr><th>Item</th><th class="num">Qty</th><th class="num">Value</th><th>Low?</th></tr>' + s.rows.map(r => '<tr><td>' + esc(r.item.name) + '</td><td class="num">' + r.qty + '</td><td class="num">' + E.inr(r.value) + '</td><td>' + (r.low ? '<span class="badge amber">Low</span>' : '') + '</td></tr>').join('') + '</table>' : '<p class="muted">No stock items yet.</p>');
    } else if (currentReport === 'gst') {
      const g = E.gstSummary(c, from, to);
      html = '<h3>GST Summary (calculation only — NOT filing)</h3><table><tr><th></th><th class="num">CGST</th><th class="num">SGST</th><th class="num">IGST</th><th class="num">Cess</th></tr>' +
        '<tr><td>Output (Sales)</td><td class="num">' + E.inr(g.out.cgst) + '</td><td class="num">' + E.inr(g.out.sgst) + '</td><td class="num">' + E.inr(g.out.igst) + '</td><td class="num">' + E.inr(g.out.cess) + '</td></tr>' +
        '<tr><td>Input (Purchase)</td><td class="num">' + E.inr(g.in.cgst) + '</td><td class="num">' + E.inr(g.in.sgst) + '</td><td class="num">' + E.inr(g.in.igst) + '</td><td class="num">' + E.inr(g.in.cess) + '</td></tr>' +
        '<tr class="total"><td>Net Payable</td><td class="num">' + E.inr(g.net.cgst) + '</td><td class="num">' + E.inr(g.net.sgst) + '</td><td class="num">' + E.inr(g.net.igst) + '</td><td class="num">' + E.inr(g.net.cess) + '</td></tr></table>' +
        '<p class="muted small">Taxable Sales ' + E.inr(g.taxableOut) + ' • Taxable Purchase ' + E.inr(g.taxableIn) + ' • Net GST ' + E.inr(g.net.total) + '</p>';
    }
    $('reportOut').innerHTML = html;
  }
  $('btnRunReport').addEventListener('click', renderReport);
  $('btnPrintReport').addEventListener('click', () => { if (window.mayaaccDesktop) window.mayaaccDesktop.print(); else window.print(); });
  $('btnExportReport').addEventListener('click', () => {
    const c = co(); const rows = [['Date', 'Type', 'No', 'Party', 'Total']].concat(c.vouchers.map(v => [v.date, v.type, v.no, v.party || '', v.total]));
    download('mayaacc-report.csv', rows.map(r => r.map(x => '"' + String(x).replace(/"/g, '""') + '"').join(',')).join('\n'), 'text/csv');
  });
  function download(name, text, type) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type || 'text/plain' })); a.download = name; a.click();
  }

  // ---------- inventory ----------
  function renderInventory() {
    const c = co(); const s = E.stockSummary(c);
    $('stockBox').innerHTML = s.rows.length
      ? '<table><tr><th>Item</th><th>Godown</th><th>HSN</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Value</th></tr>' +
        s.rows.map(r => '<tr><td>' + esc(r.item.name) + '</td><td>' + esc(r.item.godown || 'Main Godown') + '</td><td>' + esc(r.item.hsn || '') + '</td><td class="num">' + r.qty + '</td><td class="num">' + E.inr(r.item.rate || 0) + '</td><td class="num">' + E.inr(r.value) + '</td></tr>').join('') +
        '<tr class="total"><td colspan="5">Total Stock Value</td><td class="num">' + E.inr(s.totalValue) + '</td></tr></table>'
      : '<p class="muted">No stock items yet.</p>';
    $('bomList').innerHTML = c.bom.length
      ? '<table><tr><th>Finished Item</th><th>Component</th><th class="num">Qty / unit</th></tr>' + c.bom.map(b => '<tr><td>' + esc(b.finished) + '</td><td>' + esc(b.component) + '</td><td class="num">' + b.qty + '</td></tr>').join('') + '</table>'
      : '<p class="muted">No BOM lines yet.</p>';
  }
  $('btnAddStock').addEventListener('click', async () => {
    const c = co(); const name = $('stkName').value.trim(); if (!name) { alert('Item name required'); return; }
    c.stockItems.push({ id: E.uid('stk'), name, unit: $('stkUnit').value.trim() || 'Nos', rate: Number($('stkRate').value) || 0, qty: Number($('stkQty').value) || 0, openingQty: Number($('stkQty').value) || 0, reorderLevel: Number($('stkReorder').value) || 0, godown: $('stkGodown').value.trim() || 'Main Godown', hsn: $('stkHsn').value.trim(), group: 'Primary' });
    await saveState(); renderInventory(); renderDashboard();
  });
  $('btnAddBom').addEventListener('click', async () => {
    const c = co(); const f = $('bomFinished').value.trim(); if (!f) return;
    c.bom.push({ id: E.uid('bom'), finished: f, component: $('bomComponent').value.trim(), qty: Number($('bomQty').value) || 1 });
    await saveState(); renderInventory();
  });

  // ---------- GST ----------
  const HSN_TABLE = [['1006', 'Rice', '5%'], ['1001', 'Wheat', '5%'], ['1701', 'Sugar', '5%'], ['0901', 'Coffee', '5%'], ['0902', 'Tea', '5%'], ['5208', 'Cotton Fabrics', '5%'], ['6403', 'Footwear (leather)', '18%'], ['8517', 'Mobile Phones', '18%'], ['8471', 'Computers / Laptops', '18%'], ['8708', 'Motor Vehicle Parts', '18% / 28%'], ['9983', 'Professional Services', '18%'], ['9971', 'Financial Services', '18%']];
  function renderGst() {
    const c = co(); const g = E.gstSummary(c);
    $('gstBox').innerHTML = '<table><tr><th></th><th class="num">CGST</th><th class="num">SGST</th><th class="num">IGST</th><th class="num">Cess</th><th class="num">Net</th></tr>' +
      '<tr><td>Output</td><td class="num">' + E.inr(g.out.cgst) + '</td><td class="num">' + E.inr(g.out.sgst) + '</td><td class="num">' + E.inr(g.out.igst) + '</td><td class="num">' + E.inr(g.out.cess) + '</td><td class="num">—</td></tr>' +
      '<tr><td>Input</td><td class="num">' + E.inr(g.in.cgst) + '</td><td class="num">' + E.inr(g.in.sgst) + '</td><td class="num">' + E.inr(g.in.igst) + '</td><td class="num">' + E.inr(g.in.cess) + '</td><td class="num">—</td></tr>' +
      '<tr class="total"><td>Net Payable</td><td class="num">' + E.inr(g.net.cgst) + '</td><td class="num">' + E.inr(g.net.sgst) + '</td><td class="num">' + E.inr(g.net.igst) + '</td><td class="num">' + E.inr(g.net.cess) + '</td><td class="num">' + E.inr(g.net.total) + '</td></tr></table>' +
      '<p class="muted small">GSTIN: ' + esc(c.gstin || '—') + ' • State: ' + esc(c.state || '—') + '</p>';
  }
  $('btnHsn').addEventListener('click', () => {
    const q = $('hsnQuery').value.trim().toLowerCase();
    const rows = HSN_TABLE.filter(r => !q || r.join(' ').toLowerCase().includes(q));
    $('hsnOut').innerHTML = rows.length
      ? '<table><tr><th>HSN / SAC</th><th>Description</th><th>GST Rate</th></tr>' + rows.map(r => '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td><td>' + r[2] + '</td></tr>').join('') + '</table>'
      : '<p class="muted">No match. Try Rice, Mobile, Services…</p>';
  });

  // ---------- payroll ----------
  function renderPayroll() {
    const c = co();
    $('payrollBox').innerHTML = '<h3>Employees (' + c.employees.length + ')</h3>' +
      (c.employees.length ? '<table><tr><th>Name</th><th>Role</th><th class="num">Monthly Salary</th></tr>' + c.employees.map(e => '<tr><td>' + esc(e.name) + '</td><td>' + esc(e.role || '') + '</td><td class="num">' + E.inr(e.salary) + '</td></tr>').join('') + '</table>' : '<p class="muted">No employees yet.</p>') +
      (c.payrollRuns.length ? '<h3 style="margin-top:12px">Payroll Runs</h3><table><tr><th>Month</th><th class="num">Total Pay</th></tr>' + c.payrollRuns.map(r => '<tr><td>' + esc(r.month) + '</td><td class="num">' + E.inr(r.total) + '</td></tr>').join('') + '</table>' : '');
  }
  $('btnAddEmp').addEventListener('click', async () => {
    const c = co(); const name = $('empName').value.trim(); if (!name) return;
    c.employees.push({ id: E.uid('emp'), name, salary: Number($('empSalary').value) || 0, role: $('empRole').value.trim() });
    await saveState(); renderPayroll();
  });
  $('btnPayrollRun').addEventListener('click', async () => {
    const c = co(); const month = new Date().toISOString().slice(0, 7);
    const total = Math.round(c.employees.reduce((a, e) => a + (Number(e.salary) || 0), 0) * 100) / 100;
    c.payrollRuns.push({ id: E.uid('pr'), month, total });
    await saveState(); renderPayroll();
  });

  // ---------- e-invoice ----------
  $('btnEinv').addEventListener('click', () => {
    const c = co(); const no = Number($('einvNo').value) || 1;
    const v = c.vouchers.find(x => x.type === 'Sales' && Number(x.no) === no);
    if (!v) { $('einvOut').innerHTML = '<div class="alert warn">No Sales voucher No. ' + no + ' found.</div>'; return; }
    const ref = 'MAYA-' + c.id.slice(-6).toUpperCase() + '-' + String(v.no).padStart(4, '0');
    $('einvOut').innerHTML = '<div class="card" style="border:2px solid var(--indigo-3)"><h3>Tax Invoice — ' + esc(c.name) + '</h3>' +
      '<p>Invoice Ref: <b>' + ref + '</b> (local reference only — NOT a live IRN) • Date: ' + esc(E.fmtDate(v.date)) + ' • GSTIN: ' + esc(c.gstin || '—') + '</p>' +
      '<p>Party: <b>' + esc(v.party || '') + '</b> • Total: <b>' + E.inr(v.total) + '</b> (CGST ' + E.inr(v.gst.cgst) + ' + SGST ' + E.inr(v.gst.sgst) + ' + IGST ' + E.inr(v.gst.igst) + ')</p>' +
      '<p class="muted small">' + esc(v.narration || '') + '</p><div class="btnrow"><button class="btn" onclick="window.print()">Print Invoice</button></div></div>';
  });

  // ---------- data ----------
  function renderData() {
    $('dataPathLabel').textContent = dataFilePath || 'Documents\\MAYAACC-Data\\mayaacc-data.json';
    $('backupFolderLabel').textContent = state.backupFolder || 'not set — defaults to the data folder';
  }
  $('btnBackup').addEventListener('click', async () => {
    const json = E.serialize(state);
    const stamp = new Date().toISOString().slice(0, 10);
    const name = 'mayaacc-backup-' + stamp + '.json';
    if (window.mayaaccDesktop && state.backupFolder) {
      const r = await window.mayaaccDesktop.writeBackup(state.backupFolder, name, json);
      $('dataMsg').innerHTML = r.ok ? '<div class="alert ok">Backup saved: ' + esc(r.file) + '</div>' : '<div class="alert err">' + esc(r.error) + '</div>';
    } else { download(name, json, 'application/json'); $('dataMsg').innerHTML = '<div class="alert ok">Backup downloaded as ' + name + '. Set a backup folder (pen drive / Google Drive) to save there directly.</div>'; }
  });
  $('btnChooseBackupFolder').addEventListener('click', async () => {
    if (!window.mayaaccDesktop) { $('dataMsg').innerHTML = '<div class="alert info">Folder picker needs the desktop app. Run with npm start.</div>'; return; }
    const r = await window.mayaaccDesktop.chooseBackupFolder();
    if (!r.canceled) { state.backupFolder = r.folder; await saveState(); renderData(); }
  });
  $('btnExportJson').addEventListener('click', () => download('mayaacc-data.json', E.serialize(state), 'application/json'));
  $('btnExportCsv').addEventListener('click', () => {
    const c = co(); const rows = [['Date', 'Type', 'No', 'Party', 'Total']].concat(c.vouchers.map(v => [v.date, v.type, v.no, v.party || '', v.total]));
    download('mayaacc-vouchers.csv', rows.map(r => r.map(x => '"' + String(x).replace(/"/g, '""') + '"').join(',')).join('\n'), 'text/csv');
  });
  $('btnPrint').addEventListener('click', () => { if (window.mayaaccDesktop) window.mayaaccDesktop.print(); else window.print(); });
  $('btnRestore').addEventListener('click', async () => {
    try { const s = E.deserialize($('restoreText').value); state = s; await saveState(); $('dataMsg').innerHTML = '<div class="alert ok">Restored. Reloading views…</div>'; renderDashboard(); renderMasters(); }
    catch (e) { $('dataMsg').innerHTML = '<div class="alert err">Restore failed: ' + esc(e.message) + '</div>'; }
  });

  // ---------- keyboard (Tally-style) ----------
  document.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName) || '';
    const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    if (e.key === 'F1') { e.preventDefault(); showView('gateway'); return; }
    if (e.key === 'Escape' && !typing) { showView('dashboard'); return; }
    if (e.altKey && (e.key === 'n' || e.key === 'N')) { e.preventDefault(); showView('vouchers', 'Sales'); return; }
    if (e.ctrlKey && (e.key === 's' || e.key === 'S')) { if (currentView === 'vouchers') { e.preventDefault(); saveVoucher(); } return; }
    if (e.ctrlKey && (e.key === 'p' || e.key === 'P')) { e.preventDefault(); window.print(); return; }
    if (!typing) {
      if (e.key === 'F8') { showView('vouchers', 'Sales'); }
      else if (e.key === 'F9') { showView('vouchers', 'Purchase'); }
      else if (e.key === 'F5') { showView('vouchers', 'Payment'); }
      else if (e.key === 'F6') { showView('vouchers', 'Receipt'); }
    }
    // Gateway arrow navigation
    if (currentView === 'gateway' && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      const items = [...document.querySelectorAll('#gatewayList button')];
      let i = items.findIndex(b => b.classList.contains('sel'));
      items.forEach(b => b.classList.remove('sel'));
      i = e.key === 'ArrowDown' ? Math.min(items.length - 1, i + 1) : Math.max(0, i - 1);
      if (items[i]) { items[i].classList.add('sel'); items[i].focus(); }
      e.preventDefault();
    }
    if (currentView === 'gateway' && e.key === 'Enter') {
      const sel = document.querySelector('#gatewayList button.sel');
      if (sel) openGateway(sel.dataset.target);
    }
  });

  // ---------- boot ----------
  (async function boot() {
    await loadState();
    renderDashboard();
  })();
})();
