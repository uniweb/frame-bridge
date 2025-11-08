/**
 * Action types for parent-child communication
 * @constant
 */
export const ACTIONS = {
    // System actions (prefixed with __ to avoid collisions)
    PING: '__ping',
    PONG: '__pong',
    ANNOUNCE: '__announce',
    ANNOUNCE_RESPONSE: '__announceResponse',

    // Child → Parent actions
    UPDATE_DIMENSIONS: 'updateDimensions',
    UPDATE_ROUTE: 'updateRoute',
    UPDATE_JSONLD: 'updateJSONLD',
    REQUEST_PARAM: 'requestParam',

    // Parent → Child actions
    NAVIGATE: 'navigate',
    SET_PARAMS: 'setParams',
    SET_ANALYTICS_ID: 'setAnalyticsId',
};

/**
 * Default configuration values
 * @constant
 */
export const DEFAULTS = {
    // Timeout for promise-based messages (ms)
    MESSAGE_TIMEOUT: 5000,

    // Debounce for dimension reporting (ms)
    DIMENSION_DEBOUNCE: 150,

    // Retry attempts for initial announce
    ANNOUNCE_RETRIES: 3,
    ANNOUNCE_RETRY_DELAY: 500,

    // Logging levels
    LOG_LEVELS: {
        SILENT: 0,
        ERROR: 1,
        WARN: 2,
        INFO: 3,
        DEBUG: 4,
    },

    // Default log level
    LOG_LEVEL: 3, // INFO (verbose)

    // URL sync param key
    URL_PARAM_KEY: 'path',
};

/**
 * Error messages
 * @constant
 */
export const ERRORS = {
    ORIGIN_MISMATCH: 'Message origin does not match allowed origins',
    MESSAGE_TIMEOUT: 'Message timed out waiting for response',
    NOT_IN_IFRAME: 'ChildMessenger can only be used within an iframe',
    NO_CHILD_WINDOW: 'No child window registered',
    INVALID_ACTION: 'No handler found for action',
    ANNOUNCE_FAILED: 'Failed to announce to parent after retries',
};
