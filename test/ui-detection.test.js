const test = require('node:test');
const assert = require('node:assert/strict');
const { ACCOUNT_WORDS, SIGN_IN_WORDS, SIGN_UP_WORDS } = require('../ui-detection');

test('shared account labels are unique and cover major login/register variants', () => {
  assert.equal(new Set(ACCOUNT_WORDS).size, ACCOUNT_WORDS.length);
  for (const word of SIGN_IN_WORDS) assert.ok(ACCOUNT_WORDS.includes(word));
  for (const word of SIGN_UP_WORDS) assert.ok(ACCOUNT_WORDS.includes(word));
  for (const sample of ['inloggen', 'sign in', '登录', 'تسجيل الدخول', 'aanmelden', 'sign up', '注册', 'إنشاء حساب']) {
    assert.ok(ACCOUNT_WORDS.includes(sample), `missing ${sample}`);
  }
});
