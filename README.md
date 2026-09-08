# VibeZ

A simple Linux desktop client for [Mistral Vibe](https://vibe.mistral.ai/). VibeZ opens Vibe in its own application window, so you can use it like a regular desktop app.

> VibeZ is an independent desktop client and is not affiliated with or supported by Mistral AI. A Mistral account may be required to use Vibe.

## Features

- Opens the official Mistral Vibe web app in a standalone window.
- Built-in **Screenshot** button for selecting an area from your screen and sharing it directly with Vibe.
- Screenshot shortcut: **Ctrl+Shift+S**.
- Supports multi-monitor setups.
- Provides Linux installation packages for Debian-based distributions, Fedora-based distributions, Arch Linux and Arch-based distributions, plus AppImage.
- Checks for new GitHub releases automatically in installed versions.

## Install on Linux

### Quick install

Install the latest VibeZ release with one command:

```bash
curl -fsSL https://raw.githubusercontent.com/harald666/vibez/main/install.sh | bash
```

The installer automatically detects Debian/Ubuntu/Linux Mint, Fedora/RPM-based distributions, or Arch Linux/Manjaro/EndeavourOS and downloads the correct package from the latest GitHub release.

Latest release: **VibeZ 1.2.0**

| Distribution | Download |
| --- | --- |
| Debian / Ubuntu / Linux Mint | [VibeZ_1.2.0_amd64.deb](https://github.com/harald666/vibez/releases/download/v1.2.0/VibeZ_1.2.0_amd64.deb) |
| Fedora / RPM-based | [VibeZ-1.2.0.x86_64.rpm](https://github.com/harald666/vibez/releases/download/v1.2.0/VibeZ-1.2.0.x86_64.rpm) |
| Arch Linux / Manjaro / EndeavourOS | [VibeZ-1.2.0.pacman](https://github.com/harald666/vibez/releases/download/v1.2.0/VibeZ-1.2.0.pacman) |
| Portable AppImage | [VibeZ-1.2.0.AppImage](https://github.com/harald666/vibez/releases/download/v1.2.0/VibeZ-1.2.0.AppImage) |

All releases are available on the [GitHub Releases page](https://github.com/harald666/vibez/releases).

### Debian, Ubuntu, and Linux Mint

Download the `.deb` package and open it with your software installer. After installation, **VibeZ** appears in your application menu.

You can also install it from a terminal:

```bash
sudo apt install ./VibeZ_1.2.0_amd64.deb
```

### Fedora

Download the RPM package and install it with:

```bash
sudo dnf install ./VibeZ-1.2.0.x86_64.rpm
```

### Arch Linux, Manjaro, and EndeavourOS

Download the Pacman package and install it with:

```bash
sudo pacman -U ./VibeZ-1.2.0.pacman
```

### AppImage

Download the AppImage, make it executable, and run it:

```bash
chmod +x VibeZ-1.2.0.AppImage
./VibeZ-1.2.0.AppImage
```

## Screenshots

VibeZ includes a built-in **Screenshot** button inside the Vibe interface.

Click **Screenshot** or press **Ctrl+Shift+S**, then drag over the part of the screen you want to share. VibeZ supports multiple monitors and makes it easy to capture something outside the VibeZ window without switching applications first.

## Build from source

### Requirements

- Linux
- A current [Node.js LTS release](https://nodejs.org/)
- npm (included with Node.js)

### Steps

```bash
git clone https://github.com/harald666/vibez.git
cd vibez
npm install
npm start
```

Create the distribution packages with:

```bash
npm run build
```

The generated files are placed in `dist/`:

- `VibeZ_<version>_amd64.deb` — Debian, Ubuntu, and Linux Mint
- `VibeZ-<version>.x86_64.rpm` — Fedora and other RPM-based distributions
- `VibeZ-<version>.pacman` — Arch Linux, Manjaro, EndeavourOS, and other Arch-based distributions
- `VibeZ-<version>.AppImage` — portable Linux version

## Updates

An installed version checks GitHub Releases for updates when it starts. Once an update has been downloaded, VibeZ restarts to install it.

## Development

VibeZ is built with [Electron](https://www.electronjs.org/). The main application code is in [`main.js`](main.js), which creates the application window and loads `https://vibe.mistral.ai/`.

## License

VibeZ is released under the [MIT License](LICENSE).

## Privacy

See the [Privacy Policy](PRIVACY.md) for details about local browser data, Mistral Vibe, and update checks.
