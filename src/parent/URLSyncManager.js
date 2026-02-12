import { getQueryParams, updateQueryParams } from '../shared/utils.js';

/**
 * Manages URL synchronization between parent and iframe
 */
export class URLSyncManager {
    /**
     * @param {Object} options - Configuration options
     * @param {string} options.paramKey - Query parameter key for route path
     * @param {boolean} options.preserveOtherParams - Keep other query params
     * @param {Function} options.onRouteChange - Callback when route changes in iframe
     * @param {Logger} logger - Logger instance
     */
    constructor(options, logger) {
        this.logger = logger;
        this.paramKey = options.paramKey || 'path';
        this.preserveOtherParams = options.preserveOtherParams !== false;
        this.onRouteChange = options.onRouteChange || null;
        this.enabled = options.enabled !== false;

        // Track current synced route to avoid redundant updates
        this.currentRoute = null;

        if (this.enabled) {
            // Listen to popstate for back/forward navigation
            this.boundHandlePopState = this.handlePopState.bind(this);
            window.addEventListener('popstate', this.boundHandlePopState);
            this.logger.debug('URL sync enabled with param key:', this.paramKey);
        }
    }

    /**
     * Get initial route from URL parameters
     * @returns {string|null} Initial route path
     */
    getInitialRoute() {
        const params = getQueryParams();
        return params[this.paramKey] || null;
    }

    /**
     * Update parent URL when iframe route changes
     * @param {string} iframeId - Iframe identifier
     * @param {string} path - New route path
     * @param {string} [title] - Optional page title
     */
    updateFromIframe(iframeId, path, title) {
        if (!this.enabled) return;

        // Avoid redundant updates
        if (this.currentRoute === path) {
            this.logger.debug('Route unchanged, skipping update:', path);
            return;
        }

        this.currentRoute = path;

        // Update URL parameter
        const updates = { [this.paramKey]: path };
        updateQueryParams(updates, true); // Use replaceState

        // Update page title if provided
        if (title) {
            document.title = title;
        }

        this.logger.debug('URL updated from iframe:', { iframeId, path, title });
    }

    /**
     * Handle browser back/forward navigation
     * @private
     * @param {PopStateEvent} event - Popstate event
     */
    handlePopState(event) {
        const params = getQueryParams();
        const newRoute = params[this.paramKey];

        if (newRoute && newRoute !== this.currentRoute) {
            this.currentRoute = newRoute;
            this.logger.debug('Browser navigation detected:', newRoute);

            // Notify callback that parent URL changed
            // Parent messenger will send navigate message to iframe
            if (this.onRouteChange) {
                this.onRouteChange(null, { path: newRoute, source: 'popstate' });
            }
        }
    }

    /**
     * Get current route from URL
     * @returns {string|null}
     */
    getCurrentRoute() {
        return this.currentRoute || this.getInitialRoute();
    }

    /**
     * Get all current URL parameters
     * @returns {Object}
     */
    getAllParams() {
        return getQueryParams();
    }

    /**
     * Disable URL sync and cleanup
     */
    destroy() {
        if (this.boundHandlePopState) {
            window.removeEventListener('popstate', this.boundHandlePopState);
        }
        this.logger.debug('URL sync destroyed');
    }
}
