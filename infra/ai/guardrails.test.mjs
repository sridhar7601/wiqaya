import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { _internal, handler } from './index.mjs'

const result = { level: 'specialist', emergency: false, step: "See a men's health specialist", flags: [{ title: 'Possible varicocele', why: 'x', action: 'y' }] }
// Each call comes from its own address, so the per-address rate limit (20 calls in 10 minutes) does not
// cut in halfway through this file.
let caller = 0
const post = (body, headers = {}) => handler({ requestContext: { http: { method: 'POST', sourceIp: `10.0.0.${++caller}` } }, headers, body: JSON.stringify(body) })

describe('AI function guardrails (no network)', () => {
  const env = { ...process.env }
  beforeEach(() => {
    process.env.AZURE_OPENAI_ENDPOINT = 'https://example.invalid'
    process.env.AZURE_OPENAI_DEPLOYMENT = 'test'
    process.env.AZURE_OPENAI_API_KEY = 'test'
    for (const k of ['ORIGIN_SECRET', 'OPENAI_API_KEY', 'GCP_SERVICE_ACCOUNT_JSON', 'GOOGLE_APPLICATION_CREDENTIALS']) delete process.env[k]
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

  const woman = {
    level: 'primary',
    emergency: false,
    sex: 'female',
    step: 'See your family doctor',
    flags: [{ title: 'No folic acid yet', why: 'Folic acid before pregnancy prevents most spinal cord problems.', action: 'Take 400 micrograms of folic acid every day. Some women need a higher dose; ask your doctor.' }],
  }
  const reply = (content) => vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 }))

  it('blocks a diagnosis of a women’s condition, in English and Arabic', async () => {
    for (const bad of ['You have PCOS.', 'You have endometriosis.', 'You have a low egg reserve.', 'You are in early menopause.', 'لديكِ تكيس المبايض', 'أنتِ مصابة بقصور المبيض']) {
      reply(bad)
      const out = JSON.parse((await post({ lang: 'en', mode: 'explain', result: woman })).body)
      expect(out.guardrail, bad).toBe('blocked')
    }
    const { violates } = _internal
    expect(violates('Irregular cycles can have several causes, and PCOS may be one of them.')).toBe(false)
    expect(violates('This does not mean you have endometriosis.')).toBe(false)
    expect(violates('هذا لا يعني أن لديك تكيس المبايض')).toBe(false)
  })

  it('lets a dose through only when it is printed in the rule text or note the model was given', async () => {
    const quoted = 'Start with 400 micrograms of folic acid a day, as the guidance says, and ask your doctor if you need more.'
    reply(quoted)
    expect(JSON.parse((await post({ lang: 'en', mode: 'explain', result: woman })).body)).toEqual({ text: quoted, guardrail: 'pass' })
    reply('تناولي ٤٠٠ ميكروغرام من حمض الفوليك يومياً.')
    expect(JSON.parse((await post({ lang: 'ar', mode: 'explain', result: woman })).body).guardrail).toBe('pass')
    for (const invented of ['Take 5 mg of folic acid a day.', 'Take 5 milligrams a day.', 'تناولي ٥ ملغ يومياً']) {
      reply(invented)
      expect(JSON.parse((await post({ lang: 'en', mode: 'explain', result: woman })).body).guardrail, invented).toBe('blocked')
    }
    // The same sentence is refused when the result it explains does not print that dose.
    reply(quoted)
    expect(JSON.parse((await post({ lang: 'en', mode: 'explain', result })).body).guardrail).toBe('blocked')
  })

  it('does not mistake a lab value for a dose', () => {
    const { violates } = _internal
    expect(violates('An FSH above 10 IU/L early in the cycle is worth repeating.')).toBe(false)
    expect(violates('A fasting sugar of 126 mg/dL or more needs checking.')).toBe(false)
    expect(violates('Take 10 IU daily.')).toBe(true)
  })

  it('tells the model whether it is writing to a woman or a man, and nothing else about the person', async () => {
    const spy = reply('It is worth seeing your family doctor.')
    await post({ lang: 'ar', mode: 'explain', result: woman })
    const forWoman = JSON.parse(spy.mock.calls[0][1].body).messages[0].content
    expect(forWoman).toMatch(/is a woman/)
    expect(forWoman).toMatch(/feminine forms/)
    expect(forWoman).toMatch(/late or missed period/)
    expect(forWoman).not.toMatch(/men's|testicle/)
    reply('It is worth seeing a specialist.')
    await post({ lang: 'en', mode: 'explain', result: { ...result, sex: 'not-a-sex' } })
    const forMan = JSON.parse(spy.mock.calls[1][1].body).messages[0].content
    expect(forMan).toMatch(/is a man/)
    expect(forMan).toMatch(/swollen testicle/)
    expect(_internal.validate({ lang: 'en', mode: 'explain', result })).toMatchObject({ sex: 'male' })
  })

  it('answers a woman’s emergency question in Arabic in the feminine', async () => {
    const out = JSON.parse((await post({ lang: 'ar', mode: 'ask', question: 'عندي ألم شديد في جانب واحد وتأخرت الدورة', result: woman })).body)
    expect(out.emergency).toBe(true)
    expect(out.text).toContain('اتصلي بالرقم 998')
  })

  it('never sends more than the result summary to the model', () => {
    const msg = _internal.userMessage(_internal.validate({ lang: 'en', mode: 'explain', result }))
    expect(msg).toContain('Possible varicocele')
    expect(msg).not.toMatch(/age|weight|height/i)
  })
})
