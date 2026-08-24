const {
  BrowserWindow,
  Menu,
  clipboard,
  desktopCapturer,
  dialog,
  ipcMain,
  screen,
} = require('electron');
const path = require('path');

let mainWindow = null;
let buttonWindow = null;
let overlayWindow = null;
let captured = null;
let ipcRegistered = false;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function getOrderedDisplays() {
  return screen.getAllDisplays().slice().sort((a, b) => {
    if (a.bounds.x !== b.bounds.x) return a.bounds.x - b.bounds.x;
    return a.bounds.y - b.bounds.y;
  });
}

function positionButton() {
  if (!mainWindow || mainWindow.isDestroyed() || !buttonWindow || buttonWindow.isDestroyed()) return;
  const b = mainWindow.getBounds();
  buttonWindow.setBounds({
    x: Math.round(b.x + b.width - 70),
    y: Math.round(b.y + b.height - 140),
    width: 52,
    height: 52,
  });
}

function showButton() {
  if (!buttonWindow || buttonWindow.isDestroyed()) return;
  positionButton();
  if (!mainWindow || mainWindow.isDestroyed() || mainWindow.isMinimized() || !mainWindow.isVisible()) {
    buttonWindow.hide();
    return;
  }
  buttonWindow.showInactive();
}

async function ensureButtonWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (buttonWindow && !buttonWindow.isDestroyed()) {
    showButton();
    return;
  }

  buttonWindow = new BrowserWindow({
    parent: mainWindow,
    width: 52,
    height: 52,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  buttonWindow.on('closed', () => {
    buttonWindow = null;
  });

  await buttonWindow.loadFile(path.join(__dirname, 'screenshot-button.html'));
  showButton();
}

function restoreMain() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (!mainWindow.isVisible()) mainWindow.show();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
  setTimeout(showButton, 80);
}

function closeOverlay(restore = true) {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    const win = overlayWindow;
    overlayWindow = null;
    captured = null;
    win.removeAllListeners('closed');
    win.close();
  }
  if (restore) restoreMain();
}

function chooseScreenshotDisplay() {
  if (!mainWindow || mainWindow.isDestroyed() || overlayWindow) return;

  const displays = getOrderedDisplays();
  if (displays.length <= 1) {
    startScreenshot(displays[0]);
    return;
  }

  const primaryId = String(screen.getPrimaryDisplay().id);
  const vibeDisplayId = String(screen.getDisplayMatching(mainWindow.getBounds()).id);

  const template = displays.map((display, index) => {
    const notes = [];
    if (String(display.id) === primaryId) notes.push('primair');
    if (String(display.id) === vibeDisplayId) notes.push('VibeZ');
    const suffix = notes.length ? ` (${notes.join(', ')})` : '';

    return {
      label: `Scherm ${index + 1} — ${display.bounds.width}×${display.bounds.height}${suffix}`,
      click: () => startScreenshot(display),
    };
  });

  const menu = Menu.buildFromTemplate(template);
  const owner = buttonWindow && !buttonWindow.isDestroyed() ? buttonWindow : mainWindow;
  menu.popup({ window: owner });
}

async function startScreenshot(selectedDisplay) {
  if (!mainWindow || mainWindow.isDestroyed() || overlayWindow) return;

  try {
    const display = selectedDisplay || screen.getDisplayMatching(mainWindow.getBounds());
    const factor = display.scaleFactor || 1;
    const size = {
      width: Math.round(display.bounds.width * factor),
      height: Math.round(display.bounds.height * factor),
    };

    // Hide only our floating camera button. Keep the actual VibeZ window visible
    // until after desktopCapturer has frozen the screen, so every part of VibeZ
    // can itself be selected in the screenshot.
    if (buttonWindow && !buttonWindow.isDestroyed()) buttonWindow.hide();
    await wait(90);

    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: size,
      fetchWindowIcons: false,
    });

    let source = sources.find((s) => String(s.display_id) === String(display.id));

    // Some Linux capture backends do not expose display_id. In that case map the
    // chosen monitor to the corresponding screen source instead of always using
    // sources[0], which could silently capture the other monitor.
    if (!source) {
      const displays = getOrderedDisplays();
      const displayIndex = displays.findIndex((d) => String(d.id) === String(display.id));
      if (displayIndex >= 0) source = sources[displayIndex];
    }

    if (!source) source = sources[0];
    if (!source || source.thumbnail.isEmpty()) throw new Error('Geen schermbron beschikbaar.');

    captured = { display, image: source.thumbnail };
    overlayWindow = new BrowserWindow({
      ...display.bounds,
      show: false,
      frame: false,
      resizable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    overlayWindow.on('closed', () => {
      overlayWindow = null;
      captured = null;
      restoreMain();
    });

    await overlayWindow.loadFile(path.join(__dirname, 'screenshot-overlay.html'));
    await overlayWindow.webContents.executeJavaScript(
      `window.__vibezSetScreenshot(${JSON.stringify(captured.image.toDataURL())});`
    );
    overlayWindow.show();
    overlayWindow.focus();
  } catch (error) {
    console.error('Schermafdruk mislukt:', error);
    closeOverlay(false);
    restoreMain();
    dialog.showMessageBox({
      type: 'error',
      title: 'Schermafdruk mislukt',
      message: 'VibeZ kon geen schermafdruk maken.',
      detail: error.message,
    });
  }
}

function crop(rect) {
  if (!captured || !rect) return null;
  const { image, display } = captured;
  const pixels = image.getSize();
  const sx = pixels.width / display.bounds.width;
  const sy = pixels.height / display.bounds.height;
  const x = Math.max(0, Math.round(Number(rect.x) * sx));
  const y = Math.max(0, Math.round(Number(rect.y) * sy));
  const width = Math.min(pixels.width - x, Math.max(1, Math.round(Number(rect.width) * sx)));
  const height = Math.min(pixels.height - y, Math.max(1, Math.round(Number(rect.height) * sy)));
  if (![x, y, width, height].every(Number.isFinite) || width < 2 || height < 2) return null;
  return image.crop({ x, y, width, height });
}

async function focusComposer() {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  try {
    return await mainWindow.webContents.executeJavaScript(`
      (() => {
        const candidates = [...document.querySelectorAll('textarea,[contenteditable="true"],[role="textbox"]')]
          .filter(el => {
            const r = el.getBoundingClientRect();
            const s = getComputedStyle(el);
            return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden';
          });
        const editor = candidates.at(-1);
        if (!editor) return false;
        editor.focus();
        return true;
      })();
    `);
  } catch (error) {
    console.error('Kon chatinvoer niet focussen:', error);
    return false;
  }
}

async function attach(image) {
  if (!mainWindow || mainWindow.isDestroyed() || !image || image.isEmpty()) return;

  restoreMain();
  clipboard.writeImage(image);

  // Do not serialize the PNG into a giant JavaScript/base64 string. Large or
  // detailed captures could exceed renderer/DOM limits. Web chat clients already
  // support image paste, so put the native image on the clipboard and paste it.
  await wait(120);
  await focusComposer();
  await wait(80);
  mainWindow.webContents.paste();
}

function registerIpc() {
  if (ipcRegistered) return;
  ipcRegistered = true;

  ipcMain.on('vibez:screenshot:start', (event) => {
    const fromMain = mainWindow && event.sender.id === mainWindow.webContents.id;
    const fromButton = buttonWindow && event.sender.id === buttonWindow.webContents.id;
    if (fromMain || fromButton) chooseScreenshotDisplay();
  });

  ipcMain.on('vibez:screenshot:finish', async (event, rect) => {
    if (!overlayWindow || event.sender.id !== overlayWindow.webContents.id) return;
    const image = crop(rect);
    closeOverlay(false);
    restoreMain();
    if (image && !image.isEmpty()) await attach(image);
  });

  ipcMain.on('vibez:screenshot:cancel', (event) => {
    if (overlayWindow && event.sender.id === overlayWindow.webContents.id) closeOverlay(true);
  });
}

function setupScreenshot(win) {
  mainWindow = win;
  registerIpc();

  win.webContents.on('did-finish-load', () => {
    ensureButtonWindow().catch((error) => console.error('Kon schermafdrukknop niet openen:', error));
  });

  win.on('move', positionButton);
  win.on('resize', positionButton);
  win.on('minimize', () => buttonWindow && !buttonWindow.isDestroyed() && buttonWindow.hide());
  win.on('restore', showButton);
  win.on('show', showButton);
  win.on('hide', () => buttonWindow && !buttonWindow.isDestroyed() && buttonWindow.hide());

  win.webContents.on('before-input-event', (event, input) => {
    if (input.control && input.shift && String(input.key || '').toLowerCase() === 's') {
      event.preventDefault();
      chooseScreenshotDisplay();
    }
  });
}

module.exports = { setupScreenshot };
