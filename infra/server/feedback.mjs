/**
 * Anonymous feedback after a result: two ratings (1-5), how long the check took, and the language.
 * Nothing else is accepted, so no answers, results or identities can arrive here.
 *
 *   POST { trust, clarity, durationSec?, lang }  -> adds one response to the counters
 *   GET                                           -> the totals, shown on the Evidence page
 */
import { clientIp, method, readJson, resp } from './http.mjs'
import { allow, limited } from './limits.mjs'
import { run, storeReady } from './store.mjs'

const SCORES = [1, 2, 3, 4, 5]
const KEYS = ['fb:n', ...SCORES.map((s) => `fb:t:${s}`), ...SCORES.map((s) => `fb:c:${s}`), 'fb:l:en', 'fb:l:ar', 'fb:since']
const isScore = (v) => Number.isInteger(v) && v >= 1 && v <= 5

const average = (dist) => {
  const n = dist.reduce((a, b) => a + b, 0)
  return n ? Math.round((dist.reduce((a, c, i) => a + c * (i + 1), 0) / n) * 10) / 10 : null
}

async function totals() {
  const [values, durations] = await run([
    ['MGET', ...KEYS],
    ['LRANGE', 'fb:dur', 0, -1],
  ])
  const num = (i) => Number(values[i] ?? 0) || 0
  const trust = SCORES.map((_, i) => num(1 + i))
  const clarity = SCORES.map((_, i) => num(6 + i))
  const secs = (durations ?? [])
    .map(Number)
    .filter((x) => Number.isFinite(x))
    .sort((a, b) => a - b)
  return {
    n: num(0),
    trust,
    clarity,
    avgTrust: average(trust),
    avgClarity: average(clarity),
    lang: { en: num(11), ar: num(12) },
    timed: secs.length,
    medianSec: secs.length ? secs[Math.floor(secs.length / 2)] : null,
    since: values[13] ? Number(values[13]) : null,
  }
}

export async function handler(event) {
  const m = method(event)
  if (m === 'OPTIONS') return resp(204, '')
  if (!storeReady()) return resp(503, { error: 'feedback_not_configured' })

  try {
    // Totals change slowly: let the browser and the CDN hold them for a minute.
    if (m === 'GET') return resp(200, await totals(), { 'cache-control': 'public, max-age=30, s-maxage=60' })
    if (m !== 'POST') return resp(405, { error: 'method_not_allowed' })

    const parsed = readJson(event, 400)
    if (!parsed.ok) return parsed.res
    const { trust, clarity, durationSec, lang } = parsed.body
    if (!isScore(trust) || !isScore(clarity) || (lang !== 'en' && lang !== 'ar')) return resp(400, { error: 'bad_request' })
    const timed = Number.isInteger(durationSec) && durationSec >= 20 && durationSec <= 3600

    const a = await allow('feedback', clientIp(event))
    if (!a.ok) return limited(a)

    const commands = [
      ['SET', 'fb:since', String(Date.now()), 'NX'],
      ['INCR', 'fb:n'],
      ['INCR', `fb:t:${trust}`],
      ['INCR', `fb:c:${clarity}`],
      ['INCR', `fb:l:${lang}`],
    ]
    if (timed) commands.push(['LPUSH', 'fb:dur', String(durationSec)], ['LTRIM', 'fb:dur', 0, 999])
    await run(commands)
    return resp(200, { ok: true })
  } catch {
    console.log(JSON.stringify({ evt: 'feedback_error' }))
    return resp(502, { error: 'store_unavailable' })
  }
}
