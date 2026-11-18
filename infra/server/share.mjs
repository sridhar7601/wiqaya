/**
 * Doctor hand-off: a locked box the server cannot open.
 *
 * The person's phone encrypts the summary and sends only the ciphertext here. The key travels in the
 * link (after the #), which browsers never send to a server. This function therefore stores and returns
 * bytes it cannot read. It also keeps the consent lifecycle honest:
 *   - the record deletes itself when it expires (one day or one week, chosen by the person);
 *   - "withdraw" deletes it at once, and only the phone that created it can do that;
 *   - the person can see whether the link was opened, and reads the doctor's (encrypted) reply.
 *
 * One POST endpoint, { action: 'create' | 'open' | 'status' | 'reply' | 'withdraw' }, so no token ever sits in a URL.
 * Request bodies are never logged.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { clientIp, method, readJson, resp } from './http.mjs'
import { allow, limited } from './limits.mjs'
import { run, storeReady } from './store.mjs'

const TTL = { day: 86_400, week: 604_800 }
const MAX_CT = 120_000 // base64url characters: about 90 kB of summary
const MAX_REPLY = 8_000
const B64U = /^[A-Za-z0-9_-]+$/
const HEX64 = /^[0-9a-f]{64}$/
const ID = /^[A-Za-z0-9_-]{16}$/

const sha = (s) => createHash('sha256').update(String(s)).digest('hex')
const same = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))
const boxKey = (id) => `share:${id}`
const goneKey = (id) => `gone:${id}`

const isCipher = (v, max) => typeof v === 'string' && v.length >= 24 && v.length <= max && B64U.test(v)
const isIv = (v) => typeof v === 'string' && v.length === 16 && B64U.test(v)
const isToken = (v) => typeof v === 'string' && v.length >= 20 && v.length <= 64 && B64U.test(v)

async function load(id) {
  const [raw, gone] = await run([
    ['GET', boxKey(id)],
    ['GET', goneKey(id)],
  ])
  return { rec: raw ? JSON.parse(raw) : null, gone }
}

/** Writes back only if the record still exists, and keeps its expiry: a withdrawn box can never come back. */
async function update(id, rec) {
  const [r] = await run([['SET', boxKey(id), JSON.stringify(rec), 'XX', 'KEEPTTL']])
  return r === 'OK'
}

const gone = (why) => resp(404, { error: 'gone', why: why === 'withdrawn' ? 'withdrawn' : 'unknown' })

const ACTIONS = {
  async create(b, ip) {
    const a = await allow('create', ip)
    if (!a.ok) return limited(a)
    if (!isCipher(b.ct, MAX_CT) || !isIv(b.iv) || !HEX64.test(b.readHash ?? '') || !HEX64.test(b.ownerHash ?? '') || !Object.hasOwn(TTL, b.ttl ?? '')) {
      return resp(400, { error: 'bad_request' })
    }
    const ttl = TTL[b.ttl]
    const now = Date.now()
    const id = randomBytes(12).toString('base64url')
    const rec = { v: 1, ct: b.ct, iv: b.iv, readHash: b.readHash, ownerHash: b.ownerHash, createdAt: now, expiresAt: now + ttl * 1000, opens: 0, openedAt: null, lastOpenedAt: null, reply: null }
    const [ok] = await run([['SET', boxKey(id), JSON.stringify(rec), 'EX', ttl, 'NX']])
    if (ok !== 'OK') return resp(500, { error: 'try_again' })
    console.log(JSON.stringify({ evt: 'share_created', ttl: b.ttl, size: b.ct.length }))
    return resp(201, { id, expiresAt: rec.expiresAt })
  },

  /** The doctor's device fetches the box. `peek` re-reads without counting as a new opening. */
  async open(b, ip) {
    const a = await allow('open', ip)
    if (!a.ok) return limited(a)
    if (!ID.test(b.id ?? '') || !isToken(b.readToken)) return resp(400, { error: 'bad_request' })
    const { rec, gone: why } = await load(b.id)
    if (!rec) return gone(why)
    if (!same(sha(b.readToken), rec.readHash)) return resp(403, { error: 'forbidden' })
    if (!b.peek) {
      const now = Date.now()
      rec.opens += 1
      rec.openedAt ??= now
      rec.lastOpenedAt = now
      if (!(await update(b.id, rec))) return gone('withdrawn')
    }
    return resp(200, { ct: rec.ct, iv: rec.iv, createdAt: rec.createdAt, expiresAt: rec.expiresAt, reply: rec.reply })
  },

  /** The person's phone asks: was it opened, is there a reply? */
  async status(b, ip) {
    const a = await allow('open', ip)
    if (!a.ok) return limited(a)
    if (!ID.test(b.id ?? '') || !isToken(b.ownerToken)) return resp(400, { error: 'bad_request' })
    const { rec, gone: why } = await load(b.id)
    if (!rec) return gone(why)
    if (!same(sha(b.ownerToken), rec.ownerHash)) return resp(403, { error: 'forbidden' })
    return resp(200, { opens: rec.opens, openedAt: rec.openedAt, lastOpenedAt: rec.lastOpenedAt, expiresAt: rec.expiresAt, reply: rec.reply })
  },

  /** The doctor's decision, encrypted with the same key, so only the person's phone can read it. */
  async reply(b, ip) {
    const a = await allow('open', ip)
    if (!a.ok) return limited(a)
    if (!ID.test(b.id ?? '') || !isToken(b.readToken) || !isCipher(b.ct, MAX_REPLY) || !isIv(b.iv)) return resp(400, { error: 'bad_request' })
    const { rec, gone: why } = await load(b.id)
    if (!rec) return gone(why)
    if (!same(sha(b.readToken), rec.readHash)) return resp(403, { error: 'forbidden' })
    rec.reply = { ct: b.ct, iv: b.iv, at: Date.now() }
    if (!(await update(b.id, rec))) return gone('withdrawn')
    return resp(200, { ok: true, at: rec.reply.at })
  },

  /** Deletes the box now. A small marker (no content) remains until the original expiry, so the link can say "withdrawn". */
  async withdraw(b, ip) {
    const a = await allow('open', ip)
    if (!a.ok) return limited(a)
    if (!ID.test(b.id ?? '') || !isToken(b.ownerToken)) return resp(400, { error: 'bad_request' })
    const { rec } = await load(b.id)
    if (!rec) return resp(200, { ok: true, already: true })
    if (!same(sha(b.ownerToken), rec.ownerHash)) return resp(403, { error: 'forbidden' })
    const left = Math.max(60, Math.ceil((rec.expiresAt - Date.now()) / 1000))
    await run([
      ['DEL', boxKey(b.id)],
      ['SET', goneKey(b.id), 'withdrawn', 'EX', left],
    ])
    console.log(JSON.stringify({ evt: 'share_withdrawn' }))
    return resp(200, { ok: true })
  },
}

export async function handler(event) {
  const m = method(event)
  if (m === 'OPTIONS') return resp(204, '')
  if (m !== 'POST') return resp(405, { error: 'method_not_allowed' })
  if (!storeReady()) return resp(503, { error: 'handoff_not_configured' })

  const parsed = readJson(event, MAX_CT + 2_000)
  if (!parsed.ok) return parsed.res
  const action = Object.hasOwn(ACTIONS, parsed.body.action ?? '') ? ACTIONS[parsed.body.action] : null
  if (!action) return resp(400, { error: 'bad_request' })
  try {
    return await action(parsed.body, clientIp(event))
  } catch {
    console.log(JSON.stringify({ evt: 'share_error', action: parsed.body.action }))
    return resp(502, { error: 'store_unavailable' })
  }
}
