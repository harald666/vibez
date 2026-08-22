const { app, BrowserWindow } = require('electron');
const { autoUpdater } = require('electron-updater');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      hardwareAcceleration: false,
      webgl: false,
      gpu: false,
    },
  });

  mainWindow.loadURL('https://vibe.mistral.ai/');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  // Initialize auto-updater after window is created
  if (process.env.NODE_ENV !== 'development') {
    autoUpdater.checkForUpdatesAndNotify();
  }

  autoUpdater.on('update-available', () => {
    console.log('Update beschikbaar!');
  });

  autoUpdater.on('update-downloaded', () => {
    console.log('Update gedownload. Herstart de app om te updaten.');
    autoUpdater.quitAndInstall();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
