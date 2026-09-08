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
  assert.match(source, /注册/);
  assert.match(source, /إنشاء حساب/);
  assert.doesNotMatch(source, /bounds\.x \+ bounds\.width - 232/);
});
