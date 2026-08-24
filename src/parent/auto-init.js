import { ParentMessenger } from './ParentMessenger.js'
import {
  readAllowedOriginsAttribute,
  deriveOriginsFromIframes
} from '../shared/utils.js'

/**
 * Auto-initialize ParentMessenger and expose on window
 */
;(function () {
  if (typeof window === 'undefined') {
    return
  }

  // Read the script tag FIRST — document.currentScript is only valid while
  // this script is evaluating.
  //
  //   <script src="…/parent.min.js" data-allowed-origins="https://site.example.com">
  //
  // An explicit attribute wins outright. With none, derive the child origins
  // from the iframes this page actually frames: an embedder already names them
  // in the src it wrote, so repeating them would be redundant. The derivation
  // always includes our own origin, which makes it strictly additive — it can
  // widen the same-origin default but never narrow it.
  const allowedOrigins =
    readAllowedOriginsAttribute() || deriveOriginsFromIframes()

  const messenger = new ParentMessenger({
    autoResize: true,
    urlSync: true,
    jsonLD: true,
    allowedOrigins
  })

  // Simple event emitter for convenience
  const eventCallbacks = {
    iframeReady: [],
    dimensionUpdate: [],
    routeChange: []
  }

  // Wrap messenger with event API
  const api = {
    messenger,

    /**
     * Listen to events
     * @param {string} event - Event name (iframeReady, dimensionUpdate, routeChange)
     * @param {Function} callback - Callback function
     */
    on(event, callback) {
      if (eventCallbacks[event]) {
        eventCallbacks[event].push(callback)
      }
    },

    /**
     * Remove event listener
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    off(event, callback) {
      if (eventCallbacks[event]) {
        const index = eventCallbacks[event].indexOf(callback)
        if (index > -1) {
          eventCallbacks[event].splice(index, 1)
        }
      }
    },

    /**
     * Send message to iframe
     * @param {string} iframeId - Iframe ID
     * @param {string} action - Action name
     * @param {Object} params - Parameters
     */
    sendToChild(iframeId, action, params) {
      return messenger.sendToChild(iframeId, action, params)
    },

    /**
     * Send message to all iframes
     * @param {string} action - Action name
     * @param {Object} params - Parameters
     */
    sendToAllChildren(action, params) {
      return messenger.sendToAllChildren(action, params)
    },

    /**
     * Get iframe info
     * @param {string} iframeId - Iframe ID
     */
    getIframe(iframeId) {
      return messenger.getIframe(iframeId)
    },

    /**
     * Get all iframes
     */
    getAllIframes() {
      return messenger.getAllIframes()
    }
  }

  // Wire up callbacks to trigger events
  messenger.options.onIframeReady = (id, info) => {
    eventCallbacks.iframeReady.forEach((cb) => cb(id, info))
  }

  messenger.options.onDimensionUpdate = (id, dimensions) => {
    eventCallbacks.dimensionUpdate.forEach((cb) => cb(id, dimensions))
  }

  messenger.options.onRouteChange = (id, route) => {
    eventCallbacks.routeChange.forEach((cb) => cb(id, route))
  }

  // Expose on window
  window.FrameBridge = api

  console.log('[FrameBridge] Parent auto-initialized')
})()
