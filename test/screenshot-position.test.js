const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');

test('native Screenshot button anchors left of the account action', () => {
  assert.match(source, /async function positionScreenshotButton\(\)[\s\S]*?getContentBounds\(\)/);
  assert.match(source, /anchor\.left - width - gap/);
  assert.match(source, /const gap = 10/);
  assert.match(source, /aanmelden/);
  assert.match(source, /sign up/);
  assert.match(source, /inloggen/);
  assert.match(source, /sign in/);
  assert.match(source, /注册/);
  assert.match(source, /إنشاء حساب/);
  assert.doesNotMatch(source, /bounds\.x \+ bounds\.width - 232/);
});


test('native Screenshot button stays above VibeZ web content without covering other apps', () => {
  assert.match(source, /alwaysOnTop: true/);
  assert.match(source, /focusable: false/);
  assert.match(source, /mainWindow\.isFocused\(\)/);
  assert.match(source, /mainWindow\.on\('blur', \(\) => screenshotButtonWindow\?\.hide\(\)\)/);
});

test('Screenshot anchors before the whole account button cluster', () => {
  assert.match(source, /const accountMatches = nodes\.filter/);
  assert.match(source, /Math\.min\(\.\.\.accountMatches\.map\(\(item\) => item\.rect\.left\)\)/);
  assert.match(source, /anchor\.left - width - gap/);
});
