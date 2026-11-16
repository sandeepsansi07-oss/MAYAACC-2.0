/**
 * MAYAACC 2.0 — Electron main process (PC only, Windows target).
 * - Creates the desktop window, loads the fresh renderer (src/index.html).
 * - Data lives locally on the PC: <Documents>/MAYAACC-Data/mayaacc-data.json
 *   (same location as the previous build, so old data is picked up).
 * - Backup folder can be a pen drive / Google Drive folder (set in the app).
 * - No voice, no phone, no network calls. Fully offline.
 */
'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const DATA_DIR_NAME = 'MAYAACC-Data';
const DATA_FILE_NAME = 'mayaacc-data.json';

function dataDir() {
  return path.join(app.getPath('documents'), DATA_DIR_NAME);
}
function dataFile() {
  return path.join(dataDir(), DATA_FILE_NAME);
}
function ensureDataDir() {
  try { fs.mkdirSync(dataDir(), { recursive: true }); } catch (e) { /* ignore */ }
  return dataDir();
}
function readDataFile() {
  ensureDataDir();
  try {
    if (fs.existsSync(dataFile())) return fs.readFileSync(dataFile(), 'utf-8');
  } catch (e) { return JSON.stringify({ error: String(e && e.message || e) }); }
  return null; // no file yet -> renderer starts with seed data
}
function writeDataFile(jsonText) {
  ensureDataDir();
  // Write atomically: temp file then rename, so a crash cannot corrupt data.
  const tmp = dataFile() + '.tmp';
  fs.writeFileSync(tmp, jsonText, 'utf-8');
  fs.renameSync(tmp, dataFile());
  return dataFile();
}

let mainWindow = null;
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1024,
    minHeight: 640,
    title: 'MAYAACC — Smart Accounting for Indian Businesses',
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
  mainWindow.on('closed', () => { mainWindow = null; });
  // Headless GUI smoke test hook (only when MAYAACC_SMOKE=1):
  // after load, dump DOM checks to a JSON file and quit. Harmless in normal use.
  if (process.env.MAYAACC_SMOKE) {
    mainWindow.webContents.on('did-finish-load', () => {
      setTimeout(async () => {
        try {
          const result = await mainWindow.webContents.executeJavaScript(`(function(){
            const txt = (id) => { const el = document.getElementById(id); return el ? el.textContent : null; };
            return {
              title: document.title,
              company: txt('sbCompany'),
              kpiCards: document.querySelectorAll('.kpi-card').length,
              kpiText: (document.getElementById('kpiGrid')||{}).textContent || '',
              views: document.querySelectorAll('.view').length,
              navButtons: document.querySelectorAll('#mainNav button').length,
              dataPath: (window.mayaaccDesktop ? 'desktop-api' : 'browser-fallback'),
              dashboardActive: !!document.querySelector('#view-dashboard.active'),
              errors: window.__mayaaccErrors || []
            };
          })()`);
          fs.writeFileSync(process.env.MAYAACC_SMOKE_OUT || '/tmp/mayaacc-gui-smoke.json', JSON.stringify(result, null, 2));
        } catch (e) {
          try { fs.writeFileSync(process.env.MAYAACC_SMOKE_OUT || '/tmp/mayaacc-gui-smoke.json', JSON.stringify({ error: String(e) })); } catch (_) {}
        }
        app.quit();
      }, 4000);
    });
  }
}

app.whenReady().then(() => {
  ensureDataDir();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// ---- IPC: local data file ----
ipcMain.handle('mayaacc:load-data', () => ({ file: dataFile(), dir: dataDir(), json: readDataFile() }));
ipcMain.handle('mayaacc:save-data', (_e, jsonText) => {
  const file = writeDataFile(String(jsonText));
  return { ok: true, file };
});
ipcMain.handle('mayaacc:data-path', () => ({ file: dataFile(), dir: dataDir() }));
ipcMain.handle('mayaacc:choose-backup-folder', async () => {
  const r = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory', 'createDirectory'] });
  if (r.canceled || !r.filePaths.length) return { canceled: true };
  return { canceled: false, folder: r.filePaths[0] };
});
ipcMain.handle('mayaacc:write-backup', (_e, folder, fileName, jsonText) => {
  try {
    fs.mkdirSync(folder, { recursive: true });
    const file = path.join(folder, fileName);
    fs.writeFileSync(file, String(jsonText), 'utf-8');
    return { ok: true, file };
  } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
});
ipcMain.handle('mayaacc:open-path', (_e, p) => { shell.showItemInFolder(p); return { ok: true }; });
ipcMain.handle('mayaacc:print', () => { if (mainWindow) mainWindow.webContents.print({ silent: false }); return { ok: true }; });

module.exports = { dataDir, dataFile };
