# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Frame Bridge is an iframe communication library that synchronizes URLs between parent and child frames, passes parameters bidirectionally, and handles dimension reporting and JSON-LD injection for SEO.

**Key use case:** When embedding applications in iframes (search systems, docs, stores), the parent URL typically stays static, breaking deep linking, SEO, and bookmarks. This library solves that by keeping parent URLs in sync with iframe routes.

## Development Commands

### Building
```bash
npm run build        # Production build (all formats)
npm run dev          # Watch mode for development
```

### Testing
```bash
npm test             # Run tests with Vitest
npm test:watch       # Run tests in watch mode
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

### Message Flow

1. **Initialization:**
   - Child iframe announces itself to parent (`ANNOUNCE` action)
   - Parent responds with config (analytics ID, URL params)
   - Child receives initial params and starts reporters

2. **URL Sync:**
   - Child navigates internally → sends `UPDATE_ROUTE` to parent
   - Parent updates URL query param (e.g., `?route=/new-path`)
   - Browser back/forward → parent sends `NAVIGATE` to child

3. **Dimension Updates:**
   - ResizeObserver detects changes → child sends `UPDATE_DIMENSIONS`
   - Parent auto-resizes iframe height

### Build Outputs

Rollup generates multiple formats in `dist/`:
- **ESM** (`dist/esm/`) - For modern bundlers (main exports)
- **UMD** (`dist/umd/`) - For universal module systems
- **IIFE** (`dist/auto/`) - Auto-initializing scripts for `<script>` tags
  - Both minified (`.min.js`) and unminified versions

Each format has separate bundles for:
- Full library (`index.js`)
- Parent-only (`parent.js`)
- Child-only (`child.js`)

## Key Implementation Details

### Promise-Based Messaging
All `sendMessage` calls return promises. The messenger generates unique message IDs and stores pending promises in a Map, resolving them when responses arrive.

### Iframe Identification
Iframes are identified via `data-messenger-id` attribute or auto-generated from iframe src hash. This allows multiple iframes per page.

### Dimension Accuracy
`DimensionReporter.getDimensions()` adds body margin, padding, and border to `scrollHeight` for accurate reporting. Debug info (`_debug` field) includes spacing breakdown.

### Security
`OriginValidator` checks message origins against allowedOrigins (supports wildcards like `https://*.example.com`). Defaults to same-origin only.

### Retries
Child announce has retry logic (3 attempts, 1s delay) in case parent isn't ready.

## Testing

Tests use Vitest with jsdom environment. Run individual test files:
```bash
npm test -- src/parent/ParentMessenger.test.js
```

Coverage reports are generated in `coverage/` directory.
