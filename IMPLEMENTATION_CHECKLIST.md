# Implementation Checklist

Use this checklist to deploy and customize @uniweb/frame-bridge for your project.

## ✅ Initial Setup

- [ ] Install dependencies: `npm install`
- [ ] Build the library: `npm run build`
- [ ] Verify build outputs in `dist/` directory
- [ ] Run the demo locally: `python3 -m http.server 8000`
- [ ] Test demo at `http://localhost:8000/demos/basic/parent.html`

## ✅ NPM Publishing (if making public)

- [ ] Update `package.json`:
  - [ ] Set correct package name
  - [ ] Update version number
  - [ ] Add repository URL
  - [ ] Add keywords
  - [ ] Verify author and license
- [ ] Create `.npmignore` if needed (or rely on `files` field)
- [ ] Test package locally: `npm pack` and inspect `.tgz`
- [ ] Login to NPM: `npm login`
- [ ] Publish: `npm publish --access public`
- [ ] Verify on NPM: `https://www.npmjs.com/package/@uniweb/frame-bridge`
- [ ] Create git tag: `git tag v1.0.0 && git push --tags`

## ✅ CDN Deployment (optional)

- [ ] Upload `dist/auto/*.min.js` to your CDN
- [ ] Test CDN URLs in demo HTML
- [ ] Update README with CDN links
- [ ] Consider jsDelivr auto-publishing: `https://cdn.jsdelivr.net/npm/@uniweb/frame-bridge@latest/dist/auto/parent.min.js`

## ✅ Integration into Your Project

### Parent Site Integration

- [ ] Install package or add script tag
- [ ] Import ParentMessenger
- [ ] Configure allowed origins (if cross-origin)
- [ ] Add custom action handlers (if needed)
- [ ] Test iframe communication
- [ ] Verify auto-resize working
- [ ] Check URL synchronization
- [ ] Test JSON-LD injection in `<head>`

### Child App Integration

- [ ] Install package or add script tag
- [ ] Import ChildMessenger
- [ ] Configure allowed origins (if cross-origin)
- [ ] Add custom action handlers (if needed)
- [ ] Hook into routing system (if SPA)
- [ ] Test dimension reporting
- [ ] Test route reporting
- [ ] Test receiving params from parent

## ✅ React Integration (if applicable)

### Parent (React)

- [ ] Create messenger instance at app level
- [ ] Store in ref or context
- [ ] Add cleanup in useEffect
- [ ] Create custom hooks for common operations
- [ ] Test with React StrictMode

### Child (React + React Router)

- [ ] Create messenger instance before routes
- [ ] Implement route sync hook using `useLocation`
- [ ] Handle parent navigation with `useNavigate`
- [ ] Test route changes in both directions
- [ ] Verify no memory leaks on unmount

## ✅ Security Hardening

- [ ] Set specific `allowedOrigins` (no wildcards in production)
- [ ] Review all custom action handlers for security
- [ ] Validate all data received from messages
- [ ] Sanitize any HTML/DOM insertions
- [ ] Add rate limiting if needed for custom actions
- [ ] Log and monitor rejected messages
- [ ] Test with malicious origin attempts

## ✅ Performance Optimization

- [ ] Profile message frequency in production
- [ ] Adjust debounce timing if needed
- [ ] Optimize large data payloads
- [ ] Consider message batching for bulk operations
- [ ] Monitor memory usage with multiple iframes
- [ ] Test on low-end devices/browsers

## ✅ Error Handling

- [ ] Set up error logging/monitoring
- [ ] Test timeout scenarios
- [ ] Handle iframe loading errors
- [ ] Add retry logic for critical actions
- [ ] Display user-friendly errors
- [ ] Test network interruptions

## ✅ Testing

### Unit Tests

- [ ] Test BaseMessenger core functionality
- [ ] Test OriginValidator patterns
- [ ] Test ParentMessenger actions
- [ ] Test ChildMessenger actions
- [ ] Test IframeRegistry
- [ ] Test URLSyncManager
- [ ] Test DimensionReporter
- [ ] Test RouteReporter
- [ ] Run coverage: `npm run test -- --coverage`

### Integration Tests

- [ ] Test parent-child handshake
- [ ] Test bidirectional messaging
- [ ] Test auto-resize with content changes
- [ ] Test URL sync with navigation
- [ ] Test JSON-LD injection
- [ ] Test multiple iframes
- [ ] Test disconnect/reconnect scenarios

### E2E Tests (optional)

- [ ] Set up Playwright/Cypress
- [ ] Test full user flows
- [ ] Test across browsers
- [ ] Test mobile responsiveness
- [ ] Test accessibility

## ✅ Documentation

- [ ] Update README with project-specific examples
- [ ] Document custom actions
- [ ] Add troubleshooting section
- [ ] Create migration guide (if replacing existing solution)
- [ ] Add JSDoc comments to custom code
- [ ] Create visual diagrams if helpful
- [ ] Record demo video (optional)

## ✅ Monitoring & Analytics

- [ ] Add logging for critical events
- [ ] Monitor message frequency
- [ ] Track timeout occurrences
- [ ] Monitor origin validation failures
- [ ] Set up alerts for anomalies
- [ ] Collect user feedback

## ✅ Deployment

- [ ] Deploy parent application
- [ ] Deploy child application(s)
- [ ] Verify cross-origin configuration (if applicable)
- [ ] Test in production environment
- [ ] Monitor error logs
- [ ] Set up rollback plan

## ✅ Post-Launch

- [ ] Monitor for issues
- [ ] Gather user feedback
- [ ] Plan future enhancements
- [ ] Update dependencies regularly
- [ ] Stay on latest version of frame-bridge
- [ ] Contribute improvements back (if open source)

## 🎯 Customization Ideas

### Custom Actions to Consider

- [ ] User authentication sync
- [ ] Shopping cart updates
- [ ] Form data exchange
- [ ] Real-time notifications
- [ ] Theme/settings sync
- [ ] State persistence
- [ ] Analytics event tracking

### Advanced Features

- [ ] Message encryption for sensitive data
- [ ] Connection health checks
- [ ] Automatic reconnection
- [ ] Message queue for offline scenarios
- [ ] Performance monitoring integration
- [ ] A/B testing support
- [ ] Feature flags synchronization

### React Enhancements

- [ ] Create hooks package: `@uniweb/frame-bridge-react`
- [ ] `useParentMessenger()` hook
- [ ] `useChildMessenger()` hook
- [ ] `useRouteSync()` hook
- [ ] `useIframeInfo()` hook
- [ ] Context provider for messenger

### Developer Experience

- [ ] TypeScript definitions (`.d.ts` files)
- [ ] Better error messages
- [ ] DevTools extension
- [ ] Debug mode with visual indicators
- [ ] Automatic message logging

## 📝 Notes

Use this space for project-specific notes:

```
Custom origins:
- Production: https://app.example.com
- Staging: https://staging.example.com
- Development: http://localhost:3000

Custom actions implemented:
- userLogin: Sync user auth state
- cartUpdate: Update shopping cart
- notifyUser: Show notifications

Known issues:
- [None yet]

Performance metrics:
- Average messages/minute: [TBD]
- P95 latency: [TBD]
- Timeout rate: [TBD]
```

---

**Last Updated**: [Date]  
**Version**: 1.0.0  
**Status**: ✅ Ready for Production
