import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { _internal, handler } from './index.mjs'

const result = { level: 'specialist', emergency: false, step: "See a men's health specialist", flags: [{ title: 'Possible varicocele', why: 'x', action: 'y' }] }
const post = (body, headers = {}) => handler({ requestContext: { http: { method: 'POST', sourceIp: '1.2.3.4' } }, headers, body: JSON.stringify(body) })

describe('AI function guardrails (no network)', () => {
  const env = { ...process.env }
  beforeEach(() => {
    process.env.AZURE_OPENAI_ENDPOINT = 'https://example.invalid'
    process.env.AZURE_OPENAI_DEPLOYMENT = 'test'
    process.env.AZURE_OPENAI_API_KEY = 'test'
    delete process.env.ORIGIN_SECRET
  })
  afterEach(() => {
    process.env = { ...env }
    vi.restoreAllMocks()
  })

  it('answers 503 when Azure is not configured', async () => {
    delete process.env.AZURE_OPENAI_API_KEY
    expect((await post({ lang: 'en', mode: 'explain', result })).statusCode).toBe(503)
  })

  it('rejects calls without the CloudFront origin secret when one is set', async () => {
    process.env.ORIGIN_SECRET = 's3cret'
    expect((await post({ lang: 'en', mode: 'explain', result })).statusCode).toBe(403)
  })

  it('rejects a result with an unknown level', async () => {
    expect((await post({ lang: 'en', mode: 'explain', result: { ...result, level: 'diagnosed' } })).statusCode).toBe(400)
  })

  it('answers an emergency question with fixed text and never calls the model', async () => {
    const spy = vi.spyOn(globalThis, 'fetch')
    for (const question of ['I have sudden severe pain in my testicle', 'عندي ألم مفاجئ في الخصية']) {
      const r = await post({ lang: 'en', mode: 'ask', question, result })
      expect(JSON.parse(r.body).emergency).toBe(true)
    }
    expect(spy).not.toHaveBeenCalled()
  })

  it('replaces a model answer that states a diagnosis or a dose', async () => {
    for (const bad of ['You have a varicocele.', 'You are infertile.', 'Take 50 mg daily.', 'أنت عقيم']) {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: bad } }] }), { status: 200 }))
      const out = JSON.parse((await post({ lang: 'en', mode: 'explain', result })).body)
      expect(out.guardrail).toBe('blocked')
      expect(out.text).not.toContain(bad)
    }
  })

  it('allows a diagnosis phrase only when it is negated in the same sentence', () => {
    const { violates } = _internal
    expect(violates('This does not mean you are infertile. A specialist can repeat the test.')).toBe(false)
    expect(violates('It doesn’t mean you have cancer, but it must be checked.')).toBe(false)
    expect(violates('نتيجة واحدة لا تعني بالضرورة أنك عقيم')).toBe(false)
    expect(violates('You are infertile.')).toBe(true)
    expect(violates('No. You are infertile.')).toBe(true)
    expect(violates('Do not take more than 50 mg.')).toBe(true)
  })

  it('adds the 998 line when the result is an emergency and the model left it out', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: 'Please get checked.' } }] }), { status: 200 }))
    const out = JSON.parse((await post({ lang: 'en', mode: 'explain', result: { ...result, level: 'urgent', emergency: true } })).body)
    expect(out.text).toContain('998')
  })

  it('turns an Azure content-filter block into the safe fallback, not an error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'content_filter' } }), { status: 400 }))
    const r = await post({ lang: 'en', mode: 'explain', result })
    expect(r.statusCode).toBe(200)
    expect(JSON.parse(r.body).guardrail).toBe('filtered')
  })

  it('answers with a clean error, not a crash, when the model is unreachable or too slow', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new DOMException('This operation was aborted', 'AbortError'))
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const r = await post({ lang: 'en', mode: 'explain', result })
    expect(r.statusCode).toBe(502)
    expect(JSON.parse(r.body)).toEqual({ error: 'upstream' })
  })

  it('lets a safe answer through unchanged', async () => {
    const safe = 'A varicocele can be checked quickly by a specialist. It is common and often treatable.'
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: safe } }] }), { status: 200 }))
    const out = JSON.parse((await post({ lang: 'en', mode: 'explain', result })).body)
    expect(out).toEqual({ text: safe, guardrail: 'pass' })
  })

  it('never sends more than the result summary to the model', () => {
    const msg = _internal.userMessage(_internal.validate({ lang: 'en', mode: 'explain', result }))
    expect(msg).toContain('Possible varicocele')
    expect(msg).not.toMatch(/age|weight|height/i)
  })
})
