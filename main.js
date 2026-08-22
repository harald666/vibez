const { app, BrowserWindow } = require('electron');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      // Schakel hardware-versnelling volledig uit
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

app.whenReady().then(createWindow);

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

const { autoUpdater } = require('electron-updater');

app.whenReady().then(() => {
  // Je bestaande code voor het venster
  mainWindow = new BrowserWindow({ /* ... */ });
  mainWindow.loadURL('https://vibe.mistral.ai'); // Vervang door je eigen URL

  // Auto-updater
  autoUpdater.checkForUpdatesAndNotify();

  // Optioneel: Log updates voor debugging
  autoUpdater.on('update-available', () => {
    console.log('Update beschikbaar!');
  });

  autoUpdater.on('update-downloaded', () => {
    console.log('Update gedownload. Herstart de app om te updaten.');
    autoUpdater.quitAndInstall();
  });
});
