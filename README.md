# MAYAACC 2.0 — Fresh PC Desktop App

**MAYAACC — Smart Accounting Software for Indian Businesses.**
PC-only Windows desktop app, Tally-style keyboard-first accounting.
Fresh theme + new dashboard. All features from Sandeep's original
single-file HTML (`docs/original-index_0_edtg.html`, 15,298 lines, 1.5 MB)
are preserved — see `docs/FEATURE_CHECKLIST.md`.

**Constraints honoured (Sandeep's words):**
- PC ONLY. No phone/mobile version in this build (phone later).
- NO voice entry — not all PCs have voice/mic.
- Tally competitor: keyboard-first, fast entry, offline, proper double-entry.
- Data saves locally on the PC: `Documents\MAYAACC-Data\mayaacc-data.json`.
  Backup folder can be a pen drive / Google Drive folder.
- GST is calculation + reports inside the app only — NOT GST filing.

## New theme

Dark indigo sidebar (`#1e1b4b` → `#312e81`) + light content (`#f1f5f9`),
teal accent (`#0d9488`). Clean, professional, dense PC layout.

## New dashboard

Shows: current company, date/period, Total Sales, Total Purchase,
Receipts, Payments, Cash Balance, Bank Balance, Receivables (Debtors),
Payables (Creditors), low-stock alerts, recent vouchers, and quick actions
(New Sale, New Purchase, Payment, Receipt, Day Book, Trial Balance).

## Project structure

- `main.js` — Electron main process. Window + local data file at `<Documents>/MAYAACC-Data/mayaacc-data.json` (atomic write via .tmp + rename). IPC: load/save data, backup folder picker, write backup, print.
- `preload.js` — context bridge, exposes only `window.mayaaccDesktop` (load/save/print/backup).
- `src/index.html` — fresh shell: dark indigo sidebar + light content, topbar, 11 views.
- `src/styles.css` — fresh theme (indigo `#1e1b4b/#312e81/#4338ca` + teal `#0d9488`).
- `src/engine.js` — pure accounting engine (Node-testable, no DOM): double-entry vouchers, GST split (CGST/SGST/IGST/Cess), Trial Balance, P&L, Balance Sheet, Day Book, Ledger Display, Stock Summary, GST Summary, Dashboard KPIs, Indian ₹ / DD-MM-YYYY formatting.
- `src/app.js` — renderer UI wiring: dashboard, Gateway, masters, vouchers, reports, inventory, GST, payroll, e-invoice, backup/data, keyboard shortcuts.
- `test/smoke-test.js` — headless Node smoke test.
- `scripts/no-sign.js` — dev-build sign stub (skips Windows code signing on Linux; on Windows with a certificate, remove `"sign"` from package.json and signing works normally).
- `docs/FEATURE_CHECKLIST.md` — every original feature mapped to the fresh build.
- `docs/original-index_0_edtg.html` — reference copy of Sandeep's original file (sha256 `7925eeff151bc9bdd6d3f992a423f378e558dd1440bd77a3072a28b221b83c2c`).
- `src/icon.ico` / `src/icon.png` — app icon (indigo/teal "M" + ₹, 6 sizes).
- `build-windows.bat` — one-click Windows build (installer).
- `build-installer-windows.bat` — one-click Windows INSTALLER build
  (NSIS: `dist\MAYAACC-Setup-2.0.0.exe` with Desktop + Start Menu shortcuts).
- `docs/PIN-TO-TASKBAR.md` — manual pin/shortcut workaround for the
  portable version until the installer is used.

## Install on Windows (proper install — recommended)

On a Windows PC, in the `mayaacc-fresh` folder, double-click
**`build-installer-windows.bat`**. It runs `npm install`, `npm test`,
then `npm run dist:installer` and builds:

```
dist\MAYAACC-Setup-2.0.0.exe
```

Run that Setup file:

1. The install wizard opens — choose the install folder if you want
   (default is fine), tick **Create Desktop Shortcut**, click Install,
   then Finish.
2. MAYAACC is now a real installed program:
   - Start Menu (search "MAYAACC")
   - Desktop shortcut
   - Settings → Apps → Installed apps list
   - Right-click its icon → **Pin to taskbar**
3. Open it from Start / Desktop / taskbar from now on — no need to
   open the setup file again.

Unsigned build: Windows SmartScreen may warn on first run —
click **More info > Run anyway**. With a code-signing certificate,
remove the `"sign"` line from `package.json` and rebuild to get a signed EXE.

**Your data is safe:** uninstalling MAYAACC does NOT delete your data —
`Documents\MAYAACC-Data\mayaacc-data.json` is kept
(`deleteAppDataOnUninstall: false`).

## Run without installing (developer run)

```bat
cd mayaacc-fresh
npm install
npm start
```

First run creates `Documents\MAYAACC-Data\mayaacc-data.json` automatically.

## Portable EXE (no install — secondary option)

If you only want a portable file (no install, no shortcuts):

```bat
cd mayaacc-fresh
npm install
npm run dist:portable
```

Output: `dist\MAYAACC-2.0.0-Portable.exe` (single file).
Portable does **not** appear in Start Menu / Programs and has no Desktop
shortcut — see `docs/PIN-TO-TASKBAR.md` for the manual pin workaround.
For normal use, use the installer above instead.

## What was already built in this Linux VM

- `npm install` — OK (310 packages, Electron 30 + electron-builder 24).
- `npm test` — **35/35 passed** (see Test results below).
- GUI smoke test under Xvfb — window loads, dashboard renders, 8 KPI cards,
  11 views, 19 nav buttons, desktop API present, **0 JS errors**.
- `dist\win-unpacked\MAYAACC.exe` — **built, 255 MB**, runnable on Windows
  by double-clicking `MAYAACC.exe`.
- Portable single-file EXE — **not producible on Linux**: electron-builder
  needs Wine to sign Windows binaries (`wine is required`).
  Build it on Windows with `npm run dist:portable`.
- **NSIS installer (`MAYAACC-Setup-2.0.0.exe`) — also NOT producible on Linux:**
  the build stops at `wine is required` (ERR_ELECTRON_BUILDER_CANNOT_EXECUTE).
  Wine is not installable in this VM (`apt-cache policy wine64` →
  "Unable to locate package wine64"). This is a Linux-only limitation,
  not a project defect. The installer config is complete in
  `package.json` (`win` target `nsis`, shortcuts on, data kept on
  uninstall) — build it on a Windows PC with `npm run dist:installer`
  or double-click `build-installer-windows.bat`. The icon
  (`src/icon.ico`, 6 sizes) is ready and referenced by the build.

## Test results (2026-11-15, this VM)

`npm test` — 35 passed, 0 failed:
- Seed company, 8 voucher types, default groups/ledgers/units/godown
- GST split: 18% on ₹10,000 → CGST ₹900 + SGST ₹900 = ₹11,800; inter-state IGST ₹1,800
- Sales voucher ₹10,000 + 18% GST = ₹11,800, balanced Dr = Cr
- Payment voucher ₹5,000; Purchase / Receipt / Journal / Contra / Credit Note / Debit Note all build balanced
- Trial Balance balanced (Dr = Cr); P&L, Balance Sheet, Day Book, GST summary all compute
- Stock summary + low-stock alert (Rice 25kg, qty 5, reorder 10)
- Dashboard KPIs (sales, payments, recent vouchers, low stock)
- Persistence round-trip: JSON written to `mayaacc-data.json`, reopened,
  vouchers intact, Trial Balance still balanced
- Indian formatting: ₹11,800, date 15-11-2026

GUI smoke test (`MAYAACC_SMOKE=1` under Xvfb): title correct,
company "Demo Traders", 8 KPI cards, 11 views, 19 nav buttons,
`desktop-api` present, dashboard active, 0 JS errors.
(dbus "Failed to connect to the bus" lines in the log are harmless Linux VM noise.)

## Keyboard shortcuts (Tally-style)

| Key | Action |
|---|---|
| F1 | Gateway / Help |
| Esc | Back to Dashboard |
| Alt+N | New Voucher |
| F8 / F9 | Sales / Purchase |
| F5 / F6 | Payment / Receipt |
| Ctrl+S | Save current voucher |
| Ctrl+P | Print |
| ↑ ↓ + Enter | Move in Gateway list, open |

## Notes / limits

- e-Invoice in this build generates a printable invoice with a **local
  reference number only** — it is NOT a live IRP/GSTN e-invoice (no real IRN).
- GST Summary / GSTR-style view is a calculation report — it does **not**
  file returns. Filing is done on the GST portal.
- Payroll is basic (employees + monthly run). No attendance module
  (the original had no attendance either).
- The original file's login/session screen was not carried over as a login
  gate: this is a single-user local PC app, data is on the PC itself.
