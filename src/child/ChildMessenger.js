import { BaseMessenger } from '../shared/BaseMessenger.js'
import { ACTIONS, DEFAULTS, ERRORS } from '../shared/constants.js'
import {
  isInIframe,
  getIframeId,
  sleep,
  isAddressableOrigin
} from '../shared/utils.js'
import { DimensionReporter } from './DimensionReporter.js'
import { RouteReporter, defaultRouteGetter } from './RouteReporter.js'

/**
 * Messenger for child iframe to communicate with parent frame
 */
export class ChildMessenger extends BaseMessenger {
  /**
   * @param {Object} options - Configuration options
   * @param {string[]|null} options.allowedOrigins - Allowed parent origins
   * @param {boolean} options.dimensionReporting - Enable automatic dimension reporting
   * @param {number} options.dimensionThreshold - Minimum dimension change (px) to report (default: 1)
   * @param {boolean} options.routeReporting - Enable automatic route reporting
   * @param {Function} options.getRoute - Function to get current route (default: pathname)
   * @param {Function} options.onParentReady - Callback when parent responds to announce
   * @param {Function} options.onNavigate - Callback when parent requests navigation
   * @param {Object} options.metadata - Additional metadata to send with announce
   * @param {boolean} options.autoAnnounce - Announce on construction (default: true)
   * @param {Object} options.actionHandlers - Custom action handlers
   * @param {number} options.timeout - Message timeout
   * @param {number|string} options.logLevel - Logging level
   */
  constructor(options = {}) {
    // Check if we're in an iframe
    if (!isInIframe()) {
      if (options.logLevel !== 'silent' && options.logLevel !== 0) {
        console.warn(ERRORS.NOT_IN_IFRAME)
      }
      // Don't throw - just create a no-op instance
      super({ isChildFrame: false, ...options })
      this.isActive = false
      return
    }

    super({
      isChildFrame: true,
      allowedOrigins: options.allowedOrigins,
      actionHandlers: options.actionHandlers,
      timeout: options.timeout,
      logLevel: options.logLevel
    })

    this.isActive = true

    // The embedder's real origin, learned from the first validated message
    // it sends us. Null until then — see onValidatedMessage / sendToParent.
    this.parentOrigin = null

    // Store options
    this.options = {
      dimensionReporting: options.dimensionReporting === true,
      dimensionThreshold:
        options.dimensionThreshold !== undefined
          ? options.dimensionThreshold
          : 1,
      routeReporting: options.routeReporting === true,
      getRoute: options.getRoute || defaultRouteGetter,
      onParentReady: options.onParentReady || null,
      onNavigate: options.onNavigate || null,
      metadata: options.metadata || {}
    }

    // Get iframe ID
    this.iframeId = getIframeId()
    this.logger.debug('Iframe ID:', this.iframeId)

    // Initialize reporters (will be started after announce)
    this.dimensionReporter = null
    this.routeReporter = null

    // Announce to parent (can be deferred with autoAnnounce: false). Nobody
    // holds this promise, so a failure surfaces as an unhandled rejection —
    // deliberately, see announce(). Being destroyed mid-announce is not a
    // failure: it is the owner's decision, so that one is swallowed.
    if (options.autoAnnounce !== false) {
      this.announce().catch((error) => {
        if (!this.destroyed) throw error
      })
    }
  }

  /**
   * Learn the embedder's real origin from a message it sent us.
   *
   * `allowedOrigins` is a permission SET — every entry is an origin the
   * deployment says MAY frame this document — so no element of it identifies
   * the parent. The parent side has never had to guess: it records
   * `event.origin` at announce time and addresses that thereafter
   * (`ParentMessenger.handleAnnounce` -> `IframeRegistry`). This is the same
   * discipline on the child side.
   *
   * ⛔ Only `window.parent` may teach us. The validator admits any permitted
   * origin, which includes a sibling iframe or an opener on that origin —
   * without this check such a window could capture our outbound addressing.
   *
   * @protected
   * @param {MessageEvent} event - A message that already passed validation
   */
  onValidatedMessage(event) {
    if (!this.isActive || this.parentOrigin) return
    if (event.source !== window.parent) return
    // A null-origin parent (srcdoc, data:) cannot be addressed by origin;
    // leave the latch empty so sendToParent keeps its wildcard handling.
    if (!isAddressableOrigin(event.origin)) return

    this.parentOrigin = event.origin
    this.logger.debug('Parent origin learned:', event.origin)
  }

  /**
   * Get built-in action handlers
   * @protected
   * @returns {Object}
   */
  getBuiltInHandlers() {
    return {
      ...super.getBuiltInHandlers(),
      [ACTIONS.NAVIGATE]: this.handleNavigate.bind(this)
    }
  }

  /**
   * Announce presence to parent with retries.
   * Called automatically unless `autoAnnounce: false` was passed to the constructor.
   * When using `autoAnnounce: false`, call this manually after registering
   * action handlers via `setHandlers()` to avoid race conditions.
   */
  async announce() {
    const maxRetries = DEFAULTS.ANNOUNCE_RETRIES
    let attempt = 0

    while (attempt < maxRetries) {
      try {
        this.logger.debug(
          `Announcing to parent (attempt ${attempt + 1}/${maxRetries})`
        )

        const response = await this.sendToParent(ACTIONS.ANNOUNCE, {
          iframeId: this.iframeId,
          dimensions: this.getDimensions(),
          route: this.options.getRoute(),
          metadata: this.options.metadata
        })

        this.handleAnnounceResponse(response)
        return // Success!
      } catch (error) {
        // Destroyed mid-announce: stop. A retry would announce a messenger
        // that can no longer hear the reply.
        if (this.destroyed) throw error

        attempt++
        this.logger.warn(`Announce attempt ${attempt} failed:`, error.message)

        if (attempt < maxRetries) {
          await sleep(DEFAULTS.ANNOUNCE_RETRY_DELAY)
        } else {
          // Carry the reason into the throw. This is the error that surfaces
          // as an unhandled rejection for callers with no .catch(), so it is
          // the one most likely to be the only thing anybody reads.
          const detail = error?.message ? ` — ${error.message}` : ''
          this.logger.error(`${ERRORS.ANNOUNCE_FAILED}${detail}`)
          throw new Error(`${ERRORS.ANNOUNCE_FAILED}${detail}`)
        }
      }
    }
  }

  /**
   * Handle announce response from parent
   * @private
   * @param {Object} response - Response data
   */
  handleAnnounceResponse(response) {
    const { initialRoute } = response

    this.logger.info('Announce successful')

    // Start reporters
    if (this.options.dimensionReporting) {
      this.startDimensionReporting()
    }

    if (this.options.routeReporting) {
      this.startRouteReporting()
    }

    // Handle initial route if provided
    if (initialRoute && initialRoute !== this.options.getRoute().path) {
      this.logger.debug('Initial route from parent:', initialRoute)
      if (this.options.onNavigate) {
        this.options.onNavigate({ path: initialRoute })
      }
    }

    if (this.options.onParentReady) {
      this.options.onParentReady(response)
    }
  }

  /**
   * Start dimension reporting
   * @private
   */
  startDimensionReporting() {
    this.dimensionReporter = new DimensionReporter(
      (dimensions) => {
        this.sendToParent(ACTIONS.UPDATE_DIMENSIONS, {
          iframeId: this.iframeId,
          ...dimensions
        }).catch((error) => {
          this.logger.error('Failed to report dimensions:', error)
        })
      },
      DEFAULTS.DIMENSION_DEBOUNCE,
      this.logger
    )

    // Set custom threshold if provided
    if (this.options.dimensionThreshold !== 1) {
      this.dimensionReporter.setThreshold(this.options.dimensionThreshold)
    }
  }

  /**
   * Start route reporting
   * @private
   */
  startRouteReporting() {
    this.routeReporter = new RouteReporter(
      (route) => {
        this.sendToParent(ACTIONS.UPDATE_ROUTE, {
          iframeId: this.iframeId,
          ...route
        }).catch((error) => {
          this.logger.error('Failed to report route:', error)
        })
      },
      this.options.getRoute,
      this.logger
    )
  }

  /**
   * Get current dimensions
   * Accounts for body margin, padding, and border
   * @private
   * @returns {Object} Dimensions object
   */
  getDimensions() {
    return DimensionReporter.getDimensions()
  }

  /**
   * Handle navigate command from parent
   * @private
   * @param {Object} params - Navigate parameters
   * @returns {Object} Acknowledgment
   */
  handleNavigate(params) {
    const { path } = params
    this.logger.debug('Navigate requested by parent:', path)

    if (this.options.onNavigate) {
      this.options.onNavigate({ path })
    }

    return { status: 'ok' }
  }

  /**
   * Send message to parent
   * @param {string} action - Action name
   * @param {Object} params - Parameters
   * @returns {Promise<*>} Response from parent
   */
  sendToParent(action, params = {}) {
    if (!this.isActive) {
      this.logger.warn('ChildMessenger not active (not in iframe)')
      return Promise.resolve()
    }

    const allowed = this.validator.getAllowedOrigins()

    // Wildcard mode: the deployment accepts any embedder, so address any.
    if (allowed.includes('*')) {
      return this.sendMessage(window.parent, action, params, '*')
    }

    // After the handshake we KNOW who the parent is. Address it exactly.
    if (this.parentOrigin) {
      return this.sendMessage(window.parent, action, params, this.parentOrigin)
    }

    // Before the handshake we do not, and `allowedOrigins` cannot tell us:
    // it is a permission set, not an identity. Address every concrete member,
    // each once. The browser delivers to the one that matches the real parent
    // and drops the rest, so at most one lands. Nothing is widened — every
    // origin used is already permitted by the deployment.
    const targets = [...new Set(allowed.filter(isAddressableOrigin))]

    if (targets.length === 0) {
      // Patterns cannot be a postMessage target, so there is nothing to
      // address. Fail loudly instead of posting into the void.
      const error = new Error(
        `${ERRORS.NO_ADDRESSABLE_ORIGIN}: ${allowed.join(', ')}`
      )
      this.logger.error(error.message)
      return Promise.reject(error)
    }

    return this.broadcastToParent(action, params, targets)
  }

  /**
   * Address several permitted origins at once. Used only to bootstrap: once
   * the parent answers, `onValidatedMessage` latches its origin and later
   * sends are exact.
   *
   * It is ONE message posted to every origin — one id, one timer
   * (`sendMessage`) — so the reply to the one copy the browser delivers
   * settles it, and the dropped copies leave nothing behind to time out.
   *
   * @private
   * @param {string} action - Action name
   * @param {Object} params - Parameters
   * @param {string[]} targets - Concrete origins to address
   * @returns {Promise<*>} The parent's response
   */
  broadcastToParent(action, params, targets) {
    if (targets.length === 1) {
      return this.sendMessage(window.parent, action, params, targets[0])
    }

    this.logger.debug('Addressing permitted parent origins:', targets)

    return this.sendMessage(window.parent, action, params, targets).catch(
      (error) => {
        if (this.destroyed) throw error
        // Every permitted origin was addressed and none answered. Say so
        // rather than blaming the parent for a message it never received.
        throw new Error(
          `${ERRORS.NO_PARENT_RESPONSE}. Addressed: ${targets.join(', ')}`,
          { cause: error }
        )
      }
    )
  }

  /**
   * Manually update route (useful for programmatic navigation)
   * @param {string} path - Route path
   * @param {string} [title] - Optional page title
   */
  updateRoute(path, title) {
    if (!this.isActive) return

    if (this.routeReporter) {
      this.routeReporter.reportRoute(path, title)
    } else {
      // If reporter not active, send directly
      this.sendToParent(ACTIONS.UPDATE_ROUTE, {
        iframeId: this.iframeId,
        path,
        title: title || document.title
      }).catch((error) => {
        this.logger.error('Failed to update route:', error)
      })
    }
  }

  /**
   * Manually update dimensions (useful after content changes)
   */
  updateDimensions() {
    if (!this.isActive) return

    if (this.dimensionReporter) {
      this.dimensionReporter.report()
    } else {
      // If reporter not active, send directly
      const dimensions = this.getDimensions()
      this.sendToParent(ACTIONS.UPDATE_DIMENSIONS, {
        iframeId: this.iframeId,
        ...dimensions
      }).catch((error) => {
        this.logger.error('Failed to update dimensions:', error)
      })
    }
  }

  /**
   * Update JSON-LD structured data
   * @param {Object} jsonld - JSON-LD object
   */
  updateJSONLD(jsonld) {
    if (!this.isActive) return

    this.sendToParent(ACTIONS.UPDATE_JSONLD, {
      iframeId: this.iframeId,
      jsonld
    }).catch((error) => {
      this.logger.error('Failed to update JSON-LD:', error)
    })
  }

  /**
   * Cleanup and destroy messenger
   */
  destroy() {
    if (this.dimensionReporter) {
      this.dimensionReporter.stop()
    }
    if (this.routeReporter) {
      this.routeReporter.stop()
    }
    super.destroy()
    this.logger.info('ChildMessenger destroyed')
  }
}
