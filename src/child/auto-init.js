import { ChildMessenger } from './ChildMessenger.js';
import { isInIframe } from '../shared/utils.js';

/**
 * Auto-initialize ChildMessenger and expose on window
 */
(function () {
    if (typeof window === 'undefined' || !isInIframe()) {
        return;
    }

    // Create messenger with default options
    const messenger = new ChildMessenger({
        dimensionReporting: true,
        routeReporting: true,
    });

    // Simple event emitter for convenience
    const eventCallbacks = {
        parentReady: [],
        navigate: [],
        paramUpdate: [],
    };

    // Wrap messenger with event API
    const api = {
        messenger,

        /**
         * Listen to events
         * @param {string} event - Event name (parentReady, navigate, paramUpdate)
         * @param {Function} callback - Callback function
         */
        on(event, callback) {
            if (eventCallbacks[event]) {
                eventCallbacks[event].push(callback);
            }
        },

        /**
         * Remove event listener
         * @param {string} event - Event name
         * @param {Function} callback - Callback function
         */
        off(event, callback) {
            if (eventCallbacks[event]) {
                const index = eventCallbacks[event].indexOf(callback);
                if (index > -1) {
                    eventCallbacks[event].splice(index, 1);
                }
            }
        },

        /**
         * Send message to parent
         * @param {string} action - Action name
         * @param {Object} params - Parameters
         */
        sendToParent(action, params) {
            return messenger.sendToParent(action, params);
        },

        /**
         * Update route manually
         * @param {string} path - Route path
         * @param {string} title - Page title
         */
        updateRoute(path, title) {
            messenger.updateRoute(path, title);
        },

        /**
         * Update dimensions manually
         */
        updateDimensions() {
            messenger.updateDimensions();
        },

        /**
         * Update JSON-LD
         * @param {Object} jsonld - JSON-LD object
         */
        updateJSONLD(jsonld) {
            messenger.updateJSONLD(jsonld);
        },

        /**
         * Get parameter
         * @param {string} key - Parameter key
         */
        getParam(key) {
            return messenger.getParam(key);
        },

        /**
         * Get all parameters
         */
        getAllParams() {
            return messenger.getAllParams();
        },

        /**
         * Get config value
         * @param {string} key - Config key
         */
        getConfig(key) {
            return messenger.getConfig(key);
        },
    };

    // Wire up callbacks to trigger events
    messenger.options.onParentReady = (data) => {
        eventCallbacks.parentReady.forEach((cb) => cb(data));
    };

    messenger.options.onNavigate = (data) => {
        eventCallbacks.navigate.forEach((cb) => cb(data));
    };

    messenger.options.onParamUpdate = (params) => {
        eventCallbacks.paramUpdate.forEach((cb) => cb(params));
    };

    // Expose on window
    window.FrameBridge = api;

    console.log('[FrameBridge] Child auto-initialized');
})();
