import { BaseMessenger } from '../shared/BaseMessenger.js';
import { ACTIONS, ERRORS } from '../shared/constants.js';
import { IframeRegistry } from './IframeRegistry.js';
import { URLSyncManager } from './URLSyncManager.js';
import { JSONLDInjector } from './JSONLDInjector.js';

/**
 * Messenger for parent frame to communicate with child iframes
 */
export class ParentMessenger extends BaseMessenger {
    /**
     * @param {Object} options - Configuration options
     * @param {string[]|null} options.allowedOrigins - Allowed origins for child iframes
     * @param {boolean} options.autoResize - Automatically resize iframes based on dimensions
     * @param {boolean} options.urlSync - Enable URL synchronization with iframe routes
     * @param {string} options.urlParamKey - Query parameter key for route path (default: 'path')
     * @param {boolean} options.preserveOtherParams - Keep other query params when syncing
     * @param {boolean} options.jsonLD - Enable JSON-LD injection from iframes
     * @param {string} options.analyticsId - Google Analytics ID to pass to children
     * @param {string[]|null} options.syncParams - Parameters to sync to children (null = all)
     * @param {Function} options.onIframeReady - Callback when iframe announces itself
     * @param {Function} options.onDimensionUpdate - Callback when iframe dimensions change
     * @param {Function} options.onRouteChange - Callback when iframe route changes
     * @param {Object} options.actionHandlers - Custom action handlers
     * @param {number} options.timeout - Message timeout
     * @param {number|string} options.logLevel - Logging level
     */
    constructor(options = {}) {
        super({
            isChildFrame: false,
            allowedOrigins: options.allowedOrigins,
            actionHandlers: options.actionHandlers,
            timeout: options.timeout,
            logLevel: options.logLevel,
        });

        // Store options
        this.options = {
            autoResize: options.autoResize !== false,
            urlSync: options.urlSync !== false,
            jsonLD: options.jsonLD !== false,
            analyticsId: options.analyticsId || null,
            syncParams: options.syncParams || null,
            onIframeReady: options.onIframeReady || null,
            onDimensionUpdate: options.onDimensionUpdate || null,
            onRouteChange: options.onRouteChange || null,
        };

        // Initialize managers
        this.registry = new IframeRegistry(this.logger);
        this.urlSync = new URLSyncManager(
            {
                paramKey: options.urlParamKey || 'path',
                preserveOtherParams: options.preserveOtherParams !== false,
                enabled: this.options.urlSync,
                onRouteChange: this.handleURLChange.bind(this),
            },
            this.logger
        );
        this.jsonLDInjector = new JSONLDInjector(this.logger);

        this.logger.info('ParentMessenger initialized', this.options);
    }

    /**
     * Get built-in action handlers
     * @protected
     * @returns {Object}
     */
    getBuiltInHandlers() {
        return {
            ...super.getBuiltInHandlers(),
            [ACTIONS.ANNOUNCE]: this.handleAnnounce.bind(this),
            [ACTIONS.UPDATE_DIMENSIONS]: this.handleDimensionUpdate.bind(this),
            [ACTIONS.UPDATE_ROUTE]: this.handleRouteUpdate.bind(this),
            [ACTIONS.UPDATE_JSONLD]: this.handleJSONLDUpdate.bind(this),
        };
    }

    /**
     * Handle iframe announce message
     * @private
     * @param {Object} params - Announce parameters
     * @param {Window} source - Source window
     * @param {string} origin - Source origin
     * @returns {Object} Response with initial configuration
     */
    handleAnnounce(params, source, origin) {
        const { iframeId, dimensions, route, metadata = {}, jsonld } = params;

        // Register iframe
        this.registry.register(iframeId, {
            window: source,
            origin,
            dimensions,
            route,
            metadata,
        });

        // Inject JSON LD metadata if given and enabled
        if (jsonld && this.options.jsonLD) {
            this.jsonLDInjector.inject(iframeId, jsonld);
        }

        // Trigger callback
        if (this.options.onIframeReady) {
            this.options.onIframeReady(iframeId, {
                origin,
                dimensions,
                route,
                metadata,
            });
        }

        // Prepare response with initial configuration
        const response = {
            iframeId,
            config: {
                analyticsId: this.options.analyticsId,
            },
        };

        // Add URL parameters if syncing
        if (this.options.urlSync) {
            const allParams = this.urlSync.getAllParams();
            const params = this.options.syncParams
                ? Object.fromEntries(
                      Object.entries(allParams).filter(([key]) =>
                          this.options.syncParams.includes(key)
                      )
                  )
                : allParams;

            response.params = params;

            // If URL has initial route, include it
            const initialRoute = this.urlSync.getInitialRoute();
            if (initialRoute) {
                response.initialRoute = initialRoute;
            }
        }

        this.logger.info('Iframe announced and registered:', iframeId);
        return response;
    }

    /**
     * Handle dimension update from iframe
     * @private
     * @param {Object} params - Dimension parameters
     * @param {Window} source - Source window
     * @returns {Object} Acknowledgment
     */
    handleDimensionUpdate(params, source) {
        const { iframeId, width, height, _debug } = params;

        // Update registry with dimension info
        this.registry.update(iframeId, {
            dimensions: { width, height, _debug },
        });

        // Auto-resize if enabled
        if (this.options.autoResize) {
            const iframeElement = this.findIframeElement(iframeId, source);
            if (iframeElement) {
                // Get current height to avoid redundant updates
                const currentHeight =
                    parseInt(iframeElement.style.height) ||
                    iframeElement.offsetHeight;

                // Only resize if height actually changed (within 1px tolerance for sub-pixel rendering)
                if (Math.abs(currentHeight - height) > 1) {
                    iframeElement.style.height = `${height}px`;

                    if (_debug) {
                        this.logger.debug('Iframe resized:', {
                            iframeId,
                            oldHeight: currentHeight,
                            newHeight: height,
                            bodySpacing: _debug.bodySpacing?.total || 0,
                        });
                    } else {
                        this.logger.debug('Iframe resized:', {
                            iframeId,
                            oldHeight: currentHeight,
                            newHeight: height,
                        });
                    }
                } else {
                    this.logger.debug(
                        'Iframe height unchanged, skipping resize:',
                        {
                            iframeId,
                            height: currentHeight,
                            diff: Math.abs(currentHeight - height),
                        }
                    );
                }
            }
        }

        // Trigger callback
        if (this.options.onDimensionUpdate) {
            this.options.onDimensionUpdate(iframeId, { width, height, _debug });
        }

        return { status: 'ok' };
    }

    /**
     * Handle route update from iframe
     * @private
     * @param {Object} params - Route parameters
     * @returns {Object} Acknowledgment
     */
    handleRouteUpdate(params) {
        const { iframeId, path, title } = params;

        // Update registry
        this.registry.update(iframeId, { route: { path, title } });

        // Update URL if enabled
        if (this.options.urlSync) {
            this.urlSync.updateFromIframe(iframeId, path, title);
        }

        return { status: 'ok' };
    }

    /**
     * Handle JSON-LD update from iframe
     * @private
     * @param {Object} params - JSON-LD parameters
     * @returns {Object} Acknowledgment
     */
    handleJSONLDUpdate(params) {
        const { iframeId, jsonld } = params;

        if (this.options.jsonLD) {
            this.jsonLDInjector.inject(iframeId, jsonld);
        }

        return { status: 'ok' };
    }

    /**
     * Handle URL changes from browser navigation
     * @private
     * @param {string|null} iframeId - Iframe ID or null if from popstate
     * @param {Object} data - Route data
     */
    handleURLChange(iframeId, data) {
        if (data.source === 'popstate') {
            // Browser navigation - send navigate to all iframes
            this.sendToAllChildren(ACTIONS.NAVIGATE, { path: data.path });
        }

        // Trigger user callback
        if (this.options.onRouteChange) {
            this.options.onRouteChange(iframeId, data);
        }
    }

    /**
     * Find iframe element in DOM
     * @private
     * @param {string} iframeId - Iframe identifier
     * @param {Window} iframeWindow - Iframe window object
     * @returns {HTMLIFrameElement|null}
     */
    findIframeElement(iframeId, iframeWindow) {
        // Try by data attribute first
        const byAttribute = document.querySelector(
            `iframe[data-messenger-id="${iframeId}"]`
        );
        if (byAttribute) return byAttribute;

        // Try by content window
        const iframes = document.querySelectorAll('iframe');
        for (const iframe of iframes) {
            if (iframe.contentWindow === iframeWindow) {
                return iframe;
            }
        }

        return null;
    }

    /**
     * Send message to a specific child iframe
     * @param {string} iframeId - Iframe identifier
     * @param {string} action - Action name
     * @param {Object} params - Parameters
     * @returns {Promise<*>} Response from iframe
     */
    sendToChild(iframeId, action, params = {}) {
        const iframe = this.registry.get(iframeId);
        if (!iframe) {
            this.logger.error(ERRORS.NO_CHILD_WINDOW, { iframeId });
            return Promise.reject(
                new Error(`${ERRORS.NO_CHILD_WINDOW}: ${iframeId}`)
            );
        }

        return this.sendMessage(iframe.window, action, params, iframe.origin);
    }

    /**
     * Send message to all registered child iframes
     * @param {string} action - Action name
     * @param {Object} params - Parameters
     * @returns {Promise<Object>} Map of iframe IDs to responses
     */
    async sendToAllChildren(action, params = {}) {
        const iframeIds = this.registry.getAllIds();
        const results = {};

        await Promise.allSettled(
            iframeIds.map(async (iframeId) => {
                try {
                    results[iframeId] = await this.sendToChild(
                        iframeId,
                        action,
                        params
                    );
                } catch (error) {
                    results[iframeId] = { error: error.message };
                }
            })
        );

        return results;
    }

    /**
     * Get iframe information
     * @param {string} iframeId - Iframe identifier
     * @returns {Object|null} Iframe metadata
     */
    getIframe(iframeId) {
        return this.registry.get(iframeId);
    }

    /**
     * Get all registered iframes
     * @returns {Object[]} Array of iframe metadata
     */
    getAllIframes() {
        return this.registry.getAll();
    }

    /**
     * Cleanup and destroy messenger
     */
    destroy() {
        super.destroy();
        this.urlSync.destroy();
        this.jsonLDInjector.clear();
        this.registry.clear();
        this.logger.info('ParentMessenger destroyed');
    }
}
