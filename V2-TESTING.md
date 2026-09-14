# VibeZ 2.0 Test Shell

This branch is an isolated development line for the VibeZ 2.0 desktop shell.

## Safety

- Stable `main` remains on the VibeZ 1.x line.
- This branch does not publish GitHub Releases.
- VibeZ 2 Beta uses a separate app identity (`com.vibez.app.beta`), product name, executable name and user-data profile.
- The beta does not claim the stable `vibez://` protocol or alter the stable app's start-at-login registration.
- Test packages can run alongside stable VibeZ without replacing the stable app.

## What changed

VibeZ 2.0 introduces a local VibeZ toolbar and places the official Mistral Vibe website in an Electron `WebContentsView` below it.

The toolbar contains:

- Back
- Forward
- Reload
- Screenshot
- Settings

The browser-style service/hostname pill has intentionally been removed. The shell should feel like a desktop application, not a browser chrome around a website.

The former floating always-on-top Screenshot window is not used by `main-v2.js`.

## Cross-platform beta CI

The `VibeZ 2.0 Beta Test` workflow validates the same shell on:

- Linux x64 and ARM64
- Windows x64 and ARM64
- macOS Intel and Apple Silicon

The workflow does not publish a release. It only uploads test artifacts.

Windows and macOS beta artifacts are currently marked **UNSIGNED**. They are for development testing only and can still trigger SmartScreen or Gatekeeper warnings.

## Signing direction for VibeZ 2.0 stable

VibeZ 2.0 is being prepared so the eventual stable Windows and macOS packages can ship without the current unsigned-app warnings:

- macOS keeps Hardened Runtime enabled and includes Developer ID-compatible Electron entitlements. The production pipeline will add Apple Developer ID signing and Apple notarization once credentials are available.
- Windows production packages are intended to be code-signed through a trusted signing provider such as SignPath Foundation (subject to approval) or another trusted certificate route.
- Signing credentials and private keys must stay outside the repository and be supplied only through protected CI secrets/signing services.
- Stable 2.0 will not be promoted until signed packages and the update path have been verified on the real operating systems.

## Local development

```bash
git checkout v2.0-dev
npm install
npm start
```

## Linux beta artifact

The Linux AppImage is the easiest way to test the shell without installing anything over the stable package.

```bash
chmod +x VibeZ-2-Beta-2.0.0-beta.1-Linux-x64.AppImage
./VibeZ-2-Beta-2.0.0-beta.1-Linux-x64.AppImage
```

Do not replace the stable package with beta installers during the shell evaluation phase.
