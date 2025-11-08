import { debounce } from '../shared/utils.js';
import { DEFAULTS } from '../shared/constants.js';

/**
 * Reports iframe dimensions to parent using ResizeObserver
 */
export class DimensionReporter {
    /**
     * @param {Function} callback - Called when dimensions change
     * @param {number} debounceMs - Debounce delay in milliseconds
     * @param {Logger} logger - Logger instance
     */
    constructor(callback, debounceMs = DEFAULTS.DIMENSION_DEBOUNCE, logger) {
        this.callback = callback;
        this.logger = logger;
        this.observer = null;

        // Create debounced report function
        this.debouncedReport = debounce(() => {
            this.reportDimensions();
        }, debounceMs);

        this.start();
    }

    /**
     * Start observing dimension changes
     */
    start() {
        if (!window.ResizeObserver) {
            this.logger.warn('ResizeObserver not supported, using fallback');
            this.setupFallback();
            return;
        }

        this.observer = new ResizeObserver(() => {
            this.debouncedReport();
        });

        // Observe body element
        this.observer.observe(document.body);

        // Also observe documentElement for cases where body doesn't expand
        if (document.documentElement !== document.body) {
            this.observer.observe(document.documentElement);
        }

        this.logger.debug('Dimension reporting started');

        // Report initial dimensions
        this.reportDimensions();
    }

    /**
     * Setup fallback for browsers without ResizeObserver
     * @private
     */
    setupFallback() {
        // Use MutationObserver and window resize as fallback
        let mutationTimeout;

        const observer = new MutationObserver(() => {
            clearTimeout(mutationTimeout);
            mutationTimeout = setTimeout(() => {
                this.debouncedReport();
            }, 100);
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
        });

        window.addEventListener('resize', () => {
            this.debouncedReport();
        });

        this.observer = observer;
        this.reportDimensions();
    }

    /**
     * Calculate and report current dimensions
     * @private
     */
    reportDimensions() {
        const dimensions = this.getDimensions();
        this.logger.debug('Reporting dimensions:', dimensions);
        this.callback(dimensions);
    }

    /**
     * Get current document dimensions
     * @returns {Object} Dimensions object
     */
    getDimensions() {
        // Get the maximum of various height measurements
        const height = Math.max(
            document.body.scrollHeight,
            document.body.offsetHeight,
            document.documentElement.clientHeight,
            document.documentElement.scrollHeight,
            document.documentElement.offsetHeight
        );

        const width = Math.max(
            document.body.scrollWidth,
            document.body.offsetWidth,
            document.documentElement.clientWidth,
            document.documentElement.scrollWidth,
            document.documentElement.offsetWidth
        );

        return { width, height };
    }

    /**
     * Manually trigger dimension report (useful after content changes)
     */
    report() {
        this.reportDimensions();
    }

    /**
     * Stop observing and cleanup
     */
    stop() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        this.logger.debug('Dimension reporting stopped');
    }
}
