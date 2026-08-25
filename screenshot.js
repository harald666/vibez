const { BrowserWindow, clipboard, desktopCapturer, dialog, ipcMain, screen } = require('electron');
const path = require('path');

let mainWindow = null;
let overlayWindows = [];
let captures = new Map();
let ipcRegistered = false;
let captureInProgress = false;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const screenshotTranslations = {
  nl: { label: 'Screenshot', noSource: 'Geen schermbron beschikbaar voor dit scherm.', noDisplays: 'Geen beeldschermen gevonden.', failedTitle: 'Schermafdruk mislukt', failedMessage: 'VibeZ kon geen schermafdruk maken.', selectionTitle: 'Schermafdruk selecteren', selectionHint: 'Sleep over het gebied dat je wilt delen · Esc = annuleren' },
  de: { label: 'Screenshot', noSource: 'Für diesen Bildschirm ist keine Bildschirmquelle verfügbar.', noDisplays: 'Keine Bildschirme gefunden.', failedTitle: 'Screenshot fehlgeschlagen', failedMessage: 'VibeZ konnte keinen Screenshot erstellen.', selectionTitle: 'Screenshot auswählen', selectionHint: 'Ziehe über den Bereich, den du teilen möchtest · Esc = Abbrechen' },
  fr: { label: 'Capture', noSource: 'Aucune source d’écran n’est disponible pour cet écran.', noDisplays: 'Aucun écran trouvé.', failedTitle: 'Échec de la capture', failedMessage: 'VibeZ n’a pas pu créer de capture d’écran.', selectionTitle: 'Sélectionner une capture', selectionHint: 'Faites glisser sur la zone à partager · Échap = annuler' },
  es: { label: 'Captura', noSource: 'No hay una fuente de pantalla disponible para esta pantalla.', noDisplays: 'No se encontraron pantallas.', failedTitle: 'Error de captura', failedMessage: 'VibeZ no pudo crear una captura de pantalla.', selectionTitle: 'Seleccionar captura', selectionHint: 'Arrastra sobre el área que quieres compartir · Esc = cancelar' },
  it: { label: 'Schermata', noSource: 'Nessuna sorgente dello schermo disponibile per questo display.', noDisplays: 'Nessuno schermo trovato.', failedTitle: 'Acquisizione non riuscita', failedMessage: 'VibeZ non è riuscito a creare una schermata.', selectionTitle: 'Seleziona schermata', selectionHint: 'Trascina sull’area che vuoi condividere · Esc = annulla' },
  pt: { label: 'Captura', noSource: 'Não existe uma fonte de ecrã disponível para este monitor.', noDisplays: 'Não foram encontrados ecrãs.', failedTitle: 'Falha na captura', failedMessage: 'O VibeZ não conseguiu criar uma captura de ecrã.', selectionTitle: 'Selecionar captura', selectionHint: 'Arraste sobre a área que pretende partilhar · Esc = cancelar' },
  en: { label: 'Screenshot', noSource: 'No screen source is available for this display.', noDisplays: 'No displays found.', failedTitle: 'Screenshot failed', failedMessage: 'VibeZ could not create a screenshot.', selectionTitle: 'Select screenshot', selectionHint: 'Drag over the area you want to share · Esc = cancel' }
};

function screenshotText(language) {
  const languageCode = String(language || 'en').toLowerCase().split('-')[0];
  return screenshotTranslations[languageCode] || screenshotTranslations.en;
}

async function getPageLanguage() {
  if (!mainWindow || mainWindow.isDestroyed()) return 'en';
  try {
    return await mainWindow.webContents.executeJavaScript('navigator.language || document.documentElement.lang || "en"');
  } catch (_) {
    return 'en';
  }
}

function getOrderedDisplays() {
  return screen.getAllDisplays().slice().sort((a, b) => {
    if (a.bounds.x !== b.bounds.x) return a.bounds.x - b.bounds.x;
    return a.bounds.y - b.bounds.y;
  });
}

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
        const GAP = 10;
        const locale = String(navigator.language || document.documentElement.lang || 'en').toLowerCase().split('-')[0];
        const labels = { nl: 'Screenshot', de: 'Screenshot', fr: 'Capture', es: 'Captura', it: 'Schermata', pt: 'Captura', en: 'Screenshot' };
        const screenshotLabel = labels[locale] || labels.en;

        const visible = (element) => {
          if (!element || !element.isConnected) return false;
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
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

        const isAuthenticationPage = () => {
          const title = (document.title || '').trim().toLowerCase();
          const hasEmailInput = Boolean(document.querySelector('input[type="email"], input[autocomplete="email"], input[name*="email" i]'));
          const bodyText = (document.body?.innerText || '').replace(/\\s+/g, ' ').toLowerCase();
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

        const findAuthControls = () => {
          const nodes = [...document.querySelectorAll('button,[role="button"],a,span,p')]
            .filter((element) => element.id !== BUTTON_ID && visible(element))
            .map((element) => ({ element, text: textOf(element), rect: element.getBoundingClientRect() }))
            .filter((item) => item.rect.top >= 0 && item.rect.top < Math.min(130, window.innerHeight * 0.3));

          const signUpLabels = new Set(['aanmelden', 'sign up', 'register', 'registreren', 'create account']);
          const signInLabels = new Set(['inloggen', 'login', 'log in', 'sign in']);

          const signUp = nodes
            .filter((item) => signUpLabels.has(item.text))
            .sort((a, b) => (a.rect.width * a.rect.height) - (b.rect.width * b.rect.height))[0] || null;

          const signIn = nodes
            .filter((item) => signInLabels.has(item.text))
            .sort((a, b) => (a.rect.width * a.rect.height) - (b.rect.width * b.rect.height))[0] || null;

          if (!signUp && !signIn) return null;
          return { signUp, signIn, sizeSource: signUp || signIn };
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

          const textNodes = [...document.querySelectorAll('button,[role="button"],span,div,svg')]
            .filter((element) => element.id !== BUTTON_ID && visible(element));

          for (const element of textNodes) {
            const text = textOf(element);
            if (!text || (!text.includes('incognito') && !text.includes('private'))) continue;
            const clickable = element.closest('button,[role="button"]');
            if (clickable && clickable.id !== BUTTON_ID && visible(clickable)) return clickable;
          }

          const topRightActions = [...document.querySelectorAll('button,[role="button"]')]
            .filter((element) => {
              if (element.id === BUTTON_ID || !visible(element)) return false;
              const text = textOf(element);
              if (['aanmelden', 'inloggen', 'login', 'log in', 'sign in', 'sign up', 'register'].some((label) => text.includes(label))) return false;
              const rect = element.getBoundingClientRect();
              return rect.top >= 0 &&
                rect.top < Math.min(140, window.innerHeight * 0.35) &&
                rect.right > window.innerWidth - Math.min(170, window.innerWidth * 0.55) &&
                rect.width >= 16 && rect.width <= 72 &&
                rect.height >= 16 && rect.height <= 72;
            })
            .sort((a, b) => {
              const ar = a.getBoundingClientRect();
              const br = b.getBoundingClientRect();
              return (br.right - ar.right) || (ar.top - br.top);
            });

          return topRightActions[0] || null;
        };

        const createButton = () => {
          let button = document.getElementById(BUTTON_ID);
          if (button) return button;

          button = document.createElement('button');
          button.id = BUTTON_ID;
          button.type = 'button';
          button.setAttribute('aria-label', screenshotLabel);
          button.setAttribute('title', screenshotLabel + ' (Ctrl+Shift+S)');
          button.innerHTML = '<span aria-hidden="true" style="display:inline-flex;align-items:center;justify-content:center"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7.5 7.5 9 5.5h6l1.5 2H19a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9.5a2 2 0 0 1 2-2h2.5Z"></path><circle cx="12" cy="13" r="3.25"></circle></svg></span><span>' + screenshotLabel + '</span>';

          Object.assign(button.style, {
            position: 'fixed',
            zIndex: '2147483646',
            display: 'inline-flex',
            boxSizing: 'border-box',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '7px',
            minWidth: '118px',
            height: '36px',
            padding: '0 12px',
            margin: '0',
            borderRadius: '10px',
            border: '1px solid rgba(255,255,255,.12)',
            background: 'linear-gradient(135deg, rgba(122,37,53,.98) 0%, rgba(168,49,58,.98) 55%, rgba(245,96,55,.98) 100%)',
            color: '#fff7f4',
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: '13px',
            fontWeight: '600',
            lineHeight: '1',
            letterSpacing: '.01em',
            boxShadow: '0 10px 26px rgba(128, 28, 34, .28), 0 3px 10px rgba(0,0,0,.12)',
            cursor: 'pointer',
            pointerEvents: 'auto',
            whiteSpace: 'nowrap',
            transition: 'transform .12s ease, filter .12s ease, box-shadow .12s ease'
          });

          button.addEventListener('mouseenter', () => {
            button.style.filter = 'brightness(1.06) saturate(1.05)';
            button.style.boxShadow = '0 12px 30px rgba(128, 28, 34, .32), 0 5px 14px rgba(0,0,0,.16)';
          });
          button.addEventListener('mouseleave', () => {
            button.style.filter = '';
            button.style.transform = '';
            button.style.boxShadow = '0 10px 26px rgba(128, 28, 34, .28), 0 3px 10px rgba(0,0,0,.12)';
          });
          button.addEventListener('mousedown', () => { button.style.transform = 'scale(.985)'; });
          button.addEventListener('mouseup', () => { button.style.transform = ''; });
          button.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            window.vibez?.captureScreenshot();
          }, true);

          document.body.appendChild(button);
          return button;
        };

        const setLoggedInSize = (button) => {
          button.style.width = 'auto';
          button.style.minWidth = '118px';
          button.style.height = '36px';
          button.style.padding = '0 12px';
          button.style.gap = '7px';
          button.style.fontSize = '13px';
        };

        const setLoggedOutSize = (button, referenceRect) => {
          const width = Math.max(94, Math.round(referenceRect.width) + 6);
          const height = Math.max(34, Math.round(referenceRect.height) + 2);
          button.style.width = width + 'px';
          button.style.minWidth = width + 'px';
          button.style.height = height + 'px';
          button.style.padding = '0 6px';
          button.style.gap = '5px';
          button.style.fontSize = '11px';
          const actualRect = button.getBoundingClientRect();
          return { width: Math.ceil(actualRect.width), height: Math.ceil(actualRect.height) };
        };

        const placeButton = () => {
          const button = createButton();

          if (isAuthenticationPage()) {
            button.style.display = 'none';
            button.dataset.vibezPositionMode = 'authentication';
            return true;
          }

          button.style.display = 'inline-flex';
          const auth = findAuthControls();

          if (auth) {
            const referenceRect = auth.sizeSource.rect;
            const size = setLoggedOutSize(button, referenceRect);
            const authLeft = Math.min(
              auth.signIn?.rect.left ?? Number.POSITIVE_INFINITY,
              auth.signUp?.rect.left ?? Number.POSITIVE_INFINITY
            );
            const desiredLeft = Math.round(authLeft - size.width - GAP);
            const left = window.innerWidth < 520 || desiredLeft < 12 ? 12 : desiredLeft;
            const top = Math.max(8, Math.round(referenceRect.top + (referenceRect.height - size.height) / 2));

            button.style.left = left + 'px';
            button.style.right = 'auto';
            button.style.top = top + 'px';
            button.dataset.vibezPositionMode = 'logged-out';
            return true;
          }

          setLoggedInSize(button);
          const incognito = findIncognito();

          if (incognito) {
            const rect = incognito.getBoundingClientRect();
            const width = Math.ceil(button.getBoundingClientRect().width || 118);
            const height = Math.ceil(button.getBoundingClientRect().height || 36);
            const left = Math.max(8, Math.round(rect.left - width - 8));
            const top = Math.max(8, Math.round(rect.top + ((rect.height || height) - height) / 2));

            button.style.left = left + 'px';
            button.style.right = 'auto';
            button.style.top = top + 'px';
            button.dataset.vibezPositionMode = 'incognito';
          } else {
            button.style.left = 'auto';
            button.style.right = '74px';
            button.style.top = '9px';
            button.dataset.vibezPositionMode = 'logged-in-fallback';
          }
          return true;
        };

        window.__vibezEnsureScreenshotButton = placeButton;
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
              placeButton();
            });
          };

          const observer = new MutationObserver(schedule);
          observer.observe(document.documentElement, { childList: true, subtree: true });
          window.addEventListener('resize', schedule, { passive: true });
          window.addEventListener('scroll', schedule, { passive: true, capture: true });
          setInterval(schedule, 1000);
        }

        placeButton();
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

async function getCaptureForDisplay(display, language) {
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

  if (!source) {
    const captureOrder = getCaptureOrderedDisplays();
    const index = captureOrder.findIndex((item) => String(item.id) === String(display.id));
    if (index >= 0 && index < sources.length) source = sources[index];
  }

  if (!source || source.thumbnail.isEmpty()) throw new Error(screenshotText(language).noSource);
  return source.thumbnail;
}

async function createOverlay(display, image, language) {
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
  await overlay.webContents.executeJavaScript(`
    window.__vibezSetScreenshotLanguage?.(${JSON.stringify(language)});
    window.__vibezSetScreenshot(${JSON.stringify(image.toDataURL())});
  `);
  return overlay;
}

async function startScreenshot() {
  if (!mainWindow || mainWindow.isDestroyed() || captureInProgress) return;
  captureInProgress = true;
  let language = 'en';

  try {
    language = await getPageLanguage();
    const displays = getOrderedDisplays();
    if (!displays.length) throw new Error(screenshotText(language).noDisplays);

    await setScreenshotButtonVisible(false);
    await wait(90);

    const frozenDisplays = [];
    for (const display of displays) {
      frozenDisplays.push({ display, image: await getCaptureForDisplay(display, language) });
    }

    const overlays = [];
    for (const frozen of frozenDisplays) overlays.push(await createOverlay(frozen.display, frozen.image, language));
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
    const text = screenshotText(language);
    dialog.showMessageBox({
      type: 'error',
      title: text.failedTitle,
      message: text.failedMessage,
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
    const target = await mainWindow.webContents.executeJavaScript(`
      (() => {
        const visible = (element) => {
          if (!element || !element.isConnected || element.closest('[aria-hidden="true"]')) return false;
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return rect.width >= 80 && rect.height >= 12 && style.display !== 'none' && style.visibility !== 'hidden';
        };
        const editorScore = (element) => {
          const rect = element.getBoundingClientRect();
          const labels = [
            element.getAttribute('aria-label'),
            element.getAttribute('placeholder'),
            element.getAttribute('data-testid'),
            element.getAttribute('name'),
            element.id,
            element.className
          ].filter((value) => typeof value === 'string').join(' ').toLowerCase();
          let score = rect.bottom;
          if (rect.bottom > window.innerHeight * 0.55) score += 1200;
          if (element.matches('textarea,[contenteditable="true"]')) score += 250;
          if (/(prompt|composer|message|chat|ask|command|instruction)/.test(labels)) score += 2000;
          if (element.closest('form')) score += 150;
          return score;
        };
        const frames = [...document.querySelectorAll('iframe')]
          .filter(visible)
          .sort((left, right) => {
            const leftRect = left.getBoundingClientRect();
            const rightRect = right.getBoundingClientRect();
            return (rightRect.width * rightRect.height) - (leftRect.width * leftRect.height);
          });
        const focusFrame = () => {
          const frame = frames[0];
          if (!frame) return false;
          frame.contentWindow?.focus();
          frame.focus({ preventScroll: true });
          return { focused: 'frame', mode: codeMode, label: frame.getAttribute('title') || 'Vibe workspace' };
        };

        const activeNavigation = [...document.querySelectorAll('[aria-current="page"],[data-state="active"],[data-active="true"]')]
          .map((element) => (element.textContent || '').trim().toLowerCase())
          .join(' ');
        const modeContext = [location.pathname, document.title, activeNavigation].join(' ').toLowerCase();
        const codeMode = /code/.test(modeContext);
        if (codeMode) {
          const frame = focusFrame();
          if (frame) return frame;
        }

        const candidates = [...document.querySelectorAll('textarea,[contenteditable="true"],[role="textbox"]')]
          .filter(visible)
          .sort((left, right) => editorScore(right) - editorScore(left));
        const editor = candidates[0];
        if (editor) {
          editor.focus({ preventScroll: true });
          return { focused: 'editor', mode: codeMode, label: editor.getAttribute('aria-label') || editor.getAttribute('placeholder') || 'text input' };
        }
        return focusFrame();
      })();
    `);
    if (target?.focused === 'frame') {
      const frame = mainWindow.webContents.focusedFrame;
      if (frame && frame !== mainWindow.webContents.mainFrame) {
        await frame.executeJavaScript(`
          (() => {
            const visible = (element) => {
              const rect = element.getBoundingClientRect();
              const style = getComputedStyle(element);
              return rect.width >= 80 && rect.height >= 12 && style.display !== 'none' && style.visibility !== 'hidden';
            };
            const editor = [...document.querySelectorAll('textarea,[contenteditable="true"],[role="textbox"]')]
              .filter(visible)
              .sort((left, right) => right.getBoundingClientRect().bottom - left.getBoundingClientRect().bottom)[0];
            editor?.focus({ preventScroll: true });
            return Boolean(editor);
          })();
        `);
      }
    }
    return target || false;
  } catch (error) {
    console.error('Kon chatinvoer niet focussen:', error);
    return false;
  }
}

async function getVibeContext() {
  if (!mainWindow || mainWindow.isDestroyed()) return { isCode: false, language: 'en' };
  try {
    return await mainWindow.webContents.executeJavaScript(`
      (() => {
        const textOf = (element) => [
          element?.innerText,
          element?.textContent,
          element?.getAttribute?.('aria-label'),
          element?.getAttribute?.('title')
        ].filter(Boolean).join(' ').replace(/\\s+/g, ' ').trim().toLowerCase();

        const controls = [...document.querySelectorAll(
          'nav a, nav button, [role="navigation"] a, [role="navigation"] button, [role="tab"], [aria-current="page"], [aria-selected="true"]'
        )];
        const codeControlIsActive = controls.some((element) => {
          const text = textOf(element);
          if (!/(^|\\s)code(\\s|$)/.test(text)) return false;
          const activeElement = element.closest('[aria-current="page"], [aria-selected="true"], [data-state="active"], [data-active="true"]');
          return Boolean(activeElement) || element.getAttribute('aria-current') === 'page' || element.getAttribute('aria-selected') === 'true';
        });
        const activeNavigation = controls
          .filter((element) => element.getAttribute('aria-current') === 'page' || element.getAttribute('aria-selected') === 'true' || element.getAttribute('data-state') === 'active' || element.getAttribute('data-active') === 'true')
          .map(textOf)
          .join(' ');
        const locationContext = [location.pathname, document.title, activeNavigation].join(' ').toLowerCase();
        return {
          isCode: codeControlIsActive || /(^|[\\s/_-])code($|[\\s/_-])/.test(locationContext),
          language: navigator.language || document.documentElement.lang || 'en'
        };
      })();
    `);
  } catch (_) {
    return { isCode: false, language: 'en' };
  }
}

function codeScreenshotGuide(language) {
  const locale = String(language || 'en').toLowerCase();
  const guides = {
    nl: {
      title: 'Screenshot gebruiken in Vibe Code',
      message: 'De afbeelding staat nu op je klembord. Vibe Code kan een screenshot niet rechtstreeks als chatbijlage ontvangen.\n\nZo geef je hem toch mee:\n1. Plak en bewaar de screenshot in je project, bijvoorbeeld als screenshots/probleem.png.\n2. Commit en push dat bestand naar de testbranch waarmee je Code werkt — niet naar main.\n3. Schrijf in Code: “Bekijk screenshots/probleem.png en gebruik dit als context voor deze taak.”\n\nDe screenshot blijft op je klembord zodat je hem eerst kunt opslaan.'
    },
    de: {
      title: 'Screenshot in Vibe Code verwenden',
      message: 'Das Bild befindet sich jetzt in deiner Zwischenablage. Vibe Code kann einen Screenshot nicht direkt als Chat-Anhang empfangen.\n\nSo kannst du ihn trotzdem verwenden:\n1. Füge den Screenshot in dein Projekt ein und speichere ihn, zum Beispiel als screenshots/problem.png.\n2. Committe und pushe die Datei in den Test-Branch deiner Code-Sitzung — nicht nach main.\n3. Schreibe in Code: „Sieh dir screenshots/problem.png an und verwende es als Kontext für diese Aufgabe.“\n\nDer Screenshot bleibt in deiner Zwischenablage, damit du ihn zuerst speichern kannst.'
    },
    fr: {
      title: 'Utiliser une capture dans Vibe Code',
      message: 'L’image se trouve maintenant dans votre presse-papiers. Vibe Code ne peut pas recevoir une capture directement comme pièce jointe de chat.\n\nPour l’utiliser :\n1. Collez et enregistrez la capture dans votre projet, par exemple sous screenshots/probleme.png.\n2. Validez et poussez ce fichier sur la branche de test utilisée par votre session Code — jamais sur main.\n3. Écrivez dans Code : « Consulte screenshots/probleme.png et utilise-le comme contexte pour cette tâche. »\n\nLa capture reste dans votre presse-papiers pour que vous puissiez d’abord l’enregistrer.'
    },
    es: {
      title: 'Usar una captura en Vibe Code',
      message: 'La imagen está ahora en el portapapeles. Vibe Code no puede recibir una captura directamente como adjunto de chat.\n\nPara utilizarla:\n1. Pega y guarda la captura en tu proyecto, por ejemplo como screenshots/problema.png.\n2. Confirma y sube el archivo a la rama de pruebas que usa tu sesión de Code; nunca a main.\n3. Escribe en Code: «Revisa screenshots/problema.png y úsalo como contexto para esta tarea».\n\nLa captura permanece en el portapapeles para que puedas guardarla primero.'
    },
    it: {
      title: 'Usare uno screenshot in Vibe Code',
      message: 'L’immagine è ora negli appunti. Vibe Code non può ricevere direttamente uno screenshot come allegato alla chat.\n\nPer usarlo:\n1. Incolla e salva lo screenshot nel progetto, ad esempio come screenshots/problema.png.\n2. Esegui commit e push del file sul branch di prova usato dalla sessione Code, mai su main.\n3. Scrivi in Code: «Esamina screenshots/problema.png e usalo come contesto per questa attività».\n\nLo screenshot rimane negli appunti per permetterti di salvarlo prima.'
    },
    pt: {
      title: 'Usar uma captura no Vibe Code',
      message: 'A imagem está agora na área de transferência. O Vibe Code não pode receber uma captura diretamente como anexo de chat.\n\nPara usá-la:\n1. Cole e guarde a captura no seu projeto, por exemplo como screenshots/problema.png.\n2. Faça commit e push do ficheiro para a branch de teste usada pela sessão Code — nunca para main.\n3. Escreva no Code: «Examine screenshots/problema.png e use-a como contexto para esta tarefa».\n\nA captura permanece na área de transferência para que a possa guardar primeiro.'
    },
    en: {
      title: 'Use a screenshot in Vibe Code',
      message: 'The image is now on your clipboard. Vibe Code cannot receive a screenshot directly as a chat attachment.\n\nTo use it:\n1. Paste and save the screenshot in your project, for example as screenshots/issue.png.\n2. Commit and push that file to the test branch used by your Code session — never to main.\n3. In Code, write: “Inspect screenshots/issue.png and use it as context for this task.”\n\nThe screenshot remains on your clipboard so you can save it first.'
    }
  };
  const languageCode = locale.split('-')[0];
  return guides[languageCode] || guides.en;
}

async function showCodeScreenshotGuide(language) {
  const guide = codeScreenshotGuide(language);
  await dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: guide.title,
    message: guide.message,
    buttons: ['OK'],
    defaultId: 0
  });
}

async function attach(image) {
  if (!mainWindow || mainWindow.isDestroyed() || !image || image.isEmpty()) return;
  restoreMain();
  clipboard.writeImage(image);
  const context = await getVibeContext();
  if (context.isCode) {
    await showCodeScreenshotGuide(context.language);
    return;
  }
  await wait(120);
  await focusComposer();
  await wait(180);
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
