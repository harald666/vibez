# VibeZ

A Linux desktop client for [Mistral Vibe](https://vibe.mistral.ai/) with native desktop integration, screenshot tools and automatic updates.

> VibeZ is an independent desktop client and is not affiliated with or supported by Mistral AI. A Mistral account may be required to use Vibe.

## Features

- Opens the official Mistral Vibe web app in a dedicated Linux desktop window.
- **Global Screenshot** shortcut (`Ctrl+Shift+S` by default): select an area from any screen and send it to VibeZ.
- Built-in Screenshot button with multi-monitor support.
- System tray with Open, Screenshot, Settings, Check for updates, About and Quit actions.
- Settings for screenshot shortcuts, startup, tray behavior, hardware acceleration, Wayland/X11, zoom, language and updates.
- Optional start at login, minimize to tray and close to tray.
- Safer update flow with **Restart & update** or **Later** instead of an unexpected restart.
- External links open in your normal browser and web permissions are restricted to trusted Mistral pages.
- About window with version and system information that can be copied for bug reports.
- CLI commands including `vibez --version`, `vibez --screenshot` and `vibez --settings`.
- `vibez://` protocol support.
- Linux packages for x86_64 and ARM64, plus Flatpak on x86_64.
- Automatic update checks through GitHub Releases.

## Install on Linux

### Quick install

Install the latest VibeZ release with one command:

```bash
curl -fsSL https://raw.githubusercontent.com/harald666/vibez/main/install.sh | bash
```

The installer detects your Linux distribution and CPU architecture, downloads the matching package from the latest GitHub release and verifies its SHA-256 checksum when `SHA256SUMS` is available.

To uninstall a package installed this way:

```bash
curl -fsSL https://raw.githubusercontent.com/harald666/vibez/main/install.sh | bash -s -- --uninstall
```

Latest release: **VibeZ 1.3.0**

### Direct downloads — x86_64 / AMD64

| Distribution | Download |
| --- | --- |
| Debian / Ubuntu / Linux Mint | [VibeZ_1.3.0_amd64.deb](https://github.com/harald666/vibez/releases/download/v1.3.0/VibeZ_1.3.0_amd64.deb) |
| Fedora / RPM-based | [VibeZ-1.3.0.x86_64.rpm](https://github.com/harald666/vibez/releases/download/v1.3.0/VibeZ-1.3.0.x86_64.rpm) |
| Arch Linux / Manjaro / EndeavourOS | [VibeZ-1.3.0.pacman](https://github.com/harald666/vibez/releases/download/v1.3.0/VibeZ-1.3.0.pacman) |
| Portable AppImage | [VibeZ-1.3.0.AppImage](https://github.com/harald666/vibez/releases/download/v1.3.0/VibeZ-1.3.0.AppImage) |
| Flatpak bundle | [VibeZ-1.3.0-x86_64.flatpak](https://github.com/harald666/vibez/releases/download/v1.3.0/VibeZ-1.3.0-x86_64.flatpak) |

### Direct downloads — ARM64 / AArch64

| Distribution | Download |
| --- | --- |
| Debian / Ubuntu | [VibeZ_1.3.0_arm64.deb](https://github.com/harald666/vibez/releases/download/v1.3.0/VibeZ_1.3.0_arm64.deb) |
| Fedora / RPM-based | [VibeZ-1.3.0.aarch64.rpm](https://github.com/harald666/vibez/releases/download/v1.3.0/VibeZ-1.3.0.aarch64.rpm) |
| Arch-based ARM64 | [VibeZ-1.3.0-aarch64.pacman](https://github.com/harald666/vibez/releases/download/v1.3.0/VibeZ-1.3.0-aarch64.pacman) |
| Portable AppImage | [VibeZ-1.3.0-arm64.AppImage](https://github.com/harald666/vibez/releases/download/v1.3.0/VibeZ-1.3.0-arm64.AppImage) |

All releases and checksums are available on the [GitHub Releases page](https://github.com/harald666/vibez/releases).

### Manual package installation

Debian, Ubuntu and Linux Mint:

```bash
sudo apt install ./VibeZ_1.3.0_amd64.deb
```

Fedora:

```bash
sudo dnf install ./VibeZ-1.3.0.x86_64.rpm
```

Arch Linux, Manjaro and EndeavourOS:

```bash
sudo pacman -U ./VibeZ-1.3.0.pacman
```

AppImage:

```bash
chmod +x VibeZ-1.3.0.AppImage
./VibeZ-1.3.0.AppImage
```

Flatpak bundle:

```bash
flatpak install --user ./VibeZ-1.3.0-x86_64.flatpak
```

## Screenshot workflow

Press **Ctrl+Shift+S** from VibeZ or another application, then drag over the area you want to share. VibeZ captures the selected region across multi-monitor setups and brings VibeZ forward.

In Vibe Chat and Work, VibeZ places the screenshot on the clipboard and pastes it into the composer. In Vibe Code, VibeZ keeps the screenshot on the clipboard and shows guidance for saving it into your project as context.

The global shortcut, Screenshot button and shortcut combination can be changed in **Settings**.

## Desktop integration

VibeZ can stay available in the system tray, start automatically when you sign in, and optionally minimize or close to the tray. Display backend can be set to **Automatic**, **Wayland** or **X11**, and hardware acceleration can be **Automatic**, **Enabled** or **Disabled**.

## Command line

Installed package builds expose the `vibez` command:

```bash
vibez
vibez --version
vibez --screenshot
vibez --settings
```

## Updates

Installed releases can check GitHub Releases automatically. When an update has downloaded, VibeZ asks whether to **Restart & update** or install it later. Automatic checking and install-on-quit behavior can be configured in Settings.

## Build from source

### Requirements

- Linux
- A current Node.js LTS release
- npm

### Steps

```bash
git clone https://github.com/harald666/vibez.git
cd vibez
npm install
npm test
npm start
```

Build the configured Linux packages with:

```bash
npm run build
```

The release pipeline additionally builds x86_64 and ARM64 AppImage/DEB/RPM/Pacman packages, an x86_64 Flatpak bundle and a `SHA256SUMS` file.

## Testing

GitHub CI runs:

- dependency security audit at high severity and above;
- unit tests and JavaScript syntax checks;
- shell syntax validation for the installer;
- x86_64 package builds;
- ARM64 package builds;
- Flatpak build;
- a packaged x86_64 application smoke test under a virtual Linux display with Chromium sandboxing enabled.

## Development

VibeZ is built with [Electron](https://www.electronjs.org/). The main application code is in [`main.js`](main.js), screenshot handling is in [`screenshot.js`](screenshot.js), and persistent desktop preferences are handled by [`settings-store.js`](settings-store.js).

## License

VibeZ is released under the [MIT License](LICENSE).

## Privacy

See the [Privacy Policy](PRIVACY.md) for details about local settings, browser data, screenshots, Mistral Vibe and update checks.
