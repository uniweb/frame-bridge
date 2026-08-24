import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ChildMessenger } from '../src/child/ChildMessenger.js'
import { ACTIONS, ERRORS } from '../src/shared/constants.js'

/**
 * How the child addresses its embedder.
 *
 * `allowedOrigins` is a permission SET. Until 2026-08-24 `sendToParent()` used
 * `allowedOrigins[0]` as if its first element identified the parent — a guess
 * whose failure mode is a postMessage the browser drops with no error on
 * either side, reported to the sender as a TIMEOUT (i.e. blaming the parent
 * for not answering a message it never received).
 *
 * These tests pin the replacement: broadcast to bootstrap, then latch the
 * origin we actually heard from.
 */

// Real Chrome, measured 2026-08-24 on https://example.com: postMessage accepts
// ANY parseable targetOrigin without throwing — including a wildcard PATTERN —
// and silently delivers only to a window whose origin matches exactly. This
// fake reproduces that, which is the whole behaviour under test.
function makeParent(actualOrigin) {
  const parent = {
    delivered: [],
    addressed: [],
    postMessage(message, targetOrigin) {
      parent.addressed.push({ message, targetOrigin })
      if (targetOrigin === '*' || targetOrigin === actualOrigin) {
        parent.delivered.push({ message, targetOrigin })
      }
      // Any other targetOrigin — a non-matching origin, or a pattern — is
      // dropped. No throw, no event, no diagnostic. That is the defect.
    }
  }
  return parent
}

describe('ChildMessenger — addressing the embedder', () => {
  let listeners
  let parent
  let messenger

  const CHILD_ORIGIN = 'http://localhost:3002'
  const REAL_PARENT = 'http://localhost:8080'
  const ALSO_PERMITTED = 'http://127.0.0.1:8080'

  beforeEach(() => {
    vi.useFakeTimers()
    listeners = new Set()
    parent = makeParent(REAL_PARENT)

    global.window = {
      self: {},
      top: {}, // self !== top => isInIframe() is true
      parent,
      location: { origin: CHILD_ORIGIN, pathname: '/', search: '', hash: '' },
      // announce() reports dimensions and route, so the harness must satisfy
      // DimensionReporter.getDimensions() and defaultRouteGetter(). Without
      // these the announce throws before postMessage, retries, and stalls on
      // a faked timer — which looks exactly like "nothing was delivered".
      getComputedStyle: () => ({
        marginTop: '0px',
        marginBottom: '0px',
        paddingTop: '0px',
        paddingBottom: '0px',
        borderTopWidth: '0px',
        borderBottomWidth: '0px'
      }),
      addEventListener: (type, fn) => type === 'message' && listeners.add(fn),
      removeEventListener: (type, fn) => listeners.delete(fn)
    }
  })

  afterEach(() => {
    messenger?.destroy()
    messenger = null
    vi.useRealTimers()
  })

  /** Deliver a message to the child as the browser would. */
  function deliverToChild({ origin, source = parent, data }) {
    for (const fn of listeners) fn({ origin, source, data })
  }

  /** Reply to whichever announce actually landed, as a real parent would. */
  function replyToAnnounce({ origin = REAL_PARENT, source = parent } = {}) {
    const landed = parent.delivered.find(
      (d) => d.message.action === ACTIONS.ANNOUNCE
    )
    expect(landed, 'no announce was delivered to the parent').toBeTruthy()
    deliverToChild({
      origin,
      source,
      data: {
        id: landed.message.id,
        action: `${ACTIONS.ANNOUNCE}Response`,
        params: { initialRoute: null },
        sender: 'FrameBridge'
      }
    })
  }

  function newMessenger(options = {}) {
    return new ChildMessenger({
      autoAnnounce: false,
      logLevel: 'silent',
      ...options
    })
  }

  describe('bootstrap — before the parent has spoken', () => {
    it('addresses EVERY permitted origin, not just the first', async () => {
      // The regression: with the real parent second in the list, addressing
      // allowedOrigins[0] alone means nothing is ever delivered.
      messenger = newMessenger({
        allowedOrigins: [ALSO_PERMITTED, REAL_PARENT]
      })

      messenger.sendToParent('probe', {}).catch(() => {})
      await Promise.resolve()

      expect(parent.addressed.map((a) => a.targetOrigin)).toEqual(
        expect.arrayContaining([ALSO_PERMITTED, REAL_PARENT])
      )
      expect(parent.delivered).toHaveLength(1)
      expect(parent.delivered[0].targetOrigin).toBe(REAL_PARENT)
    })

    it('succeeds regardless of where the real parent sits in the list', async () => {
      for (const allowedOrigins of [
        [REAL_PARENT, ALSO_PERMITTED],
        [ALSO_PERMITTED, REAL_PARENT]
      ]) {
        parent = makeParent(REAL_PARENT)
        global.window.parent = parent
        listeners.clear()

        const m = newMessenger({ allowedOrigins })
        const announced = m.announce()
        await Promise.resolve()
        replyToAnnounce()
        await expect(announced).resolves.toBeUndefined()
        m.destroy()
      }
    })

    it('never addresses an origin the deployment did not permit', async () => {
      messenger = newMessenger({
        allowedOrigins: [ALSO_PERMITTED, REAL_PARENT]
      })

      messenger.sendToParent('probe', {}).catch(() => {})
      await Promise.resolve()

      for (const { targetOrigin } of parent.addressed) {
        expect([ALSO_PERMITTED, REAL_PARENT]).toContain(targetOrigin)
      }
    })

    it('sends once, not N times, when only one origin is permitted', async () => {
      messenger = newMessenger({ allowedOrigins: [REAL_PARENT] })

      messenger.sendToParent('probe', {}).catch(() => {})
      await Promise.resolve()

      expect(parent.addressed).toHaveLength(1)
    })
  })

  describe('wildcard patterns cannot be addressed', () => {
    it('skips pattern entries instead of posting into the void', async () => {
      messenger = newMessenger({
        allowedOrigins: ['https://*.example.com', REAL_PARENT]
      })

      messenger.sendToParent('probe', {}).catch(() => {})
      await Promise.resolve()

      const targets = parent.addressed.map((a) => a.targetOrigin)
      expect(targets).toContain(REAL_PARENT)
      expect(targets).not.toContain('https://*.example.com')
    })

    it('fails LOUDLY when every permitted entry is a pattern', async () => {
      // No ordering can rescue this: a pattern is never a legal target, so a
      // deployment using the documented wildcard syntax would otherwise get a
      // permanent silent failure.
      messenger = newMessenger({ allowedOrigins: ['https://*.example.com'] })

      await expect(messenger.sendToParent('probe', {})).rejects.toThrow(
        ERRORS.NO_ADDRESSABLE_ORIGIN
      )
      expect(parent.addressed).toHaveLength(0)
    })
  })

  describe('steady state — after the parent has spoken', () => {
    it('latches the origin it heard from and addresses only that', async () => {
      messenger = newMessenger({
        allowedOrigins: [ALSO_PERMITTED, REAL_PARENT]
      })

      const announced = messenger.announce()
      await Promise.resolve()
      replyToAnnounce()
      await announced

      expect(messenger.parentOrigin).toBe(REAL_PARENT)

      parent.addressed.length = 0
      messenger.sendToParent('probe', {}).catch(() => {})
      await Promise.resolve()

      // One send, exactly addressed — no broadcast after the handshake.
      expect(parent.addressed).toHaveLength(1)
      expect(parent.addressed[0].targetOrigin).toBe(REAL_PARENT)
    })

    it('applies to every child->parent message, not just announce', async () => {
      // sendToParent is the SOLE child->parent path, so the old guess was
      // re-made on updateDimensions/updateRoute/updateJSONLD too.
      messenger = newMessenger({
        allowedOrigins: [ALSO_PERMITTED, REAL_PARENT]
      })
      const announced = messenger.announce()
      await Promise.resolve()
      replyToAnnounce()
      await announced

      parent.addressed.length = 0
      messenger.updateRoute('/somewhere')
      messenger.updateDimensions()
      messenger.updateJSONLD({ '@type': 'WebPage' })
      await Promise.resolve()

      expect(parent.addressed).toHaveLength(3)
      for (const { targetOrigin } of parent.addressed) {
        expect(targetOrigin).toBe(REAL_PARENT)
      }
    })

    it('⛔ does NOT latch a permitted origin that is not window.parent', async () => {
      // A sibling iframe or opener on a permitted origin passes the validator.
      // Without the source check it could capture our outbound addressing.
      messenger = newMessenger({
        allowedOrigins: [ALSO_PERMITTED, REAL_PARENT]
      })

      deliverToChild({
        origin: ALSO_PERMITTED,
        source: { postMessage: vi.fn() }, // NOT window.parent
        data: { id: 'x', action: ACTIONS.PING, params: {}, sender: 'FrameBridge' }
      })

      expect(messenger.parentOrigin).toBeNull()
    })

    it('does not latch a null origin, which cannot be addressed', async () => {
      messenger = newMessenger({ allowedOrigins: ['*'] })

      deliverToChild({
        origin: 'null',
        data: { id: 'x', action: ACTIONS.PING, params: {}, sender: 'FrameBridge' }
      })

      expect(messenger.parentOrigin).toBeNull()
    })
  })

  describe('wildcard mode keeps its short-circuit', () => {
    it("addresses '*' once when allowedOrigins includes it", async () => {
      messenger = newMessenger({ allowedOrigins: ['*'] })

      messenger.sendToParent('probe', {}).catch(() => {})
      await Promise.resolve()

      expect(parent.addressed).toHaveLength(1)
      expect(parent.addressed[0].targetOrigin).toBe('*')
    })
  })

  describe('diagnostics point at the addressing, not at the parent', () => {
    it('names the origins addressed when nothing answers', async () => {
      // The failure this whole change is about: the message is never
      // delivered, and a bare timeout accuses the parent of not replying.
      const unreachable = makeParent('http://not-permitted.example')
      global.window.parent = unreachable
      messenger = newMessenger({
        allowedOrigins: [ALSO_PERMITTED, REAL_PARENT]
      })

      const sent = messenger.sendToParent('probe', {})
      const assertion = expect(sent).rejects.toThrow(
        new RegExp(
          `${ERRORS.NO_PARENT_RESPONSE}[\\s\\S]*${ALSO_PERMITTED}[\\s\\S]*${REAL_PARENT}`
        )
      )
      await vi.advanceTimersByTimeAsync(6000)
      await assertion
    })

    it('names the origin addressed on a single-target timeout', async () => {
      const unreachable = makeParent('http://not-permitted.example')
      global.window.parent = unreachable
      messenger = newMessenger({ allowedOrigins: [REAL_PARENT] })

      const sent = messenger.sendToParent('probe', {})
      const assertion = expect(sent).rejects.toThrow(
        `${ERRORS.MESSAGE_TIMEOUT}: probe (addressed ${REAL_PARENT})`
      )
      await vi.advanceTimersByTimeAsync(6000)
      await assertion
    })
  })
})
