from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"release prep target not found: {label}")
    return text.replace(old, new, 1)


# Keep VibeZ's manual language independent from the embedded Mistral website.
main = Path("main.js")
s = main.read_text()
s = replace_once(
    s,
    "if (settings.language !== 'system') {\n  app.commandLine.appendSwitch('lang', settings.language);\n}\n\n",
    "",
    "manual Chromium language block",
)
s = replace_once(
    s,
    "async function positionScreenshotButton() {\n  if (!mainWindow || mainWindow.isDestroyed() || !screenshotButtonWindow || screenshotButtonWindow.isDestroyed()) return;\n  const bounds = mainWindow.getBounds();\n",
    "async function positionScreenshotButton() {\n  if (!mainWindow || mainWindow.isDestroyed() || !screenshotButtonWindow || screenshotButtonWindow.isDestroyed()) return;\n  const bounds = mainWindow.getContentBounds();\n",
    "Screenshot content bounds",
)
main.write_text(s)

# README: 1.3.1 links and the new language model.
readme = Path("README.md")
r = readme.read_text().replace("1.3.0", "1.3.1")
feature_anchor = "- Settings for screenshot shortcuts, startup, tray behavior, hardware acceleration, Wayland/X11, zoom, language and updates.\n"
feature_line = "- VibeZ-owned interface follows the Linux/OS language automatically, with 34 built-in languages and RTL support.\n"
r = replace_once(r, feature_anchor, feature_anchor + feature_line, "README language feature")
language_section = """## Languages

By default, **System** follows the language reported by Linux. VibeZ has complete built-in translations for 34 major languages, including English, Dutch, German, French, Spanish, Italian, Portuguese, Polish, Russian, Ukrainian, Turkish, Simplified and Traditional Chinese, Japanese, Korean, Hindi, Bengali, Punjabi, Marathi, Telugu, Tamil, Gujarati, Indonesian, Vietnamese, Thai, Filipino, Javanese, Swahili, Hausa, Amharic, Arabic, Hebrew, Persian and Urdu.

Arabic, Hebrew, Persian and Urdu use right-to-left layout in VibeZ-owned interfaces. Unsupported system locales fall back to English. Choosing a VibeZ language manually changes VibeZ's own menus, dialogs, screenshot tools and Settings; it does not force the embedded Mistral Vibe website into that language.

"""
r = replace_once(r, "## Screenshot workflow\n", language_section + "## Screenshot workflow\n", "README language section")
readme.write_text(r)

# Changelog and release links.
changelog = Path("CHANGELOG.md")
c = changelog.read_text()
release = """## [1.3.1] - 2026-09-08

### Added
- Central VibeZ internationalization layer covering all VibeZ-owned menus, dialogs, Settings and screenshot interfaces.
- 34 built-in interface languages with automatic Linux/OS locale detection and English fallback.
- Simplified and Traditional Chinese support.
- Right-to-left layout support for Arabic, Hebrew, Persian and Urdu.
- Regression tests that require every advertised language to contain every VibeZ translation key.

### Changed
- **System** language now follows the Linux/Electron OS locale instead of the language reported by the Mistral web page.
- Manual VibeZ language selection applies to VibeZ-owned UI without forcing the embedded Mistral Vibe website to that language.
- Native Screenshot button localizes its label, adapts its width for longer translations and repositions itself relative to the account action.
- Screenshot selection and error dialogs now use the same central VibeZ language source.

### Fixed
- Fixed the Screenshot button overlapping **Aanmelden / Sign up / Register** on narrower windows.
- Screenshot button now anchors with a fixed gap to the account action and uses the BrowserWindow content bounds for more reliable Linux window-manager positioning.

"""
c = replace_once(c, "## [Unreleased]\n\n", "## [Unreleased]\n\n" + release, "CHANGELOG release section")
c = c.replace(
    "[Unreleased]: https://github.com/harald666/vibez/compare/v1.3.0...HEAD",
    "[Unreleased]: https://github.com/harald666/vibez/compare/v1.3.1...HEAD",
)
if "[1.3.1]:" not in c:
    c = replace_once(
        c,
        "[1.3.0]: https://github.com/harald666/vibez/releases/tag/v1.3.0",
        "[1.3.1]: https://github.com/harald666/vibez/releases/tag/v1.3.1\n[1.3.0]: https://github.com/harald666/vibez/releases/tag/v1.3.0",
        "CHANGELOG release link",
    )
changelog.write_text(c)

# Public GitHub Pages landing page.
docs = Path("docs/index.html")
d = docs.read_text()
old = '<p>VibeZ opens the official Mistral Vibe web app in a focused desktop window and checks GitHub Releases for updates.</p>'
new = old + '\n        <p>VibeZ follows your Linux language automatically and includes 34 built-in interface languages, including Chinese and right-to-left support for Arabic, Hebrew, Persian and Urdu.</p>'
d = replace_once(d, old, new, "docs language paragraph")
docs.write_text(d)

# Strengthen language regression coverage.
test = Path("test/i18n.test.js")
t = test.read_text()
required_test = """test('major global language set remains available', () => {
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

"""
t = replace_once(t, "test('RTL languages expose RTL direction'", required_test + "test('RTL languages expose RTL direction'", "i18n major-language test")
test.write_text(t)

# Protect the exact bug reported from regressing.
Path("test/screenshot-position.test.js").write_text("""const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');

test('native Screenshot button anchors left of the account action', () => {
  assert.match(source, /async function positionScreenshotButton\\(\\)[\\s\\S]*?getContentBounds\\(\\)/);
  assert.match(source, /anchor\\.left - width - gap/);
  assert.match(source, /const gap = 10/);
  assert.match(source, /aanmelden/);
  assert.match(source, /sign up/);
  assert.match(source, /注册/);
  assert.match(source, /إنشاء حساب/);
  assert.doesNotMatch(source, /bounds\\.x \\+ bounds\\.width - 232/);
});
""")
