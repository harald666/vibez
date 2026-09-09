const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ACCOUNT_WORDS } = require('../ui-detection');

const source = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');

test('native Screenshot button anchors left of the account action', () => {
  assert.match(source, /async function positionScreenshotButton\(\)[\s\S]*?getContentBounds\(\)/);
  assert.match(source, /anchor\.left - width - gap/);
  assert.match(source, /SCREENSHOT_BUTTON_LAYOUT\.gap/);
  for (const sample of ['aanmelden', 'sign up', 'inloggen', 'sign in', '注册', 'إنشاء حساب']) {
    assert.ok(ACCOUNT_WORDS.includes(sample), `missing account label: ${sample}`);
  }
  assert.doesNotMatch(source, /bounds\.x \+ bounds\.width - 232/);
});

test('native Screenshot button stays above VibeZ web content without covering other apps', () => {
  assert.match(source, /alwaysOnTop: true/);
  assert.match(source, /focusable: false/);
  assert.match(source, /mainWindow\.isFocused\(\)/);
  assert.match(source, /mainWindow\.on\('blur', \(\) => screenshotButtonWindow\?\.hide\(\)\)/);
});

test('Screenshot anchors before the whole account button cluster', () => {
  assert.match(source, /const accountWords = \${JSON\.stringify\(ACCOUNT_WORDS\)}/);
  assert.match(source, /const accountMatches = nodes\.filter/);
  assert.match(source, /Math\.min\(\.\.\.accountMatches\.map\(\(item\) => item\.rect\.left\)\)/);
});

test('Screenshot layout uses named constants and selective diagnostics', () => {
  assert.match(source, /const SCREENSHOT_BUTTON_LAYOUT = Object\.freeze/);
  assert.match(source, /minWidth: 146/);
  assert.match(source, /fallbackRightOffset: 330/);
  assert.match(source, /function warnWebUiError/);
  assert.match(source, /console\.warn/);
  assert.match(source, /isLoadingMainFrame\(\)/);
});
