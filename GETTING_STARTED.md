# Getting Started with @uniweb/frame-bridge

A quick guide to get up and running with frame-bridge in 5 minutes.

## Installation

```bash
npm install @uniweb/frame-bridge
```

## Basic Setup

### Parent Frame (Simple)

```javascript
import { ParentMessenger } from '@uniweb/frame-bridge/parent';

// Create with defaults - that's it!
const messenger = new ParentMessenger();

// Optional: Listen to events
messenger.options.onIframeReady = (id, info) => {
  console.log('Iframe ready:', id, info.route);
};
```

### Child Frame (Simple)

```javascript
import { ChildMessenger } from '@uniweb/frame-bridge/child';

// Create with defaults - that's it!
const messenger = new ChildMessenger();

// Optional: Listen to parent
messenger.options.onParentReady = ({ params, config }) => {
  console.log('Received params:', params);
};
```

## What Happens Automatically

With the simple setup above, you automatically get:

✅ **Dimension Reporting** - Child height updates sent to parent  
✅ **Auto-resize** - Parent iframe resizes to fit content  
✅ **URL Sync** - Child route changes update parent URL  
✅ **JSON-LD Injection** - SEO metadata injected in parent  
✅ **Origin Validation** - Secure same-origin messaging  

## Common Use Cases

### Send Message from Parent to Child

```javascript
// Parent
messenger.sendToChild('iframe-id', 'navigate', { path: '/users' });
```

### Send Message from Child to Parent

```javascript
// Child
messenger.sendToParent('userSelected', { userId: 123 });
```

### Handle Custom Actions

```javascript
// Parent
const messenger = new ParentMessenger({
  actionHandlers: {
    userSelected: (iframeId, { userId }) => {
      console.log(`User ${userId} selected in ${iframeId}`);
      return { success: true };
    }
  }
});

// Child
const messenger = new ChildMessenger({
  actionHandlers: {
    loadUser: ({ userId }) => {
      // Load user...
      return { user: { id: userId, name: 'John' } };
    }
  }
});
```

### React Integration

```javascript
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { ChildMessenger } from '@uniweb/frame-bridge/child';

// Create once at app level
const messenger = new ChildMessenger({
  onNavigate: ({ path }) => {
    // Use React Router navigation
    window.history.pushState({}, '', path);
  }
});

// Hook for auto-reporting routes
function useRouteReporter() {
  const location = useLocation();
  
  useEffect(() => {
    messenger.updateRoute(location.pathname);
  }, [location]);
}

// Use in your App component
function App() {
  useRouteReporter();
  return <Routes>{/* your routes */}</Routes>;
}
```

## Configuration Options

### Security

```javascript
// Parent
new ParentMessenger({
  allowedOrigins: ['https://app.example.com', 'https://*.trusted.com']
});

// Child
new ChildMessenger({
  allowedOrigins: ['https://parent.example.com']
});
```

### Features

```javascript
// Parent
new ParentMessenger({
  autoResize: true,        // Auto-resize iframes
  urlSync: true,           // Sync URLs with iframe routes
  jsonLD: true,            // Inject JSON-LD from iframes
  analyticsId: 'GA-XXX',   // Pass to children
});

// Child
new ChildMessenger({
  dimensionReporting: true,  // Report dimensions
  routeReporting: true,      // Report route changes
});
```

## Testing Your Setup

1. **Open browser DevTools console**
2. **Look for logs**: `[FrameBridge] ...`
3. **Check Network tab** for postMessage activity
4. **Verify**: Child should announce, parent should respond

## Troubleshooting

**Messages not working?**
- Check origins match (use `http://localhost:3000`, not `localhost:3000`)
- Look for origin validation errors in console
- Verify both parent and child initialized

**Auto-resize not working?**
- Check `autoResize: true` in parent
- Verify child is reporting dimensions (check logs)

**URL not syncing?**
- Check `urlSync: true` in parent
- Check `routeReporting: true` in child
- Look at browser URL bar for `?path=...` parameter

## Next Steps

1. ✅ Try the [demo](./demos/README.md) - See it working live
2. 📖 Read the [full README](./README.md) - Learn all features
3. 🔧 Customize - Add your own action handlers
4. 🚀 Deploy - It just works!

## Quick Reference

```javascript
// Parent API
messenger.sendToChild(id, action, params)
messenger.sendToAllChildren(action, params)
messenger.getIframe(id)
messenger.getAllIframes()

// Child API
messenger.sendToParent(action, params)
messenger.updateRoute(path, title)
messenger.updateDimensions()
messenger.updateJSONLD(jsonld)
messenger.getParam(key)
messenger.getAllParams()
```

## Need Help?

- 🐛 Found a bug? [Open an issue](https://github.com/proximify/frame-bridge/issues)
- 💡 Have a question? Check the [full documentation](./README.md)
- 🤝 Want to contribute? PRs welcome!
