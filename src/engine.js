/**
 * MAYAACC 2.0 — Accounting engine (pure JS, no DOM, no Electron).
 * Works in the browser renderer AND in Node (smoke tests).
 * Double-entry, Tally-style. Indian formatting (₹, en-IN, DD-MM-YYYY).
 * GST here is calculation + reports inside the app only — NOT GST filing.
 *
 * Data model (per company):
 *   groups, ledgers, stockItems, stockGroups, godowns, units,
 *   costCentres, voucherTypes, vouchers, employees, payrollRuns, bom
 * Voucher line: { ledgerId, debit, credit }  (balanced: sum Dr == sum Cr)
 * Voucher item: { stockItemId, qty, rate, amount, gstRate, cgst, sgst, igst, cess }
 */
'use strict';

const VOUCHER_TYPES = ['Sales', 'Purchase', 'Payment', 'Receipt', 'Journal', 'Contra', 'Credit Note', 'Debit Note'];

const DEFAULT_GROUPS = [
  { name: 'Capital Account', nature: 'Liability' },
  { name: 'Current Assets', nature: 'Asset' },
  { name: 'Current Liabilities', nature: 'Liability' },
  { name: 'Fixed Assets', nature: 'Asset' },
  { name: 'Loans (Liability)', nature: 'Liability' },
  { name: 'Sundry Debtors', nature: 'Asset' },
  { name: 'Sundry Creditors', nature: 'Liability' },
  { name: 'Bank Accounts', nature: 'Asset' },
  { name: 'Cash-in-Hand', nature: 'Asset' },
  { name: 'Sales Accounts', nature: 'Income' },
  { name: 'Purchase Accounts', nature: 'Expense' },
  { name: 'Direct Expenses', nature: 'Expense' },
  { name: 'Indirect Expenses', nature: 'Expense' },
  { name: 'Duties & Taxes', nature: 'Liability' },
];

let _uid = 1;
function uid(prefix) { return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + (_uid++).toString(36) + Math.floor(Math.random() * 1e6).toString(36); }
function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
function inr(n) {
  try { return '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(Number(n) || 0); }
  catch (e) { return '₹' + (Number(n) || 0).toFixed(2); }
}
function fmtDate(d) {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt)) return String(d);
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  return dd + '-' + mm + '-' + dt.getFullYear();
}
function todayISO() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

function defaultLedgers() {
  return [
    { name: 'Cash', group: 'Cash-in-Hand', opening: 0, gstin: '', hsn: '' },
    { name: 'Sales', group: 'Sales Accounts', opening: 0 },
    { name: 'Purchase', group: 'Purchase Accounts', opening: 0 },
    { name: 'Sales Returns', group: 'Sales Accounts', opening: 0 },
    { name: 'Purchase Returns', group: 'Purchase Accounts', opening: 0 },
    { name: 'CGST', group: 'Duties & Taxes', opening: 0, taxType: 'CGST' },
    { name: 'SGST', group: 'Duties & Taxes', opening: 0, taxType: 'SGST' },
    { name: 'IGST', group: 'Duties & Taxes', opening: 0, taxType: 'IGST' },
    { name: 'Cess', group: 'Duties & Taxes', opening: 0, taxType: 'Cess' },
  ];
}
function defaultUnits() { return [{ name: 'Nos', symbol: 'Nos' }, { name: 'Kg', symbol: 'Kg' }, { name: 'Ltr', symbol: 'Ltr' }, { name: 'Box', symbol: 'Box' }, { name: 'Pcs', symbol: 'Pcs' }]; }

function newCompany(name, opts) {
  opts = opts || {};
  const c = {
    id: uid('co'), name: name || 'My Company',
    address: opts.address || '', state: opts.state || '', gstin: (opts.gstin || '').toUpperCase(),
    pan: (opts.pan || '').toUpperCase(), phone: opts.phone || '', email: opts.email || '',
    fyStart: opts.fyStart || '2026-04-01',
    groups: DEFAULT_GROUPS.map(g => ({ id: uid('grp'), name: g.name, nature: g.nature, parent: '' })),
    ledgers: [], stockItems: [], stockGroups: [{ id: uid('sg'), name: 'Primary', parent: '' }],
    godowns: [{ id: uid('gd'), name: 'Main Godown', address: '' }],
    units: defaultUnits().map(u => ({ id: uid('un'), ...u })),
    costCentres: [], voucherTypes: VOUCHER_TYPES.map(t => ({ id: uid('vt'), name: t, numbering: 'Auto' })),
    vouchers: [], employees: [], payrollRuns: [], bom: [],
  };
  c.ledgers = defaultLedgers().map(l => ({ id: uid('led'), ...l, opening: 0 }));
  return c;
}

function newState() {
  return { version: 2, app: 'MAYAACC', activeCompanyId: null, companies: [], backupFolder: '', settings: { theme: 'indigo', currency: 'INR' } };
}
function seedState() {
  const s = newState();
  const co = newCompany('Demo Traders', { state: 'Delhi', gstin: '07AAAAA0000A1Z5' });
  s.companies.push(co); s.activeCompanyId = co.id;
  return s;
}
function activeCompany(state) {
  return (state.companies || []).find(c => c.id === state.activeCompanyId) || state.companies[0] || null;
}
function ledgerByName(co, name) { return (co.ledgers || []).find(l => l.name.toLowerCase() === String(name).toLowerCase()); }
function ledgerById(co, id) { return (co.ledgers || []).find(l => l.id === id); }
function groupNature(co, groupName) {
  const g = (co.groups || []).find(x => x.name === groupName);
  return g ? g.nature : 'Asset';
}

/** GST split for one taxable amount. isInterState -> IGST, else CGST+SGST. */
function gstSplit(amount, rate, isInterState, cessRate) {
  amount = round2(amount); rate = Number(rate) || 0; cessRate = Number(cessRate) || 0;
  const tax = round2(amount * rate / 100);
  const cess = round2(amount * cessRate / 100);
  if (isInterState) return { cgst: 0, sgst: 0, igst: tax, cess, total: round2(amount + tax + cess) };
  return { cgst: round2(tax / 2), sgst: round2(tax - round2(tax / 2)), igst: 0, cess, total: round2(amount + tax + cess) };
}

/** Build balanced double-entry lines for a voucher, from its high-level fields.
 *  opts: { type, party, cashBank, amount, gstRate, isInterState, cessRate, items[] }
 *  Returns { lines, items, gst, total } or throws on invalid input. */
function buildVoucherLines(co, opts) {
  const type = opts.type;
  if (!VOUCHER_TYPES.includes(type)) throw new Error('Unknown voucher type: ' + type);
  const amount = round2(opts.amount);
  if (!(amount > 0)) throw new Error('Amount must be greater than 0');
  const party = ledgerByName(co, opts.party || '') || ledgerByName(co, 'Cash');
  const cashBank = ledgerByName(co, opts.cashBank || '') || ledgerByName(co, 'Cash');
  const items = (opts.items || []).map(it => {
    const g = gstSplit(it.amount != null ? it.amount : round2((it.qty || 0) * (it.rate || 0)), it.gstRate != null ? it.gstRate : opts.gstRate, opts.isInterState, opts.cessRate);
    return { stockItemId: it.stockItemId || '', name: it.name || '', qty: Number(it.qty) || 0, rate: round2(it.rate), amount: round2(it.amount != null ? it.amount : (it.qty || 0) * (it.rate || 0)), gstRate: Number(it.gstRate != null ? it.gstRate : opts.gstRate) || 0, ...g };
  });
  const taxable = items.length ? round2(items.reduce((a, i) => a + i.amount, 0)) : amount;
  const gst = gstSplit(taxable, opts.gstRate, opts.isInterState, opts.cessRate);
  const total = items.length ? round2(items.reduce((a, i) => a + i.total, 0)) : gst.total;
  const L = (name) => { const l = ledgerByName(co, name); if (!l) throw new Error('Ledger not found: ' + name); return l.id; };
  const lines = [];
  const dr = (ledgerId, amt) => { if (amt) lines.push({ ledgerId, debit: round2(amt), credit: 0 }); };
  const cr = (ledgerId, amt) => { if (amt) lines.push({ ledgerId, debit: 0, credit: round2(amt) }); };
  switch (type) {
    case 'Sales':
      dr(party.id, total); cr(L('Sales'), taxable);
      cr(L('CGST'), gst.cgst); cr(L('SGST'), gst.sgst); cr(L('IGST'), gst.igst); cr(L('Cess'), gst.cess);
      break;
    case 'Purchase':
      dr(L('Purchase'), taxable); dr(L('CGST'), gst.cgst); dr(L('SGST'), gst.sgst); dr(L('IGST'), gst.igst); dr(L('Cess'), gst.cess);
      cr(party.id, total);
      break;
    case 'Payment': dr(party.id, amount); cr(cashBank.id, amount); break;
    case 'Receipt': dr(cashBank.id, amount); cr(party.id, amount); break;
    case 'Contra': dr(cashBank.id, amount); cr(party.id, amount); break;
    case 'Journal': {
      // opts.journalLines: [{ledgerName, debit, credit}] — must balance.
      const jl = opts.journalLines || [];
      if (jl.length < 2) throw new Error('Journal needs at least 2 lines');
      jl.forEach(j => {
        const l = ledgerByName(co, j.ledgerName); if (!l) throw new Error('Ledger not found: ' + j.ledgerName);
        if (j.debit) dr(l.id, j.debit); if (j.credit) cr(l.id, j.credit);
      });
      break;
    }
    case 'Credit Note': dr(L('Sales Returns'), taxable); dr(L('CGST'), gst.cgst); dr(L('SGST'), gst.sgst); dr(L('IGST'), gst.igst); cr(party.id, total); break;
    case 'Debit Note': dr(party.id, total); cr(L('Purchase Returns'), taxable); cr(L('CGST'), gst.cgst); cr(L('SGST'), gst.sgst); cr(L('IGST'), gst.igst); break;
  }
  const d = round2(lines.reduce((a, l) => a + l.debit, 0));
  const c = round2(lines.reduce((a, l) => a + l.credit, 0));
  if (d !== c || d <= 0) throw new Error('Voucher is not balanced (Dr ' + d + ' / Cr ' + c + ')');
  return { lines, items, gst, total: type === 'Journal' ? d : total, taxable };
}

/** Add a voucher to a company. Returns the saved voucher. */
function addVoucher(state, companyId, opts) {
  const co = (state.companies || []).find(c => c.id === companyId);
  if (!co) throw new Error('Company not found');
  // Tally-style: a new party name creates its ledger on the fly (before posting,
  // so the voucher debits/credits the party, not Cash).
  if (opts.party && !ledgerByName(co, opts.party) && !['Cash'].includes(opts.party)) {
    const grp = ['Purchase', 'Payment', 'Debit Note'].includes(opts.type) ? 'Sundry Creditors' : 'Sundry Debtors';
    co.ledgers.push({ id: uid('led'), name: opts.party, group: grp, opening: 0 });
  }
  if (opts.cashBank && !ledgerByName(co, opts.cashBank)) {
    co.ledgers.push({ id: uid('led'), name: opts.cashBank, group: 'Bank Accounts', opening: 0 });
  }
  const built = buildVoucherLines(co, opts);
  const sameType = co.vouchers.filter(v => v.type === opts.type);
  const no = opts.no || (sameType.length + 1);
  const v = {
    id: uid('vch'), no, type: opts.type, date: opts.date || todayISO(),
    narration: opts.narration || '', party: opts.party || '', cashBank: opts.cashBank || '',
    lines: built.lines, items: built.items, gst: built.gst, total: built.total,
    gstRate: Number(opts.gstRate) || 0, isInterState: !!opts.isInterState,
  };
  co.vouchers.push(v);
  return v;
}

/** Ledger balances for a company: { ledgerId: {debit, credit, balance, side} } */
function ledgerBalances(co) {
  const map = {};
  (co.ledgers || []).forEach(l => { map[l.id] = { ledger: l, debit: 0, credit: 0, opening: Number(l.opening) || 0 }; });
  (co.vouchers || []).forEach(v => (v.lines || []).forEach(ln => {
    if (!map[ln.ledgerId]) map[ln.ledgerId] = { ledger: ledgerById(co, ln.ledgerId) || { name: ln.ledgerId }, debit: 0, credit: 0, opening: 0 };
    map[ln.ledgerId].debit += Number(ln.debit) || 0;
    map[ln.ledgerId].credit += Number(ln.credit) || 0;
  }));
  Object.values(map).forEach(b => {
    // Opening is a debit balance for assets/expenses, credit for liabilities/income — store as given.
    b.balance = round2(b.opening + b.debit - b.credit);
    b.side = b.balance >= 0 ? 'Dr' : 'Cr';
  });
  return map;
}
function trialBalance(co) {
  const bal = ledgerBalances(co);
  const rows = Object.values(bal).filter(b => b.opening || b.debit || b.credit)
    .map(b => ({ ledger: b.ledger.name, group: b.ledger.group || '', debit: round2(Math.max(0, b.opening) + b.debit - Math.max(0, -b.opening) - 0), credit: 0, balance: b.balance, side: b.side }));
  // Recompute Dr/Cr columns properly: a positive net (Dr) balance goes in Dr column.
  rows.forEach(r => { r.debit = r.balance >= 0 ? round2(r.balance) : 0; r.credit = r.balance < 0 ? round2(-r.balance) : 0; });
  const totalDr = round2(rows.reduce((a, r) => a + r.debit, 0));
  const totalCr = round2(rows.reduce((a, r) => a + r.credit, 0));
  return { rows, totalDr, totalCr, balanced: totalDr === totalCr };
}
function dayBook(co, fromDate, toDate) {
  return (co.vouchers || []).filter(v => (!fromDate || v.date >= fromDate) && (!toDate || v.date <= toDate))
    .sort((a, b) => (a.date + String(a.no)).localeCompare(b.date + String(b.no)));
}
function ledgerDisplay(co, ledgerId, fromDate, toDate) {
  const l = ledgerById(co, ledgerId); if (!l) return null;
  const entries = [];
  (co.vouchers || []).forEach(v => {
    if (fromDate && v.date < fromDate) return; if (toDate && v.date > toDate) return;
    (v.lines || []).forEach(ln => { if (ln.ledgerId === ledgerId) entries.push({ date: v.date, type: v.type, no: v.no, narration: v.narration, debit: ln.debit, credit: ln.credit }); });
  });
  entries.sort((a, b) => a.date.localeCompare(b.date));
  let run = Number(l.opening) || 0;
  entries.forEach(e => { run = round2(run + e.debit - e.credit); e.running = run; });
  return { ledger: l, opening: Number(l.opening) || 0, entries, closing: run };
}
function profitAndLoss(co) {
  const bal = ledgerBalances(co);
  let sales = 0, salesRet = 0, purchase = 0, purchRet = 0, directExp = 0, indirectExp = 0;
  Object.values(bal).forEach(b => {
    const g = b.ledger.group || ''; const n = b.ledger.name;
    const net = -b.balance; // credit balances are income
    if (n === 'Sales') sales += net; else if (n === 'Sales Returns') salesRet += -net;
    else if (n === 'Purchase') purchase += b.balance; else if (n === 'Purchase Returns') purchRet += net;
    else if (g === 'Direct Expenses') directExp += b.balance;
    else if (g === 'Indirect Expenses') indirectExp += b.balance;
  });
  const netSales = round2(sales - salesRet);
  const netPurchase = round2(purchase - purchRet);
  const grossProfit = round2(netSales - netPurchase - directExp);
  const netProfit = round2(grossProfit - indirectExp);
  return { netSales, netPurchase, directExp, indirectExp, grossProfit, netProfit };
}
function balanceSheet(co) {
  const bal = ledgerBalances(co);
  const pl = profitAndLoss(co);
  let assets = 0, liabilities = 0;
  Object.values(bal).forEach(b => {
    const g = b.ledger.group || '';
    if (['Current Assets', 'Fixed Assets', 'Bank Accounts', 'Cash-in-Hand', 'Sundry Debtors'].includes(g)) assets += Math.max(0, b.balance);
    if (['Current Liabilities', 'Loans (Liability)', 'Capital Account', 'Sundry Creditors', 'Duties & Taxes'].includes(g)) liabilities += Math.max(0, -b.balance);
  });
  assets = round2(assets); liabilities = round2(liabilities + Math.max(0, pl.netProfit));
  return { assets, liabilities: round2(liabilities), netProfit: pl.netProfit, balanced: assets === liabilities };
}
function stockSummary(co) {
  const map = {};
  (co.stockItems || []).forEach(s => { map[s.id] = { item: s, qty: Number(s.openingQty) || 0, value: round2((Number(s.openingQty) || 0) * (Number(s.rate) || 0)) }; });
  (co.vouchers || []).forEach(v => (v.items || []).forEach(it => {
    if (!map[it.stockItemId]) return;
    if (v.type === 'Purchase') { map[it.stockItemId].qty += Number(it.qty) || 0; map[it.stockItemId].value = round2(map[it.stockItemId].value + (it.amount || 0)); }
    if (v.type === 'Sales' || v.type === 'Credit Note') { map[it.stockItemId].qty -= Number(it.qty) || 0; map[it.stockItemId].value = round2(map[it.stockItemId].value - (it.amount || 0)); }
  }));
  const rows = Object.values(map).map(r => ({ ...r, low: r.qty <= (Number(r.item.reorderLevel) || 0) }));
  return { rows, totalValue: round2(rows.reduce((a, r) => a + r.value, 0)), lowStock: rows.filter(r => r.low) };
}
function gstSummary(co, fromDate, toDate) {
  let outCGST = 0, outSGST = 0, outIGST = 0, outCess = 0, inCGST = 0, inSGST = 0, inIGST = 0, inCess = 0, taxableOut = 0, taxableIn = 0;
  (co.vouchers || []).forEach(v => {
    if (fromDate && v.date < fromDate) return; if (toDate && v.date > toDate) return;
    const g = v.gst || {};
    if (v.type === 'Sales') { outCGST += g.cgst || 0; outSGST += g.sgst || 0; outIGST += g.igst || 0; outCess += g.cess || 0; taxableOut += (v.items || []).reduce((a, i) => a + (i.amount || 0), 0) || 0; }
    if (v.type === 'Purchase') { inCGST += g.cgst || 0; inSGST += g.sgst || 0; inIGST += g.igst || 0; inCess += g.cess || 0; taxableIn += (v.items || []).reduce((a, i) => a + (i.amount || 0), 0) || 0; }
  });
  const net = { cgst: round2(outCGST - inCGST), sgst: round2(outSGST - inSGST), igst: round2(outIGST - inIGST), cess: round2(outCess - inCess) };
  net.total = round2(net.cgst + net.sgst + net.igst + net.cess);
  return { out: { cgst: round2(outCGST), sgst: round2(outSGST), igst: round2(outIGST), cess: round2(outCess) }, in: { cgst: round2(inCGST), sgst: round2(inSGST), igst: round2(inIGST), cess: round2(inCess) }, net, taxableOut: round2(taxableOut), taxableIn: round2(taxableIn) };
}
function dashboardKPIs(state) {
  const co = activeCompany(state);
  if (!co) return null;
  const bal = ledgerBalances(co);
  const byName = (n) => { const l = ledgerByName(co, n); return l ? bal[l.id] : null; };
  const sumByTypes = (types) => round2((co.vouchers || []).filter(v => types.includes(v.type)).reduce((a, v) => a + (v.total || 0), 0));
  const cash = byName('Cash');
  let bank = 0, debtors = 0, creditors = 0;
  Object.values(bal).forEach(b => {
    if (b.ledger.group === 'Bank Accounts') bank += b.balance;
    if (b.ledger.group === 'Sundry Debtors') debtors += Math.max(0, b.balance);
    if (b.ledger.group === 'Sundry Creditors') creditors += Math.max(0, -b.balance);
  });
  const stock = stockSummary(co);
  const recent = [...(co.vouchers || [])].sort((a, b) => (b.date + String(b.no)).localeCompare(a.date + String(a.no))).slice(0, 8);
  return {
    company: co.name, date: fmtDate(new Date()), fyStart: co.fyStart,
    sales: sumByTypes(['Sales']), purchase: sumByTypes(['Purchase']),
    receipts: sumByTypes(['Receipt']), payments: sumByTypes(['Payment']),
    cash: cash ? cash.balance : 0, bank: round2(bank),
    receivables: round2(debtors), payables: round2(creditors),
    lowStock: stock.lowStock, stockValue: stock.totalValue,
    voucherCount: (co.vouchers || []).length, recent,
    trial: trialBalance(co),
  };
}
function serialize(state) { return JSON.stringify(state, null, 2); }
function deserialize(text) {
  const s = JSON.parse(text);
  if (!s || !Array.isArray(s.companies)) throw new Error('Invalid MAYAACC data file');
  return s;
}

const api = {
  VOUCHER_TYPES, DEFAULT_GROUPS, uid, round2, inr, fmtDate, todayISO, gstSplit,
  newCompany, newState, seedState, activeCompany, ledgerByName, ledgerById, groupNature,
  buildVoucherLines, addVoucher, ledgerBalances, trialBalance, dayBook, ledgerDisplay,
  profitAndLoss, balanceSheet, stockSummary, gstSummary, dashboardKPIs, serialize, deserialize,
};
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.MayaEngine = api;
