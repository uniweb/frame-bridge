# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- Switched to ESM-only builds (removed CommonJS/UMD support)
- Updated package.json with npm best practices (homepage, bugs, engines, sideEffects)
- Enhanced keywords for better discoverability
- Added CDN fields (unpkg, jsdelivr)

### Removed
- TypeScript type definitions (not currently supported)
- CommonJS/UMD builds (use ESM or IIFE/CDN builds instead)

## [0.0.3] - 2024-12-11

### Changed
- Corrected repository URL in package.json

## [0.0.2] - 2024-12-11

### Added
- Send to parent functionality

## [0.0.1] - 2024-11-08

### Added
- Initial release
- ParentMessenger for parent frame communication
- ChildMessenger for iframe communication
- Automatic URL synchronization between parent and child frames
- ResizeObserver-based dimension reporting
- JSON-LD injection for SEO
- Promise-based postMessage wrapper
- Origin validation for security
- Support for multiple iframes
- Auto-init builds for CDN usage

[Unreleased]: https://github.com/uniweb/frame-bridge/compare/v0.0.3...HEAD
[0.0.3]: https://github.com/uniweb/frame-bridge/compare/v0.0.2...v0.0.3
[0.0.2]: https://github.com/uniweb/frame-bridge/compare/v0.0.1...v0.0.2
[0.0.1]: https://github.com/uniweb/frame-bridge/releases/tag/v0.0.1
