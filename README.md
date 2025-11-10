# Frame Bridge

Seamless URL synchronization and communication for iframe-embedded applications.

## The Problem

When you embed an application in an iframe (a search system, documentation site, store, etc.), the parent page URL becomes static. This breaks:

- **Deep linking** - Users can't link to specific pages within the iframe
- **SEO** - Search engines can't index individual pages in your embedded app
- **Bookmarking** - Users can't bookmark specific states
- **Browser navigation** - Back/forward buttons don't work as expected

## The Solution

Frame Bridge automatically synchronizes URLs between parent and child frames, passes parameters bidirectionally, and handles iframe dimensions and messaging - making your embedded application behave like a native part of the parent site.

```html
<!-- Parent URL: https://example.com/experts?term=biology -->
<!-- Iframe navigates to: /search/results -->
<!-- Parent URL updates to: https://example.com/experts?route=/search/results&term=biology -->
```

Users can now bookmark, share, and search engines can index every page in your embedded app.

## Features

- **URL Synchronization** - Keep parent URL in sync with iframe routes
- **Parameter Passing** - Pass query parameters from parent to child
- **Automatic Resizing** - ResizeObserver-based height updates
- **Promise-based Messaging** - Clean async/await API for parent-child communication
- **JSON-LD Injection** - SEO-friendly structured data from iframes
- **Origin Validation** - Secure cross-origin communication
- **Multiple Iframes** - Support for multiple child frames
- **Zero Config** - Works out of the box with sensible defaults

## Installation

**Coming soon (not yet published to npm)**

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
    <!-- Embed your application -->
    <iframe src="https://app.example.com" data-messenger-id="main"></iframe>

    <script>
      // URLs are automatically synchronized
      window.FrameBridge.on("routeChange", (id, { path, title }) => {
        console.log("Iframe navigated to:", path);
        // Parent URL automatically updated to: ?route=/new-path
      });
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
    <h1>My Embedded Application</h1>

    <script>
      // Access parameters passed from parent URL
      window.FrameBridge.on("parentReady", ({ params }) => {
        console.log("Received params:", params);
        // If parent URL is: ?term=biology&filter=active
        // params = { term: 'biology', filter: 'active' }
      });

      // Navigate and parent URL updates automatically
      window.location.href = "/search/results";
    </script>
  </body>
</html>
```

That's it! URLs are synchronized, parameters are passed, and the iframe resizes automatically.

## NPM Usage with Custom Configuration

### Parent Setup

```javascript
import { ParentMessenger } from "@uniweb/frame-bridge/parent";

const messenger = new ParentMessenger({
  // Security
  allowedOrigins: ["https://app.example.com"],

  // URL sync config (all default to true)
  urlSync: true,
  urlParamKey: "route", // ?route=/users/123
  preserveOtherParams: true, // Keep other query params

  // Pass config to children
  analyticsId: "GA-XXXXX",
  syncParams: ["term", "filter"], // Only sync these params to iframe

  // Features
  autoResize: true, // Automatically resize iframe to content
  jsonLD: true, // Inject JSON-LD from iframe into parent

  // Callbacks
  onIframeReady: (id, { route, dimensions }) => {
    console.log(`Iframe ready at ${route.path}`);
  },

  onRouteChange: (id, { path, title }) => {
    console.log(`Iframe navigated to ${path}`);
    // Parent URL automatically updated
  },

  onDimensionUpdate: (id, { height }) => {
    console.log(`Iframe height: ${height}px`);
    // Iframe automatically resized
  },
});

// Programmatic control
messenger.sendToChild("iframe-id", "navigate", { path: "/users/123" });
messenger.sendToAllChildren("setTheme", { theme: "dark" });
```

### Child Setup

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
    console.log("Received params:", params);
    console.log("Analytics ID:", config.analyticsId);

    // Use params to initialize your app
    if (params.term) {
      performSearch(params.term);
    }
  },

  onNavigate: ({ path }) => {
    // Parent requested navigation
    window.history.pushState({}, "", path);
  },

  onParamUpdate: (params) => {
    // Parent URL params changed
    console.log("Updated params:", params);
  },
});

// Update route manually (e.g., after navigation)
messenger.updateRoute("/search/results", "Search Results");

// Update JSON-LD for SEO
messenger.updateJSONLD({
  "@context": "https://schema.org",
  "@type": "SearchResultsPage",
  name: "Expert Search Results",
});

// Get current params
const searchTerm = messenger.getParam("term");
const allParams = messenger.getAllParams();
```

## React Integration

**Child with React Router:**

```javascript
import { useEffect } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { ChildMessenger } from "@uniweb/frame-bridge/child";

const messenger = new ChildMessenger({
  getRoute: () => ({
    path: window.location.pathname,
    title: document.title,
  }),
  onParentReady: ({ params }) => {
    // Initialize app with params from parent URL
    console.log("Parent params:", params);
  },
  onNavigate: ({ path }) => {
    window.history.pushState({}, "", path);
  },
});

// Hook to report route changes
export function useRouteReporter() {
  const location = useLocation();

  useEffect(() => {
    messenger.updateRoute(location.pathname, document.title);
  }, [location]);
}

// In your App component
function App() {
  useRouteReporter();
  return <Routes>{/* Your routes */}</Routes>;
}
```

**Parent with React:**

```javascript
import { useEffect, useState } from "react";
import { ParentMessenger } from "@uniweb/frame-bridge/parent";

function EmbeddedApp() {
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
      <iframe src="https://app.example.com" />
    </div>
  );
}
```

## Use Cases

### Embedded Search System

Parent URL: `example.com/experts?term=biology`  
→ Iframe searches and shows results  
→ User clicks an expert  
→ Parent URL updates to: `example.com/experts?route=/profile/john-doe&term=biology`  
→ URL is bookmarkable and indexable

### Embedded Documentation

Parent URL: `example.com/docs`  
→ User navigates through docs  
→ Parent URL updates to: `example.com/docs?route=/guides/getting-started`  
→ Deep links work, search engines index individual pages

### Embedded Store

Parent URL: `example.com/shop`  
→ User browses categories and products  
→ Parent URL updates to: `example.com/shop?route=/products/widget-123`  
→ Products are individually linkable and indexable

## Advanced Features

### Accurate Dimension Reporting

The library automatically accounts for body margin, padding, and border:

```javascript
// Child automatically includes all body spacing
const dimensions = {
  width: 1200,
  height: 1840, // = content (1800px) + margin (20px) + padding (20px)
};
```

### Custom Actions

Define bidirectional custom actions:

```javascript
// Parent
const messenger = new ParentMessenger({
  actionHandlers: {
    userSelected: (iframeId, { userId }) => {
      console.log(`User ${userId} selected`);
      return { success: true };
    },
  },
});

// Child
const messenger = new ChildMessenger({
  actionHandlers: {
    loadUser: ({ userId }) => {
      return { user: { id: userId, name: "John" } };
    },
  },
});

// Usage with promises
const result = await messenger.sendToParent("userSelected", { userId: 123 });
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
const iframe = messenger.getIframe("iframe-1");
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

// Parent automatically injects into <head>
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

| Option                | Type             | Default          | Description                 |
| --------------------- | ---------------- | ---------------- | --------------------------- |
| `allowedOrigins`      | `string[]`       | Same-origin only | Allowed child origins       |
| `urlSync`             | `boolean`        | `true`           | Sync URL with iframe routes |
| `urlParamKey`         | `string`         | `'path'`         | Query param key for routes  |
| `preserveOtherParams` | `boolean`        | `true`           | Keep other query params     |
| `autoResize`          | `boolean`        | `true`           | Auto-resize iframes         |
| `jsonLD`              | `boolean`        | `true`           | Enable JSON-LD injection    |
| `analyticsId`         | `string`         | -                | GA ID to pass to children   |
| `syncParams`          | `string[]`       | All params       | Params to sync to iframe    |
| `onIframeReady`       | `function`       | -                | Iframe ready callback       |
| `onRouteChange`       | `function`       | -                | Route change callback       |
| `onDimensionUpdate`   | `function`       | -                | Dimension update callback   |
| `actionHandlers`      | `object`         | -                | Custom action handlers      |
| `timeout`             | `number`         | `5000`           | Message timeout (ms)        |
| `logLevel`            | `string\|number` | `'info'`         | Logging level               |

#### Methods

- `sendToChild(iframeId, action, params)` - Send message to specific iframe
- `sendToAllChildren(action, params)` - Send message to all iframes
- `getIframe(iframeId)` - Get iframe metadata
- `getAllIframes()` - Get all iframe metadata
- `setLogLevel(level)` - Change log level
- `destroy()` - Cleanup and destroy

### ChildMessenger

#### Constructor Options

| Option               | Type             | Default          | Description                    |
| -------------------- | ---------------- | ---------------- | ------------------------------ |
| `allowedOrigins`     | `string[]`       | Same-origin only | Allowed parent origins         |
| `dimensionReporting` | `boolean`        | `true`           | Enable dimension reporting     |
| `dimensionThreshold` | `number`         | `1`              | Min px change to report        |
| `routeReporting`     | `boolean`        | `true`           | Enable route reporting         |
| `getRoute`           | `function`       | -                | Custom route getter            |
| `onParentReady`      | `function`       | -                | Parent ready callback          |
| `onNavigate`         | `function`       | -                | Navigation request callback    |
| `onParamUpdate`      | `function`       | -                | Param update callback          |
| `actionHandlers`     | `object`         | -                | Custom action handlers         |
| `metadata`           | `object`         | -                | Metadata to send with announce |
| `timeout`            | `number`         | `5000`           | Message timeout (ms)           |
| `logLevel`           | `string\|number` | `'info'`         | Logging level                  |

#### Methods

- `sendToParent(action, params)` - Send message to parent
- `updateRoute(path, title)` - Manually update route
- `updateDimensions()` - Manually trigger dimension update
- `updateJSONLD(jsonld)` - Update JSON-LD structured data
- `getParam(key)` - Get parameter value
- `getAllParams()` - Get all parameters
- `getConfig(key)` - Get config value
- `setLogLevel(level)` - Change log level
- `destroy()` - Cleanup and destroy

## Browser Support

- Modern browsers with ES6+ support
- ResizeObserver (with fallback for older browsers)
- postMessage API

## License

MIT © Proximify

## Contributing

Contributions are welcome! Please open an issue or PR.
