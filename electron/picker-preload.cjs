const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('picker', {
  onDevices: (callback) => {
    ipcRenderer.on('bt:devices', (_event, devices) => callback(devices))
  },
  select: (deviceId) => ipcRenderer.send('bt:select', deviceId),
  cancel: () => ipcRenderer.send('bt:cancel'),
})
