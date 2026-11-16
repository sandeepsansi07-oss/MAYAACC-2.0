/* MAYAACC 2.0 — headless smoke test (Node, no GUI needed).
 * Covers: seed, company, Sales + Payment vouchers, Trial Balance,
 * P&L, Balance Sheet, GST split, stock, dashboard KPIs, JSON persistence
 * round-trip (simulates Documents\MAYAACC-Data\mayaacc-data.json).
 * Run: npm test   (node test/smoke-test.js) — exits 0 only if all pass. */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const E = require('../src/engine');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? ' — ' + extra : '')); }
}

console.log('MAYAACC 2.0 smoke test');
const state = E.seedState();
check('seed has 1 company', state.companies.length === 1);
const co = E.activeCompany(state);
check('company is Demo Traders', co.name === 'Demo Traders');
check('8 voucher types', E.VOUCHER_TYPES.length === 8 && E.VOUCHER_TYPES.includes('Credit Note') && E.VOUCHER_TYPES.includes('Debit Note'));
check('default groups >= 14', co.groups.length >= 14);
check('default ledgers include Cash/Sales/CGST/SGST/IGST', ['Cash', 'Sales', 'Purchase', 'CGST', 'SGST', 'IGST', 'Cess'].every(n => !!E.ledgerByName(co, n)));
check('default units present', co.units.length >= 5);
check('godown present', co.godowns.length >= 1);

// GST split
const g = E.gstSplit(10000, 18, false, 0);
check('GST 18% on 10000 = 900+900', g.cgst === 900 && g.sgst === 900 && g.total === 11800, JSON.stringify(g));
const gi = E.gstSplit(10000, 18, true, 0);
check('Inter-state IGST 1800', gi.igst === 1800 && gi.cgst === 0);

// Stock item + low stock
co.stockItems.push({ id: E.uid('stk'), name: 'Rice 25kg', unit: 'Kg', rate: 1200, qty: 5, openingQty: 5, reorderLevel: 10, godown: 'Main Godown', hsn: '1006', group: 'Primary' });

// Sales voucher: party Sharma Traders, taxable 10000 @18% => total 11800
const sale = E.addVoucher(state, co.id, { type: 'Sales', date: '2026-11-15', party: 'Sharma Traders', amount: 10000, gstRate: 18, narration: 'Test sale' });
check('Sales voucher saved, total 11800', sale.total === 11800, 'got ' + sale.total);
check('Sales voucher balanced Dr=Cr', sale.lines.reduce((a, l) => a + l.debit, 0) === sale.lines.reduce((a, l) => a + l.credit, 0));
// Note: party ledger auto-created? addVoucher uses Cash fallback if party missing — check party handling:
check('Sales party recorded', sale.party === 'Sharma Traders');

// Payment voucher: pay 5000 to Sharma Traders from Cash
const pay = E.addVoucher(state, co.id, { type: 'Payment', date: '2026-11-15', party: 'Sharma Traders', cashBank: 'Cash', amount: 5000, narration: 'Test payment' });
check('Payment voucher saved, total 5000', pay.total === 5000);

// Other voucher types must all build balanced lines
for (const t of ['Purchase', 'Receipt', 'Journal', 'Contra', 'Credit Note', 'Debit Note']) {
  try {
    const opts = { type: t, date: '2026-11-15', party: 'Cash', cashBank: 'Cash', amount: 1000, gstRate: 18, narration: 'smoke ' + t };
    if (t === 'Journal') opts.journalLines = [{ ledgerName: 'Purchase', debit: 1000 }, { ledgerName: 'Cash', credit: 1000 }];
    const v = E.addVoucher(state, co.id, opts);
    check('Voucher type builds: ' + t, v.lines.length >= 2);
  } catch (e) { check('Voucher type builds: ' + t, false, e.message); }
}

// Trial Balance must balance
const tb = E.trialBalance(co);
check('Trial Balance balanced', tb.balanced && tb.totalDr === tb.totalCr, 'Dr ' + tb.totalDr + ' Cr ' + tb.totalCr);
check('Trial Balance has rows', tb.rows.length > 0);

// Reports
const pl = E.profitAndLoss(co);
check('P&L computes (netSales > 0)', pl.netSales > 0, JSON.stringify(pl));
const bs = E.balanceSheet(co);
check('Balance Sheet computes', typeof bs.assets === 'number' && typeof bs.liabilities === 'number');
const db = E.dayBook(co, '2026-11-01', '2026-11-30');
check('Day Book returns vouchers', db.length >= 2);
const gst = E.gstSummary(co);
check('GST summary: output CGST > 0', gst.out.cgst > 0, JSON.stringify(gst.out));
const stock = E.stockSummary(co);
check('Stock summary: low-stock alert for Rice', stock.lowStock.some(s => s.item.name === 'Rice 25kg'), 'low=' + stock.lowStock.length);

// Dashboard KPIs
const kpi = E.dashboardKPIs(state);
check('Dashboard: sales > 0', kpi.sales > 0, 'sales=' + kpi.sales);
check('Dashboard: payments > 0', kpi.payments > 0);
check('Dashboard: recent vouchers present', kpi.recent.length > 0);
check('Dashboard: low-stock surfaced', kpi.lowStock.length >= 1);

// Persistence round-trip: write JSON to temp file like Documents\MAYAACC-Data\mayaacc-data.json, read back, verify
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mayaacc-test-'));
const tmpFile = path.join(tmpDir, 'mayaacc-data.json');
fs.writeFileSync(tmpFile, E.serialize(state), 'utf-8');
const reloaded = E.deserialize(fs.readFileSync(tmpFile, 'utf-8'));
check('Persistence: file written + reloaded', reloaded.companies.length === state.companies.length);
const co2 = E.activeCompany(reloaded);
check('Persistence: vouchers survive reopen', co2.vouchers.length === co.vouchers.length, co2.vouchers.length + ' vs ' + co.vouchers.length);
const tb2 = E.trialBalance(co2);
check('Persistence: Trial Balance still balanced after reopen', tb2.balanced);
fs.rmSync(tmpDir, { recursive: true, force: true });

// Formatting
check('Indian ₹ formatting', E.inr(11800).includes('₹') && E.inr(11800).includes('11,800'));
check('Indian date DD-MM-YYYY', E.fmtDate('2026-11-15') === '15-11-2026');

console.log(`\nResult: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
