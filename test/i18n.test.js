const test = require('node:test');
const assert = require('node:assert/strict');
const {
  GROUP_KEYS,
  LANGUAGE_OPTIONS,
  TRANSLATIONS,
  normalizeLocale,
  resolveLanguage,
  isRtl,
  uiBundle,
} = require('../i18n');

test('all advertised languages have complete VibeZ translations', () => {
  const expected = Object.values(GROUP_KEYS).flat();
  const advertised = LANGUAGE_OPTIONS.filter((item) => item.code !== 'system').map((item) => item.code);
  assert.deepEqual(new Set(advertised), new Set(Object.keys(TRANSLATIONS)));
  for (const code of advertised) {
    const strings = TRANSLATIONS[code];
    assert.equal(Object.keys(strings).length, expected.length, code);
    for (const key of expected) assert.equal(typeof strings[key], 'string', `${code}:${key}`);
  }
});

test('OS locales resolve to the intended VibeZ language', () => {
  assert.equal(resolveLanguage('system', 'nl_NL.UTF-8'), 'nl');
  assert.equal(resolveLanguage('system', 'ar-EG'), 'ar');
  assert.equal(resolveLanguage('system', 'zh-Hans-CN'), 'zh-CN');
  assert.equal(resolveLanguage('system', 'zh-Hant-HK'), 'zh-TW');
  assert.equal(resolveLanguage('system', 'pt-BR'), 'pt');
  assert.equal(resolveLanguage('system', 'xx-YY'), 'en');
  assert.equal(resolveLanguage('ja', 'nl-NL'), 'ja');
  assert.equal(normalizeLocale('zh_TW'), 'zh-TW');
});

test('major global language set remains available', () => {
  const required = [
    'en','nl','de','fr','es','it','pt','pl','ru','uk','tr','zh-CN','zh-TW','ja','ko',
    'hi','bn','pa','mr','te','ta','gu','id','vi','th','fil','jv','sw','ha','am','ar','he','fa','ur',
  ];
  const advertised = LANGUAGE_OPTIONS.filter((item) => item.code !== 'system').map((item) => item.code);
  assert.equal(advertised.length, 34);
  assert.deepEqual(new Set(advertised), new Set(required));
  assert.equal(resolveLanguage('system', 'pa-IN'), 'pa');
  assert.equal(resolveLanguage('system', 'fil-PH'), 'fil');
  assert.equal(resolveLanguage('system', 'sw-KE'), 'sw');
});

test('RTL languages expose RTL direction', () => {
  for (const code of ['ar','he','fa','ur']) assert.equal(isRtl(code), true, code);
  for (const code of ['en','nl','zh-CN','ja']) assert.equal(isRtl(code), false, code);
  assert.equal(uiBundle('ar').dir, 'rtl');
  assert.equal(uiBundle('nl').dir, 'ltr');
});
