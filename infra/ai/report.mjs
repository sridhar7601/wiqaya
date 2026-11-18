/**
 * Lab report reader: the AI transcribes numbers from a photo of a semen analysis report. Nothing more.
 *
 *   AI reads      -> this function (vision model, fixed output schema, no free text)
 *   code checks   -> normalise() below: units, sums, ranges; all deterministic and unit-tested
 *   person checks -> the app shows every number beside "as printed" and asks for confirmation
 *   rules decide  -> the same WHO 2021 rules as for hand-typed values (src/lib/engine.ts)
 *
 * The image is passed to the model and dropped. It is never stored and never logged.
 */
import { clientIp, method, readJson, resp, header } from '../server/http.mjs'
import { allow, limited } from '../server/limits.mjs'
import { aiConfigured, callModel } from './index.mjs'

const MAX_BODY = 3_200_000 // a 1600 px JPEG is usually 0.2-0.6 MB before base64
const IMAGE_RE = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+=*)$/

export const RAW_FIELDS = [
  'volume',
  'concentration',
  'total_count',
  'total_motility',
  'progressive_motility',
  'non_progressive_motility',
  'immotile',
  'grade_a',
  'grade_b',
  'grade_c',
  'grade_d',
  'normal_morphology',
  'abnormal_morphology',
]

/** The five values the app uses, in the app's own field names. */
export const APP_FIELDS = ['volume_ml', 'concentration', 'total_motility', 'progressive', 'morphology']

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['document', 'values', 'unreadable'],
  properties: {
    document: { type: 'string', enum: ['semen_analysis', 'other_lab_report', 'not_a_report'] },
    values: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['field', 'value', 'comparator', 'unit', 'printed'],
        properties: {
          field: { type: 'string', enum: RAW_FIELDS },
          value: { type: 'number' },
          comparator: { type: 'string', enum: ['=', '<', '>'] },
          unit: { type: 'string' },
          printed: { type: 'string' },
        },
      },
    },
    unreadable: { type: 'array', items: { type: 'string', enum: RAW_FIELDS } },
  },
}

const SYSTEM = `You transcribe numbers from a photo or screenshot of a semen analysis (seminal fluid analysis) laboratory report. You do not interpret, diagnose or comment.

Rules:
- Report only what is printed in the image. Never guess, estimate or calculate a value. If a measurement is missing, cut off, covered or unreadable, leave it out of "values"; if it is present but unreadable, list its field under "unreadable".
- The page may be tilted, skewed or blurred. Follow each label along its own printed row to its result; do not take the number from the row above or below. If you cannot be sure which number belongs to a label, list the field under "unreadable" instead of choosing one.
- Take the patient's RESULT only. Ignore reference ranges, normal values and lower limits printed beside it.
- If the image is not a semen analysis report, set "document" to "other_lab_report" or "not_a_report" and return no values.
- Never return names, ID or file numbers, dates of birth, phone numbers, addresses or any other personal detail, even when visible.
- Labels may be in English, Arabic or both. Numbers may use Arabic-Indic digits or a decimal comma: return plain numbers with a decimal point.
- If no sperm were seen ("nil", "none seen", "azoospermia", "0"), give concentration with value 0.
- If a result is printed with "<" or ">", give the number and set "comparator" accordingly; otherwise "comparator" is "=".

Fields (use exactly these names):
- volume: semen volume.
- concentration: sperm concentration, also called sperm count per mL or density. Not the total count per ejaculate.
- total_count: total sperm number per ejaculate (also "total sperm count", "total count"), only when printed.
- total_motility: total motile sperm in percent (also "motility", "total motile", "PR+NP").
- progressive_motility: progressively motile sperm in percent (also "progressive", "PR", or one combined "a+b" figure).
- non_progressive_motility: non-progressive sperm in percent (also "NP").
- immotile: immotile sperm in percent (also "IM").
- grade_a, grade_b, grade_c, grade_d: only when the report lists motility grades a, b, c, d separately (also written as rapid progressive, slow progressive, non-progressive, immotile). Give each grade as printed. Do not add them up.
- normal_morphology: sperm with normal forms in percent.
- abnormal_morphology: the total of sperm with abnormal forms in percent, only when that total is printed. Never use the head, midpiece or tail defect rows for it.

For each value give: "field", "value" (a number), "comparator", "unit" exactly as printed on that same row (for example "mL", "million/mL", "x10^6/mL", "%"; empty if none is printed), and "printed": the result exactly as printed, at most 20 characters.`

// "As printed" and the unit are the only text that comes back from the model. Keep numbers and known unit
// words, word by word, and drop everything else, so a name or an ID on the report can never ride along.
const NUMBER_WORD = /^[<>≤≥]?\d[\d.,]*%?$/
const UNIT_WORD = /^(%|٪|\/|\+|ml|cc|مل|x?10[\^*]{0,2}[69⁶⁹]?\/?(ml|l)?|(m|mill?|million|mio|mln)\.?(\/(ml|cc|ejaculate))?|مليون(\/مل)?|\/(ml|l)|nil|none|seen|zero|azoospermia)$/i

/** What kind of quantity a printed unit belongs to: a row slip usually brings the wrong kind of unit with it. */
const unitKind = (u) => {
  const x = String(u ?? '').toLowerCase()
  if (!x) return ''
  if (/[%٪]/.test(x)) return 'percent'
  if (/10|mill|mio|mln|مليون|^m$|m\/|\/ml|\/l/.test(x)) return 'count'
  if (/^(ml|cc|مل)$/.test(x)) return 'volume'
  return ''
}
const clean = (s, max) =>
  String(s ?? '')
    .replace(/(\d)([A-Za-z])/g, '$1 $2')
    .split(/\s+/)
    .filter((w) => NUMBER_WORD.test(w) || UNIT_WORD.test(w))
    .join(' ')
    .slice(0, max)

const round1 = (n) => Math.round(n * 10) / 10

/** Sperm concentration in million per mL, whatever notation the lab used. Returns [value, note?]. */
export function concentrationInMillions(value, unit) {
  const u = String(unit ?? '')
    .toLowerCase()
    .replace(/\s+/g, '')
  if (/10\^?\*{0,2}9\/?l|10⁹/.test(u)) return [value] // 10^9 per litre is the same number as million per mL
  if (/10\^?\*{0,2}6|10⁶|mill|mio|m\/ml|mil\/ml/.test(u)) return [value]
  if (value >= 100_000) return [value / 1e6, 'converted'] // printed as a raw count per mL
  // Rarer notations are left as printed: the person checks every number against the report before it is used.
  return [value, u ? undefined : 'unit_missing']
}

/**
 * Turns the model's transcription into the app's five fields. Pure function: same input, same output.
 *
 * Two things happen here that the model is never trusted with:
 *  - sums and conversions (grades a + b, 100 - abnormal forms, …), marked `derived`;
 *  - cross-checks. Numbers on a real report agree with each other: motility parts add up to 100, volume times
 *    concentration gives the total count, a percentage carries a "%". When the transcription breaks one of
 *    these, the reader most likely slipped a row. The fields involved are marked `unsure`, and the app then
 *    asks the person to type them instead of filling them in.
 */
export function normalise(model) {
  const raw = {}
  for (const v of Array.isArray(model?.values) ? model.values : []) {
    if (!RAW_FIELDS.includes(v?.field) || raw[v.field]) continue
    if (typeof v.value !== 'number' || !Number.isFinite(v.value) || v.value < 0) continue
    raw[v.field] = { value: v.value, comparator: v.comparator === '<' || v.comparator === '>' ? v.comparator : '=', unit: clean(v.unit, 20), printed: clean(v.printed, 20) }
  }

  const out = {}
  const notes = []
  const put = (id, value, source, derived) => {
    out[id] = { value: round1(value), printed: source?.printed || undefined, comparator: source && source.comparator !== '=' ? source.comparator : undefined, derived }
  }
  const doubt = (why, ...ids) => {
    for (const id of ids) if (out[id] && !out[id].unsure) out[id].unsure = why
    if (!notes.includes(`check_${why}`)) notes.push(`check_${why}`)
  }
  const near = (x, y, tolerance) => Math.abs(x - y) <= tolerance
  const pct = (f) => (raw[f] && raw[f].value <= 100 ? raw[f].value : undefined)
  const kind = (f) => (raw[f] ? unitKind(raw[f].unit) : '')
  const PERCENT_FIELDS = ['total_motility', 'progressive_motility', 'non_progressive_motility', 'immotile', 'grade_a', 'grade_b', 'grade_c', 'grade_d', 'normal_morphology', 'abnormal_morphology']

  // ---- the five values ----
  if (raw.volume) {
    if (raw.volume.value <= 20) put('volume_ml', raw.volume.value, raw.volume)
    else notes.push('volume_implausible')
  }

  let concentration
  if (raw.concentration) {
    const [value, note] = concentrationInMillions(raw.concentration.value, raw.concentration.unit)
    if (note) notes.push(`concentration_${note}`)
    if (value <= 1000) {
      concentration = value
      put('concentration', value, raw.concentration, note === 'converted' ? 'converted' : undefined)
    } else notes.push('concentration_implausible')
  }

  for (const f of PERCENT_FIELDS) if (raw[f] && raw[f].value > 100) notes.push(`${f}_implausible`)

  const a = pct('grade_a')
  const b = pct('grade_b')
  const c = pct('grade_c')
  const d = pct('grade_d')
  const pr = pct('progressive_motility')
  const tm = pct('total_motility')
  const np = pct('non_progressive_motility') ?? c
  const im = pct('immotile') ?? d

  let progressive
  if (pr !== undefined) {
    progressive = pr
    put('progressive', pr, raw.progressive_motility)
  } else if (a !== undefined && b !== undefined && a + b <= 100) {
    progressive = a + b
    put('progressive', progressive, { printed: `${raw.grade_a.printed} + ${raw.grade_b.printed}`.slice(0, 24), comparator: '=' }, 'grades_a_b')
  }

  if (tm !== undefined) put('total_motility', tm, raw.total_motility)
  else if (progressive !== undefined && np !== undefined && progressive + np <= 100) put('total_motility', progressive + np, null, 'progressive_plus_non_progressive')
  else if (im !== undefined) put('total_motility', 100 - im, null, 'from_immotile')

  const normal = pct('normal_morphology')
  const abnormal = pct('abnormal_morphology')
  if (normal !== undefined) put('morphology', normal, raw.normal_morphology)
  else if (abnormal !== undefined) put('morphology', 100 - abnormal, null, 'from_abnormal')

  // ---- cross-checks: do the numbers agree with each other? ----
  const total = out.total_motility?.value
  const motilityOff =
    (a !== undefined && b !== undefined && c !== undefined && d !== undefined && !near(a + b + c + d, 100, 2)) ||
    (progressive !== undefined && np !== undefined && im !== undefined && !near(progressive + np + im, 100, 2)) ||
    (tm !== undefined && progressive !== undefined && np !== undefined && !near(tm, progressive + np, 1.5)) ||
    (tm !== undefined && im !== undefined && !near(tm + im, 100, 2))
  if (motilityOff) doubt('sum', 'total_motility', 'progressive')
  if (progressive !== undefined && total !== undefined && progressive > total + 0.05) {
    doubt('order', 'total_motility', 'progressive')
    notes.push('motility_inconsistent')
  }
  if (normal !== undefined && abnormal !== undefined && !near(normal + abnormal, 100, 1.5)) doubt('sum', 'morphology')

  if (raw.total_count && out.volume_ml && concentration !== undefined) {
    const [count] = concentrationInMillions(raw.total_count.value, raw.total_count.unit)
    if (!near(out.volume_ml.value * concentration, count, Math.max(1.5, count * 0.12))) doubt('sum', 'volume_ml', 'concentration')
  }

  // A percentage printed with "mL", or a volume printed with "%", was read from the wrong row.
  if (kind('volume') === 'percent' || kind('volume') === 'count') doubt('unit', 'volume_ml')
  if (kind('concentration') === 'percent' || kind('concentration') === 'volume') doubt('unit', 'concentration')
  const wrongUnit = (f) => kind(f) === 'count' || kind(f) === 'volume'
  if (['total_motility', 'progressive_motility', 'non_progressive_motility', 'immotile', 'grade_a', 'grade_b', 'grade_c', 'grade_d'].some(wrongUnit)) doubt('unit', 'total_motility', 'progressive')
  if (['normal_morphology', 'abnormal_morphology'].some(wrongUnit)) doubt('unit', 'morphology')

  const unreadable = (Array.isArray(model?.unreadable) ? model.unreadable : []).filter((f) => RAW_FIELDS.includes(f))
  return { values: out, missing: APP_FIELDS.filter((f) => !out[f]), notes, unreadable }
}

export async function readReport(dataUrl) {
  const out = await callModel(
    [
      { role: 'system', content: SYSTEM },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Transcribe the semen analysis results from this image.' },
          { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
        ],
      },
    ],
    { temperature: 0, max_completion_tokens: 1200, response_format: { type: 'json_schema', json_schema: { name: 'semen_analysis_transcription', strict: true, schema: SCHEMA } } },
    40_000,
  )
  if (!out.ok) return out
  try {
    return { ok: true, model: JSON.parse(out.text) }
  } catch {
    return { ok: false, status: 502 }
  }
}

export async function handler(event) {
  const started = Date.now()
  const m = method(event)
  if (m === 'OPTIONS') return resp(204, '')
  if (m !== 'POST') return resp(405, { error: 'method_not_allowed' })

  const secret = process.env.ORIGIN_SECRET
  if (secret && header(event, 'x-origin-secret') !== secret) return resp(403, { error: 'forbidden' })
  if (!aiConfigured()) return resp(503, { error: 'ai_not_configured' })

  const parsed = readJson(event, MAX_BODY)
  if (!parsed.ok) return parsed.res
  const image = parsed.body.image
  if (typeof image !== 'string' || !IMAGE_RE.test(image)) return resp(400, { error: 'bad_image' })

  const a = await allow('report', clientIp(event))
  if (!a.ok) return limited(a)

  const out = await readReport(image)
  if (!out.ok) {
    console.log(JSON.stringify({ evt: 'report_error', status: out.status, filtered: !!out.filtered, ms: Date.now() - started }))
    return out.filtered ? resp(200, { ok: false, reason: 'unreadable' }) : resp(502, { error: 'upstream' })
  }

  if (out.model?.document !== 'semen_analysis') {
    console.log(JSON.stringify({ evt: 'report_other', ms: Date.now() - started }))
    return resp(200, { ok: false, reason: 'not_semen_report' })
  }
  const result = normalise(out.model)
  const found = APP_FIELDS.length - result.missing.length
  console.log(JSON.stringify({ evt: 'report_ok', found, notes: result.notes.length, ms: Date.now() - started }))
  if (found === 0) return resp(200, { ok: false, reason: 'unreadable' })
  return resp(200, { ok: true, ...result })
}
