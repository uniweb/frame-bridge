# @uniweb/frame-bridge

Promise-based iframe communication library with automatic dimension reporting, URL synchronization, and JSON-LD injection.

## Features

- 🔄 **Promise-based messaging** - Clean async/await API instead of callback hell
- 📏 **Automatic dimension reporting** - ResizeObserver-based height updates
- 🔗 **URL synchronization** - Keep parent URL in sync with iframe routes
- 🔍 **JSON-LD injection** - SEO-friendly structured data from iframes
- 🔒 **Origin validation** - Secure cross-origin communication
- 📦 **Multiple iframes** - Support for multiple child frames
- 🎯 **Zero config** - Works out of the box with sensible defaults
- 🔧 **Fully customizable** - Progressive enhancement for advanced use cases

## Installation

```bash
npm install @uniweb/frame-bridge
```

Or use via CDN:

```html
<!-- Parent -->
<script src="https://cdn.jsdelivr.net/npm/@uniweb/frame-bridge@1.0.0/dist/auto/parent.min.js"></script>

<!-- Child -->
<script src="https://cdn.jsdelivr.net/npm/@uniweb/frame-bridge@1.0.0/dist/auto/child.min.js"></script>
```

## Quick Start

### Zero Config (Auto-init)

**Parent HTML:**

```html
<!DOCTYPE html>
<html>
  <head>
    <script src="https://cdn.../parent.min.js"></script>
  </head>
  <body>
    <iframe src="https://app.example.com" data-messenger-id="main"></iframe>

    <script>
      // Listen to iframe events
      window.FrameBridge.on("iframeReady", (id, info) => {
        console.log("Iframe ready:", id, info);
      });

      // Send message to iframe
      window.FrameBridge.sendToChild("main", "customAction", { foo: "bar" });
    </script>
  </body>
</html>
```

**Child HTML (in iframe):**

```html
<!DOCTYPE html>
<html>
  <head>
    <script src="https://cdn.../child.min.js"></script>
  </head>
  <body>
    <h1>Hello from iframe!</h1>

    <script>
      // Listen to parent events
      window.FrameBridge.on("parentReady", ({ params, config }) => {
        console.log("Parent ready, received params:", params);
      });

      // Send message to parent
      window.FrameBridge.sendToParent("customAction", { baz: "qux" });
    </script>
  </body>
</html>
```

### NPM with Custom Configuration

**Parent:**

```javascript
import { ParentMessenger } from "@uniweb/frame-bridge/parent";

const messenger = new ParentMessenger({
  // Security
  allowedOrigins: ["https://app.example.com", "https://*.trusted.com"],

  // Features (all default to true)
  autoResize: true,
  urlSync: true,
  jsonLD: true,

  // URL sync config
  urlParamKey: "route", // ?route=/users/123
  preserveOtherParams: true, // Keep other query params

  // Pass to children
  analyticsId: "GA-XXXXX",
  syncParams: ["term", "filter"], // Only sync these params

  // Callbacks
  onIframeReady: (id, { route, dimensions }) => {
    console.log(`Iframe ${id} ready at route ${route.path}`);
  },

  onRouteChange: (id, { path, title }) => {
    console.log(`Iframe ${id} navigated to ${path}`);
  },

  onDimensionUpdate: (id, { height }) => {
    console.log(`Iframe ${id} height: ${height}px`);
  },

  // Custom action handlers
  actionHandlers: {
    myCustomAction: (iframeId, params) => {
      console.log("Custom action from", iframeId, params);
      return { status: "success" };
    },
  },

  // Logging
  logLevel: "info", // 'silent', 'error', 'warn', 'info', 'debug'
});

// API
messenger.sendToChild("iframe-id", "navigate", { path: "/users/123" });
messenger.sendToAllChildren("setTheme", { theme: "dark" });

const iframe = messenger.getIframe("iframe-id");
// Returns: { window, origin, dimensions, route, metadata }

const allIframes = messenger.getAllIframes();
```

**Child:**

```javascript
import { ChildMessenger } from "@uniweb/frame-bridge/child";

const messenger = new ChildMessenger({
  // Security
  allowedOrigins: ["https://parent.example.com"],

  // Features
  dimensionReporting: true,
  routeReporting: true,

  // Custom route getter (for SPAs)
  getRoute: () => ({
    path: window.location.pathname,
    title: document.title,
  }),

  // Callbacks
  onParentReady: ({ params, config }) => {
    console.log("Received params from parent:", params);
    console.log("Analytics ID:", config.analyticsId);
  },

  onNavigate: ({ path }) => {
    // Parent requested navigation
    window.history.pushState({}, "", path);
  },

  onParamUpdate: (params) => {
    console.log("Params updated:", params);
  },

  // Custom action handlers
  actionHandlers: {
    myCustomAction: (params) => {
      console.log("Custom action:", params);
      return { status: "success" };
    },
  },

  // Metadata to send with announce
  metadata: {
    version: "1.0.0",
    type: "app",
  },

  // Logging
  logLevel: "info",
});

// API
messenger.updateRoute("/new-path", "New Title");
messenger.updateDimensions(); // Manual trigger
messenger.updateJSONLD({
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "My Article",
});

messenger.sendToParent("customAction", { data: "value" });

const param = messenger.getParam("term");
const allParams = messenger.getAllParams();
const gaId = messenger.getConfig("analyticsId");
```

## React Integration

**Child with React Router:**

```javascript
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { ChildMessenger } from "@uniweb/frame-bridge/child";

// Create messenger once (in App.jsx or top-level component)
const messenger = new ChildMessenger({
  getRoute: () => ({
    path: window.location.pathname,
    title: document.title,
  }),
  onNavigate: ({ path }) => {
    // Parent requested navigation - use React Router
    window.history.pushState({}, "", path);
  },
});

// Custom hook for route reporting
export function useRouteReporter() {
  const location = useLocation();

  useEffect(() => {
    messenger.updateRoute(location.pathname, document.title);
  }, [location]);
}

// In your App component
function App() {
  useRouteReporter(); // Automatically report route changes

  return <Routes>{/* Your routes */}</Routes>;
}
```

**Parent with React:**

```javascript
import { useEffect, useState } from "react";
import { ParentMessenger } from "@uniweb/frame-bridge/parent";

function IframeEmbed() {
  const [iframeRoute, setIframeRoute] = useState("/");
  const [messenger] = useState(
    () =>
      new ParentMessenger({
        onRouteChange: (id, { path }) => {
          setIframeRoute(path);
        },
      })
  );

  useEffect(() => {
    return () => messenger.destroy();
  }, [messenger]);

  return (
    <div>
      <p>Current iframe route: {iframeRoute}</p>
      <iframe src="https://app.example.com" />
      <button
        onClick={() =>
          messenger.sendToAllChildren("navigate", { path: "/users" })
        }
      >
        Go to Users
      </button>
    </div>
  );
}
```

## Advanced Features

### Custom Actions

Define bidirectional custom actions:

```javascript
// Parent
const messenger = new ParentMessenger({
  actionHandlers: {
    userSelected: (iframeId, { userId }) => {
      console.log(`User ${userId} selected in iframe ${iframeId}`);
      return { success: true };
    },
  },
});

// Child
const messenger = new ChildMessenger({
  actionHandlers: {
    loadUser: ({ userId }) => {
      // Load user data
      return { user: { id: userId, name: "John" } };
    },
  },
});

// Usage
// In child: await messenger.sendToParent('userSelected', { userId: 123 });
// In parent: const { user } = await messenger.sendToChild('iframe-1', 'loadUser', { userId: 123 });
```

### Multiple Iframes

```javascript
const messenger = new ParentMessenger({
  onIframeReady: (id, info) => {
    console.log("Iframe registered:", id);
  },
});

// Send to specific iframe
messenger.sendToChild("iframe-1", "action", { data: "value" });

// Send to all iframes
messenger.sendToAllChildren("action", { data: "value" });

// Get iframe info
const iframe1 = messenger.getIframe("iframe-1");
const allIframes = messenger.getAllIframes();
```

### JSON-LD for SEO

```javascript
// Child sends structured data
messenger.updateJSONLD({
  "@context": "https://schema.org",
  "@type": "Product",
  name: "Widget",
  offers: {
    "@type": "Offer",
    price: "19.99",
  },
});

// Parent automatically injects into <head>:
// <script type="application/ld+json" data-iframe-id="iframe-1">
//   { ... }
// </script>
```

### Security

```javascript
// Parent: Only accept messages from specific origins
const messenger = new ParentMessenger({
  allowedOrigins: [
    "https://app.example.com",
    "https://*.trusted.com", // Wildcard support
  ],
});

// Child: Only accept messages from parent origin
const messenger = new ChildMessenger({
  allowedOrigins: ["https://parent.example.com"],
});
```

## API Reference

### ParentMessenger

#### Constructor Options

- `allowedOrigins`: `string[]` - Allowed child origins (default: same-origin only)
- `autoResize`: `boolean` - Auto-resize iframes (default: `true`)
- `urlSync`: `boolean` - Sync URL with iframe routes (default: `true`)
- `urlParamKey`: `string` - Query param key for routes (default: `'path'`)
- `jsonLD`: `boolean` - Enable JSON-LD injection (default: `true`)
- `analyticsId`: `string` - GA ID to pass to children
- `syncParams`: `string[]` - Params to sync (default: all)
- `onIframeReady`: `(id, info) => void` - Iframe ready callback
- `onRouteChange`: `(id, route) => void` - Route change callback
- `onDimensionUpdate`: `(id, dimensions) => void` - Dimension update callback
- `actionHandlers`: `object` - Custom action handlers
- `timeout`: `number` - Message timeout (default: 5000ms)
- `logLevel`: `string|number` - Logging level (default: `'info'`)

#### Methods

- `sendToChild(iframeId, action, params)`: Send message to specific iframe
- `sendToAllChildren(action, params)`: Send message to all iframes
- `getIframe(iframeId)`: Get iframe metadata
- `getAllIframes()`: Get all iframe metadata
- `setLogLevel(level)`: Change log level
- `destroy()`: Cleanup and destroy

### ChildMessenger

#### Constructor Options

- `allowedOrigins`: `string[]` - Allowed parent origins (default: same-origin only)
- `dimensionReporting`: `boolean` - Enable dimension reporting (default: `true`)
- `routeReporting`: `boolean` - Enable route reporting (default: `true`)
- `getRoute`: `() => { path, title }` - Custom route getter
- `onParentReady`: `({ params, config }) => void` - Parent ready callback
- `onNavigate`: `({ path }) => void` - Navigation request callback
- `onParamUpdate`: `(params) => void` - Param update callback
- `actionHandlers`: `object` - Custom action handlers
- `metadata`: `object` - Metadata to send with announce
- `timeout`: `number` - Message timeout (default: 5000ms)
- `logLevel`: `string|number` - Logging level (default: `'info'`)

#### Methods

- `sendToParent(action, params)`: Send message to parent
- `updateRoute(path, title)`: Manually update route
- `updateDimensions()`: Manually trigger dimension update
- `updateJSONLD(jsonld)`: Update JSON-LD structured data
- `getParam(key)`: Get parameter value
- `getAllParams()`: Get all parameters
- `getConfig(key)`: Get config value
- `setLogLevel(level)`: Change log level
- `destroy()`: Cleanup and destroy

## Browser Support

- Modern browsers with ES6+ support
- ResizeObserver (with fallback for older browsers)
- postMessage API

## License

MIT © Proximify

## Contributing

Contributions are welcome! Please open an issue or PR.

## Changelog

### 1.0.0

- Initial release
- Promise-based messaging
- Automatic dimension reporting
- URL synchronization
- JSON-LD injection
- Multi-iframe support
