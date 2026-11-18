/**
 * Small key-value store behind the doctor hand-off, the anonymous feedback counters and the rate limits.
 *
 * Production: Upstash Redis over its REST API. The Vercel integration sets KV_REST_API_URL and
 * KV_REST_API_TOKEN (UPSTASH_REDIS_REST_URL / _TOKEN also work).
 * Local dev and tests: an in-memory stand-in, used ONLY when STORE=memory, so a missing database
 * can never look like a working one.
 *
 * Callers send Redis commands as arrays, e.g. run([['SET', 'k', 'v', 'EX', 60], ['GET', 'k']]).
 */

const url = () => (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '').replace(/\/+$/, '')
const token = () => process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || ''

export const storeRemote = () => !!(url() && token())
const memoryOn = () => process.env.STORE === 'memory'
/** False means: answer "not configured" instead of pretending. */
export const storeReady = () => storeRemote() || memoryOn()

export async function run(commands) {
  if (storeRemote()) return remote(commands)
  if (memoryOn()) return commands.map(exec)
  throw new Error('store_not_configured')
}

async function remote(commands) {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), 6000)
  try {
    const res = await fetch(`${url()}/pipeline`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token()}`, 'content-type': 'application/json' },
      body: JSON.stringify(commands),
      signal: ctl.signal,
    })
    if (!res.ok) throw new Error(`store_http_${res.status}`)
    const out = await res.json()
    if (!Array.isArray(out) || out.length !== commands.length) throw new Error('store_bad_reply')
    return out.map((r) => {
      if (r && r.error) throw new Error('store_command_failed')
      return r?.result ?? null
    })
  } finally {
    clearTimeout(timer)
  }
}

// ---------- in-memory stand-in: only the commands this project uses ----------

const mem = new Map() // key -> { v: string | string[], exp: number | null }

function live(key) {
  const e = mem.get(key)
  if (!e) return null
  if (e.exp !== null && e.exp <= Date.now()) {
    mem.delete(key)
    return null
  }
  return e
}

function slice(list, start, stop) {
  const n = list.length
  const s = start < 0 ? Math.max(0, n + start) : start
  const e = stop < 0 ? n + stop : Math.min(stop, n - 1)
  return s > e ? [] : list.slice(s, e + 1)
}

function exec([cmd, ...a]) {
  switch (String(cmd).toUpperCase()) {
    case 'GET':
      return live(a[0])?.v ?? null
    case 'MGET':
      return a.map((k) => live(k)?.v ?? null)
    case 'EXISTS':
      return a.filter((k) => live(k)).length
    case 'SET': {
      const [key, value, ...opts] = a
      const o = opts.map((x) => String(x).toUpperCase())
      const cur = live(key)
      if (o.includes('NX') && cur) return null
      if (o.includes('XX') && !cur) return null
      const i = o.indexOf('EX')
      const exp = i >= 0 ? Date.now() + Number(opts[i + 1]) * 1000 : o.includes('KEEPTTL') && cur ? cur.exp : null
      mem.set(key, { v: String(value), exp })
      return 'OK'
    }
    case 'DEL': {
      let n = 0
      for (const k of a) if (live(k) && mem.delete(k)) n++
      return n
    }
    case 'INCR': {
      const e = live(a[0])
      const n = (e ? Number(e.v) : 0) + 1
      mem.set(a[0], { v: String(n), exp: e ? e.exp : null })
      return n
    }
    case 'TTL': {
      const e = live(a[0])
      if (!e) return -2
      return e.exp === null ? -1 : Math.ceil((e.exp - Date.now()) / 1000)
    }
    case 'LPUSH': {
      const e = live(a[0]) ?? { v: [], exp: null }
      for (const x of a.slice(1)) e.v.unshift(String(x))
      mem.set(a[0], e)
      return e.v.length
    }
    case 'LTRIM': {
      const e = live(a[0])
      if (e) e.v = slice(e.v, Number(a[1]), Number(a[2]))
      return 'OK'
    }
    case 'LRANGE': {
      const e = live(a[0])
      return e ? slice(e.v, Number(a[1]), Number(a[2])) : []
    }
    default:
      throw new Error(`memory store: unsupported command ${cmd}`)
  }
}

/** Tests only. */
export const _memory = { clear: () => mem.clear(), size: () => mem.size, keys: () => [...mem.keys()], raw: (k) => live(k)?.v ?? null }
