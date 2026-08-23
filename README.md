# VibeZ

A simple Linux desktop client for [Mistral Vibe](https://vibe.mistral.ai/). VibeZ opens Vibe in its own application window, so you can use it like a regular desktop app.

> VibeZ is an independent desktop client and is not affiliated with or supported by Mistral AI. A Mistral account may be required to use Vibe.

## Features

- Opens the official Mistral Vibe web app in a standalone window.
- Provides Linux installation packages for Debian-based distributions, Fedora-based distributions, and AppImage.
- Checks for new GitHub releases automatically in installed versions.

## Install on Linux

Download the latest package from the [releases page](https://github.com/harald666/vibez/releases).

### Debian, Ubuntu, and Linux Mint

Open the `.deb` file with your software installer. After installation, **VibeZ** appears in your application menu.

You can also install it from a terminal:

```bash
sudo apt install ./VibeZ_1.0.0_amd64.deb
```

### Fedora

Download the RPM package and install it with:

```bash
sudo dnf install ./VibeZ-1.0.0.x86_64.rpm
```

### AppImage

If you prefer a portable version, download the AppImage from the same release, make it executable, and run it:

```bash
chmod +x VibeZ-1.0.0.AppImage
./VibeZ-1.0.0.AppImage
```

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
- `VibeZ-<version>.AppImage` — portable Linux version

## Updates

An installed version checks GitHub Releases for updates when it starts. Once an update has been downloaded, VibeZ restarts to install it.

## Development

VibeZ is built with [Electron](https://www.electronjs.org/). The main application code is in [`main.js`](main.js), which creates the application window and loads `https://vibe.mistral.ai/`.

## License

This project does not currently include a license. Add a `LICENSE` file before granting third parties permission to use, modify, or distribute the project.
