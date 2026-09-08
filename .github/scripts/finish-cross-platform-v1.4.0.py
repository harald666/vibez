from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"Missing expected block: {label}")
    return text.replace(old, new, 1)


# main.js: platform-specific behavior while keeping the Linux path intact.
main = Path('main.js')
s = main.read_text(encoding='utf-8')

s = replace_once(
    s,
    "  nativeImage,\n  session,\n} = require('electron');",
    "  nativeImage,\n  session,\n  systemPreferences,\n} = require('electron');",
    'electron import',
)

s = replace_once(
    s,
    "if (settings.displayBackend === 'wayland') {\n  app.commandLine.appendSwitch('enable-features', 'UseOzonePlatform');\n  app.commandLine.appendSwitch('ozone-platform', 'wayland');\n} else if (settings.displayBackend === 'x11') {\n  app.commandLine.appendSwitch('ozone-platform', 'x11');\n}",
    "if (process.platform === 'linux' && settings.displayBackend === 'wayland') {\n  app.commandLine.appendSwitch('enable-features', 'UseOzonePlatform');\n  app.commandLine.appendSwitch('ozone-platform', 'wayland');\n} else if (process.platform === 'linux' && settings.displayBackend === 'x11') {\n  app.commandLine.appendSwitch('ozone-platform', 'x11');\n}",
    'Linux display backend guard',
)

s = replace_once(
    s,
    "  const shortcut = String(settings.screenshotShortcut || '').replace('CommandOrControl', 'Ctrl');",
    "  const shortcut = String(settings.screenshotShortcut || '')\n    .replace('CommandOrControl', process.platform === 'darwin' ? 'Cmd' : 'Ctrl')\n    .replace('Super', process.platform === 'darwin' ? 'Cmd' : 'Super');",
    'shortcut display',
)

s = replace_once(
    s,
    "async function triggerScreenshot() {\n  if (!mainWindow || mainWindow.isDestroyed()) return false;\n  ensureMainVisible();",
    "async function triggerScreenshot() {\n  if (!mainWindow || mainWindow.isDestroyed()) return false;\n\n  if (process.platform === 'darwin' && typeof systemPreferences.getMediaAccessStatus === 'function') {\n    const status = systemPreferences.getMediaAccessStatus('screen');\n    if (status === 'denied' || status === 'restricted') {\n      ensureMainVisible();\n      const text = uiText();\n      const result = await showMessageBox({\n        type: 'warning',\n        title: `VibeZ · ${text.shotFailed}`,\n        message: text.shotFailedMessage,\n        detail: 'macOS requires Screen & System Audio Recording (Screen Recording) permission for screenshots. Enable VibeZ in System Settings → Privacy & Security, then try again.',\n        buttons: [text.settings, text.close],\n        defaultId: 0,\n        cancelId: 1,\n      });\n      if (result.response === 0) {\n        shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture').catch(() => {});\n      }\n      return false;\n    }\n  }\n\n  ensureMainVisible();",
    'macOS screen capture permission',
)

start = s.index('function autostartCommand() {')
end = s.index('\nfunction createMainWindow()', start)
autostart = r'''function autostartCommand() {
  if (process.env.FLATPAK_ID) return `flatpak run ${process.env.FLATPAK_ID} --hidden`;
  const executable = process.env.APPIMAGE || process.execPath;
  return `"${String(executable).replace(/"/g, '\\"')}" --hidden`;
}

function syncAutostart(enabled) {
  if (!app.isPackaged) return true;
  try {
    if (process.platform === 'win32') {
      app.setLoginItemSettings({
        openAtLogin: Boolean(enabled),
        path: process.execPath,
        args: ['--hidden'],
      });
      return app.getLoginItemSettings().openAtLogin === Boolean(enabled);
    }

    if (process.platform === 'darwin') {
      app.setLoginItemSettings({
        openAtLogin: Boolean(enabled),
        openAsHidden: true,
      });
      return app.getLoginItemSettings().openAtLogin === Boolean(enabled);
    }

    const dir = path.join(os.homedir(), '.config', 'autostart');
    const file = path.join(dir, 'vibez.desktop');
    if (!enabled) {
      try { fs.unlinkSync(file); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      return true;
    }
    fs.mkdirSync(dir, { recursive: true });
    const desktop = [
      '[Desktop Entry]',
      'Type=Application',
      'Name=VibeZ',
      `Comment=${uiText().desktopClient}`,
      `Exec=${autostartCommand()}`,
      'Terminal=false',
      'X-GNOME-Autostart-enabled=true',
      '',
    ].join('\n');
    fs.writeFileSync(file, desktop, 'utf8');
    return true;
  } catch (error) {
    console.error('Could not update autostart:', error);
    return false;
  }
}
'''
s = s[:start] + autostart + s[end:]

start = s.index('function distroName() {')
end = s.index('\nasync function showAbout()', start)
system_info = r'''function operatingSystemName() {
  if (process.platform === 'win32') return `Windows ${os.release()}`;
  if (process.platform === 'darwin') return `macOS ${os.release()}`;
  try {
    const text = fs.readFileSync('/etc/os-release', 'utf8');
    const match = text.match(/^PRETTY_NAME=(.*)$/m);
    return match ? match[1].replace(/^"|"$/g, '') : `Linux ${os.release()}`;
  } catch (_) {
    return `Linux ${os.release()}`;
  }
}

function systemInfoText() {
  const lines = [
    `VibeZ: ${app.getVersion()}`,
    `Electron: ${process.versions.electron}`,
    `Chromium: ${process.versions.chrome}`,
    `Node.js: ${process.versions.node}`,
    `OS: ${operatingSystemName()}`,
    `OS version: ${typeof os.version === 'function' ? os.version() : os.release()}`,
    `Architecture: ${process.arch}`,
    `Platform: ${process.platform}`,
    `Hardware acceleration setting: ${settings.hardwareAcceleration}`,
  ];

  if (process.platform === 'linux') {
    lines.push(
      `Session: ${process.env.XDG_SESSION_TYPE || 'unknown'}`,
      `Desktop: ${process.env.XDG_CURRENT_DESKTOP || 'unknown'}`,
      `Display backend setting: ${settings.displayBackend}`,
      `Flatpak: ${process.env.FLATPAK_ID || 'no'}`,
      `AppImage: ${process.env.APPIMAGE ? 'yes' : 'no'}`,
    );
  }

  if (process.platform === 'darwin' && typeof systemPreferences.getMediaAccessStatus === 'function') {
    lines.push(`Screen recording permission: ${systemPreferences.getMediaAccessStatus('screen')}`);
  }

  return lines.join('\n');
}
'''
s = s[:start] + system_info + s[end:]

s = replace_once(
    s,
    "    return { settings, ui: currentUiBundle() };",
    "    return { settings, ui: currentUiBundle(), platform: process.platform };",
    'settings get platform',
)

s = replace_once(
    s,
    "    const restartRequired = previous.hardwareAcceleration !== settings.hardwareAcceleration || previous.displayBackend !== settings.displayBackend || previous.language !== settings.language;",
    "    const displayBackendChanged = process.platform === 'linux' && previous.displayBackend !== settings.displayBackend;\n    const restartRequired = previous.hardwareAcceleration !== settings.hardwareAcceleration || displayBackendChanged || previous.language !== settings.language;",
    'platform-aware restart',
)

s = replace_once(
    s,
    "    return { settings, ui: currentUiBundle(), restartRequired, shortcutRegistered, autostartApplied };",
    "    return { settings, ui: currentUiBundle(), platform: process.platform, restartRequired, shortcutRegistered, autostartApplied };",
    'settings save platform',
)

flatpak_block = """  if (process.env.FLATPAK_ID) {
    if (manual) showMessageBox({ type: 'info', title: `VibeZ · ${text.updates}`, message: text.flatpakBuild, buttons: [text.openReleases, text.close], defaultId: 0 }).then((result) => { if (result.response === 0) shell.openExternal(RELEASES_URL); });
    return;
  }
"""
mac_update = flatpak_block + """  if (process.platform === 'darwin') {
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
s = replace_once(s, flatpak_block, mac_update, 'unsigned macOS updater behavior')

s = replace_once(
    s,
    "    if (settings.autoUpdates && !process.env.FLATPAK_ID) checkForUpdates(false);",
    "    if (settings.autoUpdates && !process.env.FLATPAK_ID && process.platform !== 'darwin') checkForUpdates(false);",
    'automatic updates platform guard',
)

s = replace_once(
    s,
    "app.on('window-all-closed', () => {\n  if (isQuitting || !settings.closeToTray) {",
    "app.on('window-all-closed', () => {\n  if (process.platform === 'darwin' && !isQuitting) return;\n  if (isQuitting || !settings.closeToTray) {",
    'macOS window lifecycle',
)

main.write_text(s, encoding='utf-8')

# settings.html: use the platform supplied by the trusted main process, not UA sniffing.
settings_path = Path('settings.html')
h = settings_path.read_text(encoding='utf-8')
h = replace_once(h, '<div class="row"><div><div class="label" data-i18n="autoUpdates">', '<div class="row" id="autoUpdatesRow"><div><div class="label" data-i18n="autoUpdates">', 'auto update row id')
h = replace_once(h, '<div class="row"><div><div class="label" data-i18n="installOnQuit">', '<div class="row" id="installOnQuitRow"><div><div class="label" data-i18n="installOnQuit">', 'install update row id')

old_platform = """  const platformText=String(navigator.userAgentData?.platform||navigator.platform||navigator.userAgent||'').toLowerCase();
  const isMac=platformText.includes('mac');
  const isLinux=platformText.includes('linux');
  el('displayBackendRow').hidden=!isLinux;
  if(isMac){
    const shortcut=el('screenshotShortcut');
    for(const option of shortcut.options){
      option.textContent=option.textContent.replace(/^Ctrl\\+/, 'Cmd+').replace(/^Super\\+/, 'Cmd+');
    }
  }
"""
new_platform = """  let platform='linux';let isMac=false;let isLinux=true;
  function applyPlatform(value){
    platform=String(value||'linux');isMac=platform==='darwin';isLinux=platform==='linux';
    el('displayBackendRow').hidden=!isLinux;
    el('autoUpdatesRow').hidden=isMac;
    el('installOnQuitRow').hidden=isMac;
    if(isMac){
      const shortcut=el('screenshotShortcut');
      for(const option of shortcut.options){
        option.textContent=option.textContent.replace(/^Ctrl\\+/, 'Cmd+').replace(/^Super\\+/, 'Cmd+');
      }
    }
  }
"""
h = replace_once(h, old_platform, new_platform, 'trusted platform settings')
h = replace_once(
    h,
    "  window.vibezSettings.get().then((payload)=>{const settings=payload.settings||payload;applyUi(payload.ui||{});fill(settings)}).catch((error)=>setStatus(error.message,'danger'));",
    "  window.vibezSettings.get().then((payload)=>{applyPlatform(payload.platform);const settings=payload.settings||payload;applyUi(payload.ui||{});fill(settings)}).catch((error)=>setStatus(error.message,'danger'));",
    'settings load platform',
)
settings_path.write_text(h, encoding='utf-8')

# README: be explicit that free unsigned macOS releases use manual updates.
readme = Path('README.md')
r = readme.read_text(encoding='utf-8')
r = r.replace(
    "VibeZ checks GitHub Releases for updates. Linux and Windows packages use the platform-appropriate updater behavior. For unsigned macOS builds, VibeZ may direct the user to the GitHub release when macOS security rules prevent an in-place update.\n\nAutomatic checking and install-on-quit behavior can be configured in Settings where supported.",
    "VibeZ checks GitHub Releases for updates. Linux and Windows packages support VibeZ's in-app update flow where their package type allows it. The free unsigned macOS builds use **manual updates from GitHub Releases** because reliable in-place macOS updating requires a signed application.\n\nAutomatic checking and install-on-quit behavior can be configured in Settings where supported. Those two controls are hidden on unsigned macOS builds.",
)
readme.write_text(r, encoding='utf-8')

# Windows/macOS guide: correct update expectations for the zero-cost unsigned builds.
guide = Path('WINDOWS-MACOS.md')
g = guide.read_text(encoding='utf-8')
old_updates = """## Automatic updates

VibeZ checks GitHub Releases for updates. When an update has downloaded, VibeZ asks whether to restart and install it or postpone it. Because Windows and macOS builds are unsigned, the operating system may show its normal security warning again for a newly downloaded version.
"""
new_updates = """## Updates

**Windows:** VibeZ can use the normal in-app update flow. Because the installer is unsigned, Windows may show its normal security warning again for a new version.

**macOS:** the free unsigned build deliberately uses manual updates from GitHub Releases. Reliable in-place macOS updating requires a signed application, so VibeZ opens the Releases page instead of pretending an unsigned automatic install is reliable.
"""
g = replace_once(g, old_updates, new_updates, 'Windows/macOS update guide')
guide.write_text(g, encoding='utf-8')

# Cross-platform landing page.
docs = Path('docs/index.html')
docs.write_text('''<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="VibeZ is a free cross-platform desktop client for Mistral Vibe, available for Windows, macOS and Linux.">
    <meta name="theme-color" content="#f36c45">
    <title>VibeZ — Mistral Vibe desktop client for Windows, macOS & Linux</title>
    <link rel="stylesheet" href="styles.css">
  </head>
  <body>
    <main>
      <section class="hero" aria-labelledby="page-title">
        <img class="app-icon" src="icon.png" alt="VibeZ logo">
        <div class="hero-copy">
          <p class="eyebrow">Independent · Open source · Windows · macOS · Linux</p>
          <h1 id="page-title">VibeZ</h1>
          <p class="lead">A free cross-platform desktop client for Mistral Vibe.</p>
          <div class="actions">
            <a class="button button-primary" href="https://github.com/harald666/vibez/releases/latest">Download VibeZ</a>
            <a class="button button-secondary" href="https://github.com/harald666/vibez">View on GitHub</a>
          </div>
        </div>
      </section>
      <section class="packages" aria-labelledby="packages-title">
        <h2 id="packages-title">Choose your platform</h2>
        <div class="package-grid">
          <article><span class="package-label">WINDOWS</span><h3>Windows x64 & ARM64</h3><p>Install VibeZ with the NSIS EXE installer. Free builds are unsigned, so SmartScreen can ask for confirmation.</p></article>
          <article><span class="package-label">macOS</span><h3>Apple Silicon & Intel</h3><p>DMG and ZIP downloads are available. Free builds are unsigned and may require Open Anyway in Privacy & Security.</p></article>
          <article><span class="package-label">LINUX</span><h3>Debian, Fedora, Arch & more</h3><p>Native DEB, RPM and Pacman packages plus AppImage; Flatpak is available on x86_64.</p></article>
          <article><span class="package-label">34 LANGUAGES</span><h3>System language aware</h3><p>VibeZ follows your operating-system language and includes RTL support for Arabic, Hebrew, Persian and Urdu.</p></article>
        </div>
      </section>
      <section class="details" aria-labelledby="details-title">
        <h2 id="details-title">One VibeZ, three desktop platforms</h2>
        <p>VibeZ opens the official Mistral Vibe web app in a focused desktop window and adds screenshot tools, tray or menu-bar integration, start-at-login and update support where the platform permits it.</p>
        <p>Windows and macOS builds are intentionally unsigned to keep the project at €0. The GitHub release includes SHA-256 checksums and clear first-launch instructions.</p>
        <p class="notice">VibeZ is an independent project and is not affiliated with or supported by Mistral AI. A Mistral account may be required to use Vibe.</p>
      </section>
    </main>
    <footer><p>Released under the <a href="https://github.com/harald666/vibez/blob/main/LICENSE">MIT License</a> by Le Computeur. Read the <a href="https://github.com/harald666/vibez/blob/main/PRIVACY.md">Privacy Policy</a>.</p></footer>
  </body>
</html>
''', encoding='utf-8')

# Changelog entry for the first cross-platform release.
changelog = Path('CHANGELOG.md')
c = changelog.read_text(encoding='utf-8')
marker = '## [Unreleased]\n\n'
entry = '''## [1.4.0] - 2026-09-08

### Added
- Windows x64 and Windows ARM64 NSIS installers.
- macOS DMG and ZIP packages for Apple Silicon and Intel Macs.
- Native Windows and macOS package verification in GitHub Actions alongside the existing Linux build matrix.
- Cross-platform download and first-launch documentation, including SmartScreen and Gatekeeper guidance for the zero-cost unsigned builds.
- Platform-aware start-at-login implementation for Windows and macOS while preserving Linux XDG autostart.
- macOS Screen Recording permission detection and a direct route to the relevant System Settings page when access is blocked.

### Changed
- VibeZ is now presented as a Windows, macOS and Linux desktop client from one shared Electron codebase.
- Linux-only Wayland/X11 settings are hidden on Windows and macOS and no longer affect those platforms.
- System information and shortcut labels are platform-aware.
- Free unsigned macOS builds use manual GitHub Release updates instead of claiming reliable unsigned in-place installation.
- Release automation builds, verifies, checksums and publishes Linux, Windows and macOS packages together.

### Security
- Windows and macOS packages remain unsigned by design to keep distribution at €0; release documentation explains the resulting OS warnings and SHA-256 verification.
- Existing renderer sandboxing, trusted-origin restrictions and dependency security auditing are preserved on all platforms.

'''
if '## [1.4.0]' not in c:
    c = replace_once(c, marker, marker + entry, 'changelog insertion')
c = c.replace('[Unreleased]: https://github.com/harald666/vibez/compare/v1.3.2...HEAD', '[Unreleased]: https://github.com/harald666/vibez/compare/v1.4.0...HEAD')
if '[1.4.0]:' not in c:
    c = c.replace('[1.3.2]: https://github.com/harald666/vibez/releases/tag/v1.3.2', '[1.4.0]: https://github.com/harald666/vibez/releases/tag/v1.4.0\n[1.3.2]: https://github.com/harald666/vibez/releases/tag/v1.3.2')
changelog.write_text(c, encoding='utf-8')

# Regression tests for the platform contracts.
test_path = Path('test/platform.test.js')
test_path.write_text(r'''const test = require('node:test');
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

test('macOS screenshot permission and unsigned update behavior are explicit', () => {
  assert.match(main, /getMediaAccessStatus\('screen'\)/);
  assert.match(main, /Privacy_ScreenCapture/);
  assert.match(main, /Unsigned macOS builds are updated manually from GitHub Releases/);
  assert.match(settings, /autoUpdatesRow/);
  assert.match(settings, /installOnQuitRow/);
});

test('settings receive platform identity from the trusted main process', () => {
  assert.match(main, /platform: process\.platform/);
  assert.match(settings, /applyPlatform\(payload\.platform\)/);
});
''', encoding='utf-8')
