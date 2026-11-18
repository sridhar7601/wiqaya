import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { concentrationInMillions, handler, normalise } from './report.mjs'

const v = (field, value, unit = '%', printed = String(value), comparator = '=') => ({ field, value, comparator, unit, printed })
const post = (body) => handler({ requestContext: { http: { method: 'POST', sourceIp: '1.2.3.4' } }, headers: {}, body: JSON.stringify(body) })
const IMAGE = `data:image/jpeg;base64,${Buffer.from('not really a picture').toString('base64')}`

/** Makes the mocked model answer with this transcription. */
function modelSays(model) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(model) } }] }), { status: 200, headers: { 'content-type': 'application/json' } }),
  )
}

describe('report reader: the checks done in code, not by the AI', () => {
  it('passes plain WHO-style values through', () => {
    const r = normalise({
      document: 'semen_analysis',
      values: [v('volume', 2.5, 'mL'), v('concentration', 12, 'million/mL'), v('total_motility', 35), v('progressive_motility', 22), v('normal_morphology', 3)],
      unreadable: [],
    })
    expect(Object.fromEntries(Object.entries(r.values).map(([k, x]) => [k, x.value]))).toEqual({ volume_ml: 2.5, concentration: 12, total_motility: 35, progressive: 22, morphology: 3 })
    expect(r.missing).toEqual([])
    expect(r.notes).toEqual([])
    expect(r.values.concentration.derived).toBeUndefined()
  })

  it('adds motility grades itself and says so', () => {
    const r = normalise({ document: 'semen_analysis', values: [v('grade_a', 10), v('grade_b', 15), v('grade_c', 20), v('grade_d', 55)], unreadable: [] })
    expect(r.values.progressive).toMatchObject({ value: 25, derived: 'grades_a_b' })
    expect(r.values.total_motility).toMatchObject({ value: 45, derived: 'progressive_plus_non_progressive' })
    expect(r.missing).toEqual(['volume_ml', 'concentration', 'morphology'])
  })

  it('works out total motility from immotile, and normal forms from abnormal forms', () => {
    const r = normalise({ document: 'semen_analysis', values: [v('immotile', 62), v('abnormal_morphology', 97)], unreadable: [] })
    expect(r.values.total_motility).toMatchObject({ value: 38, derived: 'from_immotile' })
    expect(r.values.morphology).toMatchObject({ value: 3, derived: 'from_abnormal' })
  })

  it('reads concentration in the notations labs use', () => {
    expect(concentrationInMillions(18, 'x10^6/mL')).toEqual([18])
    expect(concentrationInMillions(18, 'M/ml')).toEqual([18])
    expect(concentrationInMillions(18, 'million / mL')).toEqual([18])
    expect(concentrationInMillions(18, '10^9/L')).toEqual([18])
    expect(concentrationInMillions(18_000_000, '/mL')).toEqual([18, 'converted'])
    expect(concentrationInMillions(18, '')).toEqual([18, 'unit_missing'])
  })

  it('keeps azoospermia as zero and remembers a "<" sign', () => {
    const r = normalise({ document: 'semen_analysis', values: [v('concentration', 0, 'million/mL', 'Nil'), v('volume', 1, 'mL', '<1', '<')], unreadable: [] })
    expect(r.values.concentration.value).toBe(0)
    expect(r.values.volume_ml).toMatchObject({ value: 1, comparator: '<', printed: '<1' })
  })

  it('drops impossible numbers instead of passing them on', () => {
    const r = normalise({
      document: 'semen_analysis',
      values: [v('total_motility', 140), v('volume', 45, 'mL'), v('normal_morphology', -3), v('concentration', Number.NaN, 'million/mL'), v('progressive_motility', 30)],
      unreadable: [],
    })
    expect(Object.keys(r.values)).toEqual(['progressive'])
    expect(r.notes).toEqual(expect.arrayContaining(['total_motility_implausible', 'volume_implausible']))
  })

  it('flags progressive above total, uses the first of duplicate fields, ignores unknown fields', () => {
    const r = normalise({
      document: 'semen_analysis',
      values: [v('total_motility', 30), v('total_motility', 80), v('progressive_motility', 45), v('patient_name', 1, '', 'Ahmed')],
      unreadable: ['volume', 'made_up'],
    })
    expect(r.values.total_motility.value).toBe(30)
    expect(r.notes).toContain('motility_inconsistent')
    expect(r.unreadable).toEqual(['volume'])
    expect(JSON.stringify(r)).not.toContain('Ahmed')
  })

  describe('cross-checks: numbers on a report must agree with each other', () => {
    const unsure = (r) => Object.fromEntries(Object.entries(r.values).filter(([, x]) => x.unsure).map(([k, x]) => [k, x.unsure]))

    it('is quiet when everything agrees, allowing for rounding', () => {
      const r = normalise({
        document: 'semen_analysis',
        values: [v('volume', 2.8, 'mL'), v('concentration', 11, 'million/mL'), v('total_count', 30.8, 'million/ejaculate'), v('total_motility', 47), v('progressive_motility', 33), v('non_progressive_motility', 14), v('immotile', 54), v('normal_morphology', 5)],
        unreadable: [],
      })
      expect(unsure(r)).toEqual({})
      expect(r.notes).toEqual([])
    })

    it('catches a row slip in motility: the parts no longer add up to 100', () => {
      const r = normalise({ document: 'semen_analysis', values: [v('total_motility', 18), v('progressive_motility', 9), v('non_progressive_motility', 73), v('immotile', 55)], unreadable: [] })
      expect(unsure(r)).toEqual({ total_motility: 'sum', progressive: 'sum' })
      expect(r.notes).toContain('check_sum')
    })

    it('catches grades that do not add up, and a total that is not progressive plus non-progressive', () => {
      const grades = normalise({ document: 'semen_analysis', values: [v('grade_a', 16), v('grade_b', 22), v('grade_c', 51), v('grade_d', 98)], unreadable: [] })
      expect(unsure(grades)).toEqual({ total_motility: 'sum', progressive: 'sum' })
      const total = normalise({ document: 'semen_analysis', values: [v('total_motility', 44), v('progressive_motility', 34), v('non_progressive_motility', 56)], unreadable: [] })
      expect(unsure(total)).toEqual({ total_motility: 'sum', progressive: 'sum' })
    })

    it('catches a count that is not volume times concentration', () => {
      const r = normalise({ document: 'semen_analysis', values: [v('volume', 2.4, 'mL'), v('concentration', 88.8, 'million/mL'), v('total_count', 88.8, 'million/ejaculate')], unreadable: [] })
      expect(unsure(r)).toEqual({ volume_ml: 'sum', concentration: 'sum' })
    })

    it('catches a value that came with the wrong kind of unit', () => {
      const r = normalise({ document: 'semen_analysis', values: [v('normal_morphology', 0.6, 'million/mL'), v('volume', 4.4, '%'), v('concentration', 3, 'mL'), v('progressive_motility', 20, 'مل')], unreadable: [] })
      expect(unsure(r)).toEqual({ morphology: 'unit', volume_ml: 'unit', concentration: 'unit', progressive: 'unit' })
    })

    it('accepts Arabic units and a missing unit', () => {
      const r = normalise({ document: 'semen_analysis', values: [v('volume', 4.1, 'مل'), v('concentration', 44, 'مليون/مل'), v('total_motility', 49, '٪'), v('normal_morphology', 2, '')], unreadable: [] })
      expect(unsure(r)).toEqual({})
    })
  })

  it('strips anything that is not a number or a unit from "as printed"', () => {
    const r = normalise({
      document: 'semen_analysis',
      values: [v('volume', 2, 'mL', '2.0 mL (Mr Khalid 784-1990)'), v('concentration', 12, 'x10^6/mL Khalid', '12x10^6/mL'), v('normal_morphology', 3, '%', 'خالد 3%')],
      unreadable: [],
    })
    expect(r.values.volume_ml.printed).toBe('2.0 mL')
    expect(r.values.concentration.printed).toBe('12 x10^6/mL')
    expect(r.values.morphology.printed).toBe('3%')
    expect(JSON.stringify(r)).not.toMatch(/Khalid|784|خالد/)
  })
})

describe('report reader: the function (no network)', () => {
  const env = { ...process.env }
  beforeEach(() => {
    process.env.AZURE_OPENAI_ENDPOINT = 'https://example.invalid'
    process.env.AZURE_OPENAI_DEPLOYMENT = 'test'
    process.env.AZURE_OPENAI_API_KEY = 'test'
    delete process.env.ORIGIN_SECRET
    delete process.env.STORE
  })
  afterEach(() => {
    process.env = { ...env }
    vi.restoreAllMocks()
  })

  it('answers 503 when the AI is not configured', async () => {
    delete process.env.AZURE_OPENAI_API_KEY
    expect((await post({ image: IMAGE })).statusCode).toBe(503)
  })

  it('accepts only a JPEG, PNG or WebP image and never calls the model otherwise', async () => {
    const spy = vi.spyOn(globalThis, 'fetch')
    expect((await post({ image: 'data:text/html;base64,PGI+' })).statusCode).toBe(400)
    expect((await post({ image: 'https://example.com/report.jpg' })).statusCode).toBe(400)
    expect((await post({})).statusCode).toBe(400)
    expect(spy).not.toHaveBeenCalled()
  })

  it('returns the five values and asks the model for a fixed format', async () => {
    const spy = modelSays({ document: 'semen_analysis', values: [v('volume', 3, 'mL'), v('concentration', 9, 'x10^6/mL'), v('grade_a', 5), v('grade_b', 10), v('grade_c', 12), v('normal_morphology', 2)], unreadable: [] })
    const r = await post({ image: IMAGE })
    const body = JSON.parse(r.body)
    expect(r.statusCode).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.values.progressive.value).toBe(15)
    expect(body.values.total_motility.value).toBe(27)
    expect(body.missing).toEqual([])

    const sent = JSON.parse(spy.mock.calls[0][1].body)
    expect(sent.response_format.json_schema.strict).toBe(true)
    expect(sent.temperature).toBe(0)
    expect(sent.messages[1].content[1].image_url.url).toBe(IMAGE)
  })

  it('says so when the picture is not a semen analysis, or nothing could be read', async () => {
    modelSays({ document: 'other_lab_report', values: [v('volume', 3, 'mL')], unreadable: [] })
    expect(JSON.parse((await post({ image: IMAGE })).body)).toEqual({ ok: false, reason: 'not_semen_report' })
    vi.restoreAllMocks()
    modelSays({ document: 'semen_analysis', values: [], unreadable: ['volume'] })
    expect(JSON.parse((await post({ image: IMAGE })).body)).toEqual({ ok: false, reason: 'unreadable' })
  })

  it('answers with a clean error, not a crash, when the model is unreachable or too slow', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new DOMException('This operation was aborted', 'AbortError'))
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const r = await post({ image: IMAGE })
    expect(r.statusCode).toBe(502)
  })

  it('never writes the image or the values to the log', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    modelSays({ document: 'semen_analysis', values: [v('volume', 3.3, 'mL')], unreadable: [] })
    await post({ image: IMAGE })
    const logged = log.mock.calls.flat().join(' ')
    expect(logged).toContain('report_ok')
    expect(logged).not.toContain(IMAGE.slice(30))
    expect(logged).not.toContain('3.3')
  })
})
