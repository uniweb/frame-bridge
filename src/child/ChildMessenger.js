import { BaseMessenger } from '../shared/BaseMessenger.js';
import { ACTIONS, DEFAULTS, ERRORS } from '../shared/constants.js';
import { isInIframe, getIframeId, sleep } from '../shared/utils.js';
import { DimensionReporter } from './DimensionReporter.js';
import { RouteReporter, defaultRouteGetter } from './RouteReporter.js';

/**
 * Messenger for child iframe to communicate with parent frame
 */
export class ChildMessenger extends BaseMessenger {
    /**
     * @param {Object} options - Configuration options
     * @param {string[]|null} options.allowedOrigins - Allowed parent origins
     * @param {boolean} options.dimensionReporting - Enable automatic dimension reporting
     * @param {number} options.dimensionThreshold - Minimum dimension change (px) to report (default: 5)
     * @param {boolean} options.routeReporting - Enable automatic route reporting
     * @param {Function} options.getRoute - Function to get current route (default: pathname)
     * @param {Function} options.onParentReady - Callback when parent responds to announce
     * @param {Function} options.onNavigate - Callback when parent requests navigation
     * @param {Object} options.metadata - Additional metadata to send with announce
     * @param {Object} options.actionHandlers - Custom action handlers
     * @param {number} options.timeout - Message timeout
     * @param {number|string} options.logLevel - Logging level
     */
    constructor(options = {}) {
        // Check if we're in an iframe
        if (!isInIframe()) {
            if (options.logLevel !== 'silent' && options.logLevel !== 0) {
                console.warn(ERRORS.NOT_IN_IFRAME);
            }
            // Don't throw - just create a no-op instance
            super({ isChildFrame: false, ...options });
            this.isActive = false;
            return;
        }

        super({
            isChildFrame: true,
            allowedOrigins: options.allowedOrigins,
            actionHandlers: options.actionHandlers,
            timeout: options.timeout,
            logLevel: options.logLevel,
        });

        this.isActive = true;

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
            metadata: options.metadata || {},
        };

        // Get iframe ID
        this.iframeId = getIframeId();
        this.logger.debug('Iframe ID:', this.iframeId);

        // Initialize reporters (will be started after announce)
        this.dimensionReporter = null;
        this.routeReporter = null;

        // Announce to parent (can be deferred with autoAnnounce: false)
        if (options.autoAnnounce !== false) {
            this.announce();
        }
    }

    /**
     * Get built-in action handlers
     * @protected
     * @returns {Object}
     */
    getBuiltInHandlers() {
        return {
            ...super.getBuiltInHandlers(),
            [ACTIONS.NAVIGATE]: this.handleNavigate.bind(this),
        };
    }

    /**
     * Announce presence to parent with retries.
     * Called automatically unless `autoAnnounce: false` was passed to the constructor.
     * When using `autoAnnounce: false`, call this manually after registering
     * action handlers via `setHandlers()` to avoid race conditions.
     */
    async announce() {
        const maxRetries = DEFAULTS.ANNOUNCE_RETRIES;
        let attempt = 0;

        while (attempt < maxRetries) {
            try {
                this.logger.debug(
                    `Announcing to parent (attempt ${
                        attempt + 1
                    }/${maxRetries})`
                );

                const response = await this.sendToParent(ACTIONS.ANNOUNCE, {
                    iframeId: this.iframeId,
                    dimensions: this.getDimensions(),
                    route: this.options.getRoute(),
                    metadata: this.options.metadata,
                });

                this.handleAnnounceResponse(response);
                return; // Success!
            } catch (error) {
                attempt++;
                this.logger.warn(
                    `Announce attempt ${attempt} failed:`,
                    error.message
                );

                if (attempt < maxRetries) {
                    await sleep(DEFAULTS.ANNOUNCE_RETRY_DELAY);
                } else {
                    this.logger.error(ERRORS.ANNOUNCE_FAILED);
                    throw new Error(ERRORS.ANNOUNCE_FAILED);
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
        const { initialRoute } = response;

        this.logger.info('Announce successful');

        // Start reporters
        if (this.options.dimensionReporting) {
            this.startDimensionReporting();
        }

        if (this.options.routeReporting) {
            this.startRouteReporting();
        }

        // Handle initial route if provided
        if (initialRoute && initialRoute !== this.options.getRoute().path) {
            this.logger.debug('Initial route from parent:', initialRoute);
            if (this.options.onNavigate) {
                this.options.onNavigate({ path: initialRoute });
            }
        }

        if (this.options.onParentReady) {
            this.options.onParentReady(response);
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
                    ...dimensions,
                }).catch((error) => {
                    this.logger.error('Failed to report dimensions:', error);
                });
            },
            DEFAULTS.DIMENSION_DEBOUNCE,
            this.logger
        );

        // Set custom threshold if provided
        if (this.options.dimensionThreshold !== 1) {
            this.dimensionReporter.setThreshold(
                this.options.dimensionThreshold
            );
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
                    ...route,
                }).catch((error) => {
                    this.logger.error('Failed to report route:', error);
                });
            },
            this.options.getRoute,
            this.logger
        );
    }

    /**
     * Get current dimensions
     * Accounts for body margin, padding, and border
     * @private
     * @returns {Object} Dimensions object
     */
    getDimensions() {
        return DimensionReporter.getDimensions();
    }

    /**
     * Handle navigate command from parent
     * @private
     * @param {Object} params - Navigate parameters
     * @returns {Object} Acknowledgment
     */
    handleNavigate(params) {
        const { path } = params;
        this.logger.debug('Navigate requested by parent:', path);

        if (this.options.onNavigate) {
            this.options.onNavigate({ path });
        }

        return { status: 'ok' };
    }

    /**
     * Send message to parent
     * @param {string} action - Action name
     * @param {Object} params - Parameters
     * @returns {Promise<*>} Response from parent
     */
    sendToParent(action, params = {}) {
        if (!this.isActive) {
            this.logger.warn('ChildMessenger not active (not in iframe)');
            return Promise.resolve();
        }

        // Use parent's origin (from allowedOrigins) for cross-origin support.
        // '*' wildcard is used when allowedOrigins includes '*'.
        const allowed = this.validator.getAllowedOrigins();
        const targetOrigin = allowed.includes('*')
            ? '*'
            : (allowed[0] || window.location.origin);

        return this.sendMessage(
            window.parent,
            action,
            params,
            targetOrigin
        );
    }

    /**
     * Manually update route (useful for programmatic navigation)
     * @param {string} path - Route path
     * @param {string} [title] - Optional page title
     */
    updateRoute(path, title) {
        if (!this.isActive) return;

        if (this.routeReporter) {
            this.routeReporter.reportRoute(path, title);
        } else {
            // If reporter not active, send directly
            this.sendToParent(ACTIONS.UPDATE_ROUTE, {
                iframeId: this.iframeId,
                path,
                title: title || document.title,
            }).catch((error) => {
                this.logger.error('Failed to update route:', error);
            });
        }
    }

    /**
     * Manually update dimensions (useful after content changes)
     */
    updateDimensions() {
        if (!this.isActive) return;

        if (this.dimensionReporter) {
            this.dimensionReporter.report();
        } else {
            // If reporter not active, send directly
            const dimensions = this.getDimensions();
            this.sendToParent(ACTIONS.UPDATE_DIMENSIONS, {
                iframeId: this.iframeId,
                ...dimensions,
            }).catch((error) => {
                this.logger.error('Failed to update dimensions:', error);
            });
        }
    }

    /**
     * Update JSON-LD structured data
     * @param {Object} jsonld - JSON-LD object
     */
    updateJSONLD(jsonld) {
        if (!this.isActive) return;

        this.sendToParent(ACTIONS.UPDATE_JSONLD, {
            iframeId: this.iframeId,
            jsonld,
        }).catch((error) => {
            this.logger.error('Failed to update JSON-LD:', error);
        });
    }

    /**
     * Cleanup and destroy messenger
     */
    destroy() {
        if (this.dimensionReporter) {
            this.dimensionReporter.stop();
        }
        if (this.routeReporter) {
            this.routeReporter.stop();
        }
        super.destroy();
        this.logger.info('ChildMessenger destroyed');
    }
}
