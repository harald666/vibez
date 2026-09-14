const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('VibeZ 2.0 uses its own desktop shell around Mistral Vibe', () => {
  const main = read('main-v2.js');
  assert.match(main, /WebContentsView/);
  assert.match(main, /contentView\.addChildView\(vibeView\)/);
  assert.match(main, /loadFile\(path\.join\(__dirname, 'shell\.html'\)\)/);
  assert.match(main, /vibeView\.webContents/);
});

test('VibeZ 2.0 no longer creates the floating screenshot window', () => {
  const main = read('main-v2.js');
  const screenshot = read('screenshot-v2.js');
  assert.doesNotMatch(main, /screenshotButtonWindow/);
  assert.doesNotMatch(screenshot, /vibez-screenshot-button/);
  assert.match(main, /vibez:shell:action/);
  assert.match(main, /triggerScreenshot/);
});

test('2.0 test branch uses an isolated beta bootstrap', () => {
  const pkg = JSON.parse(read('package.json'));
  const bootstrap = read('main-v2-bootstrap.js');
  assert.equal(pkg.main, 'main-v2-bootstrap.js');
  assert.match(pkg.version, /^2\.0\.0-beta\./);
  assert.match(bootstrap, /VibeZ-2\.0-test/);
  assert.match(bootstrap, /setAsDefaultProtocolClient = \(\) => false/);
  assert.match(bootstrap, /setLoginItemSettings = \(\) => \{\}/);
});
