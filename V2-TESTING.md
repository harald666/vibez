# VibeZ 2.0 Test Shell

This branch is an isolated development line for the VibeZ 2.0 desktop shell.

## Safety

- Stable `main` remains on the VibeZ 1.x line.
- This branch does not publish GitHub Releases.
- The beta CI only uploads a Linux AppImage test artifact.
- Running the AppImage does not replace the installed stable DEB package.

## What changed

VibeZ 2.0 introduces a local VibeZ toolbar and places the official Mistral Vibe website in an Electron `WebContentsView` below it.

The toolbar contains:

- Back
- Forward
- Reload
- Screenshot
- Settings

The former floating always-on-top Screenshot window is not used by `main-v2.js`.

## Local development

```bash
git checkout v2.0-dev
npm install
npm start
```

## Linux beta artifact

The `VibeZ 2.0 Beta Test` GitHub Actions workflow builds an x64 AppImage without publishing a release. Download the workflow artifact, make the AppImage executable and run it alongside stable VibeZ.

```bash
chmod +x VibeZ-2.0.0-beta.1*.AppImage
./VibeZ-2.0.0-beta.1*.AppImage
```

Do not install the beta DEB over the stable package during the shell evaluation phase.
