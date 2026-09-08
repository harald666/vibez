const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vibez', {
  captureScreenshot: () => ipcRenderer.send('vibez:native-screenshot'),
});
