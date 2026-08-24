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
        const BUTTON_ID = 'vibez-screenshot-button';

        const visible = (element) => {
          if (!element || !element.isConnected) return false;
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
        };

        const findIncognito = () => {
          const directSelectors = [
            'button[aria-label*="incognito" i]',
            '[role="button"][aria-label*="incognito" i]',
            'button[title*="incognito" i]',
            '[role="button"][title*="incognito" i]',
            '[data-testid*="incognito" i]'
          ];

          for (const selector of directSelectors) {
            const found = [...document.querySelectorAll(selector)].find((element) => element.id !== BUTTON_ID && visible(element));
            if (found) return found.closest('button,[role="button"]') || found;
          }

          const textNodes = [...document.querySelectorAll('button,[role="button"],span,div')]
            .filter((element) => element.id !== BUTTON_ID && visible(element));

          for (const element of textNodes) {
            const text = (element.innerText || element.textContent || '').replace(/\\s+/g, ' ').trim().toLowerCase();
            if (!text || (!text.includes('incognito') && !text.includes('private'))) continue;
            const clickable = element.closest('button,[role="button"]');
            if (clickable && clickable.id !== BUTTON_ID && visible(clickable)) return clickable;
          }

          return null;
        };

        const createButton = () => {
          let button = document.getElementById(BUTTON_ID);
          if (button) return button;

          button = document.createElement('button');
          button.id = BUTTON_ID;
          button.type = 'button';
          button.setAttribute('aria-label', 'Screenshot');
          button.setAttribute('title', 'Screenshot (Ctrl+Shift+S)');
          button.innerHTML = '<span aria-hidden="true" style="display:inline-flex;align-items:center;justify-content:center"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7.5 7.5 9 5.5h6l1.5 2H19a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9.5a2 2 0 0 1 2-2h2.5Z"></path><circle cx="12" cy="13" r="3.25"></circle></svg></span><span>Screenshot</span>';

          Object.assign(button.style, {
            position: 'fixed',
            zIndex: '2147483646',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '7px',
            minWidth: '112px',
            height: '36px',
            padding: '0 12px',
            margin: '0',
            borderRadius: '9px',
            border: '1px solid rgba(255,255,255,.10)',
            background: 'rgba(30,30,30,.92)',
            color: 'rgba(255,255,255,.92)',
            fontFamily: 'inherit',
            fontSize: '13px',
            fontWeight: '500',
            lineHeight: '1',
            letterSpacing: '0',
            boxShadow: '0 2px 8px rgba(0,0,0,.18)',
            cursor: 'pointer',
            pointerEvents: 'auto',
            whiteSpace: 'nowrap',
            transition: 'filter .12s ease, transform .12s ease, background-color .12s ease'
          });

          button.addEventListener('mouseenter', () => {
            button.style.filter = 'brightness(1.12)';
          });
          button.addEventListener('mouseleave', () => {
            button.style.filter = '';
            button.style.transform = '';
          });
          button.addEventListener('mousedown', () => {
            button.style.transform = 'scale(.98)';
          });
          button.addEventListener('mouseup', () => {
            button.style.transform = '';
          });
          button.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            window.vibez?.captureScreenshot();
          }, true);

          document.body.appendChild(button);
          return button;
        };

        const matchStyleAndPosition = () => {
          const button = createButton();
          const incognito = findIncognito();

          if (incognito) {
            const rect = incognito.getBoundingClientRect();
            const style = getComputedStyle(incognito);
            const height = Math.max(32, Math.min(44, Math.round(rect.height || 36)));
            const width = Math.max(112, Math.min(142, Math.round(rect.width || 112)));

            button.style.height = height + 'px';
            button.style.minWidth = width + 'px';
            button.style.fontFamily = style.fontFamily || 'inherit';
            button.style.fontSize = style.fontSize || '13px';
            button.style.fontWeight = style.fontWeight || '500';
            button.style.color = style.color || 'rgba(255,255,255,.92)';
            button.style.background = style.backgroundColor && style.backgroundColor !== 'rgba(0, 0, 0, 0)'
              ? style.backgroundColor
              : 'rgba(30,30,30,.92)';
            button.style.borderRadius = style.borderRadius || '9px';
            button.style.borderTop = style.borderTop || '1px solid rgba(255,255,255,.10)';
            button.style.borderRight = style.borderRight || '1px solid rgba(255,255,255,.10)';
            button.style.borderBottom = style.borderBottom || '1px solid rgba(255,255,255,.10)';
            button.style.borderLeft = style.borderLeft || '1px solid rgba(255,255,255,.10)';
            button.style.boxShadow = style.boxShadow !== 'none' ? style.boxShadow : '0 2px 8px rgba(0,0,0,.18)';

            let left = Math.round(rect.right + 8);
            if (left + width > window.innerWidth - 8) left = Math.round(rect.left - width - 8);

            button.style.left = Math.max(8, left) + 'px';
            button.style.right = 'auto';
            button.style.top = Math.max(8, Math.round(rect.top + (rect.height - height) / 2)) + 'px';
            button.dataset.vibezAnchored = '1';
          } else {
            // Fallback: the button always remains available, even while Vibe is rerendering.
            button.style.left = 'auto';
            button.style.right = '18px';
            button.style.top = '68px';
            button.style.height = '36px';
            button.style.minWidth = '112px';
            button.dataset.vibezAnchored = '0';
          }

          return true;
        };

        window.__vibezEnsureScreenshotButton = matchStyleAndPosition;
        window.__vibezSetScreenshotButtonVisible = (show) => {
          const button = document.getElementById(BUTTON_ID);
          if (!button) return;
          button.style.visibility = show ? 'visible' : 'hidden';
        };

        if (!window.__vibezScreenshotUiInstalled) {
          window.__vibezScreenshotUiInstalled = true;

          let queued = false;
          const schedule = () => {
            if (queued) return;
            queued = true;
            requestAnimationFrame(() => {
              queued = false;
              matchStyleAndPosition();
            });
          };

          const observer = new MutationObserver(schedule);
          observer.observe(document.documentElement, { childList: true, subtree: true });
          window.addEventListener('resize', schedule, { passive: true });
          window.addEventListener('scroll', schedule, { passive: true, capture: true });
          setInterval(schedule, 1500);
        }

        matchStyleAndPosition();
      })();
    `);
  } catch (error) {
    console.error('Kon Screenshot-knop niet in Vibe plaatsen:', error);
  }
}

async function setScreenshotButtonVisible(show) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    await mainWindow.webContents.executeJavaScript(`window.__vibezSetScreenshotButtonVisible?.(${show ? 'true' : 'false'});`);
  } catch (_) {
    // The page can be navigating while visibility is restored; the installer will recreate it.
  }
}

function restoreMain() {
  captureInProgress = false;
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (!mainWindow.isVisible()) mainWindow.show();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
  setScreenshotButtonVisible(true);
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

    await setScreenshotButtonVisible(false);
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
