# Frame Bridge Demos

This directory contains demonstrations of the @uniweb/frame-bridge library.

## Running the Demos

### Option 1: Using a Simple HTTP Server

The demos need to be served via HTTP (not opened directly as `file://`) due to iframe security restrictions.

**Using Python 3:**
```bash
# From the project root
python3 -m http.server 8000

# Then open: http://localhost:8000/demos/basic/parent.html
```

**Using Node.js (with npx):**
```bash
# From the project root
npx http-server -p 8000

# Then open: http://localhost:8000/demos/basic/parent.html
```

**Using PHP:**
```bash
# From the project root
php -S localhost:8000

# Then open: http://localhost:8000/demos/basic/parent.html
```

### Option 2: Using a Development Server

If you're developing the library:

```bash
npm run dev
# This starts Rollup in watch mode

# In another terminal, serve the files:
python3 -m http.server 8000
```

## Available Demos

### Basic Demo (`/demos/basic/`)

Demonstrates core functionality:
- Parent-child communication
- Automatic dimension reporting
- URL synchronization
- Route navigation
- Custom message passing
- JSON-LD injection
- Dynamic content addition/removal

**Files:**
- `parent.html` - Parent frame with controls
- `child.html` - Child iframe with simulated routing

**What to try:**
1. Click navigation buttons in either parent or child
2. Watch URL parameter sync in browser address bar
3. Add/remove content in child to see auto-resize
4. Send custom messages bidirectionally
5. Update JSON-LD and inspect parent page `<head>` in DevTools
6. Monitor the event log for all communications

## Creating Your Own Demo

1. Create a new directory under `/demos/`
2. Create `parent.html` and `child.html`
3. Import the library:
   ```html
   <script type="module">
     import { ParentMessenger } from '../../src/parent/index.js';
     // or for built version:
     // import { ParentMessenger } from '../../dist/esm/parent.js';
   </script>
   ```

## Troubleshooting

### "Failed to load module" errors
- Make sure you're serving via HTTP, not opening files directly
- Check that paths to `../src/` are correct relative to your demo

### Messages not being received
- Check browser console for origin validation errors
- Verify both parent and child are using the same origin (localhost:8000)
- Check that `allowedOrigins` configuration matches your setup

### ResizeObserver warnings
- These are normal and don't affect functionality
- They occur when content changes rapidly

## Browser DevTools Tips

1. **Network Tab**: See iframe loading
2. **Console**: View all messenger logs (set `logLevel: 'debug'`)
3. **Elements Tab**: Inspect injected JSON-LD scripts
4. **Application Tab**: View postMessage activity

## Next Steps

After trying the basic demo:
1. Review the code to understand the API
2. Try modifying the `actionHandlers` to add custom actions
3. Experiment with different configuration options
4. Build your own integration with React or other frameworks
