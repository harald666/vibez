const { BrowserWindow, clipboard, desktopCapturer, dialog, ipcMain, screen } = require('electron');
const path = require('path');

let mainWindow = null;
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

// Chromium's Linux screen-capture fallback normally exposes the primary screen
// first. Physical left-to-right order can be different, which made two monitors
// appear swapped in the selection overlay.
function getCaptureOrderedDisplays() {
  const displays = getOrderedDisplays();
  const primaryId = String(screen.getPrimaryDisplay().id);
  const primary = displays.find((display) => String(display.id) === primaryId);
  const others = displays.filter((display) => String(display.id) !== primaryId);
  return primary ? [primary, ...others] : displays;
}

async function installScreenshotButton() {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  try {
    await mainWindow.webContents.executeJavaScript(`
      (() => {
        if (window.__vibezScreenshotUiInstalled) {
          window.__vibezEnsureScreenshotButton?.();
          return;
        }

        window.__vibezScreenshotUiInstalled = true;

        const findIncognito = () => {
          const candidates = [...document.querySelectorAll('button,[role="button"]')];
          return candidates.find((element) => {
            const text = (element.innerText || element.textContent || '').trim().toLowerCase();
            const label = (element.getAttribute('aria-label') || '').trim().toLowerCase();
            const title = (element.getAttribute('title') || '').trim().toLowerCase();
            return text.includes('incognito') || label.includes('incognito') || title.includes('incognito');
          });
        };

        const makeButton = (incognito) => {
          const button = incognito.cloneNode(true);
          button.id = 'vibez-screenshot-button';
          button.removeAttribute('aria-pressed');
          button.removeAttribute('data-state');
          button.removeAttribute('title');
          button.setAttribute('type', 'button');
          button.setAttribute('aria-label', 'Screenshot');
          button.setAttribute('title', 'Screenshot (Ctrl+Shift+S)');

          while (button.firstChild) button.removeChild(button.firstChild);

          const iconWrap = document.createElement('span');
          iconWrap.setAttribute('aria-hidden', 'true');
          iconWrap.style.display = 'inline-flex';
          iconWrap.style.alignItems = 'center';
          iconWrap.style.justifyContent = 'center';
          iconWrap.style.flexShrink = '0';
          iconWrap.style.color = 'currentColor';
          iconWrap.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7.5 7.5 9 5.5h6l1.5 2H19a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9.5a2 2 0 0 1 2-2h2.5Z"></path><circle cx="12" cy="13" r="3.25"></circle></svg>';

          const label = document.createElement('span');
          label.textContent = 'Screenshot';

          button.append(iconWrap, label);
          button.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            window.vibez?.captureScreenshot();
          });

          return button;
        };

        const ensureButton = () => {
          const existing = document.getElementById('vibez-screenshot-button');
          if (existing && existing.isConnected) return true;

          const incognito = findIncognito();
          if (!incognito || !incognito.parentElement) return false;

          const button = makeButton(incognito);
          incognito.insertAdjacentElement('afterend', button);
          return true;
        };

        window.__vibezEnsureScreenshotButton = ensureButton;
        ensureButton();

        let queued = false;
        const observer = new MutationObserver(() => {
          if (queued) return;
          queued = true;
          requestAnimationFrame(() => {
            queued = false;
            ensureButton();
          });
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
      })();
    `);
  } catch (error) {
    console.error('Kon Screenshot-knop niet in Vibe plaatsen:', error);
  }
}

function restoreMain() {
  captureInProgress = false;
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (!mainWindow.isVisible()) mainWindow.show();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
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

async function getCaptureForDisplay(display) {
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

  // Some Linux backends leave display_id empty. Match Chromium's source order:
  // primary monitor first, then the remaining monitors. This prevents the frozen
  // images from being painted onto the opposite physical monitor.
  if (!source) {
    const captureOrder = getCaptureOrderedDisplays();
    const index = captureOrder.findIndex((item) => String(item.id) === String(display.id));
    if (index >= 0 && index < sources.length) source = sources[index];
  }

  if (!source || source.thumbnail.isEmpty()) throw new Error('Geen schermbron beschikbaar voor dit scherm.');
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
  await overlay.webContents.executeJavaScript(`window.__vibezSetScreenshot(${JSON.stringify(image.toDataURL())});`);
  return overlay;
}

async function startScreenshot() {
  if (!mainWindow || mainWindow.isDestroyed() || captureInProgress) return;
  captureInProgress = true;

  try {
    const displays = getOrderedDisplays();
    if (!displays.length) throw new Error('Geen beeldschermen gevonden.');

    await wait(90);

    const frozenDisplays = [];
    for (const display of displays) {
      frozenDisplays.push({ display, image: await getCaptureForDisplay(display) });
    }

    const overlays = [];
    for (const frozen of frozenDisplays) overlays.push(await createOverlay(frozen.display, frozen.image));
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
    if (fromMain) startScreenshot();
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
    installScreenshotButton();
  });

  win.webContents.on('did-navigate-in-page', () => {
    installScreenshotButton();
  });

  win.webContents.on('before-input-event', (event, input) => {
    if (input.control && input.shift && String(input.key || '').toLowerCase() === 's') {
      event.preventDefault();
      startScreenshot();
    }
  });
}

module.exports = { setupScreenshot };
