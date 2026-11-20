import { createVerify, generateKeyPairSync } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { handler, modelName } from './index.mjs'

// A throwaway key made for this test run. It signs in nowhere.
const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
})
const TOKEN_URI = 'https://oauth2.googleapis.com/token'
const account = { type: 'service_account', project_id: 'demo-project', client_email: 'wiqaya-ai@demo-project.iam.gserviceaccount.com', private_key: privateKey, token_uri: TOKEN_URI }

const result = { level: 'primary', emergency: false, sex: 'female', step: 'See your family doctor', flags: [{ title: 'Irregular cycles', why: 'x', action: 'y' }] }
let caller = 0
const post = (body) => handler({ requestContext: { http: { method: 'POST', sourceIp: `10.1.0.${++caller}` } }, headers: {}, body: JSON.stringify(body) })
const json = (body, status = 200) => new Response(JSON.stringify(body), { status })

describe('Google Vertex AI as the AI service (no network)', () => {
  const env = { ...process.env }
  beforeEach(() => {
    for (const k of ['ORIGIN_SECRET', 'OPENAI_API_KEY', 'GOOGLE_APPLICATION_CREDENTIALS', 'GOOGLE_CLOUD_PROJECT', 'GOOGLE_CLOUD_LOCATION', 'VERTEX_MODEL', 'AI_REASONING_EFFORT', 'AZURE_OPENAI_REASONING_EFFORT']) delete process.env[k]
    // The way the key is given on Vercel: the file's contents in one environment variable.
    process.env.GCP_SERVICE_ACCOUNT_JSON = JSON.stringify(account)
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })
  afterEach(() => {
    process.env = { ...env }
    vi.restoreAllMocks()
  })

  it('answers with a clean error when Google refuses the key', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(json({ error: 'invalid_grant' }, 400))
    const r = await post({ lang: 'en', mode: 'explain', result })
    expect(r.statusCode).toBe(502)
    expect(JSON.parse(r.body)).toEqual({ error: 'upstream' })
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('signs in with the service-account key once, then calls Gemini with the access token', async () => {
    const calls = []
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      calls.push({ url: String(url), init })
      if (String(url) === TOKEN_URI) return json({ access_token: 'tok-1', expires_in: 3600 })
      return json({ choices: [{ finish_reason: 'stop', message: { content: 'It is worth seeing your family doctor.' } }] })
    })

    expect(modelName()).toBe('vertex:google/gemini-3-flash-preview')
    const first = await post({ lang: 'en', mode: 'explain', result })
    expect(JSON.parse(first.body)).toEqual({ text: 'It is worth seeing your family doctor.', guardrail: 'pass' })
    process.env.GOOGLE_CLOUD_LOCATION = 'me-central1'
    await post({ lang: 'en', mode: 'explain', result })

    // One sign-in for both calls: the token is kept in memory until shortly before it expires.
    const signIns = calls.filter((c) => c.url === TOKEN_URI)
    expect(signIns).toHaveLength(1)
    const form = new URLSearchParams(String(signIns[0].init.body))
    expect(form.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:jwt-bearer')
    const [head, claims, signature] = form.get('assertion').split('.')
    expect(JSON.parse(Buffer.from(head, 'base64url'))).toEqual({ alg: 'RS256', typ: 'JWT' })
    expect(JSON.parse(Buffer.from(claims, 'base64url'))).toMatchObject({ iss: account.client_email, aud: TOKEN_URI, scope: 'https://www.googleapis.com/auth/cloud-platform' })
    expect(createVerify('RSA-SHA256').update(`${head}.${claims}`).verify(publicKey, signature, 'base64url')).toBe(true)

    const chats = calls.filter((c) => c.url !== TOKEN_URI)
    expect(chats.map((c) => c.url)).toEqual([
      'https://aiplatform.googleapis.com/v1/projects/demo-project/locations/global/endpoints/openapi/chat/completions',
      'https://me-central1-aiplatform.googleapis.com/v1/projects/demo-project/locations/me-central1/endpoints/openapi/chat/completions',
    ])
    expect(chats[0].init.headers.authorization).toBe('Bearer tok-1')
    const sent = JSON.parse(chats[0].init.body)
    expect(sent.model).toBe('google/gemini-3-flash-preview')
    // Gemini 3 thinks before it answers: thinking is kept minimal and given its own room, so replies are not cut off.
    expect(sent.reasoning_effort).toBe('minimal')
    expect(sent.max_completion_tokens).toBe(3500)
    expect(sent).not.toHaveProperty('temperature')
    // The key itself never leaves this server.
    expect(JSON.stringify(chats.map((c) => c.init))).not.toContain('PRIVATE KEY')
  })

  it('tries again when Google refuses a call it accepts a moment later', async () => {
    let chats = 0
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (String(url) === TOKEN_URI) return json({ access_token: 'tok-2', expires_in: 3600 })
      chats++
      if (chats <= 2) return json({ error: { code: 403, status: 'PERMISSION_DENIED' } }, 403)
      return json({ choices: [{ finish_reason: 'stop', message: { content: 'It is worth seeing your family doctor.' } }] })
    })
    const r = await post({ lang: 'en', mode: 'explain', result })
    expect(r.statusCode).toBe(200)
    expect(JSON.parse(r.body).guardrail).toBe('pass')
    expect(chats).toBe(3)
  })
})
