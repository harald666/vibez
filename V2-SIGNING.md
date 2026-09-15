# VibeZ 2.0 Signing Plan

This document describes the production signing path for VibeZ 2.0. Stable VibeZ 1.4.1 remains unchanged while the signing pipeline is prepared and tested.

## Goal

Production VibeZ 2.0 releases should ship as:

- **Windows x64:** signed NSIS installer.
- **macOS Intel and Apple Silicon:** Developer ID signed and Apple-notarized DMG/ZIP packages.
- **Linux x64:** AppImage, DEB, RPM, Pacman and Flatpak packages with SHA-256 checksums.

Beta builds can remain unsigned until credentials are connected. A beta must never be presented as signed unless verification succeeds in CI.

## Public package policy

VibeZ 2.0 deliberately keeps broad x86_64 Linux packaging as an ode to the Linux community while avoiding rarely used ARM64 desktop packages:

- Windows x64: NSIS `.exe`.
- macOS Apple Silicon: notarized `.dmg` plus ZIP for update compatibility.
- macOS Intel: notarized `.dmg` plus ZIP for update compatibility.
- Linux x64: AppImage, DEB, RPM, Pacman and Flatpak.

Windows ARM64 and Linux ARM64 are not part of the VibeZ 2.0 public release set. They can be reconsidered later if actual user demand justifies them.

## Windows — SignPath Foundation

VibeZ plans to use SignPath for free open-source Windows code signing.

Required external setup:

1. Apply at https://signpath.org/apply.html.
2. Enable MFA for GitHub and SignPath.
3. Install the SignPath GitHub App for `lecomputeur/vibez` when requested.
4. Create/link the predefined GitHub.com Trusted Build System in SignPath.
5. Create the SignPath project and signing policy.
6. Configure the SignPath artifact configuration for the VibeZ Windows installer.
7. Record:
   - SignPath Organization ID
   - Project slug
   - Signing policy slug
8. Create a SignPath API token with submitter permission.

Repository configuration to add after approval:

### GitHub secret

- `SIGNPATH_API_TOKEN`

### GitHub variables

- `SIGNPATH_ORGANIZATION_ID`
- `SIGNPATH_PROJECT_SLUG`
- `SIGNPATH_SIGNING_POLICY_SLUG`

The signing job must:

1. Build the Windows installer on a GitHub-hosted Windows runner.
2. Upload the unsigned installer as a GitHub Actions artifact.
3. Submit that exact artifact to SignPath using `signpath/github-action-submit-signing-request@v2`.
4. Wait for manual/required SignPath approval.
5. Download the signed artifact.
6. Verify the Authenticode signature before publication.
7. Generate updater metadata and checksums from the final signed file, not from the unsigned file.
8. Publish only the signed installer.

The current code-signing policy is published at:

https://lecomputeur.github.io/vibez/code-signing-policy.html

## macOS — Apple Developer ID + notarization

Required external setup:

1. Join the Apple Developer Program.
2. Create a **Developer ID Application** certificate.
3. Export the certificate/private key from Keychain as a password-protected `.p12`.
4. Create an App Store Connect API key for notarization and download the `.p8` file.
5. Record:
   - Apple Team ID
   - App Store Connect Key ID
   - App Store Connect Issuer ID

The following GitHub secrets are configured and used:

- `MAC_CERTIFICATE_P12_BASE64` — base64 of the exported `.p12`
- `MAC_CERTIFICATE_PASSWORD` — password protecting the `.p12`
- `APPLE_API_KEY_P8_BASE64` — base64 of the App Store Connect `.p8`
- `APPLE_API_KEY_ID`
- `APPLE_API_ISSUER`
- `APPLE_TEAM_ID`

CI will decode both files into the runner temporary directory. `CSC_LINK` will point to the decoded `.p12` and `APPLE_API_KEY` will point to the decoded `.p8`.

VibeZ 2.0 already contains:

- Hardened Runtime configuration.
- `build/entitlements.mac.plist`.
- `build/entitlements.mac.inherit.plist`.

The signed macOS release job must:

1. Build on a GitHub-hosted macOS runner.
2. Import/use the Developer ID Application certificate through electron-builder.
3. Notarize with Apple's notary service.
4. Verify `codesign`.
5. Verify Gatekeeper acceptance with `spctl` where applicable.
6. Verify notarization/stapling for the distributed artifact.
7. Publish only after all checks pass.

## Verified macOS release pipeline

The macOS signing and notarization path was verified end to end on 15 September 2026:

- Intel app: Developer ID signed, accepted by Apple, stapled and Gatekeeper verified.
- Intel DMG: accepted by Apple, stapled and validated.
- Apple Silicon app: Developer ID signed, accepted by Apple, stapled and Gatekeeper verified.
- Apple Silicon DMG: accepted by Apple, stapled and validated.
- Final ZIP and DMG artifacts were produced successfully for both architectures.

The permanent implementation is split between:

- `.github/workflows/release.yml` — calls the signed macOS builds and publishes only final `release-*` artifacts.
- `.github/workflows/macos-signed-release.yml` — reusable Intel/Apple Silicon build, signing, notarization, stapling and validation workflow.

For resilience, the workflow stores the exact signed app, the pre-notarization DMG and both Apple submission IDs as recovery artifacts for 90 days. Recovery artifacts use the `recovery-*` or `internal-*` prefix and are excluded from GitHub Releases.

## Production identity

The isolated beta currently uses a beta-specific app ID, executable name, protocol and profile so it can coexist with VibeZ 1.4.1.

Before VibeZ 2.0 stable, production builds must switch back to the stable identity:

- App ID: `com.vibez.app`
- Product name: `VibeZ`
- Executable: `vibez`
- Protocol: `vibez://`
- Normal VibeZ user-data profile

This identity switch must happen only in the production release path, not in the isolated beta build.

## Release gate for VibeZ 2.0 stable

VibeZ 2.0 must not be published as stable until all of these are true:

- Linux x64 AppImage, DEB, RPM, Pacman and Flatpak builds pass.
- Windows x64 build passes.
- macOS Intel and Apple Silicon builds pass.
- Windows installers are signed and signature verification passes.
- macOS apps are Developer ID signed and notarized.
- Automatic/update metadata is generated from final signed artifacts.
- Upgrade from VibeZ 1.4.1 to VibeZ 2.0 is tested.
- A clean install is tested on Windows and macOS.
- Screenshot, Settings, login/session persistence and tray/menu-bar behavior are tested on all three platforms.
- SHA-256 checksums are generated after signing/notarization.

## Security rules

- Private keys and API credentials are never committed to the repository.
- Signing secrets exist only in GitHub Secrets or the signing provider.
- Production signing runs only from GitHub-hosted runners and the official repository.
- Signed artifacts are never modified after signing; if a file changes, it must be signed again.
- An unsigned Windows/macOS artifact must never replace a signed production artifact with the same release version.
