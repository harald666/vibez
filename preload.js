const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vibez', {
  captureScreenshot: () => ipcRenderer.send('vibez:screenshot:start'),
  finishScreenshot: (rect) => ipcRenderer.send('vibez:screenshot:finish', rect),
  cancelScreenshot: () => ipcRenderer.send('vibez:screenshot:cancel'),
});
