const {
  app,
  BrowserWindow,
  Menu,
  Tray,
  globalShortcut,
  ipcMain,
  shell,
  dialog,
  clipboard,
  nativeImage,
  session,
} = require('electron');
const { autoUpdater } = require('electron-updater');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { setupScreenshot } = require('./screenshot');
const { createSettingsStore } = require('./settings-store');

const REPO_URL = 'https://github.com/harald666/vibez';
const RELEASES_URL = `${REPO_URL}/releases/latest`;
const VIBE_URL = 'https://vibe.mistral.ai/';
const APP_PROTOCOL = 'vibez';

if (process.argv.includes('--version')) {
  console.log(require('./package.json').version);
  process.exit(0);
}

app.setName('VibeZ');

const settingsStore = createSettingsStore(path.join(app.getPath('userData'), 'settings.json'));
let settings = settingsStore.read();

if (settings.hardwareAcceleration === 'disabled') {
  app.disableHardwareAcceleration();
} else if (settings.hardwareAcceleration === 'enabled') {
  app.commandLine.appendSwitch('ignore-gpu-blocklist');
  app.commandLine.appendSwitch('enable-gpu-rasterization');
}

if (settings.displayBackend === 'wayland') {
  app.commandLine.appendSwitch('enable-features', 'UseOzonePlatform');
  app.commandLine.appendSwitch('ozone-platform', 'wayland');
} else if (settings.displayBackend === 'x11') {
  app.commandLine.appendSwitch('ozone-platform', 'x11');
}

if (settings.language !== 'system') {
  app.commandLine.appendSwitch('lang', settings.language);
}

let mainWindow = null;
let settingsWindow = null;
let screenshotButtonWindow = null;
let screenshotButtonNativeReady = false;
let tray = null;
let browserLanguage = 'en';
let isQuitting = false;
let manualUpdateCheck = false;
let updaterHandlersInstalled = false;
let initialActionHandled = false;

const uiTranslations = {
  nl: { paste: 'Plakken', copy: 'Kopiëren', cut: 'Knippen', selectAll: 'Alles selecteren', google: 'Zoeken met Google', duckDuckGo: 'Zoeken met DuckDuckGo', open: 'VibeZ openen', screenshot: 'Screenshot', settings: 'Instellingen', updates: 'Controleren op updates', about: 'Over VibeZ', quit: 'Afsluiten' },
  de: { paste: 'Einfügen', copy: 'Kopieren', cut: 'Ausschneiden', selectAll: 'Alles auswählen', google: 'Mit Google suchen', duckDuckGo: 'Mit DuckDuckGo suchen', open: 'VibeZ öffnen', screenshot: 'Screenshot', settings: 'Einstellungen', updates: 'Nach Updates suchen', about: 'Über VibeZ', quit: 'Beenden' },
  fr: { paste: 'Coller', copy: 'Copier', cut: 'Couper', selectAll: 'Tout sélectionner', google: 'Rechercher avec Google', duckDuckGo: 'Rechercher avec DuckDuckGo', open: 'Ouvrir VibeZ', screenshot: 'Capture', settings: 'Paramètres', updates: 'Rechercher des mises à jour', about: 'À propos de VibeZ', quit: 'Quitter' },
  es: { paste: 'Pegar', copy: 'Copiar', cut: 'Cortar', selectAll: 'Seleccionar todo', google: 'Buscar con Google', duckDuckGo: 'Buscar con DuckDuckGo', open: 'Abrir VibeZ', screenshot: 'Captura', settings: 'Ajustes', updates: 'Buscar actualizaciones', about: 'Acerca de VibeZ', quit: 'Salir' },
  it: { paste: 'Incolla', copy: 'Copia', cut: 'Taglia', selectAll: 'Seleziona tutto', google: 'Cerca con Google', duckDuckGo: 'Cerca con DuckDuckGo', open: 'Apri VibeZ', screenshot: 'Schermata', settings: 'Impostazioni', updates: 'Controlla aggiornamenti', about: 'Informazioni su VibeZ', quit: 'Esci' },
  pt: { paste: 'Colar', copy: 'Copiar', cut: 'Cortar', selectAll: 'Selecionar tudo', google: 'Pesquisar com o Google', duckDuckGo: 'Pesquisar com DuckDuckGo', open: 'Abrir VibeZ', screenshot: 'Captura', settings: 'Definições', updates: 'Procurar atualizações', about: 'Sobre o VibeZ', quit: 'Sair' },
  en: { paste: 'Paste', copy: 'Copy', cut: 'Cut', selectAll: 'Select All', google: 'Search with Google', duckDuckGo: 'Search with DuckDuckGo', open: 'Open VibeZ', screenshot: 'Screenshot', settings: 'Settings', updates: 'Check for updates', about: 'About VibeZ', quit: 'Quit' },
};

function selectedLanguage() {
  if (settings.language !== 'system') return settings.language;
  return String(browserLanguage || app.getLocale?.() || 'en').toLowerCase().split('-')[0];
}

function uiText() {
  return uiTranslations[selectedLanguage()] || uiTranslations.en;
}

function windowTitle() {
  return `VibeZ v${app.getVersion()}`;
}

function showMessageBox(options, parent = settingsWindow || mainWindow) {
  const win = parent && !parent.isDestroyed?.() ? parent : null;
  return win ? dialog.showMessageBox(win, options) : dialog.showMessageBox(options);
}

function isTrustedMistralUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return url.protocol === 'https:' && (host === 'mistral.ai' || host.endsWith('.mistral.ai'));
  } catch (_) {
    return false;
  }
}

function isSafeExternalUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch (_) {
    return false;
  }
}

function ensureMainVisible() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  if (!mainWindow.isVisible()) mainWindow.show();
  mainWindow.focus();
}

async function positionScreenshotButton() {
  if (!mainWindow || mainWindow.isDestroyed() || !screenshotButtonWindow || screenshotButtonWindow.isDestroyed()) return;
  const bounds = mainWindow.getBounds();
  const width = 146;
  const height = 48;
  const gap = 10;
  let x = Math.round(bounds.x + bounds.width - 330);
  let y = Math.round(bounds.y + 5);

  try {
    const anchor = await mainWindow.webContents.executeJavaScript(`
      (() => {
        const visible = (el) => {
          if (!el || !el.isConnected) return false;
          const r = el.getBoundingClientRect();
          const s = getComputedStyle(el);
          return r.width > 18 && r.height > 18 && r.top >= 0 && r.top < 120 && s.display !== 'none' && s.visibility !== 'hidden';
        };
        const textOf = (el) => [el.innerText, el.textContent, el.getAttribute('aria-label'), el.getAttribute('title')]
          .filter(Boolean).join(' ').replace(/\s+/g, ' ').trim().toLowerCase();
        const signupWords = [
          'aanmelden','registreren','sign up','register','create account','konto erstellen','registrieren',
          's’inscrire','inscription','registrarse','crear cuenta','registrati','crea account','registar','criar conta',
          '注册','註冊','创建账户','建立帳戶','إنشاء حساب','تسجيل','साइन अप','登録','가입','регистрация','зарегистрироваться',
          'kayıt ol','zarejestruj','реєстрація','daftar','đăng ký','สมัคร','הרשמה','ثبت نام','رجسٹر','নিবন্ধন'
        ];
        const nodes = [...document.querySelectorAll('button,a,[role="button"]')]
          .filter(visible)
          .map((el) => ({ el, text: textOf(el), rect: el.getBoundingClientRect() }))
          .filter((item) => item.rect.left > window.innerWidth * 0.55);
        let match = nodes.find((item) => signupWords.some((word) => item.text === word || item.text.includes(word)));
        if (!match) {
          match = nodes
            .filter((item) => item.rect.width >= 55 && item.rect.width <= 240)
            .sort((a, b) => b.rect.right - a.rect.right)[0];
        }
        if (!match) return null;
        const r = match.rect;
        return { left: r.left, top: r.top, width: r.width, height: r.height };
      })()
    `);
    if (anchor && Number.isFinite(anchor.left)) {
      x = Math.round(bounds.x + anchor.left - width - gap);
      y = Math.round(bounds.y + anchor.top + (anchor.height - height) / 2);
    }
  } catch (_) {}

  const minX = bounds.x + 8;
  const maxX = bounds.x + bounds.width - width - 8;
  const minY = bounds.y + 2;
  const maxY = bounds.y + Math.min(90, bounds.height - height - 2);
  x = Math.max(minX, Math.min(maxX, x));
  y = Math.max(minY, Math.min(maxY, y));
  screenshotButtonWindow.setBounds({ x, y, width, height }, false);
}

function shouldShowScreenshotButton() {
  return Boolean(
    settings.showScreenshotButton &&
    screenshotButtonNativeReady &&
    mainWindow &&
    !mainWindow.isDestroyed() &&
    mainWindow.isVisible() &&
    !mainWindow.isMinimized() &&
    mainWindow.getBounds().width >= 620
  );
}

function refreshScreenshotButtonVisibility() {
  if (!screenshotButtonWindow || screenshotButtonWindow.isDestroyed()) return;
  if (shouldShowScreenshotButton()) {
    positionScreenshotButton();
    screenshotButtonWindow.showInactive();
  } else {
    screenshotButtonWindow.hide();
  }
}

async function suppressInjectedScreenshotButton() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (!screenshotButtonNativeReady && settings.showScreenshotButton) return;
  try {
    await mainWindow.webContents.insertCSS('#vibez-screenshot-button{display:none !important;visibility:hidden !important;pointer-events:none !important;}');
  } catch (_) {}
}

async function triggerScreenshot() {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  ensureMainVisible();
  screenshotButtonWindow?.hide();

  if (mainWindow.webContents.isLoadingMainFrame()) {
    mainWindow.webContents.once('did-finish-load', () => setTimeout(triggerScreenshot, 120));
    return true;
  }

  try {
    const triggered = await mainWindow.webContents.executeJavaScript(`
      (() => {
        if (!window.vibez || typeof window.vibez.captureScreenshot !== 'function') return false;
        window.vibez.captureScreenshot();
        return true;
      })();
    `);
    if (!triggered) throw new Error('Screenshot bridge is not ready.');
    return true;
  } catch (error) {
    console.error('Could not start screenshot:', error);
    refreshScreenshotButtonVisibility();
    await showMessageBox({
      type: 'error',
      title: 'VibeZ Screenshot',
      message: 'Could not start the screenshot tool.',
      detail: error.message,
    });
    return false;
  }
}

function createScreenshotButtonWindow() {
  if (!mainWindow || mainWindow.isDestroyed() || screenshotButtonWindow) return;

  screenshotButtonWindow = new BrowserWindow({
    width: 146,
    height: 48,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    parent: mainWindow,
    webPreferences: {
      preload: path.join(__dirname, 'native-button-preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  screenshotButtonWindow.setMenuBarVisibility(false);
  screenshotButtonWindow.loadFile(path.join(__dirname, 'screenshot-button.html')).then(() => {
    screenshotButtonNativeReady = true;
    suppressInjectedScreenshotButton();
    refreshScreenshotButtonVisibility();
  }).catch((error) => {
    console.error('Native Screenshot button failed to load; keeping web fallback:', error);
    screenshotButtonNativeReady = false;
    screenshotButtonWindow?.destroy();
    screenshotButtonWindow = null;
  });

  screenshotButtonWindow.on('closed', () => {
    screenshotButtonWindow = null;
    screenshotButtonNativeReady = false;
  });
}

function setupContextMenu() {
  mainWindow.webContents.on('context-menu', (event, params) => {
    event.preventDefault();
    const selection = params.selectionText?.trim();
    const template = [];
    const text = uiText();

    if (params.isEditable) {
      template.push(
        { label: text.paste, click: () => mainWindow?.webContents.paste(), accelerator: 'Ctrl+V' },
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

    if (!template.length) {
      template.push(
        { label: text.screenshot, click: triggerScreenshot },
        { label: text.settings, click: openSettings },
      );
    }

    Menu.buildFromTemplate(template).popup({ window: mainWindow, x: params.x, y: params.y });
  });
}

function setupNavigationSecurity(win) {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isTrustedMistralUrl(url)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          autoHideMenuBar: true,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
          },
        },
      };
    }

    if (isSafeExternalUrl(url) && settings.openExternalLinks) {
      shell.openExternal(url);
      return { action: 'deny' };
    }

    return isSafeExternalUrl(url)
      ? { action: 'allow', overrideBrowserWindowOptions: { autoHideMenuBar: true, webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true } } }
      : { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    try {
      const protocol = new URL(url).protocol;
      if (protocol !== 'https:' && protocol !== 'http:') event.preventDefault();
    } catch (_) {
      event.preventDefault();
    }
  });
}

function updateBrowserLanguage(win) {
  if (!win || win.isDestroyed()) return;
  win.webContents.executeJavaScript('navigator.language || document.documentElement.lang || "en"')
    .then((language) => {
      browserLanguage = language || 'en';
      rebuildTray();
      buildApplicationMenu();
    })
    .catch(() => {});
}

function applyZoom() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try { mainWindow.webContents.setZoomFactor(settings.zoomFactor); } catch (_) {}
}

function registerGlobalScreenshot() {
  globalShortcut.unregisterAll();
  if (!settings.globalScreenshot) return true;
  try {
    return globalShortcut.register(settings.screenshotShortcut, triggerScreenshot);
  } catch (error) {
    console.error('Could not register global screenshot shortcut:', error);
    return false;
  }
}

function autostartCommand() {
  if (process.env.FLATPAK_ID) return `flatpak run ${process.env.FLATPAK_ID} --hidden`;
  const executable = process.env.APPIMAGE || process.execPath;
  return `"${String(executable).replace(/"/g, '\\"')}" --hidden`;
}

function syncAutostart(enabled) {
  if (!app.isPackaged) return true;
  try {
    const dir = path.join(os.homedir(), '.config', 'autostart');
    const file = path.join(dir, 'vibez.desktop');
    if (!enabled) {
      try { fs.unlinkSync(file); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      return true;
    }
    fs.mkdirSync(dir, { recursive: true });
    const desktop = [
      '[Desktop Entry]',
      'Type=Application',
      'Name=VibeZ',
      'Comment=Mistral Vibe desktop client',
      `Exec=${autostartCommand()}`,
      'Terminal=false',
      'X-GNOME-Autostart-enabled=true',
      '',
    ].join('\n');
    fs.writeFileSync(file, desktop, 'utf8');
    return true;
  } catch (error) {
    console.error('Could not update autostart:', error);
    return false;
  }
}

function createMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) return mainWindow;

  const startHidden = process.argv.includes('--hidden');
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 720,
    minHeight: 520,
    show: !startHidden,
    autoHideMenuBar: true,
    backgroundColor: '#111216',
    title: windowTitle(),
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      spellcheck: true,
    },
  });

  mainWindow.webContents.on('before-input-event', (_event, input) => {
    if (input.control && input.shift && String(input.key || '').toLowerCase() === 's') screenshotButtonWindow?.hide();
  });

  setupScreenshot(mainWindow);
  setupContextMenu();
  setupNavigationSecurity(mainWindow);
  createScreenshotButtonWindow();

  mainWindow.webContents.on('did-finish-load', () => {
    updateBrowserLanguage(mainWindow);
    applyZoom();
    suppressInjectedScreenshotButton();
    if (!initialActionHandled) {
      initialActionHandled = true;
      setTimeout(() => handleCommandLine(process.argv), 180);
    }
  });
  mainWindow.webContents.on('did-navigate-in-page', () => {
    updateBrowserLanguage(mainWindow);
    suppressInjectedScreenshotButton();
  });
  mainWindow.webContents.on('page-title-updated', (event) => {
    event.preventDefault();
    mainWindow?.setTitle(windowTitle());
  });

  mainWindow.on('move', positionScreenshotButton);
  mainWindow.on('resize', refreshScreenshotButtonVisibility);
  mainWindow.on('maximize', () => setTimeout(refreshScreenshotButtonVisibility, 40));
  mainWindow.on('unmaximize', () => setTimeout(refreshScreenshotButtonVisibility, 40));
  mainWindow.on('show', refreshScreenshotButtonVisibility);
  mainWindow.on('focus', () => setTimeout(refreshScreenshotButtonVisibility, 100));
  mainWindow.on('hide', () => screenshotButtonWindow?.hide());
  mainWindow.on('minimize', (event) => {
    screenshotButtonWindow?.hide();
    if (settings.minimizeToTray) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
  mainWindow.on('close', (event) => {
    if (!isQuitting && settings.closeToTray) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
  mainWindow.on('closed', () => {
    screenshotButtonWindow?.destroy();
    screenshotButtonWindow = null;
    mainWindow = null;
  });

  mainWindow.loadURL(VIBE_URL);
  return mainWindow;
}

function buildApplicationMenu() {
  const text = uiText();
  const template = [
    {
      label: 'VibeZ',
      submenu: [
        { label: text.screenshot, accelerator: 'CommandOrControl+Shift+S', click: triggerScreenshot },
        { label: text.settings, accelerator: 'CommandOrControl+,', click: openSettings },
        { label: text.updates, click: () => checkForUpdates(true) },
        { label: text.about, click: showAbout },
        { type: 'separator' },
        { label: text.quit, accelerator: 'CommandOrControl+Q', click: quitApp },
      ],
    },
    { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: 'View', submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function trayTemplate() {
  const text = uiText();
  return [
    { label: text.open, click: ensureMainVisible },
    { label: text.screenshot, click: triggerScreenshot },
    { type: 'separator' },
    { label: text.settings, click: openSettings },
    { label: text.updates, click: () => checkForUpdates(true) },
    { label: text.about, click: showAbout },
    { type: 'separator' },
    { label: text.quit, click: quitApp },
  ];
}

function createTray() {
  if (tray) return;
  try {
    let image = nativeImage.createFromPath(path.join(__dirname, 'icon.png'));
    if (!image.isEmpty()) image = image.resize({ width: 22, height: 22 });
    tray = new Tray(image);
    tray.setToolTip(windowTitle());
    tray.on('click', ensureMainVisible);
    rebuildTray();
  } catch (error) {
    console.error('Could not create system tray icon:', error);
    tray = null;
  }
}

function rebuildTray() {
  if (!tray) return;
  tray.setContextMenu(Menu.buildFromTemplate(trayTemplate()));
  tray.setToolTip(windowTitle());
}

function quitApp() {
  isQuitting = true;
  app.quit();
}

function distroName() {
  try {
    const text = fs.readFileSync('/etc/os-release', 'utf8');
    const match = text.match(/^PRETTY_NAME=(.*)$/m);
    return match ? match[1].replace(/^"|"$/g, '') : 'Linux';
  } catch (_) {
    return 'Linux';
  }
}

function systemInfoText() {
  return [
    `VibeZ: ${app.getVersion()}`,
    `Electron: ${process.versions.electron}`,
    `Chromium: ${process.versions.chrome}`,
    `Node.js: ${process.versions.node}`,
    `OS: ${distroName()}`,
    `Kernel: ${os.release()}`,
    `Architecture: ${process.arch}`,
    `Session: ${process.env.XDG_SESSION_TYPE || 'unknown'}`,
    `Desktop: ${process.env.XDG_CURRENT_DESKTOP || 'unknown'}`,
    `Display backend setting: ${settings.displayBackend}`,
    `Hardware acceleration setting: ${settings.hardwareAcceleration}`,
    `Flatpak: ${process.env.FLATPAK_ID || 'no'}`,
    `AppImage: ${process.env.APPIMAGE ? 'yes' : 'no'}`,
  ].join('\n');
}

async function showAbout() {
  const result = await showMessageBox({
    type: 'info',
    title: `About ${windowTitle()}`,
    message: windowTitle(),
    detail: `Desktop client for Mistral Vibe\n\n${systemInfoText()}`,
    buttons: ['Copy system information', 'GitHub', 'Report a problem', 'Close'],
    defaultId: 3,
    cancelId: 3,
  });
  if (result.response === 0) clipboard.writeText(systemInfoText());
  if (result.response === 1) shell.openExternal(REPO_URL);
  if (result.response === 2) shell.openExternal(`${REPO_URL}/issues/new`);
  return true;
}

function openSettings() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
    return;
  }
  settingsWindow = new BrowserWindow({
    width: 820,
    height: 760,
    minWidth: 700,
    minHeight: 560,
    parent: mainWindow || undefined,
    title: 'VibeZ Settings',
    autoHideMenuBar: true,
    backgroundColor: '#111216',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'settings-preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  settingsWindow.setMenuBarVisibility(false);
  settingsWindow.loadFile(path.join(__dirname, 'settings.html'));
  settingsWindow.on('closed', () => { settingsWindow = null; });
}

function validSettingsSender(event) {
  return Boolean(settingsWindow && !settingsWindow.isDestroyed() && event.sender.id === settingsWindow.webContents.id);
}

function installIpcHandlers() {
  ipcMain.on('vibez:native-screenshot', (event) => {
    if (screenshotButtonWindow && !screenshotButtonWindow.isDestroyed() && event.sender.id === screenshotButtonWindow.webContents.id) triggerScreenshot();
  });

  ipcMain.handle('vibez:settings:get', (event) => {
    if (!validSettingsSender(event)) throw new Error('Unauthorized settings request.');
    return settings;
  });

  ipcMain.handle('vibez:settings:save', async (event, patch) => {
    if (!validSettingsSender(event)) throw new Error('Unauthorized settings request.');
    const previous = settings;
    settings = settingsStore.patch(patch);
    const restartRequired = previous.hardwareAcceleration !== settings.hardwareAcceleration || previous.displayBackend !== settings.displayBackend || previous.language !== settings.language;
    const shortcutRegistered = registerGlobalScreenshot();
    const autostartApplied = syncAutostart(settings.startAtLogin);
    applyZoom();
    autoUpdater.autoInstallOnAppQuit = Boolean(settings.installUpdatesOnQuit);
    refreshScreenshotButtonVisibility();
    suppressInjectedScreenshotButton();
    rebuildTray();
    buildApplicationMenu();
    return { settings, restartRequired, shortcutRegistered, autostartApplied };
  });

  ipcMain.handle('vibez:updates:check', (event) => {
    if (!validSettingsSender(event)) throw new Error('Unauthorized update request.');
    checkForUpdates(true);
    return true;
  });

  ipcMain.handle('vibez:about:show', (event) => {
    if (!validSettingsSender(event)) throw new Error('Unauthorized about request.');
    return showAbout();
  });

  ipcMain.handle('vibez:data:reset', async (event) => {
    if (!validSettingsSender(event)) throw new Error('Unauthorized data request.');
    const targetSession = mainWindow?.webContents.session || session.defaultSession;
    await targetSession.clearCache();
    await targetSession.clearStorageData();
    mainWindow?.reload();
    return true;
  });

  ipcMain.handle('vibez:external:open', (event, url) => {
    if (!validSettingsSender(event) || !isSafeExternalUrl(url)) throw new Error('Invalid external URL.');
    shell.openExternal(url);
    return true;
  });

  ipcMain.on('vibez:settings:close', (event) => {
    if (validSettingsSender(event)) settingsWindow?.close();
  });
}

function installUpdaterHandlers() {
  if (updaterHandlersInstalled) return;
  updaterHandlersInstalled = true;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = Boolean(settings.installUpdatesOnQuit);

  autoUpdater.on('update-available', (info) => console.log(`VibeZ update available: ${info.version}`));
  autoUpdater.on('update-not-available', () => {
    if (!manualUpdateCheck) return;
    manualUpdateCheck = false;
    showMessageBox({ type: 'info', title: 'VibeZ Updates', message: 'You already have the latest VibeZ version.' });
  });
  autoUpdater.on('error', (error) => {
    console.error('VibeZ updater error:', error);
    if (!manualUpdateCheck) return;
    manualUpdateCheck = false;
    showMessageBox({ type: 'error', title: 'VibeZ Updates', message: 'Could not check for updates.', detail: error.message });
  });
  autoUpdater.on('update-downloaded', async (info) => {
    manualUpdateCheck = false;
    const result = await showMessageBox({
      type: 'info',
      title: 'VibeZ update ready',
      message: `VibeZ ${info.version} is ready to install.`,
      detail: settings.installUpdatesOnQuit ? 'Restart now, or choose Later to install when VibeZ closes.' : 'Restart now to install the update, or choose Later.',
      buttons: ['Restart & update', 'Later'],
      defaultId: 0,
      cancelId: 1,
    });
    if (result.response === 0) {
      isQuitting = true;
      autoUpdater.quitAndInstall(false, true);
    }
  });
}

function checkForUpdates(manual = false) {
  manualUpdateCheck = Boolean(manual);
  if (!app.isPackaged) {
    if (manual) showMessageBox({ type: 'info', title: 'VibeZ Updates', message: 'Update checks are available in installed VibeZ builds.' });
    return;
  }
  if (process.env.FLATPAK_ID) {
    if (manual) showMessageBox({ type: 'info', title: 'VibeZ Updates', message: 'This is the Flatpak build.', detail: 'Open the VibeZ Releases page to install a newer Flatpak bundle.', buttons: ['Open Releases', 'Close'], defaultId: 0 }).then((result) => { if (result.response === 0) shell.openExternal(RELEASES_URL); });
    return;
  }
  installUpdaterHandlers();
  autoUpdater.checkForUpdates().catch((error) => {
    console.error('Update check failed:', error);
  });
}

function configureSessionSecurity() {
  const ses = session.defaultSession;
  ses.setPermissionCheckHandler((_webContents, _permission, requestingOrigin) => isTrustedMistralUrl(requestingOrigin));
  ses.setPermissionRequestHandler((webContents, _permission, callback, details) => {
    callback(isTrustedMistralUrl(details.requestingUrl || webContents.getURL()));
  });
}

function commandAction(argv) {
  const args = Array.isArray(argv) ? argv : [];
  if (args.includes('--screenshot')) return 'screenshot';
  if (args.includes('--settings')) return 'settings';
  const protocolUrl = args.find((arg) => typeof arg === 'string' && arg.startsWith(`${APP_PROTOCOL}://`));
  if (protocolUrl) {
    try {
      const parsed = new URL(protocolUrl);
      const action = `${parsed.hostname}${parsed.pathname}`.replace(/^\/+|\/+$/g, '').toLowerCase();
      if (action.startsWith('screenshot')) return 'screenshot';
      if (action.startsWith('settings')) return 'settings';
    } catch (_) {}
  }
  return 'open';
}

function handleCommandLine(argv) {
  const action = commandAction(argv);
  if (action === 'screenshot') triggerScreenshot();
  else if (action === 'settings') openSettings();
  else if (!(Array.isArray(argv) && argv.includes('--hidden'))) ensureMainVisible();
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, commandLine) => handleCommandLine(commandLine));
}

app.on('open-url', (event, url) => {
  event.preventDefault();
  handleCommandLine([url]);
});

app.whenReady().then(() => {
  if (!gotSingleInstanceLock) return;
  if (app.isPackaged) {
    try { app.setAsDefaultProtocolClient(APP_PROTOCOL); } catch (error) { console.error('Could not register vibez:// protocol:', error); }
  }
  configureSessionSecurity();
  installIpcHandlers();
  createMainWindow();
  createTray();
  buildApplicationMenu();
  registerGlobalScreenshot();
  syncAutostart(settings.startAtLogin);

  if (app.isPackaged) {
    installUpdaterHandlers();
    if (settings.autoUpdates && !process.env.FLATPAK_ID) checkForUpdates(false);
  }
});

app.on('before-quit', () => { isQuitting = true; });
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => {
  if (isQuitting || !settings.closeToTray) {
    isQuitting = true;
    app.quit();
  }
});
app.on('activate', () => {
  if (!mainWindow || mainWindow.isDestroyed()) createMainWindow();
  ensureMainVisible();
});
