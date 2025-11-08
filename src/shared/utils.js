import { DEFAULTS } from './constants.js';

/**
 * Logger utility with configurable verbosity
 */
export class Logger {
    constructor(level = DEFAULTS.LOG_LEVEL, prefix = 'FrameBridge') {
        this.level = level;
        this.prefix = prefix;
        this.levels = DEFAULTS.LOG_LEVELS;
    }

    setLevel(level) {
        this.level = level;
    }

    debug(...args) {
        if (this.level >= this.levels.DEBUG) {
            console.debug(`[${this.prefix}]`, ...args);
        }
    }

    info(...args) {
        if (this.level >= this.levels.INFO) {
            console.info(`[${this.prefix}]`, ...args);
        }
    }

    warn(...args) {
        if (this.level >= this.levels.WARN) {
            console.warn(`[${this.prefix}]`, ...args);
        }
    }

    error(...args) {
        if (this.level >= this.levels.ERROR) {
            console.error(`[${this.prefix}]`, ...args);
        }
    }
}

/**
 * Debounce function execution
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Generate a unique message ID
 * @param {boolean} isChildFrame - Whether this is a child frame
 * @returns {string} Unique message ID
 */
export function generateMessageId(isChildFrame) {
    const type = isChildFrame ? 1 : 0;
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 7);
    const counter = generateMessageId.counter || 0;
    generateMessageId.counter = (counter + 1) % 10000;
    return `${counter}-${type}-${timestamp}-${random}`;
}

/**
 * Check if code is running in an iframe
 * @returns {boolean}
 */
export function isInIframe() {
    try {
        return window.self !== window.top;
    } catch (e) {
        // If we get a security error, we're definitely in an iframe
        return true;
    }
}

/**
 * Get iframe ID from data attribute or generate one
 * @returns {string} Iframe ID
 */
export function getIframeId() {
    try {
        const iframe = window.frameElement;
        if (iframe?.dataset?.messengerId) {
            return iframe.dataset.messengerId;
        }
    } catch (e) {
        // Cross-origin iframe, can't access frameElement
    }

    // Generate UUID-like ID
    return `iframe-${generateUUID()}`;
}

/**
 * Generate a simple UUID v4
 * @returns {string}
 */
function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }

    // Fallback for older browsers
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

/**
 * Sleep for a specified duration
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
export function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Deep freeze an object
 * @param {Object} obj - Object to freeze
 * @returns {Object} Frozen object
 */
export function deepFreeze(obj) {
    Object.freeze(obj);

    Object.getOwnPropertyNames(obj).forEach((prop) => {
        if (
            obj[prop] !== null &&
            (typeof obj[prop] === 'object' || typeof obj[prop] === 'function') &&
            !Object.isFrozen(obj[prop])
        ) {
            deepFreeze(obj[prop]);
        }
    });

    return obj;
}

/**
 * Safe JSON parse with fallback
 * @param {string} json - JSON string to parse
 * @param {*} fallback - Fallback value if parse fails
 * @returns {*} Parsed value or fallback
 */
export function safeJSONParse(json, fallback = null) {
    try {
        return JSON.parse(json);
    } catch (e) {
        return fallback;
    }
}

/**
 * Get query parameters from URL
 * @param {string} [url] - URL to parse (defaults to current location)
 * @returns {Object} Object with key-value pairs
 */
export function getQueryParams(url) {
    const searchParams = new URLSearchParams(url || window.location.search);
    const params = {};
    for (const [key, value] of searchParams.entries()) {
        params[key] = value;
    }
    return params;
}

/**
 * Update query parameters in URL without reload
 * @param {Object} params - Parameters to update
 * @param {boolean} replace - Use replaceState instead of pushState
 */
export function updateQueryParams(params, replace = true) {
    const url = new URL(window.location.href);
    Object.entries(params).forEach(([key, value]) => {
        if (value === null || value === undefined) {
            url.searchParams.delete(key);
        } else {
            url.searchParams.set(key, value);
        }
    });

    const method = replace ? 'replaceState' : 'pushState';
    window.history[method]({}, '', url.toString());
}
