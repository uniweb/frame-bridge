/**
 * Registry for managing multiple iframe connections
 */
export class IframeRegistry {
    constructor(logger) {
        this.logger = logger;
        this.iframes = new Map();
    }

    /**
     * Register a new iframe
     * @param {string} iframeId - Unique iframe identifier
     * @param {Object} metadata - Iframe metadata
     * @returns {boolean} True if registered successfully
     */
    register(iframeId, metadata) {
        if (this.iframes.has(iframeId)) {
            this.logger.warn('Iframe already registered, updating:', iframeId);
        }

        this.iframes.set(iframeId, {
            ...metadata,
            registeredAt: Date.now(),
        });

        this.logger.info('Iframe registered:', iframeId, metadata);
        return true;
    }

    /**
     * Unregister an iframe
     * @param {string} iframeId - Iframe identifier
     * @returns {boolean} True if unregistered successfully
     */
    unregister(iframeId) {
        const existed = this.iframes.delete(iframeId);
        if (existed) {
            this.logger.info('Iframe unregistered:', iframeId);
        }
        return existed;
    }

    /**
     * Get iframe metadata
     * @param {string} iframeId - Iframe identifier
     * @returns {Object|null} Iframe metadata or null if not found
     */
    get(iframeId) {
        return this.iframes.get(iframeId) || null;
    }

    /**
     * Check if iframe is registered
     * @param {string} iframeId - Iframe identifier
     * @returns {boolean}
     */
    has(iframeId) {
        return this.iframes.has(iframeId);
    }

    /**
     * Get all registered iframe IDs
     * @returns {string[]}
     */
    getAllIds() {
        return Array.from(this.iframes.keys());
    }

    /**
     * Get all registered iframes
     * @returns {Object[]} Array of iframe metadata with IDs
     */
    getAll() {
        return Array.from(this.iframes.entries()).map(([id, metadata]) => ({
            id,
            ...metadata,
        }));
    }

    /**
     * Update iframe metadata
     * @param {string} iframeId - Iframe identifier
     * @param {Object} updates - Metadata updates
     * @returns {boolean} True if updated successfully
     */
    update(iframeId, updates) {
        const iframe = this.iframes.get(iframeId);
        if (!iframe) {
            this.logger.warn('Cannot update non-existent iframe:', iframeId);
            return false;
        }

        this.iframes.set(iframeId, {
            ...iframe,
            ...updates,
            updatedAt: Date.now(),
        });

        this.logger.debug('Iframe updated:', iframeId, updates);
        return true;
    }

    /**
     * Clear all registered iframes
     */
    clear() {
        const count = this.iframes.size;
        this.iframes.clear();
        this.logger.info(`Cleared ${count} registered iframes`);
    }

    /**
     * Get count of registered iframes
     * @returns {number}
     */
    count() {
        return this.iframes.size;
    }
}
