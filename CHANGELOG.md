# Changelog

All notable changes to VibeZ will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.1.2] - 2026-08-25

### Added
- Added a native Arch Linux / Arch-based distribution package through the electron-builder `pacman` target.
- GitHub Releases now build VibeZ for AppImage, DEB, RPM and Arch Linux packages.
- Added Arch Linux runtime dependency metadata for GTK, notifications, NSS, X11 helpers, accessibility support and libsecret.

### Changed
- Added the `bsdtar` build dependency required for creating Pacman packages in the Ubuntu GitHub Actions runner.

## [1.1.0] - 2026-08-24

### Added
- Added a native **Screenshot** button to VibeZ.
- Added multi-monitor screenshot selection and capture.
- Screenshots are automatically inserted into the Vibe chat composer after capture.
- Added automatic update support through GitHub Releases.
- Added an automated Linux release workflow for AppImage, DEB and RPM packages.
- Added update metadata generation through `latest-linux.yml` for `electron-updater`.

### Changed
- Integrated the Screenshot button into the existing Vibe interface.
- Improved Screenshot button placement for logged-in and logged-out views.
- Kept the Screenshot button hidden on the authentication form.
- Stabilized Screenshot button positioning so it no longer jumps when Vibe action buttons appear or disappear.

### Fixed
- Fixed Screenshot button overlap with Vibe's star and share controls.

[Unreleased]: https://github.com/harald666/vibez/compare/v1.1.2...HEAD
[1.1.2]: https://github.com/harald666/vibez/compare/v1.1.0...v1.1.2
[1.1.0]: https://github.com/harald666/vibez/releases/tag/v1.1.0
