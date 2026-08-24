const { app, BrowserWindow } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const { setupScreenshot } = require('./screenshot');

let mainWindow;

function lockScreenshotButtonPosition(win) {
  win.webContents.on('did-finish-load', async () => {
    try {
      await win.webContents.executeJavaScript(`
        (() => {
          const STYLE_ID = 'vibez-screenshot-position-lock';
          if (document.getElementById(STYLE_ID)) return;

          const style = document.createElement('style');
          style.id = STYLE_ID;
          style.textContent = '#vibez-screenshot-button { left: auto !important; right: 74px !important; top: 12px !important; }';
          (document.head || document.documentElement).appendChild(style);
        })();
      `);
    } catch (error) {
      console.error('Kon Screenshot-positie niet vastzetten:', error);
    }
  });
}

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

  mainWindow.loadURL('https://vibe.mistral.ai/');
  setupScreenshot(mainWindow);
  lockScreenshotButtonPosition(mainWindow);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  // Initialize auto-updater ONLY in production (packaged app)
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
