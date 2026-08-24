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
let overlayWindow = null;
let captured = null;
let ipcRegistered = false;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

async function startScreenshot() {
  if (!mainWindow || mainWindow.isDestroyed() || overlayWindow) return;

  try {
    const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    const factor = display.scaleFactor || 1;
    const size = {
      width: Math.round(display.size.width * factor),
      height: Math.round(display.size.height * factor),
    };

    if (buttonWindow && !buttonWindow.isDestroyed()) buttonWindow.hide();
    mainWindow.hide();
    await wait(250);

    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: size,
      fetchWindowIcons: false,
    });
    const source = sources.find((s) => String(s.display_id) === String(display.id)) || sources[0];
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

async function attach(image) {
  if (!mainWindow || mainWindow.isDestroyed() || !image || image.isEmpty()) return;
  restoreMain();
  clipboard.writeImage(image);
  const dataUrl = image.toDataURL();
  const fileName = `vibez-screenshot-${Date.now()}.png`;

  try {
    const result = await mainWindow.webContents.executeJavaScript(`
      (() => {
        const binary = atob(${JSON.stringify(dataUrl)}.split(',')[1] || '');
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const file = new File([bytes], ${JSON.stringify(fileName)}, { type: 'image/png' });
        const inputs = [...document.querySelectorAll('input[type="file"]')].filter(i => !i.disabled);
        const input = inputs.find(i => {
          const accept = (i.accept || '').toLowerCase();
          return !accept || accept.includes('image') || accept.includes('*');
        }) || inputs[0];
        if (input) {
          const dt = new DataTransfer();
          dt.items.add(file);
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'files')?.set;
          if (setter) setter.call(input, dt.files);
          else Object.defineProperty(input, 'files', { configurable: true, value: dt.files });
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
        const editors = [...document.querySelectorAll('textarea,[contenteditable="true"]')]
          .filter(el => {
            const r = el.getBoundingClientRect();
            const s = getComputedStyle(el);
            return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden';
          });
        editors.at(-1)?.focus();
        return false;
      })();
    `);
    if (!result) mainWindow.webContents.paste();
  } catch (error) {
    console.error('Schermafdruk toevoegen mislukt:', error);
    mainWindow.webContents.paste();
  }
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
      startScreenshot();
    }
  });
}

module.exports = { setupScreenshot };
