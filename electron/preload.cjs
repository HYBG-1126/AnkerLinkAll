const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('ankerDesktop', {
  platform: process.platform,
  electronVersion: process.versions.electron,
  hidePanel: () => ipcRenderer.send('panel:hide'),
})
