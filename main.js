const { app, BrowserWindow, Menu, MenuItem, clipboard, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const { setupScreenshot } = require('./screenshot');

let mainWindow;

// Context menu voor rechtermuisknop
function createContextMenu() {
  const menu = new Menu();

  // Copy
  menu.append(new MenuItem({
    label: 'Copy',
    click: () => {
      const focusedWindow = BrowserWindow.getFocusedWindow();
      if (focusedWindow) {
        focusedWindow.webContents.executeJavaScript(`
          window.getSelection().toString();
        `).then((result) => {
          if (result && result !== '') {
            clipboard.writeText(result);
          }
        });
      }
    },
    accelerator: 'CmdOrCtrl+C'
  }));

  // Paste
  menu.append(new MenuItem({
    label: 'Paste',
    click: () => {
      const focusedWindow = BrowserWindow.getFocusedWindow();
      if (focusedWindow) {
        const text = clipboard.readText();
        if (text) {
          focusedWindow.webContents.executeJavaScript(`
            const activeElement = document.activeElement;
            if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.isContentEditable)) {
              document.execCommand('insertText', false, '${text.replace(/'/g, "\\'")}');
            }
          `);
        }
      }
    },
    accelerator: 'CmdOrCtrl+V'
  }));

  // Separator
  menu.append(new MenuItem({ type: 'separator' }));

  // Select All
  menu.append(new MenuItem({
    label: 'Select All',
    click: () => {
      const focusedWindow = BrowserWindow.getFocusedWindow();
      if (focusedWindow) {
        focusedWindow.webContents.executeJavaScript(`
          document.execCommand('selectAll', false, null);
        `);
      }
    },
    accelerator: 'CmdOrCtrl+A'
  }));

  // Separator
  menu.append(new MenuItem({ type: 'separator' }));

  // Search with Google
  menu.append(new MenuItem({
    label: 'Search with Google',
    click: () => {
      const focusedWindow = BrowserWindow.getFocusedWindow();
      if (focusedWindow) {
        focusedWindow.webContents.executeJavaScript(`
          window.getSelection().toString();
        `).then((result) => {
          if (result && result !== '') {
            shell.openExternal(`https://www.google.com/search?q=${encodeURIComponent(result)}`);
          }
        });
      }
    }
  }));

  // Search with DuckDuckGo
  menu.append(new MenuItem({
    label: 'Search with DuckDuckGo',
    click: () => {
      const focusedWindow = BrowserWindow.getFocusedWindow();
      if (focusedWindow) {
        focusedWindow.webContents.executeJavaScript(`
          window.getSelection().toString();
        `).then((result) => {
          if (result && result !== '') {
            shell.openExternal(`https://duckduckgo.com/?q=${encodeURIComponent(result)}`);
          }
        });
      }
    }
  }));

  return menu;
}

function setupScreenshotLayout(win) {
  const install = async () => {
    if (!win || win.isDestroyed()) return;

    try {
      await win.webContents.executeJavaScript(`
        (() => {
          const STYLE_ID = 'vibez-screenshot-auth-layout-style';
          const BUTTON_ID = 'vibez-screenshot-button';
          const root = document.documentElement;

          let style = document.getElementById(STYLE_ID);
          if (!style) {
            style = document.createElement('style');
            style.id = STYLE_ID;
            (document.head || document.documentElement).appendChild(style);
          }

          style.textContent = [
            'html:not(.vibez-screenshot-layout-ready) #vibez-screenshot-button {',
            '  visibility: hidden !important;',
            '}',
            'html.vibez-logged-out-home #vibez-screenshot-button {',
            '  display: inline-flex !important;',
            '  visibility: visible !important;',
            '  left: auto !important;',
            '  right: 219px !important;',
            '  top: 9.5px !important;',
            '  width: 118px !important;',
            '  min-width: 118px !important;',
            '  height: 34px !important;',
            '  padding: 0 10px !important;',
            '  gap: 5px !important;',
            '  font-size: 11px !important;',
            '  box-sizing: border-box !important;',
            '}',
            'html.vibez-logged-in #vibez-screenshot-button {',
            '  display: inline-flex !important;',
            '  visibility: visible !important;',
            '  left: auto !important;',
            '  right: 85px !important;',
            '  top: 8px !important;',
            '  width: auto !important;',
            '  min-width: 118px !important;',
            '  height: 36px !important;',
            '  padding: 0 12px !important;',
            '  gap: 7px !important;',
            '  font-size: 13px !important;',
            '  box-sizing: border-box !important;',
            '}',
            'html.vibez-authentication-page #vibez-screenshot-button {',
            '  display: none !important;',
            '}'
          ].join('\\n');

          const visible = (element) => {
            if (!element || !element.isConnected) return false;
            const rect = element.getBoundingClientRect();
            const computed = getComputedStyle(element);
            return rect.width > 0 &&
              rect.height > 0 &&
              computed.display !== 'none' &&
              computed.visibility !== 'hidden';
          };

          const textOf = (element) => [
            element?.innerText,
            element?.textContent,
            element?.getAttribute?.('aria-label'),
            element?.getAttribute?.('title')
          ]
            .filter(Boolean)
            .join(' ')
            .replace(/\\s+/g, ' ')
            .trim()
            .toLowerCase();

          const hasTopRightAuthControl = () => {
            const labels = new Set([
              'aanmelden',
              'inloggen',
              'sign up',
              'sign in',
              'log in',
              'register',
              'registreren',
              'create account'
            ]);

            return [...document.querySelectorAll('button,[role="button"],a')].some((element) => {
              if (element.id === BUTTON_ID || !visible(element)) return false;
              if (!labels.has(textOf(element))) return false;
              const rect = element.getBoundingClientRect();
              return rect.top >= 0 &&
                rect.top < Math.min(130, window.innerHeight * 0.3) &&
                rect.right > window.innerWidth - Math.min(240, window.innerWidth * 0.65);
            });
          };

          const isAuthenticationPage = () => {
            const title = (document.title || '').trim().toLowerCase();
            const bodyText = (document.body?.innerText || '')
              .replace(/\\s+/g, ' ')
              .toLowerCase();
            const hasEmailInput = Boolean(
              document.querySelector('input[type="email"], input[autocomplete="email"], input[name*="email" i]')
            );

            return hasEmailInput && (
              title.includes('inloggen') ||
              title.includes('login') ||
              title.includes('log in') ||
              title.includes('sign in') ||
              bodyText.includes('wachtwoord vergeten') ||
              bodyText.includes('forgot password') ||
              bodyText.includes('hieronder inloggen') ||
              bodyText.includes('sign in with')
            );
          };

          const updateState = () => {
            const authenticationPage = isAuthenticationPage();
            const loggedOutHome = !authenticationPage && hasTopRightAuthControl();
            const loggedIn = !authenticationPage && !loggedOutHome;

            root.classList.toggle('vibez-authentication-page', authenticationPage);
            root.classList.toggle('vibez-logged-out-home', loggedOutHome);
            root.classList.toggle('vibez-logged-in', loggedIn);
            root.classList.remove('vibez-logged-in-actions');
            root.style.removeProperty('--vibez-screenshot-action-left');
            root.classList.add('vibez-screenshot-layout-ready');
          };

          if (!window.__vibezStableScreenshotLayoutInstalled) {
            window.__vibezStableScreenshotLayoutInstalled = true;

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
            setInterval(updateState, 1000);
          }

          updateState();
        })();
      `);
    } catch (error) {
      console.error('Kon stabiele Screenshot-layout niet installeren:', error);
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

  // Voeg context menu toe aan het venster
  mainWindow.webContents.on('context-menu', (e, params) => {
    const contextMenu = createContextMenu();
    contextMenu.popup({ window: mainWindow, x: params.x, y: params.y });
  });

  setupScreenshot(mainWindow);
  setupScreenshotLayout(mainWindow);
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
