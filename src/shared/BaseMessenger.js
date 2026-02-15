import { ACTIONS, DEFAULTS, ERRORS } from "./constants.js";
import { OriginValidator } from "./OriginValidator.js";
import { Logger, generateMessageId } from "./utils.js";

/**
 * Base class for handling message communication between parent and child windows
 * @abstract
 */
export class BaseMessenger {
  /**
   * @param {Object} options - Configuration options
   * @param {boolean} options.isChildFrame - Whether this instance is in a child frame
   * @param {string[]|null} options.allowedOrigins - Allowed origins for messages
   * @param {Object} options.actionHandlers - Custom action handlers
   * @param {number} options.timeout - Message timeout in milliseconds
   * @param {number|string} options.logLevel - Logging verbosity level
   */
  constructor(options = {}) {
    const {
      isChildFrame = false,
      allowedOrigins = null,
      actionHandlers = {},
      timeout = DEFAULTS.MESSAGE_TIMEOUT,
      logLevel = DEFAULTS.LOG_LEVEL,
    } = options;

    // Setup logger
    this.logger = new Logger(
      typeof logLevel === "string"
        ? DEFAULTS.LOG_LEVELS[logLevel.toUpperCase()]
        : logLevel,
      isChildFrame ? "FrameBridge:Child" : "FrameBridge:Parent"
    );

    // Store configuration as frozen properties
    this.defineConstProperty("isChildFrame", isChildFrame);
    this.defineConstProperty("timeout", timeout);

    // Initialize state
    this.pendingPromises = new Map();
    this.validator = new OriginValidator(allowedOrigins, this.logger);

    // Merge built-in and custom action handlers
    this.actionHandlers = {
      ...this.getBuiltInHandlers(),
      ...actionHandlers,
    };

    // Start listening for messages
    this.boundHandleMessage = this.handleMessage.bind(this);
    window.addEventListener("message", this.boundHandleMessage);

    this.logger.info("Messenger initialized", {
      isChildFrame,
      allowedOrigins: this.validator.getAllowedOrigins(),
    });
  }

  /**
   * Get built-in action handlers (to be overridden by subclasses)
   * @protected
   * @returns {Object}
   */
  getBuiltInHandlers() {
    return {
      [ACTIONS.PING]: () => ({ type: ACTIONS.PONG, timestamp: Date.now() }),
    };
  }

  /**
   * Send a message and wait for response
   * @protected
   * @param {Window} targetWindow - Target window object
   * @param {string} action - Action name
   * @param {Object} params - Parameters to send
   * @param {string} targetOrigin - Target origin for postMessage
   * @returns {Promise<*>} Response from target
   */
  sendMessage(
    targetWindow,
    action,
    params = {},
    targetOrigin = window.location.origin
  ) {
    return new Promise((resolve, reject) => {
      const messageId = generateMessageId(this.isChildFrame);
      const message = {
        id: messageId,
        action,
        params,
        sender: "FrameBridge",
      };

      this.logger.debug("Sending message:", { action, messageId, params });

      // Setup timeout
      const timeoutId = setTimeout(() => {
        this.pendingPromises.delete(messageId);
        this.logger.error(ERRORS.MESSAGE_TIMEOUT, { action, messageId });
        reject(new Error(`${ERRORS.MESSAGE_TIMEOUT}: ${action}`));
      }, this.timeout);

      // Store promise resolver with timeout
      this.pendingPromises.set(messageId, { resolve, reject, timeoutId });

      // Send message
      try {
        targetWindow.postMessage(message, targetOrigin);
      } catch (error) {
        this.pendingPromises.delete(messageId);
        clearTimeout(timeoutId);
        this.logger.error("Failed to send message:", error);
        reject(error);
      }
    });
  }

  /**
   * Handle incoming messages
   * @private
   * @param {MessageEvent} event - Message event
   */
  async handleMessage(event) {
    // Validate origin
    if (!this.validator.validate(event.origin)) {
      return;
    }

    const { id, action, params, sender } = event.data || {};

    // Ignore messages not from FrameBridge
    if (sender !== "FrameBridge") {
      return;
    }

    this.logger.debug("Received message:", { action, id, params });

    // Check if this is a response to a message we sent
    if (this.pendingPromises.has(id)) {
      const { resolve, timeoutId } = this.pendingPromises.get(id);
      this.pendingPromises.delete(id);
      clearTimeout(timeoutId);
      resolve(params);
      return;
    }

    // This is a new message that needs handling
    try {
      const result = await this.handleAction(
        action,
        params,
        event.source,
        event.origin
      );
      this.sendResponse(event.source, id, action, result, event.origin);
    } catch (error) {
      this.logger.error("Error handling action:", { action, error });
      this.sendResponse(
        event.source,
        id,
        action,
        { error: error.message },
        event.origin
      );
    }
  }

  /**
   * Handle an action by calling the appropriate handler
   * @protected
   * @param {string} action - Action name
   * @param {Object} params - Action parameters
   * @param {Window} source - Source window
   * @param {string} origin - Source origin
   * @returns {Promise<*>|*} Result from handler
   */
  async handleAction(action, params, source, origin) {
    if (this.actionHandlers.hasOwnProperty(action)) {
      const handler = this.actionHandlers[action];
      const result = handler(params, source, origin);

      // Support both sync and async handlers
      if (result instanceof Promise) {
        return await result;
      }
      return result;
    } else {
      this.logger.warn(ERRORS.INVALID_ACTION, { action });
      return { error: ERRORS.INVALID_ACTION };
    }
  }

  /**
   * Send response to a message
   * @private
   * @param {Window} targetWindow - Target window
   * @param {string} messageId - Original message ID
   * @param {string} action - Original action
   * @param {*} result - Result to send back
   * @param {string} targetOrigin - Target origin
   */
  sendResponse(targetWindow, messageId, action, result, targetOrigin) {
    const message = {
      id: messageId,
      action: `${action}Response`,
      params: result,
      sender: "FrameBridge",
    };

    this.logger.debug("Sending response:", { action, messageId });

    // Null-origin iframes (srcdoc, data: URLs) can only be reached with '*'.
    // postMessage(data, "null") is silently discarded per the HTML spec.
    const origin = targetOrigin === "null" ? "*" : targetOrigin;

    try {
      targetWindow.postMessage(message, origin);
    } catch (error) {
      this.logger.error("Failed to send response:", error);
    }
  }

  /**
   * Define a constant (read-only) property
   * @protected
   * @param {string} name - Property name
   * @param {*} value - Property value
   */
  defineConstProperty(name, value) {
    Object.defineProperty(this, name, {
      value,
      writable: false,
      configurable: false,
    });
  }

  /**
   * Set a single action handler (add or replace)
   * @param {string} action - Action name
   * @param {Function} handler - Handler function
   */
  setHandler(action, handler) {
    this.actionHandlers[action] = handler;
  }

  /**
   * Set multiple action handlers (add or replace)
   * @param {Object} handlers - Map of action names to handler functions
   */
  setHandlers(handlers) {
    Object.assign(this.actionHandlers, handlers);
  }

  /**
   * Set log level
   * @param {number|string} level - Log level
   */
  setLogLevel(level) {
    const numericLevel =
      typeof level === "string"
        ? DEFAULTS.LOG_LEVELS[level.toUpperCase()]
        : level;
    this.logger.setLevel(numericLevel);
  }

  /**
   * Destroy messenger and cleanup
   */
  destroy() {
    window.removeEventListener("message", this.boundHandleMessage);

    // Clear pending promises
    this.pendingPromises.forEach(({ reject, timeoutId }) => {
      clearTimeout(timeoutId);
      reject(new Error("Messenger destroyed"));
    });
    this.pendingPromises.clear();

    this.logger.info("Messenger destroyed");
  }
}
