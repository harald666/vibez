const { app, BrowserWindow } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const { setupScreenshot } = require('./screenshot');

let mainWindow;

function setupScreenshotAuthLayout(win) {
  const install = async () => {
    if (!win || win.isDestroyed()) return;

    try {
      await win.webContents.executeJavaScript(`
        (() => {
          const STYLE_ID = 'vibez-screenshot-auth-layout-style';
          const root = document.documentElement;

          let style = document.getElementById(STYLE_ID);
          if (!style) {
            style = document.createElement('style');
            style.id = STYLE_ID;
            style.textContent = [
              'html.vibez-logged-out-home #vibez-screenshot-button {',
              '  left: auto !important;',
              '  right: 194px !important;',
              '  top: 9px !important;',
              '  width: 118px !important;',
              '  min-width: 118px !important;',
              '  height: 36px !important;',
              '  padding: 0 10px !important;',
              '  gap: 5px !important;',
              '  font-size: 11px !important;',
              '  box-sizing: border-box !important;',
              '}',
              'html.vibez-authentication-page #vibez-screenshot-button {',
              '  display: none !important;',
              '}'
            ].join('\\n');
            (document.head || document.documentElement).appendChild(style);
          }

          const updateState = () => {
            const title = (document.title || '').trim().toLowerCase();
            const bodyText = (document.body?.innerText || '')
              .replace(/\\s+/g, ' ')
              .trim()
              .toLowerCase();

            const hasEmailInput = Boolean(
              document.querySelector('input[type="email"], input[autocomplete="email"], input[name*="email" i]')
            );

            const authenticationPage = hasEmailInput && (
              title.includes('inloggen') ||
              title.includes('login') ||
              title.includes('log in') ||
              title.includes('sign in') ||
              bodyText.includes('wachtwoord vergeten') ||
              bodyText.includes('forgot password') ||
              bodyText.includes('hieronder inloggen') ||
              bodyText.includes('sign in with')
            );

            const loggedOutHome = !authenticationPage && (
              bodyText.includes('aanmelden') ||
              bodyText.includes('inloggen') ||
              bodyText.includes('sign up') ||
              bodyText.includes('sign in') ||
              bodyText.includes('log in') ||
              bodyText.includes('register')
            );

            root.classList.toggle('vibez-authentication-page', authenticationPage);
            root.classList.toggle('vibez-logged-out-home', loggedOutHome);
          };

          if (!window.__vibezScreenshotAuthLayoutInstalled) {
            window.__vibezScreenshotAuthLayoutInstalled = true;

            let queued = false;
            const schedule = () => {
              if (queued) return;
              queued = true;
              requestAnimationFrame(() => {
                queued = false;
                updateState();
              });
            };

            const observer = new MutationObserver(schedule);
            observer.observe(document.documentElement, { childList: true, subtree: true });
            window.addEventListener('resize', schedule, { passive: true });
            setInterval(updateState, 500);
          }

          updateState();
        })();
      `);
    } catch (error) {
      console.error('Kon Screenshot auth-layout niet installeren:', error);
    }
  };

  win.webContents.on('did-finish-load', install);
  win.webContents.on('did-navigate-in-page', install);
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

  setupScreenshot(mainWindow);
  setupScreenshotAuthLayout(mainWindow);
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
