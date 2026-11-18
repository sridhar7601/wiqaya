/**
 * Rate limits and daily caps. They protect two things: the paid AI budget, and the store from being filled.
 * Counters live in the shared store, so they hold across serverless instances. Network addresses are never
 * stored: only a salted hash, which expires with its counting window.
 */
import { createHash } from 'node:crypto'
import { clientIp, method, resp } from './http.mjs'
import { run, storeReady } from './store.mjs'

/** perIp: [max requests, window in seconds]. daily: total across everyone, per UTC day. */
export const LIMITS = {
  explain: { perIp: [20, 600], daily: 600 },
  report: { perIp: [8, 600], daily: 200 },
  navigate: { perIp: [30, 600], daily: 1500 },
  create: { perIp: [12, 3600], daily: 2000 },
  open: { perIp: [120, 600], daily: 20000 },
  feedback: { perIp: [20, 3600], daily: 2000 },
}

const salt = () => process.env.RL_SALT || process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || 'wiqaya-local'
export const who = (ip) => createHash('sha256').update(`${salt()}|${ip}`).digest('hex').slice(0, 20)

const local = new Map() // per-instance fallback when there is no store

function allowLocal(bucket, ip, max, windowSec) {
  const now = Date.now()
  const key = `${bucket}:${ip}`
  const list = (local.get(key) || []).filter((t) => now - t < windowSec * 1000)
  list.push(now)
  local.set(key, list)
  if (local.size > 5000) local.clear()
  return list.length <= max
}

/** Returns { ok: true } or { ok: false, why: 'rate' | 'cap' }. */
export async function allow(bucket, ip) {
  const {
    perIp: [max, windowSec],
    daily,
  } = LIMITS[bucket]
  if (!storeReady()) return allowLocal(bucket, ip, max, windowSec) ? { ok: true } : { ok: false, why: 'rate' }

  const now = Date.now()
  const kIp = `rl:${bucket}:${who(ip)}:${Math.floor(now / 1000 / windowSec)}`
  const kDay = `cap:${bucket}:${new Date(now).toISOString().slice(0, 10)}`
  try {
    // SET … NX starts the window with its expiry; INCR then counts inside it.
    const [, nIp, , nDay] = await run([
      ['SET', kIp, '0', 'EX', windowSec * 2, 'NX'],
      ['INCR', kIp],
      ['SET', kDay, '0', 'EX', 172_800, 'NX'],
      ['INCR', kDay],
    ])
    if (Number(nIp) > max) return { ok: false, why: 'rate' }
    if (Number(nDay) > daily) return { ok: false, why: 'cap' }
    return { ok: true }
  } catch {
    // The store is unreachable: keep serving, with the per-instance limit as a floor.
    return allowLocal(bucket, ip, max, windowSec) ? { ok: true } : { ok: false, why: 'rate' }
  }
}

export const limited = (a) => resp(429, { error: a.why === 'cap' ? 'daily_cap' : 'rate_limited' })

/** Puts a limit in front of an existing handler without touching it (used for the AI explainer). */
export const guarded = (bucket, handler) => async (event) => {
  if (method(event) === 'POST') {
    const a = await allow(bucket, clientIp(event))
    if (!a.ok) return limited(a)
  }
  return handler(event)
}

/** Tests only. */
export const _local = { clear: () => local.clear() }
