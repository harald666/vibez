# Changelog

All notable changes to VibeZ will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.2.0] - 2026-08-25

### Added
- Browser-language interface text for the Screenshot button, screenshot selection, context menu, and Vibe Code guidance.
- Clear, localized instructions for using a screenshot with a Vibe Code project and test branch.
- VibeZ version in the application title bar.

### Changed
- Replaced the Vibe page title in the title bar with the VibeZ application name and version.
- Localized the right-click menu, including Google and DuckDuckGo search options.

### Fixed
- Restored reliable direct screenshot pasting in Chat and Work.

## [1.1.0] - 2026-08-24

### Added
- Added a native **Screenshot** button to VibeZ.
- Added multi-monitor screenshot selection and capture.
- Screenshots are automatically inserted into the Vibe chat composer after capture.
- Added automatic update support through GitHub Releases.
- Added Linux release packages for AppImage, DEB, RPM, and Arch Linux / Pacman.
- Added a native Arch Linux package for Arch, Manjaro, EndeavourOS, and other Arch-based distributions.
- Added update metadata generation through `latest-linux.yml` for `electron-updater`.

### Changed
- Integrated the Screenshot button into the existing Vibe interface.
- Improved Screenshot button placement for logged-in and logged-out views.
- Kept the Screenshot button hidden on the authentication form.
- Stabilized Screenshot button positioning so it no longer jumps when Vibe action buttons appear or disappear.

### Fixed
- Fixed Screenshot button overlap with Vibe's star and share controls.

[Unreleased]: https://github.com/harald666/vibez/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/harald666/vibez/releases/tag/v1.2.0
[1.1.0]: https://github.com/harald666/vibez/releases/tag/v1.1.0
