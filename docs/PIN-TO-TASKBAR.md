# Pin MAYAACC to taskbar / Desktop — manual workaround (portable version only)

Use this **only until you install with the proper installer**
(`MAYAACC-Setup-2.0.0.exe`, built with `build-installer-windows.bat`).
Once installed, the app is in Start Menu + Desktop + Programs list and
can be pinned — no workaround needed.

## The problem

The current build is **portable** (`MAYAACC.exe` inside `win-unpacked/`).
Windows does not register a portable EXE as an installed program, so it
does not appear in Start Menu / Programs, and it has no Desktop shortcut
of its own. You have to open it from the file every time.

## Workaround 1 — Pin to taskbar (quickest)

1. Open the folder with `MAYAACC.exe` (`dist\win-unpacked\`).
2. **Right-click** `MAYAACC.exe`.
3. Click **Pin to taskbar**.
4. Done — the MAYAACC icon now stays on the taskbar. Click it to open
   the app any time.

## Workaround 2 — Desktop shortcut

1. Open the folder with `MAYAACC.exe`.
2. **Right-click** `MAYAACC.exe` → **Send to** → **Desktop (create shortcut)**.
3. A `MAYAACC` shortcut appears on the Desktop. Double-click it to open.
4. Optional: right-click that Desktop shortcut → **Pin to taskbar**.

## Workaround 3 — Start Menu (manual)

1. Press `Win + R`, type `shell:programs`, press Enter.
   (This opens your Start Menu Programs folder.)
2. Copy the Desktop shortcut created in Workaround 2 into this folder.
3. MAYAACC now appears in Start Menu search.

## Important — do NOT move the EXE alone

`MAYAACC.exe` only works together with the other files in the
`win-unpacked` folder (`resources`, DLLs, etc.). Move the **whole
`win-unpacked` folder** if you want it elsewhere (e.g. `C:\MAYAACC\`),
then pin / shortcut the `MAYAACC.exe` inside it.

## The real fix — install it properly

On the Windows PC, in the `mayaacc-fresh` folder, double-click
`build-installer-windows.bat`. It builds `dist\MAYAACC-Setup-2.0.0.exe`.
Run that Setup, tick **Create Desktop Shortcut**, click Finish — and
MAYAACC is installed like any normal program (Start Menu, Desktop,
Programs list, pin to taskbar, uninstall from Settings).
