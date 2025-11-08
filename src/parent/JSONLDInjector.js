/**
 * Manages JSON-LD structured data injection into page head
 */
export class JSONLDInjector {
    constructor(logger) {
        this.logger = logger;
        this.scripts = new Map(); // Track scripts by iframe ID
    }

    /**
     * Inject or update JSON-LD for an iframe
     * @param {string} iframeId - Iframe identifier
     * @param {Object} jsonld - JSON-LD structured data object
     */
    inject(iframeId, jsonld) {
        if (!jsonld || typeof jsonld !== 'object') {
            this.logger.warn('Invalid JSON-LD data provided:', jsonld);
            return;
        }

        // Remove existing script for this iframe if present
        this.remove(iframeId);

        // Create new script element
        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.dataset.iframeId = iframeId;
        script.textContent = JSON.stringify(jsonld, null, 2);

        // Append to head
        document.head.appendChild(script);
        this.scripts.set(iframeId, script);

        this.logger.debug('JSON-LD injected for iframe:', iframeId);
    }

    /**
     * Remove JSON-LD for an iframe
     * @param {string} iframeId - Iframe identifier
     * @returns {boolean} True if removed
     */
    remove(iframeId) {
        const script = this.scripts.get(iframeId);
        if (script && script.parentNode) {
            script.parentNode.removeChild(script);
            this.scripts.delete(iframeId);
            this.logger.debug('JSON-LD removed for iframe:', iframeId);
            return true;
        }
        return false;
    }

    /**
     * Get current JSON-LD for an iframe
     * @param {string} iframeId - Iframe identifier
     * @returns {Object|null} JSON-LD object or null
     */
    get(iframeId) {
        const script = this.scripts.get(iframeId);
        if (script) {
            try {
                return JSON.parse(script.textContent);
            } catch (e) {
                this.logger.error('Failed to parse JSON-LD:', e);
                return null;
            }
        }
        return null;
    }

    /**
     * Check if iframe has JSON-LD
     * @param {string} iframeId - Iframe identifier
     * @returns {boolean}
     */
    has(iframeId) {
        return this.scripts.has(iframeId);
    }

    /**
     * Clear all JSON-LD scripts
     */
    clear() {
        this.scripts.forEach((script, iframeId) => {
            this.remove(iframeId);
        });
        this.logger.debug('All JSON-LD scripts cleared');
    }

    /**
     * Get count of active JSON-LD scripts
     * @returns {number}
     */
    count() {
        return this.scripts.size;
    }
}
