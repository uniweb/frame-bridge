import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { BaseMessenger } from '../src/shared/BaseMessenger.js'
import { ACTIONS, ERRORS } from '../src/shared/constants.js'

/**
 * Replies.
 *
 * A reply is named after its request (`sendResponse` appends `Response`) and
 * settles the promise waiting on its id. Until 2026-10-05 a reply that matched
 * no waiting promise was handled as a REQUEST: answered with "no handler",
 * which is itself a reply nothing waits for on the other side, answered in
 * turn, without end. Measured with two windows: a reply that arrived after its
 * timeout kept them exchanging messages indefinitely, and a second messenger
 * listening in one window made the exchange grow exponentially.
 */

const A = 'http://parent.test'
const B = 'http://child.test'

// Past this many deliveries the world stops delivering, so a regression fails
// on a count instead of looping.
const DELIVERY_CAP = 50

/**
 * Windows that post to each other as a browser does: asynchronously, only to
 * an exact origin (or '*'), with `source` and `origin` stamped by the sender.
 */
function makeWorld() {
  const windows = {}
  const delivered = []

  /** Window `to`, as window `from` holds it. */
  function handle(from, to) {
    return {
      postMessage(data, targetOrigin) {
        if (targetOrigin !== '*' && targetOrigin !== windows[to].origin) return
        const message = JSON.parse(JSON.stringify(data))
        setTimeout(() => {
          if (delivered.length >= DELIVERY_CAP) return
          delivered.push(message)
          for (const listener of [...windows[to].listeners]) {
            listener({
              origin: windows[from].origin,
              source: handle(to, from),
              data: message
            })
          }
        }, 0)
      }
    }
  }

  return {
    delivered,
    handle,
    open(name, origin) {
      windows[name] = { origin, listeners: new Set() }
    },
    /** A messenger listening in window `name`. */
    messengerIn(name, options = {}) {
      global.window = {
        location: { origin: windows[name].origin },
        addEventListener: (type, fn) =>
          type === 'message' && windows[name].listeners.add(fn),
        removeEventListener: (type, fn) => windows[name].listeners.delete(fn)
      }
      return new BaseMessenger({ logLevel: 'silent', ...options })
    }
  }
}

describe('replies', () => {
  let world
  let messengers

  beforeEach(() => {
    vi.useFakeTimers()
    world = makeWorld()
    world.open('A', A)
    world.open('B', B)
    messengers = []
  })

  afterEach(() => {
    messengers.forEach((m) => m.destroy())
    vi.useRealTimers()
  })

  function keep(messenger) {
    messengers.push(messenger)
    return messenger
  }
  const inA = (options) =>
    keep(world.messengerIn('A', { allowedOrigins: [B], ...options }))
  const inB = (options) =>
    keep(world.messengerIn('B', { allowedOrigins: [A], ...options }))
  const actions = () => world.delivered.map((m) => m.action)

  it('drops a reply that arrives after its timeout instead of answering it', async () => {
    const a = inA({ timeout: 50 })
    inB({
      actionHandlers: {
        slow: () =>
          new Promise((resolve) => setTimeout(() => resolve({ ok: true }), 100))
      }
    })

    const sent = a.sendMessage(world.handle('A', 'B'), 'slow', {}, B)
    const timedOut = expect(sent).rejects.toThrow(ERRORS.MESSAGE_TIMEOUT)
    await vi.advanceTimersByTimeAsync(1000)
    await timedOut

    // The request and its late reply. Nothing answers the reply.
    expect(actions()).toEqual(['slow', 'slowResponse'])
  })

  it('a second messenger in the window does not answer a reply meant for the first', async () => {
    inA()
    const b1 = inB()
    inB() // e.g. an instance that was never destroyed

    const sent = b1.sendMessage(world.handle('B', 'A'), ACTIONS.PING, {}, A)
    await vi.advanceTimersByTimeAsync(1000)

    await expect(sent).resolves.toMatchObject({ type: ACTIONS.PONG })
    expect(actions()).toEqual([ACTIONS.PING, `${ACTIONS.PING}Response`])
  })

  it('still answers a request it has no handler for', async () => {
    const a = inA()
    inB()

    const sent = a.sendMessage(world.handle('A', 'B'), 'unknownAction', {}, B)
    await vi.advanceTimersByTimeAsync(1000)

    await expect(sent).resolves.toEqual({ error: ERRORS.INVALID_ACTION })
  })

  it('still handles an action registered under a name ending in Response', async () => {
    // A request its app chose to name that way, not a reply.
    const a = inA()
    inB({ actionHandlers: { formResponse: () => ({ saved: true }) } })

    const sent = a.sendMessage(world.handle('A', 'B'), 'formResponse', {}, B)
    await vi.advanceTimersByTimeAsync(1000)

    await expect(sent).resolves.toEqual({ saved: true })
  })
})
