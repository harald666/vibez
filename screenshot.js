const {
  BrowserWindow,
  clipboard,
  desktopCapturer,
  dialog,
  ipcMain,
  screen,
} = require('electron');
const path = require('path');

let mainWindow = null;
let buttonWindow = null;
let overlayWindows = [];
let captures = new Map();
let ipcRegistered = false;
let captureInProgress = false;

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
  if (
    captureInProgress ||
    !mainWindow ||
    mainWindow.isDestroyed() ||
    mainWindow.isMinimized() ||
    !mainWindow.isVisible()
  ) {
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
  captureInProgress = false;
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (!mainWindow.isVisible()) mainWindow.show();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
  setTimeout(showButton, 80);
}

function closeOverlays(restore = true) {
  const windows = overlayWindows.slice();
  overlayWindows = [];
  captures.clear();

  for (const win of windows) {
    if (!win || win.isDestroyed()) continue;
    win.removeAllListeners('closed');
    win.close();
  }

  if (restore) restoreMain();
}

async function getCaptureForDisplay(display, displayIndex) {
  const factor = display.scaleFactor || 1;
  const thumbnailSize = {
    width: Math.max(1, Math.round(display.bounds.width * factor)),
    height: Math.max(1, Math.round(display.bounds.height * factor)),
  };

  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize,
    fetchWindowIcons: false,
  });

  let source = sources.find((item) => String(item.display_id) === String(display.id));

  // Some Linux capture backends do not expose display_id. Fall back to the
  // left-to-right display/source order rather than silently choosing source 0.
  if (!source && displayIndex >= 0 && displayIndex < sources.length) {
    source = sources[displayIndex];
  }

  if (!source || source.thumbnail.isEmpty()) {
    throw new Error(`Geen schermbron beschikbaar voor scherm ${displayIndex + 1}.`);
  }

  return source.thumbnail;
}

async function createOverlay(display, image) {
  const overlay = new BrowserWindow({
    ...display.bounds,
    show: false,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  overlayWindows.push(overlay);
  captures.set(overlay.webContents.id, { display, image });

  overlay.on('closed', () => {
    overlayWindows = overlayWindows.filter((win) => win !== overlay);
    captures.delete(overlay.webContents.id);
    if (captureInProgress && overlayWindows.length === 0) restoreMain();
  });

  await overlay.loadFile(path.join(__dirname, 'screenshot-overlay.html'));
  await overlay.webContents.executeJavaScript(
    `window.__vibezSetScreenshot(${JSON.stringify(image.toDataURL())});`
  );

  return overlay;
}

async function startScreenshot() {
  if (!mainWindow || mainWindow.isDestroyed() || captureInProgress) return;

  captureInProgress = true;

  try {
    const displays = getOrderedDisplays();
    if (!displays.length) throw new Error('Geen beeldschermen gevonden.');

    // Keep VibeZ visible. Hide only the floating camera button so it is not
    // included in the frozen desktop image.
    if (buttonWindow && !buttonWindow.isDestroyed()) buttonWindow.hide();
    await wait(90);

    const frozenDisplays = [];
    for (let index = 0; index < displays.length; index += 1) {
      const display = displays[index];
      const image = await getCaptureForDisplay(display, index);
      frozenDisplays.push({ display, image });
    }

    const overlays = [];
    for (const frozen of frozenDisplays) {
      overlays.push(await createOverlay(frozen.display, frozen.image));
    }

    // Show all overlays together. The desktop now behaves like one global
    // screenshot-selection mode: just move to either monitor and drag.
    for (const overlay of overlays) overlay.showInactive();

    const cursorDisplay = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    const active = overlays.find((overlay) => {
      const capture = captures.get(overlay.webContents.id);
      return capture && String(capture.display.id) === String(cursorDisplay.id);
    }) || overlays[0];

    if (active && !active.isDestroyed()) active.focus();
  } catch (error) {
    console.error('Schermafdruk mislukt:', error);
    closeOverlays(false);
    restoreMain();
    dialog.showMessageBox({
      type: 'error',
      title: 'Schermafdruk mislukt',
      message: 'VibeZ kon geen schermafdruk maken.',
      detail: error.message,
    });
  }
}

function crop(capture, rect) {
  if (!capture || !rect) return null;
  const { image, display } = capture;
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
    if (fromMain || fromButton) startScreenshot();
  });

  ipcMain.on('vibez:screenshot:finish', async (event, rect) => {
    const capture = captures.get(event.sender.id);
    if (!capture) return;

    const image = crop(capture, rect);
    closeOverlays(false);
    restoreMain();
    if (image && !image.isEmpty()) await attach(image);
  });

  ipcMain.on('vibez:screenshot:cancel', (event) => {
    if (captures.has(event.sender.id)) closeOverlays(true);
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
      startScreenshot();
    }
  });
}

module.exports = { setupScreenshot };
