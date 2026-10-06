# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **Note:** the `0.2.x` releases were made without changelog updates and are not
> reconstructed here — inventing them after the fact would be a guess.

## [Unreleased]

### Fixed

- **A reply nothing is waiting for is dropped, never answered.** A reply
  settles the promise waiting on its id. One that matched none — it arrived
  after its timeout, or it answered a request another messenger in the same
  window had sent — was handled as a new request and answered with "no
  handler". The other side received that answer as a reply *it* was not
  waiting for, and answered in turn: an exchange with no end. Measured with
  two windows, a late reply looped indefinitely, and a second messenger
  listening in one window made the loop grow exponentially. Such a reply is
  now dropped with a warning. An action registered under a name ending in
  `Response` is still handled as a request; a request so named that has no
  handler on the other side now times out instead of receiving a "no
  handler" reply.
- **Addressing several parent origins no longer leaves timers behind.**
  Before the handshake the child addresses every permitted parent origin.
  Each was sent as its own message with its own timer, so every copy the
  browser dropped logged *"Message timed out waiting for response"* five
  seconds after the handshake had succeeded. It is now one message posted to
  each origin, with one id and one timer, settled by the reply to the copy
  that was delivered. When nothing answers, one timeout is logged instead of
  one per origin. An origin listed twice is addressed once.
- **A destroyed messenger sends nothing.** `destroy()` stopped listening but
  not sending: an announce in progress kept retrying, posting announces whose
  replies nothing could hear, and ended about 16 seconds later as an
  unhandled *"Failed to announce to parent after retries"*. Destroying now
  ends the announce, and a send after `destroy()` rejects with *"Messenger
  destroyed"* without posting.

## [0.3.1] - 2026-08-24

### Fixed

- **The CDN auto-init bundles can now be used cross-origin.** Neither
  `dist/auto/child.min.js` nor `dist/auto/parent.min.js` set `allowedOrigins`,
  so `OriginValidator` defaulted each side to its *own* origin — meaning the
  cross-origin embedding this README documents could never complete a
  handshake. The child addressed itself (dropped silently by the browser) and
  both sides rejected the other on the way in. Broken since the bundles were
  introduced.

### Added

- **`data-allowed-origins` on the auto-init script tag.** Comma-separated
  origins, read from the executing `<script>` element. On the **child** it
  names the pages allowed to embed the document, and is required for
  cross-origin use. On the **parent** it is optional: with no attribute the
  parent derives the permitted child origins from the `src` of the iframes on
  the page, always keeping its own origin so the derivation can only widen the
  previous default, never narrow it.
- Tests for both auto-init bundles, which previously had none.

**Absence still means same-origin only, deliberately** — not `'*'`. The
auto-init child enables route reporting and acts on `navigate` from its parent,
so a permissive default would let any page that frames the document steer it.

## [0.3.0] - 2026-08-24

### Fixed

- **`ChildMessenger` no longer guesses which permitted origin is its embedder.**
  `sendToParent()` addressed `allowedOrigins[0]`, treating the first element of a
  permission **set** as if it identified the parent. When the real embedder was
  any other member the browser dropped every message with no error on either
  side, and the child reported a *timeout* — blaming the parent for not answering
  a message it never received. The child now addresses every permitted origin to
  bootstrap (the browser delivers to at most one), then **latches the origin it
  actually heard from** and addresses that exactly for every later message. This
  is the discipline the parent side has always used.
- **Wildcard patterns are no longer addressed.** `allowedOrigins` may hold
  patterns such as `https://*.example.com`, which `OriginValidator` matches on
  inbound messages. A pattern can never be a `postMessage` target — measured in
  Chrome, it is accepted without throwing and then delivered to nobody. Patterns
  are now skipped when addressing, and a set containing *only* patterns fails
  loudly instead of silently posting into the void.

### Changed

- **Message-timeout errors name the origin that was addressed.** A dropped
  `postMessage` is indistinguishable from a peer that never replied, so a bare
  timeout pointed at the wrong side of the connection.

## [0.1.0] - 2025-12-11

### Changed

- Switched to ESM-only builds (removed CommonJS/UMD support)
- Updated package.json with npm best practices (homepage, bugs, engines, sideEffects)
- Enhanced keywords for better discoverability
- Added CDN fields (unpkg, jsdelivr)

### Removed

- TypeScript type definitions (not currently supported)
- CommonJS/UMD builds (use ESM or IIFE/CDN builds instead)

## [0.0.3] - 2025-12-11

### Changed

- Corrected repository URL in package.json

## [0.0.2] - 2025-12-11

### Added

- Send to parent functionality

## [0.0.1] - 2025-11-08

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

[Unreleased]: https://github.com/uniweb/frame-bridge/compare/v0.3.1...HEAD
[0.3.1]: https://github.com/uniweb/frame-bridge/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/uniweb/frame-bridge/compare/v0.2.4...v0.3.0
[0.1.0]: https://github.com/uniweb/frame-bridge/compare/v0.0.3...v0.1.0
[0.0.3]: https://github.com/uniweb/frame-bridge/compare/v0.0.2...v0.0.3
[0.0.2]: https://github.com/uniweb/frame-bridge/releases/tag/v0.0.2
