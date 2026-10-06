# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Frame Bridge is an iframe communication library for Uniweb. Its **primary** use case is the editor designer mode — a rich bidirectional protocol between the editor parent and the dynamic-runtime child. Its **secondary** use case is embedding (a non-Uniweb parent hosting a Uniweb iframe).

## Development Commands

### Building

```bash
npm run build        # Production build (all formats)
npm run dev          # Watch mode for development
```

### Testing

```bash
npm test             # Run tests with Vitest
npm run test:watch   # Run tests in watch mode
```

## Architecture

### Core Components

The library is split into **parent** and **child** messengers that communicate via `postMessage`:

**Parent-side (`src/parent/`):**

- `ParentMessenger.js` - Main parent frame messenger
- `IframeRegistry.js` - Tracks registered iframe metadata (origin, dimensions, route)
- `URLSyncManager.js` - Syncs parent URL with iframe routes, handles browser navigation
- `JSONLDInjector.js` - Injects structured data from iframes into parent `<head>`
- `auto-init.js` - Self-initializing IIFE for CDN usage

**Child-side (`src/child/`):**

- `ChildMessenger.js` - Main iframe messenger
- `DimensionReporter.js` - ResizeObserver-based dimension reporting (accounts for body margin/padding)
- `RouteReporter.js` - Watches for route changes and reports to parent
- `auto-init.js` - Self-initializing IIFE for CDN usage

**Shared (`src/shared/`):**

- `BaseMessenger.js` - Abstract base class with promise-based postMessage wrapper
- `OriginValidator.js` - Validates message origins for security
- `constants.js` - Action types, defaults, error messages
- `utils.js` - Logger, debounce, iframe detection utilities

### Defaults

All embedding features default to **off**:

- `ParentMessenger`: `autoResize`, `urlSync`, `jsonLD` — all `false` by default
- `ChildMessenger`: `dimensionReporting`, `routeReporting` — all `false` by default

The auto-init IIFE scripts explicitly opt in (`autoResize: true`, etc.) for the embedding use case. The editor uses the defaults (all off) and only enables what it needs.

### Mutable Handlers

Action handlers can be updated after construction via `setHandler(action, fn)` or `setHandlers({ action: fn, ... })`.

**In React, one effect owns the messenger's whole lifetime** — created in it, destroyed in its
cleanup — and handlers read current state through a ref (the README's *React Pattern* has the full
example):

```jsx
useEffect(() => {
  const messenger = new ChildMessenger({
    actionHandlers: { myAction: (params) => doSomething(stateRef.current) },
  })
  return () => messenger.destroy()
}, [])
```

⛔ **Not in a `useState` initializer.** Construction is a side effect — it adds a window listener
and announces — and React's StrictMode runs initializers twice in development, so the extra
instance is never destroyed and keeps answering messages. ⛔ **Nor in an effect whose dependencies
change**, with `destroy()` in its cleanup: the cleanup runs on every change and leaves a destroyed
messenger in use. *(Until 2026-10-05 this file recommended the first, and the README both.)* To register
handlers after construction, pass `autoAnnounce: false`, call `setHandlers()`, then `announce()`.

### Message Flow

1. **Initialization:**
   - Child iframe announces itself to parent (`ANNOUNCE` action)
   - Parent responds with iframe ID and optional initial route
   - Child starts dimension/route reporters if enabled

2. **URL Sync (opt-in):**
   - Child navigates internally → sends `UPDATE_ROUTE` to parent
   - `onRouteChange` always fires directly from `handleRouteUpdate`
   - If `urlSync` is enabled, parent also updates URL query param
   - Browser back/forward → parent sends `NAVIGATE` to child

3. **Dimension Updates (opt-in):**
   - ResizeObserver detects changes → child sends `UPDATE_DIMENSIONS`
   - Parent auto-resizes iframe height if `autoResize` enabled

### Build Outputs

Rollup generates multiple formats in `dist/`:

- **ESM** (`dist/esm/`) - For modern bundlers
- **IIFE** (`dist/auto/`) - Auto-initializing scripts for `<script>` tags
  - Both minified (`.min.js`) and unminified versions

UMD builds were removed (`Remove UDM builds`); there is no `dist/umd/`.

**Why this package has a build at all, when most `@uniweb/*` packages ship plain
source.** The IIFE bundles are the reason: a frame-bridge child may have to run
inside an arbitrary iframe page with no bundler and no module system, which a
bare `src/` cannot serve.

⛔ **Do not drop `dist` from `files` to "simplify" the package.** The README
documents these bundles as jsDelivr script-tag includes
(`cdn.jsdelivr.net/npm/@uniweb/frame-bridge/dist/auto/parent.min.js`), and that
URL is live — jsDelivr serves any published tarball's files with no action from
us. Removing `dist` breaks a documented public entry point.

Note that the consumers of that entry point are **outside every repo we own** —
somebody embedding a site in an iframe on their own page. So searching our code
for usage cannot tell you whether it is used; a zero-hit grep means only that we
don't consume it ourselves. The README is the contract here, not our imports.

Note the entry split this creates: `exports` points at `src/`, while
`main`/`module` point at `dist/esm/index.js`. Any modern ESM resolver takes
`exports` and never sees `dist/`; only a `main`-resolving consumer does. The
banner is derived from `package.json` (see `rollup.config.js`) precisely because
that path is the one nobody developing here looks at — it shipped a hardcoded
`@version 1.0.0` for the package's whole history, and was found by a consumer
resolving the package the other way, not from inside.

ESM has three bundles — the full library (`index.js`), parent-only (`parent.js`) and child-only
(`child.js`); IIFE has two, `parent` and `child`, since each auto-init script runs on one side
(`rollup.config.js`).

## Key Implementation Details

### Promise-Based Messaging

All `sendMessage` calls return promises. The messenger generates unique message IDs and stores pending promises in a Map, resolving them when responses arrive.

### Iframe Identification

Iframes are identified via `data-messenger-id` attribute or auto-generated from iframe src hash. This allows multiple iframes per page.

### Dimension Accuracy

`DimensionReporter.getDimensions()` adds body margin, padding, and border to `scrollHeight` for accurate reporting. Debug info (`_debug` field) includes spacing breakdown.

### Security

`OriginValidator` checks message origins against allowedOrigins (supports wildcards like `https://*.example.com`). Defaults to same-origin only.

### ⛔ `allowedOrigins` is a permission SET, not an identity — and the two directions differ

**Nothing in it identifies the peer.** Every entry is an origin the deployment says *may* sit on
the other side. Reading any element of it as "the parent" is a category error, and it is one this
package made for six months (`a2d5aa3`, 2026-02-10, whose commit message says the quiet part:
*"uses the first allowedOrigin (the parent's origin)"*).

**Inbound is a match; outbound is an address.** They are not symmetric:

| | inbound (`validate`) | outbound (`postMessage` targetOrigin) |
|---|---|---|
| the set | matched against, patterns included | ⛔ **cannot be used as a target** |
| `https://*.example.com` | ✅ matches subdomains | ⛔ accepted **without throwing**, delivered to **nobody** |

⚠️ **That asymmetry is why the failure was invisible.** A wrong target is not rejected — the browser
drops the message, no error fires anywhere, and the sender's 5 s timeout reports it as *the peer did
not answer*. **Evidence pointing at the wrong side of the connection is worse
than no evidence at all.**

⭐ **The discipline, and the parent side has always had it: LEARN the origin, never guess it.**
`ParentMessenger.handleAnnounce` records `event.origin` into `IframeRegistry`, and `sendToChild`
addresses `iframe.origin`. `ChildMessenger` now does the same via `onValidatedMessage` →
`this.parentOrigin`, and only `window.parent` may set it — the validator admits *any* permitted
origin, which includes a sibling iframe or an opener that would otherwise capture our addressing.

The child speaks first, so it has one genuine bootstrap problem: at announce time nobody has told it
anything. It addresses **every concrete permitted origin**; the browser delivers to at most one.
That widens nothing (each origin is already permitted) and it is the **only** send that broadcasts —
after the reply lands, addressing is exact. Pinned by `tests/ChildMessenger.test.js`, whose fake
parent reproduces the measured browser semantics (accept anything, deliver only on an exact match).

⛔ **Do not "simplify" this back to a single target chosen from the list.** The list cannot answer
the question, and the failure it produces is silent.

### Retries

Child announce has retry logic (3 attempts, 500ms delay) in case parent isn't ready.

### RouteReporter Cleanup

`RouteReporter.stop()` restores original `pushState`/`replaceState` methods, preventing leaked history interception after the reporter is destroyed.

## Testing

Tests use Vitest with jsdom environment, in `tests/`. Run individual test files:

```bash
npm test -- tests/ChildMessenger.test.js
```
