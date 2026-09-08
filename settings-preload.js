const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vibezSettings', {
  get: () => ipcRenderer.invoke('vibez:settings:get'),
  save: (patch) => ipcRenderer.invoke('vibez:settings:save', patch),
  checkForUpdates: () => ipcRenderer.invoke('vibez:updates:check'),
  showAbout: () => ipcRenderer.invoke('vibez:about:show'),
  resetBrowserData: () => ipcRenderer.invoke('vibez:data:reset'),
  openExternal: (url) => ipcRenderer.invoke('vibez:external:open', url),
  close: () => ipcRenderer.send('vibez:settings:close'),
});
