const { app, BrowserWindow } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const { setupScreenshot } = require('./screenshot');

let mainWindow;

function manageScreenshotButtonPosition(win) {
  win.webContents.on('did-finish-load', async () => {
    try {
      await win.webContents.executeJavaScript(`
        (() => {
          if (window.__vibezScreenshotPositionManagerInstalled) return;
          window.__vibezScreenshotPositionManagerInstalled = true;

          const BUTTON_ID = 'vibez-screenshot-button';
          const GAP = 8;

          const visible = (element) => {
            if (!element || !element.isConnected) return false;
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
          };

          const findLoginButton = () => {
            const candidates = [...document.querySelectorAll('button,[role="button"],a')]
              .filter((element) => element.id !== BUTTON_ID && visible(element));

            return candidates.find((element) => {
              const text = [
                element.innerText,
                element.textContent,
                element.getAttribute('aria-label'),
                element.getAttribute('title')
              ]
                .filter(Boolean)
                .join(' ')
                .replace(/\\s+/g, ' ')
                .trim()
                .toLowerCase();

              return text === 'aanmelden' ||
                text === 'inloggen' ||
                text === 'login' ||
                text === 'log in' ||
                text === 'sign in' ||
                text.includes('aanmelden') ||
                text.includes('sign in');
            }) || null;
          };

          const updatePosition = () => {
            const button = document.getElementById(BUTTON_ID);
            if (!button || !visible(button)) return;

            const loginButton = findLoginButton();
            if (loginButton) {
              const loginRect = loginButton.getBoundingClientRect();
              const buttonRect = button.getBoundingClientRect();
              const width = Math.ceil(buttonRect.width || 118);
              const height = Math.ceil(buttonRect.height || 36);
              const left = Math.max(8, Math.round(loginRect.left - width - GAP));
              const top = Math.max(8, Math.round(loginRect.top + (loginRect.height - height) / 2));

              button.style.setProperty('left', left + 'px', 'important');
              button.style.setProperty('right', 'auto', 'important');
              button.style.setProperty('top', top + 'px', 'important');
              button.dataset.vibezPositionMode = 'login';
              return;
            }

            button.style.setProperty('left', 'auto', 'important');
            button.style.setProperty('right', '74px', 'important');
            button.style.setProperty('top', '9px', 'important');
            button.dataset.vibezPositionMode = 'incognito';
          };

          let queued = false;
          const schedule = () => {
            if (queued) return;
            queued = true;
            requestAnimationFrame(() => {
              queued = false;
              updatePosition();
            });
          };

          const observer = new MutationObserver(schedule);
          observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
          window.addEventListener('resize', schedule, { passive: true });
          setInterval(updatePosition, 750);
          updatePosition();
        })();
      `);
    } catch (error) {
      console.error('Kon Screenshot-positie niet beheren:', error);
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
  manageScreenshotButtonPosition(mainWindow);

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
