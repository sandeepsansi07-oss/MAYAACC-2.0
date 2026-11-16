/**
 * MAYAACC 2.0 — preload (context bridge).
 * Exposes only the safe, local file APIs the renderer needs.
 * No Node access from the renderer, no network, no voice.
 */
'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mayaaccDesktop', {
  isDesktop: true,
  loadData: () => ipcRenderer.invoke('mayaacc:load-data'),
  saveData: (jsonText) => ipcRenderer.invoke('mayaacc:save-data', jsonText),
  dataPath: () => ipcRenderer.invoke('mayaacc:data-path'),
  chooseBackupFolder: () => ipcRenderer.invoke('mayaacc:choose-backup-folder'),
  writeBackup: (folder, fileName, jsonText) => ipcRenderer.invoke('mayaacc:write-backup', folder, fileName, jsonText),
  openPath: (p) => ipcRenderer.invoke('mayaacc:open-path', p),
  print: () => ipcRenderer.invoke('mayaacc:print'),
});
