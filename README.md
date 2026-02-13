# Frame Bridge

Iframe communication library for [Uniweb](https://github.com/uniweb). Provides a bidirectional, promise-based messaging protocol between parent and child frames with origin validation, dimension reporting, URL synchronization, and custom action handlers.

## Two Use Cases

**Editor (primary)** — Rich bidirectional protocol between the Uniweb editor and the dynamic-runtime preview iframe. Messengers are constructed programmatically with all embedding features off (the defaults), and handlers are registered dynamically via `setHandler`/`setHandlers`.

**Embedding (secondary)** — A non-Uniweb parent page hosts a Uniweb site in an iframe. Auto-init `<script>` tags opt into embedding features (URL sync, auto-resize, JSON-LD injection) for a drop-in experience.

## Installation

```bash
npm install @uniweb/frame-bridge
```

Or use auto-init scripts via CDN for the embedding use case:

```html
<!-- Parent page -->
<script src="https://cdn.jsdelivr.net/npm/@uniweb/frame-bridge/dist/auto/parent.min.js"></script>

<!-- Child iframe -->
<script src="https://cdn.jsdelivr.net/npm/@uniweb/frame-bridge/dist/auto/child.min.js"></script>
```

## Programmatic Usage

### Parent

```javascript
import { ParentMessenger } from '@uniweb/frame-bridge/parent'

const messenger = new ParentMessenger({
  allowedOrigins: ['https://app.example.com'],

  // Embedding features — all default to false
  autoResize: true,
  urlSync: true,
  jsonLD: true,

  // Callbacks
  onIframeReady: (id, { origin, route, dimensions, metadata }) => {
    console.log(`Iframe ${id} ready at ${route.path}`)
  },
  onRouteChange: (id, { path, title }) => {
    console.log(`Iframe navigated to ${path}`)
  },
  onDimensionUpdate: (id, { width, height }) => {
    console.log(`Iframe resized to ${height}px`)
  },

  // Custom action handlers
  actionHandlers: {
    userSelected: (iframeId, { userId }) => {
      return { success: true }
    },
  },
})

// Send messages
messenger.sendToChild('iframe-id', 'navigate', { path: '/users/123' })
messenger.sendToAllChildren('setTheme', { theme: 'dark' })

// Query iframe state
messenger.getIframe('iframe-id')   // { origin, dimensions, route, metadata }
messenger.getAllIframes()

// Update handlers after construction
messenger.setHandler('userSelected', (id, params) => { /* ... */ })
messenger.setHandlers({ action1: fn1, action2: fn2 })

// Cleanup
messenger.destroy()
```

### Child

```javascript
import { ChildMessenger } from '@uniweb/frame-bridge/child'

const messenger = new ChildMessenger({
  allowedOrigins: ['https://parent.example.com'],

  // Reporting features — all default to false
  dimensionReporting: true,
  routeReporting: true,

  // Custom route getter (for SPAs)
  getRoute: () => ({
    path: window.location.pathname,
    title: document.title,
  }),

  // Callbacks
  onParentReady: (response) => {
    console.log('Connected to parent')
  },
  onNavigate: ({ path }) => {
    window.history.pushState({}, '', path)
  },

  // Custom action handlers
  actionHandlers: {
    loadUser: ({ userId }) => {
      return { user: { id: userId, name: 'John' } }
    },
  },

  // Extra data sent with announce
  metadata: { version: '1.0' },
})

// Manual updates
messenger.updateRoute('/search/results', 'Search Results')
messenger.updateDimensions()
messenger.updateJSONLD({ '@context': 'https://schema.org', '@type': 'WebPage' })

// Send messages
const result = await messenger.sendToParent('userSelected', { userId: 123 })

// Update handlers after construction
messenger.setHandlers({
  myAction: (params) => { /* can access current state */ },
})

// Cleanup
messenger.destroy()
```

### React Pattern

Construct the messenger once in `useState`, register handlers in `useEffect` so they can access current React state:

```javascript
import { useState, useEffect } from 'react'
import { ChildMessenger } from '@uniweb/frame-bridge/child'

function App() {
  const [count, setCount] = useState(0)
  const [messenger] = useState(() => new ChildMessenger({
    allowedOrigins: ['https://parent.example.com'],
  }))

  useEffect(() => {
    messenger.setHandlers({
      getCount: () => ({ count }),  // always reads current state
      navigate: ({ path }) => {
        window.history.pushState({}, '', path)
      },
    })
    return () => messenger.destroy()
  }, [messenger, count])

  return <div>{/* ... */}</div>
}
```

## Embedding with Auto-Init Scripts

The auto-init scripts create a `window.FrameBridge` object with all embedding features enabled. No imports needed.

**Parent page:**

```html
<iframe src="https://app.example.com" data-messenger-id="main"></iframe>
<script src="https://cdn.../parent.min.js"></script>
<script>
  window.FrameBridge.on('routeChange', (id, { path, title }) => {
    console.log('Iframe navigated to:', path)
  })

  window.FrameBridge.on('iframeReady', (id, info) => {
    console.log('Iframe registered:', id)
  })
</script>
```

**Child iframe:**

```html
<script src="https://cdn.../child.min.js"></script>
<script>
  window.FrameBridge.on('parentReady', (response) => {
    console.log('Connected to parent')
  })
</script>
```

The auto-init parent enables `autoResize`, `urlSync`, and `jsonLD`. The auto-init child enables `dimensionReporting` and `routeReporting`.

## Architecture

The library is split into parent and child messengers that communicate via `postMessage`.

**Parent-side (`src/parent/`):**
- `ParentMessenger.js` — Main parent frame messenger
- `IframeRegistry.js` — Tracks registered iframe metadata (origin, dimensions, route)
- `URLSyncManager.js` — Syncs parent URL with iframe routes, handles browser navigation
- `JSONLDInjector.js` — Injects structured data from iframes into parent `<head>`
- `auto-init.js` — Self-initializing IIFE for CDN usage

**Child-side (`src/child/`):**
- `ChildMessenger.js` — Main iframe messenger
- `DimensionReporter.js` — ResizeObserver-based dimension reporting (accounts for body margin/padding)
- `RouteReporter.js` — Watches for route changes via pushState/replaceState patching
- `auto-init.js` — Self-initializing IIFE for CDN usage

**Shared (`src/shared/`):**
- `BaseMessenger.js` — Abstract base class with promise-based postMessage wrapper
- `OriginValidator.js` — Validates message origins (supports wildcards like `https://*.example.com`)
- `constants.js` — Action types, defaults, error messages
- `utils.js` — Logger, debounce, iframe detection utilities

### Message Flow

1. **Initialization** — Child announces itself to parent (`ANNOUNCE`). Parent responds with iframe ID and optional initial route. Child starts reporters if enabled.

2. **Route updates (opt-in)** — Child navigates internally and sends `UPDATE_ROUTE`. The `onRouteChange` callback always fires. If `urlSync` is enabled, parent also updates the URL query param. Browser back/forward sends `NAVIGATE` to child.

3. **Dimension updates (opt-in)** — ResizeObserver detects changes. Child sends `UPDATE_DIMENSIONS`. Parent auto-resizes iframe if `autoResize` is enabled.

4. **Custom actions** — Both sides can register `actionHandlers` for bidirectional RPC. All messages return promises.

### Build Outputs

Rollup generates multiple formats in `dist/`:
- **ESM** (`dist/esm/`) — For modern bundlers
- **UMD** (`dist/umd/`) — For universal module systems
- **IIFE** (`dist/auto/`) — Auto-initializing scripts for `<script>` tags (minified and unminified)

Each format has separate bundles for the full library (`index`), parent-only (`parent`), and child-only (`child`).

## API Reference

### ParentMessenger

#### Constructor Options

| Option | Type | Default | Description |
|---|---|---|---|
| `allowedOrigins` | `string[]` | Same-origin only | Allowed child origins |
| `autoResize` | `boolean` | `false` | Auto-resize iframes to content |
| `urlSync` | `boolean` | `false` | Sync parent URL with iframe routes |
| `urlParamKey` | `string` | `'path'` | Query param key for routes |
| `preserveOtherParams` | `boolean` | `true` | Keep other query params when syncing |
| `jsonLD` | `boolean` | `false` | Inject JSON-LD from iframes into `<head>` |
| `onIframeReady` | `function` | - | `(iframeId, { origin, dimensions, route, metadata })` |
| `onRouteChange` | `function` | - | `(iframeId, { path, title })` |
| `onDimensionUpdate` | `function` | - | `(iframeId, { width, height })` |
| `actionHandlers` | `object` | `{}` | Custom action handlers |
| `timeout` | `number` | `5000` | Message timeout (ms) |
| `logLevel` | `number\|string` | `3` (`'INFO'`) | Logging verbosity |

#### Methods

| Method | Returns | Description |
|---|---|---|
| `sendToChild(iframeId, action, params)` | `Promise` | Send message to specific iframe |
| `sendToAllChildren(action, params)` | `Promise` | Send message to all iframes |
| `getIframe(iframeId)` | `object\|null` | Get iframe metadata |
| `getAllIframes()` | `object[]` | Get all iframe metadata |
| `setHandler(action, fn)` | `void` | Set/replace single action handler |
| `setHandlers(handlers)` | `void` | Set/replace multiple action handlers |
| `setLogLevel(level)` | `void` | Change log level |
| `destroy()` | `void` | Cleanup and remove listeners |

### ChildMessenger

#### Constructor Options

| Option | Type | Default | Description |
|---|---|---|---|
| `allowedOrigins` | `string[]` | Same-origin only | Allowed parent origins |
| `dimensionReporting` | `boolean` | `false` | Auto-report dimensions on resize |
| `dimensionThreshold` | `number` | `1` | Min px change to trigger report |
| `routeReporting` | `boolean` | `false` | Auto-report route changes |
| `getRoute` | `function` | Default getter | Returns `{ path, title }` |
| `onParentReady` | `function` | - | `(response)` |
| `onNavigate` | `function` | - | `({ path })` |
| `actionHandlers` | `object` | `{}` | Custom action handlers |
| `metadata` | `object` | `{}` | Extra data sent with announce |
| `timeout` | `number` | `5000` | Message timeout (ms) |
| `logLevel` | `number\|string` | `3` (`'INFO'`) | Logging verbosity |

#### Methods

| Method | Returns | Description |
|---|---|---|
| `sendToParent(action, params)` | `Promise` | Send message to parent |
| `updateRoute(path, title?)` | `void` | Manually report route change |
| `updateDimensions()` | `void` | Manually trigger dimension report |
| `updateJSONLD(jsonld)` | `void` | Send JSON-LD structured data |
| `setHandler(action, fn)` | `void` | Set/replace single action handler |
| `setHandlers(handlers)` | `void` | Set/replace multiple action handlers |
| `setLogLevel(level)` | `void` | Change log level |
| `destroy()` | `void` | Cleanup and remove listeners |

If `ChildMessenger` is constructed outside an iframe, it creates a no-op instance (`isActive = false`) with a console warning.

## License

MIT
