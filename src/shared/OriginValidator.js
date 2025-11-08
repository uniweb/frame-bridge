import { ERRORS } from './constants.js';
import { Logger } from './utils.js';

/**
 * Validates message origins against allowed origins list
 */
export class OriginValidator {
    /**
     * @param {string[]|null} allowedOrigins - Array of allowed origins or null for same-origin only
     * @param {Logger} logger - Logger instance
     */
    constructor(allowedOrigins = null, logger) {
        this.logger = logger;

        // null means same-origin only (strict default)
        if (allowedOrigins === null) {
            this.allowedOrigins = [window.location.origin];
            this.logger.debug('Origin validation: same-origin only');
        } else if (Array.isArray(allowedOrigins) && allowedOrigins.length > 0) {
            this.allowedOrigins = allowedOrigins;
            this.logger.debug('Origin validation enabled:', allowedOrigins);
        } else {
            // Empty array or invalid value - default to same-origin
            this.allowedOrigins = [window.location.origin];
            this.logger.warn('Invalid allowedOrigins provided, defaulting to same-origin only');
        }
    }

    /**
     * Validate if an origin is allowed
     * @param {string} origin - Origin to validate
     * @returns {boolean} True if origin is allowed
     */
    validate(origin) {
        // Wildcard allows all (use with caution)
        if (this.allowedOrigins.includes('*')) {
            this.logger.warn('Wildcard origin validation - accepting all origins (security risk)');
            return true;
        }

        // Check exact matches and wildcard patterns
        const isAllowed = this.allowedOrigins.some((allowed) => {
            if (allowed === origin) {
                return true;
            }

            // Support wildcard patterns like https://*.example.com
            if (allowed.includes('*')) {
                const pattern = this.createPatternRegex(allowed);
                return pattern.test(origin);
            }

            return false;
        });

        if (!isAllowed) {
            this.logger.error(ERRORS.ORIGIN_MISMATCH, { origin, allowed: this.allowedOrigins });
        }

        return isAllowed;
    }

    /**
     * Create regex pattern from wildcard string
     * @private
     * @param {string} pattern - Pattern with * wildcards
     * @returns {RegExp} Regular expression
     */
    createPatternRegex(pattern) {
        // Escape special regex characters except *
        const escaped = pattern
            .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
            .replace(/\*/g, '.*');

        return new RegExp(`^${escaped}$`);
    }

    /**
     * Get list of allowed origins (for debugging)
     * @returns {string[]}
     */
    getAllowedOrigins() {
        return [...this.allowedOrigins];
    }
}
