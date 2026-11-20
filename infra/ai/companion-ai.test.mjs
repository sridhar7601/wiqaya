import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { _local } from '../server/limits.mjs'
import { _internal, handler } from './index.mjs'
import { handler as navigate, sanitise } from './navigate.mjs'

const result = { level: 'specialist', emergency: false, step: "See a men's health specialist", flags: [{ title: 'Two semen results below range', why: 'x', action: 'y' }] }
const notes = [
  { id: 'low_result', q: 'Am I infertile?', a: 'One result does not mean that.' },
  { id: 'heat_work', q: 'Does heat matter?', a: 'It can.' },
]
const event = (body) => ({ requestContext: { http: { method: 'POST', sourceIp: '1.2.3.4' } }, headers: {}, body: JSON.stringify(body) })
const post = (body) => handler(event(body))
const model = (content) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 }))

describe('Grounded answers, visit preparation and care search (no network)', () => {
  const env = { ...process.env }
  beforeEach(() => {
    process.env.AZURE_OPENAI_ENDPOINT = 'https://example.invalid'
    process.env.AZURE_OPENAI_DEPLOYMENT = 'test'
    process.env.AZURE_OPENAI_API_KEY = 'test'
    process.env.STORE = 'memory'
    for (const k of ['ORIGIN_SECRET', 'OPENAI_API_KEY', 'GCP_SERVICE_ACCOUNT_JSON', 'GOOGLE_APPLICATION_CREDENTIALS']) delete process.env[k]
    _local.clear()
  })
  afterEach(() => {
    process.env = { ...env }
    vi.restoreAllMocks()
  })

  it('keeps a grounded answer that cites its notes and says which notes it used', async () => {
    model('One result does not decide this, and doctors repeat the test [1].')
    const out = JSON.parse((await post({ lang: 'en', mode: 'ask', question: 'Am I infertile?', notes, result })).body)
    expect(out.cited).toEqual(['low_result'])
    expect(out.text).toContain('[1]')
    expect(out.guardrail).toBe('pass')
  })

  it('sends the notes to the model, numbered, with the rule that it must cite them', async () => {
    const spy = model('It can [2].')
    await post({ lang: 'en', mode: 'ask', question: 'Does heat matter?', notes, result })
    const sent = JSON.parse(spy.mock.calls[0][1].body)
    expect(sent.messages[0].content).toMatch(/exactly NO_NOTE/)
    expect(sent.messages[1].content).toContain('[2] Does heat matter? It can.')
  })

  it('replaces an answer that cites no note with the fixed "no reviewed answer" text', async () => {
    model('Most men are fine, do not worry.')
    const out = JSON.parse((await post({ lang: 'en', mode: 'ask', question: 'Am I infertile?', notes, result })).body)
    expect(out.text).toBe(_internal.NO_NOTE.en)
    expect(out.guardrail).toBe('uncited')
    expect(out.cited).toEqual([])
  })

  it('answers NO_NOTE with the fixed text, in Arabic too', async () => {
    model('NO_NOTE')
    const out = JSON.parse((await post({ lang: 'ar', mode: 'ask', question: 'سؤال خارج الملاحظات', notes, result })).body)
    expect(out.text).toBe(_internal.NO_NOTE.ar)
    expect(out.guardrail).toBe('no_note')
  })

  it('removes citation numbers that point at no note', () => {
    expect(_internal.checkGrounded('It can [2]. Also this [7].', notes)).toEqual({ text: 'It can [2]. Also this.', cited: ['heat_work'] })
  })

  it('still blocks a diagnosis even when it is cited', async () => {
    model('You are infertile [1].')
    const out = JSON.parse((await post({ lang: 'en', mode: 'ask', question: 'Am I infertile?', notes, result })).body)
    expect(out.guardrail).toBe('blocked')
    expect(out.cited).toEqual([])
  })

  it('never prepares a visit for an emergency: it sends the 998 line without calling the model', async () => {
    const spy = vi.spyOn(globalThis, 'fetch')
    const out = JSON.parse((await post({ lang: 'en', mode: 'prep', visit: 'Video visit', result: { ...result, level: 'urgent', emergency: true } })).body)
    expect(out.emergency).toBe(true)
    expect(out.text).toMatch(/998/)
    expect(spy).not.toHaveBeenCalled()
  })

  it('drops a preparation question that names a dose, and keeps the rest', async () => {
    model(JSON.stringify({ opening: 'I am here because two semen results were below the range.', questions: ['Should I repeat the test?', 'Can I take 50 mg of clomiphene?'] }))
    const out = JSON.parse((await post({ lang: 'en', mode: 'prep', visit: 'Specialist visit', questions: ['Is heat at work a problem?'], result })).body)
    expect(out.questions).toEqual(['Should I repeat the test?'])
    expect(out.guardrail).toBe('trimmed')
    expect(out.opening).toMatch(/^I am here/)
  })

  it('passes the person’s own questions and the visit type to the model, and nothing else about them', () => {
    const msg = _internal.userMessage(_internal.validate({ lang: 'en', mode: 'prep', visit: 'Video visit', questions: ['Is heat a problem?'], decidedBy: 'clinician', result }))
    expect(msg).toContain('Visit: Video visit')
    expect(msg).toContain('"""Is heat a problem?"""')
    expect(msg).toContain("decided by the person's own clinician")
    expect(msg).not.toMatch(/age|weight|height|name/i)
  })

  it('care search: an emergency is answered by fixed text and the model is not called', async () => {
    const spy = vi.spyOn(globalThis, 'fetch')
    const out = JSON.parse((await navigate(event({ text: 'sudden severe pain in my testicle, where do I go' }))).body)
    expect(out).toEqual({ emergency: true, filter: null })
    expect(spy).not.toHaveBeenCalled()
  })

  it('care search: keeps only known filter values and reports a symptom', async () => {
    model(JSON.stringify({ area: 'al_ain', languages: ['ar', 'fr'], male_clinician: true, female_clinician: null, video: null, evenings: true, weekends: null, insurance: 'gold', symptom: true }))
    const out = JSON.parse((await navigate(event({ text: 'Arabic male doctor in Al Ain after work, I have a lump' }))).body)
    expect(out).toEqual({ filter: { area: 'al_ain', languages: ['ar'], maleClinician: true, evenings: true }, symptom: true })
  })

  it('care search: a woman asking for a female doctor gets that filter, and it wins if both are set', async () => {
    model(JSON.stringify({ area: 'abu_dhabi', languages: ['ar'], male_clinician: true, female_clinician: true, video: null, evenings: null, weekends: null, insurance: null, symptom: false }))
    const out = JSON.parse((await navigate(event({ text: 'طبيبة تتكلم العربية في أبوظبي' }))).body)
    expect(out).toEqual({ filter: { area: 'abu_dhabi', languages: ['ar'], femaleClinician: true }, symptom: false })
  })

  it('care search: refuses a reply that leaves a field out', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    model(JSON.stringify({ area: 'al_ain', languages: [], male_clinician: null, video: null, evenings: null, weekends: null, insurance: null, symptom: false }))
    expect((await navigate(event({ text: 'clinic in Al Ain' }))).statusCode).toBe(502)
  })

  it('visit preparation for a woman is written for a woman, and a man’s for a man', async () => {
    const reply = JSON.stringify({ opening: 'I am here because my cycles are irregular.', questions: ['Which tests do I need?', 'What can I do now?', 'When should I come back?'] })
    const spy = model(reply)
    await post({ lang: 'ar', mode: 'prep', visit: 'Family doctor', result: { ...result, sex: 'female' } })
    const forWoman = JSON.parse(spy.mock.calls[0][1].body).messages[0].content
    expect(forWoman).toMatch(/is a woman/)
    expect(forWoman).toMatch(/hormone tests/)
    expect(forWoman).not.toMatch(/\bhis\b|\bhe\b|men's|semen/)
    model(reply)
    await post({ lang: 'en', mode: 'prep', visit: 'Family doctor', result })
    const forMan = JSON.parse(spy.mock.calls[1][1].body).messages[0].content
    expect(forMan).toMatch(/is a man/)
    expect(forMan).toMatch(/semen analysis/)
  })

  it('care search: refuses a reply that is not the fixed shape', () => {
    expect(sanitise('Al Ain')).toBeNull()
    expect(sanitise({ area: 'dubai', video: 'yes' })).toEqual({ filter: {}, symptom: false })
  })
})
