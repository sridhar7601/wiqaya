/**
 * Shared request/response helpers. Every function uses the same event shape as the AI explainer
 * (an AWS Lambda style event), so one handler runs on Vercel, on Lambda and in the local dev server.
 */

export function resp(statusCode, body, extra = {}) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }
}

export function header(event, name) {
  const h = event.headers || {}
  return h[name] ?? h[name.toLowerCase()] ?? Object.entries(h).find(([k]) => k.toLowerCase() === name)?.[1]
}

export const method = (event) => event.requestContext?.http?.method || event.httpMethod || 'GET'

export const clientIp = (event) => header(event, 'x-forwarded-for')?.split(',')[0]?.trim() || event.requestContext?.http?.sourceIp || 'unknown'

/** Parses a JSON body with a size cap. Returns { ok: true, body } or { ok: false, res }. */
export function readJson(event, maxLength) {
  const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : event.body || ''
  if (raw.length > maxLength) return { ok: false, res: resp(413, { error: 'too_large' }) }
  try {
    const body = JSON.parse(raw || '{}')
    if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, res: resp(400, { error: 'bad_request' }) }
    return { ok: true, body }
  } catch {
    return { ok: false, res: resp(400, { error: 'bad_json' }) }
  }
}

async function bodyOf(req) {
  if (typeof req.body === 'string') return req.body
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return JSON.stringify(req.body)
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8')
  const chunks = []
  for await (const c of req) chunks.push(c)
  return Buffer.concat(chunks).toString('utf8')
}

/** Wraps a handler as a Vercel (or plain Node http) function. */
export const toVercel = (handler) => async (req, res) => {
  const out = await handler({
    requestContext: { http: { method: req.method, sourceIp: req.socket?.remoteAddress } },
    headers: req.headers,
    body: await bodyOf(req),
  })
  res.statusCode = out.statusCode
  for (const [k, v] of Object.entries(out.headers)) res.setHeader(k, v)
  res.end(out.body)
}
