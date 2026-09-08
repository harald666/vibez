const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  DEFAULT_SETTINGS,
  normalizeSettings,
  createSettingsStore,
} = require('../settings-store');

test('normalizeSettings keeps safe defaults for invalid values', () => {
  const settings = normalizeSettings({
    zoomFactor: 99,
    hardwareAcceleration: 'turbo',
    displayBackend: 'mir',
    language: 'xx',
    screenshotShortcut: 'rm -rf /',
  });
  assert.deepEqual(settings, DEFAULT_SETTINGS);
});

test('normalizeSettings accepts supported values', () => {
  const settings = normalizeSettings({
    globalScreenshot: false,
    screenshotShortcut: 'CommandOrControl+Alt+S',
    hardwareAcceleration: 'disabled',
    displayBackend: 'wayland',
    zoomFactor: 1.25,
    language: 'nl',
    closeToTray: true,
  });
  assert.equal(settings.globalScreenshot, false);
  assert.equal(settings.screenshotShortcut, 'CommandOrControl+Alt+S');
  assert.equal(settings.hardwareAcceleration, 'disabled');
  assert.equal(settings.displayBackend, 'wayland');
  assert.equal(settings.zoomFactor, 1.25);
  assert.equal(settings.language, 'nl');
  assert.equal(settings.closeToTray, true);
});

test('settings store writes atomically and merges patches', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibez-settings-'));
  const file = path.join(dir, 'settings.json');
  const store = createSettingsStore(file);
  assert.deepEqual(store.read(), DEFAULT_SETTINGS);
  store.write({ ...DEFAULT_SETTINGS, language: 'de' });
  const patched = store.patch({ zoomFactor: 1.1, autoUpdates: false });
  assert.equal(patched.language, 'de');
  assert.equal(patched.zoomFactor, 1.1);
  assert.equal(patched.autoUpdates, false);
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
});
