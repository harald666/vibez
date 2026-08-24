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
          const STYLE_ID = 'vibez-screenshot-position-manager-style';

          // One authoritative CSS rule owns position, visibility and contextual sizing.
          // screenshot.js may calculate a fallback position, but these !important
          // values always win so the button cannot flicker between locations.
          let style = document.getElementById(STYLE_ID);
          if (!style) {
            style = document.createElement('style');
            style.id = STYLE_ID;
            style.textContent = '#vibez-screenshot-button { left: var(--vibez-screenshot-left, auto) !important; right: var(--vibez-screenshot-right, 74px) !important; top: var(--vibez-screenshot-top, 9px) !important; display: var(--vibez-screenshot-display, inline-flex) !important; width: var(--vibez-screenshot-width, auto) !important; min-width: var(--vibez-screenshot-min-width, 118px) !important; height: var(--vibez-screenshot-height, 36px) !important; padding: var(--vibez-screenshot-padding, 0 12px) !important; gap: var(--vibez-screenshot-gap, 7px) !important; font-size: var(--vibez-screenshot-font-size, 13px) !important; }';
            (document.head || document.documentElement).appendChild(style);
          }

          const visible = (element) => {
            if (!element || !element.isConnected) return false;
            const rect = element.getBoundingClientRect();
            const computed = getComputedStyle(element);
            return rect.width > 0 && rect.height > 0 && computed.display !== 'none' && computed.visibility !== 'hidden';
          };

          const isAuthenticationPage = () => {
            const title = (document.title || '').trim().toLowerCase();
            const hasEmailInput = Boolean(document.querySelector('input[type="email"], input[autocomplete="email"], input[name*="email" i]'));
            const bodyText = (document.body?.innerText || '').replace(/\\s+/g, ' ').toLowerCase();

            const loginTitle = title.includes('inloggen') ||
              title.includes('login') ||
              title.includes('log in') ||
              title.includes('sign in');

            const loginFormText = bodyText.includes('wachtwoord vergeten') ||
              bodyText.includes('forgot password') ||
              bodyText.includes('hieronder inloggen') ||
              bodyText.includes('sign in with');

            // The normal logged-out Vibe page can contain an "Aanmelden" button.
            // Only hide Screenshot on the actual credential/social-login form.
            return hasEmailInput && (loginTitle || loginFormText);
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

          const root = document.documentElement;

          const setPosition = (left, right, top) => {
            root.style.setProperty('--vibez-screenshot-left', left);
            root.style.setProperty('--vibez-screenshot-right', right);
            root.style.setProperty('--vibez-screenshot-top', top);
          };

          const setDisplay = (display) => {
            root.style.setProperty('--vibez-screenshot-display', display);
          };

          const setLoggedInSize = () => {
            root.style.setProperty('--vibez-screenshot-width', 'auto');
            root.style.setProperty('--vibez-screenshot-min-width', '118px');
            root.style.setProperty('--vibez-screenshot-height', '36px');
            root.style.setProperty('--vibez-screenshot-padding', '0 12px');
            root.style.setProperty('--vibez-screenshot-gap', '7px');
            root.style.setProperty('--vibez-screenshot-font-size', '13px');
          };

          const setLoginSize = (loginRect) => {
            const width = Math.max(1, Math.round(loginRect.width));
            const height = Math.max(1, Math.round(loginRect.height));
            root.style.setProperty('--vibez-screenshot-width', width + 'px');
            root.style.setProperty('--vibez-screenshot-min-width', width + 'px');
            root.style.setProperty('--vibez-screenshot-height', height + 'px');
            root.style.setProperty('--vibez-screenshot-padding', '0 6px');
            root.style.setProperty('--vibez-screenshot-gap', '5px');
            root.style.setProperty('--vibez-screenshot-font-size', '11px');
          };

          const updatePosition = () => {
            const button = document.getElementById(BUTTON_ID);

            if (isAuthenticationPage()) {
              setDisplay('none');
              if (button) button.dataset.vibezPositionMode = 'authentication';
              return;
            }

            setDisplay('inline-flex');
            const loginButton = findLoginButton();

            if (loginButton) {
              const loginRect = loginButton.getBoundingClientRect();
              setLoginSize(loginRect);

              const width = Math.round(loginRect.width);
              const height = Math.round(loginRect.height);
              const left = Math.max(8, Math.round(loginRect.left - width - GAP));
              const top = Math.max(8, Math.round(loginRect.top + (loginRect.height - height) / 2));

              setPosition(left + 'px', 'auto', top + 'px');
              if (button) button.dataset.vibezPositionMode = 'login';
              return;
            }

            // Logged-in Vibe position: next to Incognito, using the original button size.
            setLoggedInSize();
            setPosition('auto', '74px', '9px');
            if (button) button.dataset.vibezPositionMode = 'incognito';
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

          // Observe structural changes only. Attribute changes include our own CSS
          // variables and previously caused the Screenshot button to flicker.
          const observer = new MutationObserver(schedule);
          observer.observe(document.documentElement, { childList: true, subtree: true });
          window.addEventListener('resize', schedule, { passive: true });
          setInterval(updatePosition, 500);
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

  // Register the position manager first so its CSS is ready before the button appears.
  manageScreenshotButtonPosition(mainWindow);
  setupScreenshot(mainWindow);

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
