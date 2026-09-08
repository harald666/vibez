const fs = require('fs');
const path = require('path');

const DEFAULT_SETTINGS = Object.freeze({
  globalScreenshot: true,
  screenshotShortcut: 'CommandOrControl+Shift+S',
  showScreenshotButton: true,
  startAtLogin: false,
  minimizeToTray: false,
  closeToTray: false,
  autoUpdates: true,
  installUpdatesOnQuit: false,
  hardwareAcceleration: 'automatic',
  displayBackend: 'automatic',
  zoomFactor: 1,
  language: 'system',
  openExternalLinks: true,
});

const VALID_SHORTCUTS = new Set([
  'CommandOrControl+Shift+S',
  'CommandOrControl+Alt+S',
  'Alt+Shift+S',
  'Super+Shift+S',
]);

const VALID_HARDWARE = new Set(['automatic', 'enabled', 'disabled']);
const VALID_BACKENDS = new Set(['automatic', 'wayland', 'x11']);
const VALID_LANGUAGES = new Set(['system', 'en', 'nl', 'de', 'fr', 'es', 'it', 'pt']);
const VALID_ZOOM = new Set([0.8, 0.9, 1, 1.1, 1.25, 1.5]);

function normalizeSettings(input = {}) {
  const raw = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const out = { ...DEFAULT_SETTINGS };

  for (const key of [
    'globalScreenshot',
    'showScreenshotButton',
    'startAtLogin',
    'minimizeToTray',
    'closeToTray',
    'autoUpdates',
    'installUpdatesOnQuit',
    'openExternalLinks',
  ]) {
    if (typeof raw[key] === 'boolean') out[key] = raw[key];
  }

  if (VALID_SHORTCUTS.has(raw.screenshotShortcut)) out.screenshotShortcut = raw.screenshotShortcut;
  if (VALID_HARDWARE.has(raw.hardwareAcceleration)) out.hardwareAcceleration = raw.hardwareAcceleration;
  if (VALID_BACKENDS.has(raw.displayBackend)) out.displayBackend = raw.displayBackend;
  if (VALID_LANGUAGES.has(raw.language)) out.language = raw.language;

  const zoom = Number(raw.zoomFactor);
  if (VALID_ZOOM.has(zoom)) out.zoomFactor = zoom;

  return out;
}

function createSettingsStore(filePath) {
  if (!filePath || typeof filePath !== 'string') throw new TypeError('filePath is required');

  function read() {
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return normalizeSettings(parsed);
    } catch (error) {
      if (error && error.code !== 'ENOENT') console.warn('Could not read VibeZ settings:', error.message);
      return { ...DEFAULT_SETTINGS };
    }
  }

  function write(next) {
    const normalized = normalizeSettings(next);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const tmp = `${filePath}.tmp`;
    fs.writeFileSync(tmp, `${JSON.stringify(normalized, null, 2)}\n`, { mode: 0o600 });
    fs.renameSync(tmp, filePath);
    return normalized;
  }

  function patch(partial) {
    return write({ ...read(), ...(partial || {}) });
  }

  return { read, write, patch, filePath };
}

module.exports = {
  DEFAULT_SETTINGS,
  VALID_SHORTCUTS,
  normalizeSettings,
  createSettingsStore,
};
