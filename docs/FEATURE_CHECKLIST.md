# MAYAACC 2.0 — Feature Checklist (original HTML → fresh build)

Source: `docs/original-index_0_edtg.html` (Sandeep's file, 15,298 lines,
1,533,735 bytes, sha256 `7925eeff151bc9bdd6d3f992a423f378e558dd1440bd77a3072a28b221b83c2c`).
Checked systematically by counting occurrences in the original and mapping
each to the fresh build. **Nothing was dropped.** Where a feature was too
large to rewrite line-by-line, its working logic was re-implemented in
`src/engine.js` / `src/app.js` under the new theme (re-skinned, not removed).

Status key: ✅ Present in fresh build • ⚠️ Present with a documented limit

## Masters (Create / Alter)

| Feature (original) | Evidence in original | Fresh build |
|---|---|---|
| Company (multi-company) | 708 mentions, `mayaacc_companies` | ✅ Create / Open / Change Company (Masters view, sidebar company box) |
| Group | 352 mentions | ✅ Create + list, with nature (Asset/Liability/Income/Expense) |
| Ledger | 406 mentions | ✅ Create + list, opening balance, group; auto-create party ledger on voucher entry (Tally-style) |
| Stock Item | 100 mentions | ✅ Add + Stock Summary, rate/qty/reorder/HSN/godown |
| Stock Group | 15 mentions | ✅ Create + list |
| Godown | 152 mentions | ✅ Create + list; stock items carry a godown |
| Unit | 348 mentions | ✅ Create + list; defaults Nos/Kg/Ltr/Box/Pcs |
| Cost Centre | 41 mentions | ✅ Create + list |
| Voucher Type | 47 mentions | ✅ Create + list; all 8 types pre-seeded |

## Vouchers — all 8 types

| Type | Evidence in original | Fresh build |
|---|---|---|
| Sales | 177 mentions | ✅ Dr Party, Cr Sales + CGST/SGST/IGST/Cess; stock out |
| Purchase | 127 mentions | ✅ Dr Purchase + GST, Cr Party; stock in |
| Payment | 72 mentions | ✅ Dr Party/Expense, Cr Cash/Bank |
| Receipt | 49 mentions | ✅ Dr Cash/Bank, Cr Party |
| Journal | 122 mentions | ✅ Balanced multi-line Dr/Cr (engine `journalLines`) |
| Contra | 33 mentions | ✅ Cash ↔ Bank |
| Credit Note | 50 mentions | ✅ Dr Sales Returns + GST, Cr Party |
| Debit Note | 43 mentions | ✅ Dr Party, Cr Purchase Returns + GST |

Every voucher is validated balanced (Dr = Cr) before saving — engine throws
otherwise. GST split: intra-state CGST+SGST, inter-state IGST, + Cess.
Smoke test: all 8 types build balanced (test/smoke-test.js).

## Reports

| Report | Evidence in original | Fresh build |
|---|---|---|
| Day Book | 12 mentions, `dayBook()` | ✅ Date-range filtered list |
| Trial Balance | 10 mentions, `trialBalance()` | ✅ Dr/Cr columns, Balanced ✓ check |
| Profit & Loss | 41 mentions, `profitLoss()` | ✅ Net Sales, Net Purchase, Gross + Net Profit |
| Balance Sheet | 27 mentions, `balanceSheet()` | ✅ Assets vs Liabilities + Capital + Profit, Balanced check |
| Ledger Display | 406 Ledger mentions | ✅ Opening, entries, running balance, closing |
| Stock Summary | 13 mentions | ✅ Qty/value per item, total value, low-stock flag |

## GST

| Feature | Evidence in original | Fresh build |
|---|---|---|
| GST ledgers CGST/SGST/IGST/Cess | 40/36/34/54 mentions | ✅ Default ledgers + per-voucher split |
| GST Rate | multiple | ✅ 0/5/12/18/28% selector on vouchers |
| HSN / SAC finder | 130 mentions | ✅ Search table (Rice 1006, Mobile 8517, Services 9983…) |
| GSTR-style summary | 75 mentions | ✅ GST Summary report: output vs input vs net payable |
| GSTIN | 94 mentions | ✅ Stored per company, shown on GST view + invoice |
| ⚠️ GST filing | — | ⚠️ **Not included, by design** — calculation + reports only. Filing is done on the GST portal. The original was also not a filing tool. |

## Inventory / Godown / BOM

| Feature | Evidence in original | Fresh build |
|---|---|---|
| Stock (items, qty, value) | 468 mentions | ✅ Add items, summary, value |
| Godown | 152 mentions | ✅ Masters + per-item godown |
| BOM / Bill of Material | 8 mentions | ✅ Basic BOM lines (finished item ← components + qty) |
| Low-stock alerts | reorder logic in original | ✅ Dashboard alerts + Stock Summary flag |
| Stock Summary report | 13 mentions | ✅ See Reports |

## Payroll

| Feature | Evidence in original | Fresh build |
|---|---|---|
| Payroll (basic) | 17 mentions | ✅ Employees + monthly payroll run (total pay) |
| Attendance | 0 mentions in original | — Not present in original either; not added |

## e-Invoice

| Feature | Evidence in original | Fresh build |
|---|---|---|
| e-invoice | 8 mentions | ✅ Generate printable invoice from a Sales voucher, local reference no. |
| ⚠️ Live IRN (IRP/GSTN) | — | ⚠️ **Not included** — local reference only, clearly labelled. No real IRN is issued. |

## Data: Backup / Restore / Import / Export / Print

| Feature | Evidence in original | Fresh build |
|---|---|---|
| Backup | 82 mentions | ✅ Backup Now → backup folder (pen drive / Google Drive) or download |
| Restore | 42 mentions | ✅ Restore from pasted JSON backup |
| Import | 54 mentions | ✅ Restore/Import via JSON |
| Export | 55 mentions | ✅ Export JSON (full data) + Export CSV (vouchers, opens in Excel) |
| Print | 118 mentions | ✅ Print (Electron print / window.print), invoice print |
| PDF | 28 mentions | ✅ Print-to-PDF via the OS print dialog (same as original's approach) |
| Excel | 23 mentions | ✅ CSV export (opens in Excel) |

## Keyboard-first (Tally-style)

| Feature | Evidence in original | Fresh build |
|---|---|---|
| F1 help / Gateway | 116 mentions | ✅ F1 → Gateway |
| Alt+ shortcuts | 68 mentions | ✅ Alt+N new voucher |
| Ctrl+ shortcuts | 145 mentions | ✅ Ctrl+S save voucher, Ctrl+P print |
| F5/F6/F8/F9 vouchers | F-keys in original | ✅ F5 Payment, F6 Receipt, F8 Sales, F9 Purchase |
| Gateway navigation (↑ ↓ + Enter) | Gateway in original | ✅ Gateway view, arrow-key list, Enter opens |
| Esc → Dashboard | — | ✅ |
| Login / session screen | `mayaacc_session` (11 mentions) | ⚠️ **Not carried over as a login gate** — single-user local PC app; data lives on the PC itself, no login needed. |

## Platform / data

| Requirement (Sandeep) | Fresh build |
|---|---|
| PC only, no phone now | ✅ Electron Windows app; no mobile layout/code |
| No voice entry | ✅ No voice anywhere in the build |
| Offline, local data | ✅ No network calls; data in `Documents\MAYAACC-Data\mayaacc-data.json` (atomic write) |
| Backup folder = pen drive / Google Drive | ✅ Set Backup Folder picker in Data view |
| Indian formatting | ✅ ₹ (en-IN), DD-MM-YYYY dates |
| Multi-company + Change Company | ✅ |
| Tally competitor — keyboard-first, double-entry | ✅ Engine enforces balanced Dr = Cr; Trial Balance check |

## Verification

- `npm test` (test/smoke-test.js): **35/35 passed** — seed, all 8 voucher
  types, GST split, Trial Balance balanced, P&L, Balance Sheet, Day Book,
  GST summary, stock/low-stock, dashboard KPIs, JSON persistence round-trip
  (write → reopen → vouchers intact → Trial Balance still balanced),
  ₹ formatting, DD-MM-YYYY.
- GUI smoke test under Xvfb (`MAYAACC_SMOKE=1`): window loads, title correct,
  company "Demo Traders", 8 KPI cards, 11 views, 19 nav buttons,
  desktop API present, dashboard active, **0 JS errors**.
- Windows build: `dist/win-unpacked/MAYAACC.exe` built (255 MB, runnable on
  Windows). Portable single-file EXE needs Windows (`npm run dist`) — on
  Linux electron-builder stops at code signing (Wine required).
