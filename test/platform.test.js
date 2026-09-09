const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const main = fs.readFileSync('main.js', 'utf8');
const settings = fs.readFileSync('settings.html', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

test('Windows and macOS packaging targets stay configured', () => {
  assert.ok(pkg.build.win);
  assert.deepEqual(pkg.build.win.target, ['nsis']);
  assert.ok(pkg.build.mac);
  assert.deepEqual(pkg.build.mac.target, ['dmg', 'zip']);
});

test('Linux display backend switches cannot leak to Windows or macOS', () => {
  assert.match(main, /process\.platform === 'linux' && settings\.displayBackend === 'wayland'/);
  assert.match(main, /process\.platform === 'linux' && settings\.displayBackend === 'x11'/);
  assert.match(settings, /displayBackendRow/);
  assert.match(settings, /isLinux/);
});

test('start at login uses native APIs on Windows and macOS and XDG on Linux', () => {
  assert.match(main, /process\.platform === 'win32'/);
  assert.match(main, /process\.platform === 'darwin'/);
  assert.match(main, /app\.setLoginItemSettings/);
  assert.match(main, /\.config', 'autostart'/);
});

test('macOS keeps manual installation but can notify about new GitHub releases', () => {
  assert.match(main, /getMediaAccessStatus\('screen'\)/);
  assert.match(main, /Privacy_ScreenCapture/);
  assert.match(main, /async function checkMacUpdates/);
  assert.match(main, /LATEST_RELEASE_API/);
  assert.match(main, /void checkMacUpdates\(manual\)/);
  assert.match(settings, /el\('autoUpdatesRow'\)\.hidden=false/);
  assert.match(settings, /el\('installOnQuitRow'\)\.hidden=isMac/);
});

test('settings receive platform identity from the trusted main process', () => {
  assert.match(main, /platform: process\.platform/);
  assert.match(settings, /applyPlatform\(payload\.platform\)/);
});
