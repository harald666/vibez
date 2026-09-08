# VibeZ on Windows and macOS

VibeZ 1.4.0 adds native desktop packages for **Windows** and **macOS** alongside the existing Linux packages.

VibeZ is free and open source. To keep distribution at **€0**, the Windows and macOS packages are intentionally distributed **without paid code-signing certificates**. The files are built automatically from this GitHub repository by GitHub Actions and every public release includes SHA-256 checksums so you can verify the download.

## Windows

### Which download?

- Most Windows PCs: `VibeZ-<version>-Windows-x64.exe`
- Windows on ARM devices: `VibeZ-<version>-Windows-arm64.exe`

Download the installer from the [GitHub Releases](https://github.com/harald666/vibez/releases) page.

### Windows SmartScreen warning

Because the installer is not signed with a paid Windows code-signing certificate, Windows may show **Windows protected your PC** or **Unknown publisher**.

If you downloaded VibeZ from this repository:

1. Open the downloaded VibeZ installer.
2. If SmartScreen appears, choose **More info**.
3. Check that the app name is VibeZ and that the file came from the VibeZ GitHub release.
4. Choose **Run anyway**.
5. Continue through the VibeZ installer.

On managed work or school PCs, your administrator may block unsigned applications completely. VibeZ cannot bypass an administrator policy.

## macOS

### Which download?

- Apple Silicon (M1, M2, M3, M4 and newer): `VibeZ-<version>-macOS-arm64.dmg`
- Intel Mac: `VibeZ-<version>-macOS-x64.dmg`

A ZIP build is also supplied for each architecture. For most users, the DMG is the easiest option.

Download VibeZ from the [GitHub Releases](https://github.com/harald666/vibez/releases) page, open the DMG and drag **VibeZ** to **Applications**.

### macOS Gatekeeper warning

VibeZ is not notarized with a paid Apple Developer account, so macOS may initially say that it cannot verify the developer or that the app cannot be opened.

If you downloaded VibeZ from this repository:

1. Try to open VibeZ once from **Applications**.
2. Close the warning.
3. Open **System Settings → Privacy & Security**.
4. Scroll to the Security section.
5. Find the message that VibeZ was blocked and choose **Open Anyway**.
6. Confirm **Open** when macOS asks again.

Depending on the macOS version, you can also Control-click VibeZ in Applications, choose **Open**, and confirm the exception when that option is offered.

### Screenshot permission on macOS

The VibeZ Screenshot feature needs macOS screen-capture permission.

The first time macOS blocks screen capture, open **System Settings → Privacy & Security → Screen & System Audio Recording** (called **Screen Recording** on some macOS versions), enable VibeZ, then restart VibeZ if macOS requests it.

VibeZ only captures the screen when you explicitly start its Screenshot tool.

## Verify a download

Every VibeZ release publishes a `SHA256SUMS` file. Compare the checksum of your downloaded file with the value in that file.

### Windows PowerShell

```powershell
Get-FileHash .\VibeZ-1.4.0-Windows-x64.exe -Algorithm SHA256
```

### macOS Terminal

```bash
shasum -a 256 VibeZ-1.4.0-macOS-arm64.dmg
```

The calculated value must exactly match the corresponding line in `SHA256SUMS` on the GitHub release.

## Automatic updates

VibeZ checks GitHub Releases for updates. When an update has downloaded, VibeZ asks whether to restart and install it or postpone it. Because Windows and macOS builds are unsigned, the operating system may show its normal security warning again for a newly downloaded version.

## Why are the builds unsigned?

Microsoft and Apple charge for the developer identities normally used to sign public desktop applications. VibeZ deliberately keeps distribution free. The trade-off is the one-time operating-system warning described above.

Only download VibeZ from **https://github.com/harald666/vibez** or the website linked from that repository.