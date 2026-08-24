import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ACTIONS } from '../src/shared/constants.js'

/**
 * The CDN auto-init bundles.
 *
 * These are the `dist/auto/*.min.js` scripts documented in the README as
 * jsDelivr includes — a public entry point whose consumers are outside every
 * repo we own, so no grep here can tell us who uses it.
 *
 * ⛔ Neither bundle set `allowedOrigins` until 2026-08-24, so `OriginValidator`
 * defaulted each side to its OWN origin. The README's own example frames a
 * cross-origin document, and that example could never complete a handshake:
 * the child addressed itself (silently dropped) and both sides rejected the
 * other on the way in. It had been broken since the bundles were introduced.
 *
 * Nothing exercised auto-init at all, which is how that survived every release.
 * These tests are the guard — we do not use this path ourselves, so they are
 * the only thing standing between it and the next silent breakage.
 */

const CHILD_ORIGIN = 'https://site.example.com'
const EMBEDDER_ORIGIN = 'https://embedder.example.com'

/** Stand in for the script element that is "currently evaluating". */
function setCurrentScript(attrs) {
  const el = attrs === null ? null : document.createElement('script')
  if (el && attrs) {
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
  }
  Object.defineProperty(document, 'currentScript', {
    value: el,
    configurable: true
  })
  return el
}

describe('CDN auto-init bundles', () => {
  let posted
  let listeners

  beforeEach(() => {
    posted = []
    listeners = new Set()
    document.body.innerHTML = ''
    vi.resetModules()
    setCurrentScript(null)
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    window.FrameBridge?.messenger?.destroy?.()
    delete window.FrameBridge
    vi.restoreAllMocks()
  })

  /** Minimal window the IIFEs can run against, with `posted` capturing sends. */
  function installWindow({ inIframe }) {
    const parent = { postMessage: (m, t) => posted.push({ m, t }) }
    global.window = {
      self: {},
      top: inIframe ? {} : undefined,
      parent,
      location: {
        origin: inIframe ? CHILD_ORIGIN : EMBEDDER_ORIGIN,
        href: (inIframe ? CHILD_ORIGIN : EMBEDDER_ORIGIN) + '/',
        pathname: '/',
        search: '',
        hash: ''
      },
      getComputedStyle: () => ({
        marginTop: '0px',
        marginBottom: '0px',
        paddingTop: '0px',
        paddingBottom: '0px',
        borderTopWidth: '0px',
        borderBottomWidth: '0px'
      }),
      addEventListener: (t, fn) => t === 'message' && listeners.add(fn),
      removeEventListener: (t, fn) => listeners.delete(fn),
      history: { pushState() {}, replaceState() {} }
    }
    if (!inIframe) global.window.self = global.window.top = global.window
  }

  describe('child (dist/auto/child.min.js)', () => {
    it('reaches a CROSS-ORIGIN embedder when the script tag declares it', async () => {
      // The README's documented case. Before this fix nothing was delivered.
      installWindow({ inIframe: true })
      setCurrentScript({ 'data-allowed-origins': EMBEDDER_ORIGIN })

      await import('../src/child/auto-init.js')
      await Promise.resolve()

      const announce = posted.filter((p) => p.m.action === ACTIONS.ANNOUNCE)
      expect(announce.length).toBeGreaterThan(0)
      expect(announce.map((p) => p.t)).toContain(EMBEDDER_ORIGIN)
      // ⛔ Never its own origin — that was the bug.
      expect(announce.map((p) => p.t)).not.toContain(CHILD_ORIGIN)
    })

    it('accepts several origins, comma-separated and whitespace-tolerant', async () => {
      installWindow({ inIframe: true })
      setCurrentScript({
        'data-allowed-origins': `${EMBEDDER_ORIGIN} , https://other.example.com`
      })

      await import('../src/child/auto-init.js')
      await Promise.resolve()

      const targets = posted.map((p) => p.t)
      expect(targets).toContain(EMBEDDER_ORIGIN)
      expect(targets).toContain('https://other.example.com')
    })

    it('⛔ falls back to SAME-ORIGIN, never to a wildcard, with no attribute', async () => {
      // This bundle enables routeReporting and wires onNavigate, so a
      // permissive default would let any framing page steer the document.
      installWindow({ inIframe: true })
      setCurrentScript(null)

      await import('../src/child/auto-init.js')
      await Promise.resolve()

      expect(posted.length).toBeGreaterThan(0)
      expect(posted.map((p) => p.t)).not.toContain('*')
      expect(window.FrameBridge.messenger.validator.getAllowedOrigins()).toEqual(
        [CHILD_ORIGIN]
      )
    })

    it('treats an empty attribute as absent', async () => {
      installWindow({ inIframe: true })
      setCurrentScript({ 'data-allowed-origins': '   ,  ' })

      await import('../src/child/auto-init.js')
      await Promise.resolve()

      expect(window.FrameBridge.messenger.validator.getAllowedOrigins()).toEqual(
        [CHILD_ORIGIN]
      )
    })

    it('does nothing at all outside an iframe', async () => {
      installWindow({ inIframe: false })
      setCurrentScript({ 'data-allowed-origins': EMBEDDER_ORIGIN })

      await import('../src/child/auto-init.js')

      expect(window.FrameBridge).toBeUndefined()
      expect(posted).toHaveLength(0)
    })
  })

  describe('parent (dist/auto/parent.min.js)', () => {
    it('derives child origins from the iframes it actually frames', async () => {
      // An embedder already names its children in the src it wrote; making it
      // repeat them in an attribute would be redundant.
      installWindow({ inIframe: false })
      document.body.innerHTML = `<iframe src="${CHILD_ORIGIN}/page" data-messenger-id="main"></iframe>`
      setCurrentScript(null)

      await import('../src/parent/auto-init.js')

      const allowed =
        window.FrameBridge.messenger.validator.getAllowedOrigins()
      expect(allowed).toContain(CHILD_ORIGIN)
    })

    it('⭐ derivation is STRICTLY ADDITIVE — own origin survives', async () => {
      // Regression guard: an iframe whose src is assigned later must keep
      // working exactly as it does today, so the own-origin default must
      // never be narrowed away by the derivation.
      installWindow({ inIframe: false })
      document.body.innerHTML = `<iframe src="${CHILD_ORIGIN}/page"></iframe>`
      setCurrentScript(null)

      await import('../src/parent/auto-init.js')

      const allowed =
        window.FrameBridge.messenger.validator.getAllowedOrigins()
      expect(allowed).toContain(EMBEDDER_ORIGIN) // this page's own origin
      expect(allowed).toContain(CHILD_ORIGIN)
    })

    it('an explicit attribute wins over derivation', async () => {
      installWindow({ inIframe: false })
      document.body.innerHTML = `<iframe src="https://ignored.example.com/x"></iframe>`
      setCurrentScript({ 'data-allowed-origins': CHILD_ORIGIN })

      await import('../src/parent/auto-init.js')

      const allowed =
        window.FrameBridge.messenger.validator.getAllowedOrigins()
      expect(allowed).toEqual([CHILD_ORIGIN])
      expect(allowed).not.toContain('https://ignored.example.com')
    })

    it('ignores an unparseable or opaque iframe src', async () => {
      installWindow({ inIframe: false })
      document.body.innerHTML =
        `<iframe src="about:blank"></iframe><iframe srcdoc="<p>x</p>"></iframe>`
      setCurrentScript(null)

      await import('../src/parent/auto-init.js')

      const allowed =
        window.FrameBridge.messenger.validator.getAllowedOrigins()
      expect(allowed).not.toContain('null')
      expect(allowed).toContain(EMBEDDER_ORIGIN)
    })

    it('falls back to same-origin on a page framing nothing', async () => {
      installWindow({ inIframe: false })
      setCurrentScript(null)

      await import('../src/parent/auto-init.js')

      expect(
        window.FrameBridge.messenger.validator.getAllowedOrigins()
      ).toEqual([EMBEDDER_ORIGIN])
    })
  })
})
