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

        // Track last reported dimensions to prevent redundant reports
        this.lastReportedWidth = null;
        this.lastReportedHeight = null;

        // Minimum change threshold (in pixels) before reporting
        // Default 1px to account for sub-pixel rounding differences
        // Set to 0 to report every change
        this.threshold = 1;

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
        const dimensions = DimensionReporter.getDimensions();

        // Check if dimensions changed significantly (use primary width/height)
        const widthChanged =
            this.lastReportedWidth === null ||
            Math.abs(dimensions.width - this.lastReportedWidth) >
                this.threshold;
        const heightChanged =
            this.lastReportedHeight === null ||
            Math.abs(dimensions.height - this.lastReportedHeight) >
                this.threshold;

        if (!widthChanged && !heightChanged) {
            this.logger.debug(
                'Dimensions unchanged (within threshold), skipping report'
            );
            return;
        }

        // Update last reported dimensions
        this.lastReportedWidth = dimensions.width;
        this.lastReportedHeight = dimensions.height;

        this.logger.debug('Reporting dimensions:', {
            width: dimensions.width,
            height: dimensions.height,
            spacing: dimensions._debug?.bodySpacing?.total || 0,
        });

        this.callback(dimensions);
    }

    /**
     * Get current document dimensions
     * Accounts for body margin and padding to get true content height
     * @returns {Object} Dimensions object
     */
    static getDimensions() {
        const body = document.body;
        const html = document.documentElement;
        const bodyStyle = window.getComputedStyle(body);

        // Get body spacing that affects total height
        const bodyMarginTop = parseInt(bodyStyle.marginTop) || 0;
        const bodyMarginBottom = parseInt(bodyStyle.marginBottom) || 0;
        const bodyPaddingTop = parseInt(bodyStyle.paddingTop) || 0;
        const bodyPaddingBottom = parseInt(bodyStyle.paddingBottom) || 0;

        // Body border (usually 0, but should be accounted for)
        const bodyBorderTop = parseInt(bodyStyle.borderTopWidth) || 0;
        const bodyBorderBottom = parseInt(bodyStyle.borderBottomWidth) || 0;

        // Get content height (without body's own spacing)
        const contentHeight = Math.max(
            body.scrollHeight,
            body.offsetHeight,
            html.scrollHeight,
            html.offsetHeight
        );

        const contentWidth = Math.max(
            body.scrollWidth,
            body.offsetWidth,
            html.scrollWidth,
            html.offsetWidth
        );

        // Total spacing on body element
        const bodyVerticalSpacing =
            bodyMarginTop +
            bodyMarginBottom +
            bodyPaddingTop +
            bodyPaddingBottom +
            bodyBorderTop +
            bodyBorderBottom;

        // True height = content + all body spacing
        const totalHeight = contentHeight + bodyVerticalSpacing;

        return {
            width: contentWidth,
            height: totalHeight,

            // Include spacing breakdown for debugging (optional)
            _debug: {
                contentHeight,
                bodySpacing: {
                    margin: bodyMarginTop + bodyMarginBottom,
                    padding: bodyPaddingTop + bodyPaddingBottom,
                    border: bodyBorderTop + bodyBorderBottom,
                    total: bodyVerticalSpacing,
                },
            },
        };
    }

    /**
     * Set the threshold for reporting dimension changes (in pixels)
     * @param {number} threshold - Minimum change in pixels before reporting
     */
    setThreshold(threshold) {
        this.threshold = threshold;
        this.logger.debug('Dimension report threshold set to:', threshold);
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
