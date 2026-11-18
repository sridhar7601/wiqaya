import { createHash, randomBytes } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { handler as feedback } from './feedback.mjs'
import { _local, allow, LIMITS, who } from './limits.mjs'
import { handler as share } from './share.mjs'
import { _memory, run, storeReady } from './store.mjs'

const sha = (s) => createHash('sha256').update(s).digest('hex')
const token = () => randomBytes(16).toString('base64url')
const event = (method, body, ip = '10.0.0.1') => ({ requestContext: { http: { method, sourceIp: ip } }, headers: {}, body: body === undefined ? '' : JSON.stringify(body) })
const call = async (handler, method, body, ip) => {
  const r = await handler(event(method, body, ip))
  return { status: r.statusCode, body: r.body ? JSON.parse(r.body) : null, headers: r.headers }
}

/** What a phone would send: ciphertext, a nonce, and the hashes of the two tokens. */
function box() {
  const readToken = token()
  const ownerToken = token()
  const ct = randomBytes(600).toString('base64url')
  const iv = randomBytes(12).toString('base64url')
  return { readToken, ownerToken, ct, iv, create: { action: 'create', ct, iv, readHash: sha(readToken), ownerHash: sha(ownerToken), ttl: 'day' } }
}

const env = { ...process.env }
beforeEach(() => {
  process.env.STORE = 'memory'
  delete process.env.KV_REST_API_URL
  delete process.env.UPSTASH_REDIS_REST_URL
  _memory.clear()
  _local.clear()
})
afterEach(() => {
  process.env = { ...env }
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('store (in-memory stand-in)', () => {
  it('is off unless asked for, so a missing database never looks like a working one', async () => {
    delete process.env.STORE
    expect(storeReady()).toBe(false)
    await expect(run([['GET', 'x']])).rejects.toThrow('store_not_configured')
  })

  it('expires keys, keeps a time-to-live on update, and refuses to recreate a deleted key', async () => {
    vi.useFakeTimers()
    await run([['SET', 'k', 'a', 'EX', 100]])
    vi.advanceTimersByTime(40_000)
    expect(await run([['SET', 'k', 'b', 'XX', 'KEEPTTL'], ['TTL', 'k'], ['GET', 'k']])).toEqual(['OK', 60, 'b'])
    vi.advanceTimersByTime(61_000)
    expect(await run([['GET', 'k'], ['SET', 'k', 'c', 'XX', 'KEEPTTL'], ['GET', 'k']])).toEqual([null, null, null])
  })

  it('counts and keeps capped lists', async () => {
    expect(await run([['INCR', 'n'], ['INCR', 'n'], ['MGET', 'n', 'missing']])).toEqual([1, 2, ['2', null]])
    await run([['LPUSH', 'l', '1'], ['LPUSH', 'l', '2'], ['LPUSH', 'l', '3'], ['LTRIM', 'l', 0, 1]])
    expect(await run([['LRANGE', 'l', 0, -1]])).toEqual([['3', '2']])
  })
})

describe('doctor hand-off', () => {
  it('answers 503 when no store is configured', async () => {
    delete process.env.STORE
    expect((await call(share, 'POST', box().create)).status).toBe(503)
  })

  it('stores the box, lets the right link open it, and counts openings but not re-reads', async () => {
    const b = box()
    const made = await call(share, 'POST', b.create)
    expect(made.status).toBe(201)
    expect(made.body.id).toMatch(/^[A-Za-z0-9_-]{16}$/)

    const opened = await call(share, 'POST', { action: 'open', id: made.body.id, readToken: b.readToken })
    expect(opened.status).toBe(200)
    expect(opened.body.ct).toBe(b.ct)
    await call(share, 'POST', { action: 'open', id: made.body.id, readToken: b.readToken, peek: true })

    const status = await call(share, 'POST', { action: 'status', id: made.body.id, ownerToken: b.ownerToken })
    expect(status.body.opens).toBe(1)
    expect(status.body.openedAt).toBeTypeOf('number')
  })

  it('keeps only ciphertext and token hashes: neither token is stored', async () => {
    const b = box()
    const made = await call(share, 'POST', b.create)
    const stored = _memory.raw(`share:${made.body.id}`)
    expect(stored).toContain(b.ct)
    expect(stored).not.toContain(b.readToken)
    expect(stored).not.toContain(b.ownerToken)
  })

  it('refuses a wrong link, a wrong owner and an unknown id', async () => {
    const b = box()
    const { body } = await call(share, 'POST', b.create)
    expect((await call(share, 'POST', { action: 'open', id: body.id, readToken: token() })).status).toBe(403)
    expect((await call(share, 'POST', { action: 'status', id: body.id, ownerToken: token() })).status).toBe(403)
    expect((await call(share, 'POST', { action: 'withdraw', id: body.id, ownerToken: b.readToken })).status).toBe(403)
    const unknown = await call(share, 'POST', { action: 'open', id: 'A'.repeat(16), readToken: b.readToken })
    expect(unknown.status).toBe(404)
    expect(unknown.body.why).toBe('unknown')
  })

  it("carries the doctor's encrypted reply back to the phone", async () => {
    const b = box()
    const { body } = await call(share, 'POST', b.create)
    const reply = { ct: randomBytes(80).toString('base64url'), iv: randomBytes(12).toString('base64url') }
    expect((await call(share, 'POST', { action: 'reply', id: body.id, readToken: token(), ...reply })).status).toBe(403)
    expect((await call(share, 'POST', { action: 'reply', id: body.id, readToken: b.readToken, ...reply })).status).toBe(200)
    const status = await call(share, 'POST', { action: 'status', id: body.id, ownerToken: b.ownerToken })
    expect(status.body.reply.ct).toBe(reply.ct)
  })

  it('withdraw deletes the box at once and it cannot come back', async () => {
    const b = box()
    const { body } = await call(share, 'POST', b.create)
    expect((await call(share, 'POST', { action: 'withdraw', id: body.id, ownerToken: b.ownerToken })).status).toBe(200)
    expect(_memory.raw(`share:${body.id}`)).toBeNull()

    const opened = await call(share, 'POST', { action: 'open', id: body.id, readToken: b.readToken })
    expect(opened.status).toBe(404)
    expect(opened.body.why).toBe('withdrawn')

    const late = await call(share, 'POST', { action: 'reply', id: body.id, readToken: b.readToken, ct: randomBytes(80).toString('base64url'), iv: randomBytes(12).toString('base64url') })
    expect(late.status).toBe(404)
    expect(_memory.raw(`share:${body.id}`)).toBeNull()
    expect((await call(share, 'POST', { action: 'withdraw', id: body.id, ownerToken: b.ownerToken })).body.already).toBe(true)
  })

  it('expires by itself', async () => {
    vi.useFakeTimers()
    const b = box()
    const { body } = await call(share, 'POST', b.create)
    vi.advanceTimersByTime(86_400_000 + 1000)
    const opened = await call(share, 'POST', { action: 'open', id: body.id, readToken: b.readToken })
    expect(opened.status).toBe(404)
    expect(_memory.raw(`share:${body.id}`)).toBeNull()
  })

  it('rejects malformed and oversized requests', async () => {
    const b = box()
    expect((await call(share, 'POST', { ...b.create, ttl: 'forever' })).status).toBe(400)
    expect((await call(share, 'POST', { ...b.create, readHash: 'nope' })).status).toBe(400)
    expect((await call(share, 'POST', { ...b.create, ct: 'not base64!' })).status).toBe(400)
    expect((await call(share, 'POST', { ...b.create, ct: 'A'.repeat(130_000) })).status).toBe(413)
    expect((await call(share, 'POST', { action: 'delete-everything' })).status).toBe(400)
    expect((await call(share, 'GET')).status).toBe(405)
  })

  it('limits how many boxes one network address can create', async () => {
    const [max] = LIMITS.create.perIp
    for (let i = 0; i < max; i++) expect((await call(share, 'POST', box().create, '10.9.9.9')).status).toBe(201)
    expect((await call(share, 'POST', box().create, '10.9.9.9')).status).toBe(429)
    expect((await call(share, 'POST', box().create, '10.9.9.10')).status).toBe(201)
  })
})

describe('rate limits', () => {
  it('never stores a network address, only a salted hash', async () => {
    await allow('explain', '203.0.113.77')
    const keys = _memory.keys()
    expect(keys.length).toBe(2)
    expect(keys.join(' ')).not.toContain('203.0.113.77')
    expect(keys.some((k) => k.includes(who('203.0.113.77')))).toBe(true)
    expect(who('203.0.113.77')).toMatch(/^[0-9a-f]{20}$/)
    expect(who('203.0.113.77')).not.toBe(who('203.0.113.78'))
  })

  it('applies the per-address limit, then the daily cap across all addresses', async () => {
    const before = LIMITS.report
    LIMITS.report = { perIp: [2, 600], daily: 5 }
    try {
      expect((await allow('report', '10.1.1.1')).ok).toBe(true)
      expect((await allow('report', '10.1.1.1')).ok).toBe(true)
      expect(await allow('report', '10.1.1.1')).toEqual({ ok: false, why: 'rate' })
      expect((await allow('report', '10.1.1.2')).ok).toBe(true)
      expect((await allow('report', '10.1.1.3')).ok).toBe(true)
      expect(await allow('report', '10.1.1.4')).toEqual({ ok: false, why: 'cap' })
    } finally {
      LIMITS.report = before
    }
  })
})

describe('anonymous feedback', () => {
  it('counts ratings and reports totals', async () => {
    expect((await call(feedback, 'POST', { trust: 5, clarity: 4, durationSec: 200, lang: 'en' })).status).toBe(200)
    expect((await call(feedback, 'POST', { trust: 4, clarity: 4, durationSec: 260, lang: 'ar' }, '10.0.0.2')).status).toBe(200)
    expect((await call(feedback, 'POST', { trust: 3, clarity: 5, lang: 'ar' }, '10.0.0.3')).status).toBe(200)
    const t = (await call(feedback, 'GET')).body
    expect(t.n).toBe(3)
    expect(t.trust).toEqual([0, 0, 1, 1, 1])
    expect(t.avgTrust).toBe(4)
    expect(t.avgClarity).toBe(4.3)
    expect(t.lang).toEqual({ en: 1, ar: 2 })
    expect(t.timed).toBe(2)
    expect(t.medianSec).toBe(260)
    expect(t.since).toBeTypeOf('number')
  })

  it('accepts nothing but the two ratings, the time and the language', async () => {
    expect((await call(feedback, 'POST', { trust: 6, clarity: 4, lang: 'en' })).status).toBe(400)
    expect((await call(feedback, 'POST', { trust: 4, clarity: 4, lang: 'fr' })).status).toBe(400)
    expect((await call(feedback, 'POST', { trust: 4, clarity: 4, lang: 'en', note: 'x'.repeat(500) })).status).toBe(413)
    await call(feedback, 'POST', { trust: 4, clarity: 4, lang: 'en', answers: { age: 30 }, name: 'A' })
    const everything = JSON.stringify(await run([['MGET', 'fb:n', 'fb:t:4', 'fb:c:4', 'fb:l:en']]))
    expect(everything).not.toContain('age')
    expect(_memory.size()).toBeLessThan(12)
  })
})
