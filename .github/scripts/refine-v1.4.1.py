from pathlib import Path
import re


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'{label}: expected text not found')
    return text.replace(old, new, 1)

main_path = Path('main.js')
main = main_path.read_text()

main = replace_once(
    main,
    "const { resolveLanguage, t, uiBundle } = require('./i18n');\n",
    "const { resolveLanguage, t, uiBundle } = require('./i18n');\nconst { ACCOUNT_WORDS } = require('./ui-detection');\n",
    'main import',
)

main = replace_once(
    main,
    "const APP_PROTOCOL = 'vibez';\n",
    """const APP_PROTOCOL = 'vibez';
const LATEST_RELEASE_API = 'https://api.github.com/repos/harald666/vibez/releases/latest';
const SCREENSHOT_BUTTON_LAYOUT = Object.freeze({
  minWidth: 146,
  maxWidth: 228,
  height: 48,
  gap: 10,
  fallbackRightOffset: 330,
  fallbackTop: 5,
  edgePadding: 8,
  maxTopBand: 90,
  minMainWidth: 620,
});
""",
    'main constants',
)

helpers_anchor = """function ensureMainVisible() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  if (!mainWindow.isVisible()) mainWindow.show();
  mainWindow.focus();
}

"""
helpers = helpers_anchor + """function isTransientWebUiError(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return !mainWindow ||
    mainWindow.isDestroyed() ||
    mainWindow.webContents.isDestroyed() ||
    mainWindow.webContents.isLoadingMainFrame() ||
    message.includes('object has been destroyed') ||
    message.includes('execution context was destroyed') ||
    message.includes('frame was disposed') ||
    message.includes('navigat');
}

function warnWebUiError(context, error) {
  if (!isTransientWebUiError(error)) console.warn(`[VibeZ] ${context}:`, error);
}

function compareVersions(left, right) {
  const parse = (value) => String(value || '')
    .replace(/^v/i, '')
    .split('-')[0]
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0);
  const a = parse(left);
  const b = parse(right);
  const length = Math.max(a.length, b.length, 3);
  for (let index = 0; index < length; index += 1) {
    const av = a[index] || 0;
    const bv = b[index] || 0;
    if (av !== bv) return av > bv ? 1 : -1;
  }
  return 0;
}

async function fetchLatestRelease() {
  const response = await fetch(LATEST_RELEASE_API, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': `VibeZ/${app.getVersion()}`,
    },
  });
  if (!response.ok) throw new Error(`GitHub update check failed (HTTP ${response.status}).`);
  const release = await response.json();
  const version = String(release.tag_name || release.name || '').replace(/^v/i, '').trim();
  if (!version) throw new Error('GitHub release response did not contain a version.');
  return {
    version,
    url: isSafeExternalUrl(release.html_url) ? release.html_url : RELEASES_URL,
  };
}

async function checkMacUpdates(manual = false) {
  const text = uiText();
  try {
    const latest = await fetchLatestRelease();
    if (compareVersions(latest.version, app.getVersion()) > 0) {
      const result = await showMessageBox({
        type: 'info',
        title: `VibeZ · ${text.updates}`,
        message: `${text.updateReady} — VibeZ ${latest.version}`,
        buttons: [text.openReleases, text.later],
        defaultId: 0,
        cancelId: 1,
      });
      if (result.response === 0) await shell.openExternal(latest.url);
      return true;
    }
    if (manual) {
      await showMessageBox({ type: 'info', title: `VibeZ · ${text.updates}`, message: text.latest });
    }
    return false;
  } catch (error) {
    console.error('macOS update check failed:', error);
    if (manual) {
      await showMessageBox({
        type: 'error',
        title: `VibeZ · ${text.updates}`,
        message: text.updateFailed,
        detail: error.message,
      });
    }
    return false;
  }
}

"""
main = replace_once(main, helpers_anchor, helpers, 'main helpers')

old_layout = """  const bounds = mainWindow.getContentBounds();
  const buttonBounds = screenshotButtonWindow.getBounds();
  const width = Math.max(146, buttonBounds.width || 146);
  const height = 48;
  const gap = 10;
  let x = Math.round(bounds.x + bounds.width - 330);
  let y = Math.round(bounds.y + 5);
"""
new_layout = """  const bounds = mainWindow.getContentBounds();
  const buttonBounds = screenshotButtonWindow.getBounds();
  const width = Math.max(SCREENSHOT_BUTTON_LAYOUT.minWidth, buttonBounds.width || SCREENSHOT_BUTTON_LAYOUT.minWidth);
  const height = SCREENSHOT_BUTTON_LAYOUT.height;
  const gap = SCREENSHOT_BUTTON_LAYOUT.gap;
  let x = Math.round(bounds.x + bounds.width - SCREENSHOT_BUTTON_LAYOUT.fallbackRightOffset);
  let y = Math.round(bounds.y + SCREENSHOT_BUTTON_LAYOUT.fallbackTop);
"""
main = replace_once(main, old_layout, new_layout, 'main screenshot layout')

pattern = re.compile(r"        const accountWords = \[\n.*?        \];\n", re.S)
main, count = pattern.subn("        const accountWords = ${JSON.stringify(ACCOUNT_WORDS)};\n", main, count=1)
if count != 1:
    raise SystemExit('main account word block not found')

main = replace_once(
    main,
    "  } catch (_) {}\n\n  const minX = bounds.x + 8;\n  const maxX = bounds.x + bounds.width - width - 8;\n  const minY = bounds.y + 2;\n  const maxY = bounds.y + Math.min(90, bounds.height - height - 2);\n",
    """  } catch (error) {
    warnWebUiError('Could not position Screenshot button', error);
  }

  const minX = bounds.x + SCREENSHOT_BUTTON_LAYOUT.edgePadding;
  const maxX = bounds.x + bounds.width - width - SCREENSHOT_BUTTON_LAYOUT.edgePadding;
  const minY = bounds.y + 2;
  const maxY = bounds.y + Math.min(SCREENSHOT_BUTTON_LAYOUT.maxTopBand, bounds.height - height - 2);
""",
    'main position error handling',
)

main = replace_once(main, "    mainWindow.getBounds().width >= 620\n", "    mainWindow.getBounds().width >= SCREENSHOT_BUTTON_LAYOUT.minMainWidth\n", 'main minimum window width')
main = replace_once(main, "  } catch (_) {}\n}\n\nasync function syncNativeScreenshotButtonText()", "  } catch (error) {\n    warnWebUiError('Could not suppress injected Screenshot button', error);\n  }\n}\n\nasync function syncNativeScreenshotButtonText()", 'main suppress error handling')
main = replace_once(main, "      window.__vibezSetUi?.(${JSON.stringify({ language: ui.language, dir: ui.dir, label: ui.strings.screenshot, shortcut })}) || 146\n", "      window.__vibezSetUi?.(${JSON.stringify({ language: ui.language, dir: ui.dir, label: ui.strings.screenshot, shortcut })}) || ${SCREENSHOT_BUTTON_LAYOUT.minWidth}\n", 'main ui fallback width')
main = replace_once(main, "    const width = Math.max(146, Math.min(228, Number(desiredWidth) || 146));\n", "    const width = Math.max(SCREENSHOT_BUTTON_LAYOUT.minWidth, Math.min(SCREENSHOT_BUTTON_LAYOUT.maxWidth, Number(desiredWidth) || SCREENSHOT_BUTTON_LAYOUT.minWidth));\n", 'main ui width clamp')
main = replace_once(main, "    width: 146,\n    height: 48,\n", "    width: SCREENSHOT_BUTTON_LAYOUT.minWidth,\n    height: SCREENSHOT_BUTTON_LAYOUT.height,\n", 'main window dimensions')
main = replace_once(main, "        shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture').catch(() => {});\n", "        shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture').catch((error) => console.warn('Could not open macOS Screen Recording settings:', error));\n", 'mac settings warning')
main = replace_once(main, "  try { mainWindow.webContents.setZoomFactor(settings.zoomFactor); } catch (_) {}\n", "  try { mainWindow.webContents.setZoomFactor(settings.zoomFactor); } catch (error) { warnWebUiError('Could not apply zoom', error); }\n", 'zoom warning')
main = replace_once(main, "    autoUpdater.autoInstallOnAppQuit = Boolean(settings.installUpdatesOnQuit);\n", "    if (process.platform !== 'darwin') autoUpdater.autoInstallOnAppQuit = Boolean(settings.installUpdatesOnQuit);\n", 'settings updater preference')

old_mac_updates = """  if (process.platform === 'darwin') {
    if (manual) {
      showMessageBox({
        type: 'info',
        title: `VibeZ · ${text.updates}`,
        message: 'Unsigned macOS builds are updated manually from GitHub Releases.',
        detail: 'This avoids unreliable in-place installation without a paid Apple signing identity.',
        buttons: [text.openReleases, text.close],
        defaultId: 0,
        cancelId: 1,
      }).then((result) => { if (result.response === 0) shell.openExternal(RELEASES_URL); });
    }
    return;
  }
"""
new_mac_updates = """  if (process.platform === 'darwin') {
    void checkMacUpdates(manual);
    return;
  }
"""
main = replace_once(main, old_mac_updates, new_mac_updates, 'mac update flow')

old_ready = """  if (app.isPackaged) {
    installUpdaterHandlers();
    if (settings.autoUpdates && !process.env.FLATPAK_ID && process.platform !== 'darwin') checkForUpdates(false);
  }
"""
new_ready = """  if (app.isPackaged) {
    if (process.platform !== 'darwin') installUpdaterHandlers();
    if (settings.autoUpdates && !process.env.FLATPAK_ID) checkForUpdates(false);
  }
"""
main = replace_once(main, old_ready, new_ready, 'startup update flow')
main_path.write_text(main)

shot_path = Path('screenshot.js')
shot = shot_path.read_text()
shot = replace_once(shot, "const { t, uiBundle } = require('./i18n');\n", "const { t, uiBundle } = require('./i18n');\nconst { ACCOUNT_WORDS, SIGN_IN_WORDS, SIGN_UP_WORDS } = require('./ui-detection');\n", 'screenshot import')
shot = replace_once(shot, "        const screenshotLabel = ${JSON.stringify(t(currentLanguage(), 'screenshot'))};\n", "        const screenshotLabel = ${JSON.stringify(t(currentLanguage(), 'screenshot'))};\n        const accountLabels = ${JSON.stringify(ACCOUNT_WORDS)};\n        const signInLabels = new Set(${JSON.stringify(SIGN_IN_WORDS)});\n        const signUpLabels = new Set(${JSON.stringify(SIGN_UP_WORDS)});\n", 'screenshot injected labels')

old_auth = """          return hasEmailInput && (
            title.includes('inloggen') ||
            title.includes('login') ||
            title.includes('log in') ||
            title.includes('sign in') ||
            bodyText.includes('wachtwoord vergeten') ||
            bodyText.includes('forgot password') ||
            bodyText.includes('hieronder inloggen') ||
            bodyText.includes('sign in with')
          );
"""
new_auth = """          return hasEmailInput && (
            [...signInLabels].some((label) => title.includes(label) || bodyText.includes(label)) ||
            bodyText.includes('wachtwoord vergeten') ||
            bodyText.includes('forgot password') ||
            bodyText.includes('hieronder inloggen') ||
            bodyText.includes('sign in with')
          );
"""
shot = replace_once(shot, old_auth, new_auth, 'screenshot auth detection')
shot = replace_once(shot, "          const signUpLabels = new Set(['aanmelden', 'sign up', 'register', 'registreren', 'create account']);\n          const signInLabels = new Set(['inloggen', 'login', 'log in', 'sign in']);\n\n", "", 'screenshot local account sets')
shot = replace_once(shot, "              if (['aanmelden', 'inloggen', 'login', 'log in', 'sign in', 'sign up', 'register'].some((label) => text.includes(label))) return false;\n", "              if (accountLabels.some((label) => text.includes(label))) return false;\n", 'screenshot account exclusion')
shot_path.write_text(shot)

settings_path = Path('settings.html')
settings = settings_path.read_text()
settings = replace_once(settings, "    el('autoUpdatesRow').hidden=isMac;\n    el('installOnQuitRow').hidden=isMac;\n", "    el('autoUpdatesRow').hidden=false;\n    el('installOnQuitRow').hidden=isMac;\n", 'mac settings update row')
settings_path.write_text(settings)

pkg_path = Path('package.json')
pkg = pkg_path.read_text()
pkg = replace_once(pkg, "node --check native-button-preload.js && node --check i18n.js && node --check locales/*.js", "node --check native-button-preload.js && node --check i18n.js && node --check ui-detection.js && node --check locales/*.js", 'package check script')
pkg_path.write_text(pkg)

platform_test = Path('test/platform.test.js')
p = platform_test.read_text()
old_test = """test('macOS screenshot permission and unsigned update behavior are explicit', () => {
  assert.match(main, /getMediaAccessStatus\\('screen'\\)/);
  assert.match(main, /Privacy_ScreenCapture/);
  assert.match(main, /Unsigned macOS builds are updated manually from GitHub Releases/);
  assert.match(settings, /autoUpdatesRow/);
  assert.match(settings, /installOnQuitRow/);
});
"""
new_test = """test('macOS keeps manual installation but can notify about new GitHub releases', () => {
  assert.match(main, /getMediaAccessStatus\\('screen'\\)/);
  assert.match(main, /Privacy_ScreenCapture/);
  assert.match(main, /async function checkMacUpdates/);
  assert.match(main, /LATEST_RELEASE_API/);
  assert.match(main, /void checkMacUpdates\\(manual\\)/);
  assert.match(settings, /el\\('autoUpdatesRow'\\)\\.hidden=false/);
  assert.match(settings, /el\\('installOnQuitRow'\\)\\.hidden=isMac/);
});
"""
p = replace_once(p, old_test, new_test, 'platform mac test')
platform_test.write_text(p)

screenshot_test = Path('test/screenshot-position.test.js')
screenshot_test.write_text("""const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ACCOUNT_WORDS } = require('../ui-detection');

const source = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');

test('native Screenshot button anchors left of the account action', () => {
  assert.match(source, /async function positionScreenshotButton\\(\\)[\\s\\S]*?getContentBounds\\(\\)/);
  assert.match(source, /anchor\\.left - width - gap/);
  assert.match(source, /SCREENSHOT_BUTTON_LAYOUT\\.gap/);
  for (const sample of ['aanmelden', 'sign up', 'inloggen', 'sign in', '注册', 'إنشاء حساب']) {
    assert.ok(ACCOUNT_WORDS.includes(sample), `missing account label: ${sample}`);
  }
  assert.doesNotMatch(source, /bounds\\.x \\+ bounds\\.width - 232/);
});

test('native Screenshot button stays above VibeZ web content without covering other apps', () => {
  assert.match(source, /alwaysOnTop: true/);
  assert.match(source, /focusable: false/);
  assert.match(source, /mainWindow\\.isFocused\\(\\)/);
  assert.match(source, /mainWindow\\.on\\('blur', \\(\\) => screenshotButtonWindow\\?\\.hide\\(\\)\\)/);
});

test('Screenshot anchors before the whole account button cluster', () => {
  assert.match(source, /const accountWords = \\${JSON\\.stringify\\(ACCOUNT_WORDS\\)}/);
  assert.match(source, /const accountMatches = nodes\\.filter/);
  assert.match(source, /Math\\.min\\(\\.\\.\\.accountMatches\\.map\\(\\(item\\) => item\\.rect\\.left\\)\\)/);
});

test('Screenshot layout uses named constants and selective diagnostics', () => {
  assert.match(source, /const SCREENSHOT_BUTTON_LAYOUT = Object\\.freeze/);
  assert.match(source, /minWidth: 146/);
  assert.match(source, /fallbackRightOffset: 330/);
  assert.match(source, /function warnWebUiError/);
  assert.match(source, /console\\.warn/);
  assert.match(source, /isLoadingMainFrame\\(\\)/);
});
""")

ui_test = Path('test/ui-detection.test.js')
ui_test.write_text("""const test = require('node:test');
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
""")

readme_path = Path('README.md')
readme = readme_path.read_text()
readme = readme.replace('VibeZ 1.4.0 brings the same VibeZ experience', 'VibeZ 1.4.1 brings the same VibeZ experience', 1)
old_updates = """VibeZ checks GitHub Releases for updates. Linux and Windows packages support VibeZ's in-app update flow where their package type allows it. The free unsigned macOS builds use **manual updates from GitHub Releases** because reliable in-place macOS updating requires a signed application.

Automatic checking and install-on-quit behavior can be configured in Settings where supported. Those two controls are hidden on unsigned macOS builds.
"""
new_updates = """VibeZ checks GitHub Releases for updates. Linux and Windows packages support VibeZ's in-app update flow where their package type allows it. The free unsigned macOS builds now **check automatically and notify you when a newer release exists**, while the actual macOS installation remains manual because reliable in-place updating requires a signed application.

Automatic update checking can be configured in Settings on all three platforms. Install-on-quit is available where in-app installation is supported and remains hidden on unsigned macOS builds. On macOS, an update notification opens the matching GitHub Release so you can download the new DMG or ZIP yourself.
"""
readme = replace_once(readme, old_updates, new_updates, 'README update section')
readme_path.write_text(readme)

changelog_path = Path('CHANGELOG.md')
changelog = changelog_path.read_text()
marker = '## [Unreleased]\n\n'
release = """## [1.4.1] - 2026-09-09

### Added
- Automatic macOS update-availability checks that notify users about a newer GitHub Release while keeping unsigned installation manual.
- Shared multilingual account-control detection used by both native and injected Screenshot UI paths.
- Regression coverage for centralized account labels, named Screenshot layout constants and the macOS notification-only update flow.

### Changed
- Replaced repeated Screenshot positioning magic numbers in the main process with named layout constants.
- Expanded the injected Screenshot fallback to use the same multilingual Sign in / Sign up detection as the native Screenshot button.
- Automatic update checking is now configurable on macOS; install-on-quit remains disabled there because unsigned in-place installation is intentionally unsupported.
- Expected navigation/render races stay quiet, while unexpected Screenshot UI failures now produce targeted diagnostic warnings.

### Kept intentionally
- Electron 43 automatic Ozone selection remains unchanged when Linux display backend is set to Automatic.
- The native Screenshot overlay still hides when VibeZ loses focus so it cannot float over unrelated applications.
- `electron-updater` remains on the valid 6.8.x release line; no downgrade is applied.

"""
if '## [1.4.1]' not in changelog:
    changelog = replace_once(changelog, marker, marker + release, 'changelog release insert')
changelog = changelog.replace('[Unreleased]: https://github.com/harald666/vibez/compare/v1.4.0...HEAD', '[Unreleased]: https://github.com/harald666/vibez/compare/v1.4.1...HEAD')
if '[1.4.1]:' not in changelog:
    changelog = changelog.replace('[1.4.0]: https://github.com/harald666/vibez/releases/tag/v1.4.0', '[1.4.1]: https://github.com/harald666/vibez/releases/tag/v1.4.1\n[1.4.0]: https://github.com/harald666/vibez/releases/tag/v1.4.0')
changelog_path.write_text(changelog)
