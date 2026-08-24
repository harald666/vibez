const { app, BrowserWindow } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const { setupScreenshot } = require('./screenshot');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      hardwareAcceleration: false,
      webgl: false,
      gpu: false,
    },
  });

  setupScreenshot(mainWindow);
  mainWindow.loadURL('https://vibe.mistral.ai/');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify();

    autoUpdater.on('update-available', () => {
      console.log('Update beschikbaar!');
    });

    autoUpdater.on('update-downloaded', () => {
      console.log('Update gedownload. Herstart de app om te updaten.');
      autoUpdater.quitAndInstall();
    });
  }
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
