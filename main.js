const { app, BrowserWindow, Menu, shell } = require("electron");
const { autoUpdater } = require('electron-updater');
const path = require('path');
const { setupScreenshot } = require('./screenshot');

let mainWindow;
let browserLanguage = 'en';

const uiTranslations = {
  nl: { paste: 'Plakken', copy: 'Kopiëren', cut: 'Knippen', selectAll: 'Alles selecteren', google: 'Zoeken met Google', duckDuckGo: 'Zoeken met DuckDuckGo' },
  de: { paste: 'Einfügen', copy: 'Kopieren', cut: 'Ausschneiden', selectAll: 'Alles auswählen', google: 'Mit Google suchen', duckDuckGo: 'Mit DuckDuckGo suchen' },
  fr: { paste: 'Coller', copy: 'Copier', cut: 'Couper', selectAll: 'Tout sélectionner', google: 'Rechercher avec Google', duckDuckGo: 'Rechercher avec DuckDuckGo' },
  es: { paste: 'Pegar', copy: 'Copiar', cut: 'Cortar', selectAll: 'Seleccionar todo', google: 'Buscar con Google', duckDuckGo: 'Buscar con DuckDuckGo' },
  it: { paste: 'Incolla', copy: 'Copia', cut: 'Taglia', selectAll: 'Seleziona tutto', google: 'Cerca con Google', duckDuckGo: 'Cerca con DuckDuckGo' },
  pt: { paste: 'Colar', copy: 'Copiar', cut: 'Cortar', selectAll: 'Selecionar tudo', google: 'Pesquisar com o Google', duckDuckGo: 'Pesquisar com o DuckDuckGo' },
  en: { paste: 'Paste', copy: 'Copy', cut: 'Cut', selectAll: 'Select All', google: 'Search with Google', duckDuckGo: 'Search with DuckDuckGo' }
};

function uiText(language = browserLanguage) {
  return uiTranslations[String(language || 'en').toLowerCase().split('-')[0]] || uiTranslations.en;
}

function windowTitle() {
  return `VibeZ v${app.getVersion()}`;
}

function updateBrowserLanguage(win) {
  if (!win || win.isDestroyed()) return;
  win.webContents.executeJavaScript('navigator.language || document.documentElement.lang || "en"')
    .then((language) => { browserLanguage = language || 'en'; })
    .catch(() => {});
}


function setupContextMenu() {
  mainWindow.webContents.on('context-menu', (e, params) => {
    e.preventDefault();
    const selection = params.selectionText?.trim();
    const template = [];
    const text = uiText();

    if (params.isEditable) {
      template.push(
        {
          label: text.paste,
          click: () => mainWindow?.webContents.paste(),
          accelerator: process.platform === 'darwin' ? 'Cmd+V' : 'Ctrl+V',
        },
        { label: text.copy, role: 'copy', enabled: Boolean(selection) },
        { label: text.cut, role: 'cut', enabled: Boolean(selection) },
        { label: text.selectAll, role: 'selectAll' },
      );
    } else if (selection) {
      template.push({ label: text.copy, role: 'copy' });
    }

    if (selection) {
      if (template.length) template.push({ type: 'separator' });
      template.push(
        { label: text.google, click: () => shell.openExternal(`https://www.google.com/search?q=${encodeURIComponent(selection)}`) },
        { label: text.duckDuckGo, click: () => shell.openExternal(`https://duckduckgo.com/?q=${encodeURIComponent(selection)}`) },
      );
    }

    if (template.length) Menu.buildFromTemplate(template).popup({ window: mainWindow, x: params.x, y: params.y });
  });
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
    title: windowTitle(),
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
  setupScreenshotLayout(mainWindow);
  mainWindow.webContents.on('did-finish-load', () => updateBrowserLanguage(mainWindow));
  mainWindow.webContents.on('did-navigate-in-page', () => updateBrowserLanguage(mainWindow));
  mainWindow.webContents.on('page-title-updated', (event) => {
    event.preventDefault();
    mainWindow?.setTitle(windowTitle());
  });
  mainWindow.loadURL('https://vibe.mistral.ai/');

  setupContextMenu();

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
