/**
 * Reports route changes to parent
 * Supports manual reporting and automatic detection
 */
export class RouteReporter {
    /**
     * @param {Function} callback - Called when route changes
     * @param {Function} getRoute - Function to get current route info
     * @param {Logger} logger - Logger instance
     */
    constructor(callback, getRoute, logger) {
        this.callback = callback;
        this.getRoute = getRoute;
        this.logger = logger;
        this.currentRoute = null;
        this.boundHandlePopState = null;

        // Try to detect React Router or similar
        this.setupAutoDetection();

        // Report initial route
        this.reportRoute();
    }

    /**
     * Setup automatic route detection
     * @private
     */
    setupAutoDetection() {
        // Listen to popstate for browser back/forward
        this.boundHandlePopState = () => {
            this.reportRoute();
        };
        window.addEventListener('popstate', this.boundHandlePopState);

        // Intercept pushState and replaceState for SPA navigation
        this.interceptHistoryMethods();

        this.logger.debug('Route detection setup complete');
    }

    /**
     * Intercept history.pushState and history.replaceState
     * @private
     */
    interceptHistoryMethods() {
        const original = {
            pushState: window.history.pushState.bind(window.history),
            replaceState: window.history.replaceState.bind(window.history),
        };

        // Wrap pushState
        window.history.pushState = (...args) => {
            original.pushState(...args);
            this.reportRoute();
        };

        // Wrap replaceState
        window.history.replaceState = (...args) => {
            original.replaceState(...args);
            this.reportRoute();
        };

        this.logger.debug('History methods intercepted for route detection');
    }

    /**
     * Get current route information
     * @returns {Object} Route info with path and title
     */
    getCurrentRoute() {
        return this.getRoute();
    }

    /**
     * Report current route to parent
     * @param {string} [path] - Optional path override
     * @param {string} [title] - Optional title override
     */
    reportRoute(path, title) {
        let route;

        if (path !== undefined) {
            // Manual override
            route = {
                path,
                title: title || document.title,
            };
        } else {
            // Get from getRoute function
            route = this.getCurrentRoute();
        }

        // Only report if route actually changed
        const routeKey = `${route.path}|${route.title}`;
        if (this.currentRoute === routeKey) {
            this.logger.debug('Route unchanged, skipping report:', route.path);
            return;
        }

        this.currentRoute = routeKey;
        this.logger.debug('Reporting route:', route);
        this.callback(route);
    }

    /**
     * Stop route detection and cleanup
     */
    stop() {
        if (this.boundHandlePopState) {
            window.removeEventListener('popstate', this.boundHandlePopState);
        }
        this.logger.debug('Route reporting stopped');
    }
}

/**
 * Default route getter function
 * @returns {Object} Route info
 */
export function defaultRouteGetter() {
    return {
        path: window.location.pathname + window.location.search + window.location.hash,
        title: document.title,
    };
}
