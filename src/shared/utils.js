import { DEFAULTS } from './constants.js'

/**
 * Logger utility with configurable verbosity
 */
export class Logger {
  constructor(level = DEFAULTS.LOG_LEVEL, prefix = 'FrameBridge') {
    this.level = level
    this.prefix = prefix
    this.levels = DEFAULTS.LOG_LEVELS
  }

  setLevel(level) {
    this.level = level
  }

  debug(...args) {
    if (this.level >= this.levels.DEBUG) {
      console.debug(`[${this.prefix}]`, ...args)
    }
  }

  info(...args) {
    if (this.level >= this.levels.INFO) {
      console.info(`[${this.prefix}]`, ...args)
    }
  }

  warn(...args) {
    if (this.level >= this.levels.WARN) {
      console.warn(`[${this.prefix}]`, ...args)
    }
  }

  error(...args) {
    if (this.level >= this.levels.ERROR) {
      console.error(`[${this.prefix}]`, ...args)
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
  let timeout
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

/**
 * Generate a unique message ID
 * @param {boolean} isChildFrame - Whether this is a child frame
 * @returns {string} Unique message ID
 */
export function generateMessageId(isChildFrame) {
  const type = isChildFrame ? 1 : 0
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 7)
  const counter = generateMessageId.counter || 0
  generateMessageId.counter = (counter + 1) % 10000
  return `${counter}-${type}-${timestamp}-${random}`
}

/**
 * Read a comma-separated origin list off the currently-executing script tag.
 *
 *   <script src="…/child.min.js" data-allowed-origins="https://a.example.com">
 *
 * ⛔ Returns `null` when the attribute is absent or empty, and callers MUST
 * read that as "same-origin only" — never as "any origin". The auto-init
 * bundles enable `routeReporting` and wire `onNavigate`, so a permissive
 * default would let any page that frames the document steer it.
 *
 * `document.currentScript` is only valid while a classic `<script src>` is
 * evaluating, which is how these bundles are documented — so callers must read
 * it synchronously at the top of the IIFE. A module or async loader may null
 * it, hence the explicit override.
 *
 * @param {Element} [scriptEl] - Script element to read instead of currentScript
 * @returns {string[]|null} Declared origins, or null if none were declared
 */
export function readAllowedOriginsAttribute(scriptEl) {
  try {
    const el = scriptEl || document.currentScript
    const raw =
      el?.dataset?.allowedOrigins ??
      el?.getAttribute?.('data-allowed-origins')
    if (!raw) return null

    const origins = raw
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)

    return origins.length ? origins : null
  } catch (e) {
    return null
  }
}

/**
 * Origins this page has deliberately framed, for the parent auto-init.
 *
 * An embedder already names its children in the iframe `src` it wrote, so
 * requiring it to repeat them in an attribute is redundant. `window.location
 * .origin` is always included, which makes this **strictly additive**: it can
 * only widen the same-origin default, never narrow it — an iframe whose `src`
 * is assigned later still works exactly as it does today.
 *
 * @returns {string[]} Own origin plus every framed origin found at load
 */
export function deriveOriginsFromIframes() {
  const origins = new Set([window.location.origin])

  try {
    for (const el of document.querySelectorAll('iframe[src]')) {
      try {
        const { origin } = new URL(
          el.getAttribute('src'),
          window.location.href
        )
        // An opaque origin ('null' — srcdoc, data:) can never be matched.
        if (origin && origin !== 'null') origins.add(origin)
      } catch (e) {
        // An unparseable src names no origin; skip it.
      }
    }
  } catch (e) {
    // No DOM to query — fall through with the own-origin default.
  }

  return [...origins]
}

/**
 * Can this string be used as a postMessage `targetOrigin`?
 *
 * `allowedOrigins` is a permission set and may hold wildcard PATTERNS
 * (`https://*.example.com`) which `OriginValidator` matches on the way in.
 * A pattern can never be addressed on the way out: measured in Chrome,
 * `postMessage(msg, 'https://*.example.com')` is accepted without throwing
 * and is then never delivered to anyone. `'null'` is likewise discarded per
 * the HTML spec. Both must be filtered before addressing, not after.
 *
 * @param {string} origin - Candidate origin
 * @returns {boolean} True if a window could actually match it
 */
export function isAddressableOrigin(origin) {
  return (
    typeof origin === 'string' &&
    origin.length > 0 &&
    !origin.includes('*') &&
    origin !== 'null'
  )
}

/**
 * Check if code is running in an iframe
 * @returns {boolean}
 */
export function isInIframe() {
  try {
    return window.self !== window.top
  } catch (e) {
    // If we get a security error, we're definitely in an iframe
    return true
  }
}

/**
 * Get iframe ID from data attribute or generate one
 * @returns {string} Iframe ID
 */
export function getIframeId() {
  try {
    const iframe = window.frameElement
    if (iframe?.dataset?.messengerId) {
      return iframe.dataset.messengerId
    }
  } catch (e) {
    // Cross-origin iframe, can't access frameElement
  }

  // Generate UUID-like ID
  return `iframe-${generateUUID()}`
}

/**
 * Generate a simple UUID v4
 * @returns {string}
 */
function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }

  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * Sleep for a specified duration
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Safe JSON parse with fallback
 * @param {string} json - JSON string to parse
 * @param {*} fallback - Fallback value if parse fails
 * @returns {*} Parsed value or fallback
 */
export function safeJSONParse(json, fallback = null) {
  try {
    return JSON.parse(json)
  } catch (e) {
    return fallback
  }
}

/**
 * Get query parameters from URL
 * @param {string} [url] - URL to parse (defaults to current location)
 * @returns {Object} Object with key-value pairs
 */
export function getQueryParams(url) {
  const searchParams = new URLSearchParams(url || window.location.search)
  const params = {}
  for (const [key, value] of searchParams.entries()) {
    params[key] = value
  }
  return params
}

/**
 * Update query parameters in URL without reload
 * @param {Object} params - Parameters to update
 * @param {boolean} replace - Use replaceState instead of pushState
 */
export function updateQueryParams(params, replace = true) {
  const url = new URL(window.location.href)
  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined) {
      url.searchParams.delete(key)
    } else {
      url.searchParams.set(key, value)
    }
  })

  const method = replace ? 'replaceState' : 'pushState'
  window.history[method]({}, '', url.toString())
}
