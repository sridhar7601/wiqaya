/**
 * AI care search: turns what the person types ("Arabic-speaking male doctor in Al Ain after work") into
 * directory filters. Nothing more.
 *
 *   rules/clinician decide -> which kind of care (the journey step); the AI never sees it and cannot change it
 *   AI reads               -> this function: free text in, a fixed JSON schema out (no free text back)
 *   code checks            -> sanitise() below keeps only known values; anything else is dropped
 *
 * An emergency in the text is answered by fixed text before the model is called. When the text describes a
 * symptom, the app is told so it can point to the check-in, which decides urgency by fixed rules.
 * The text is passed to the model and dropped. It is never stored and never logged.
 */
import { clientIp, method, readJson, resp } from '../server/http.mjs'
import { allow, limited } from '../server/limits.mjs'
import { aiConfigured, callModel, _internal } from './index.mjs'

const AREAS = ['abu_dhabi', 'al_ain', 'al_dhafra', 'online']
const LANGUAGES = ['ar', 'en', 'hi', 'ur', 'ml', 'tl']
const INSURANCE = ['thiqa', 'basic', 'enhanced', 'self_pay']

const nullable = (schema) => ({ anyOf: [schema, { type: 'null' }] })
const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['area', 'languages', 'male_clinician', 'female_clinician', 'video', 'evenings', 'weekends', 'insurance', 'symptom'],
  properties: {
    area: nullable({ type: 'string', enum: AREAS }),
    languages: { type: 'array', items: { type: 'string', enum: LANGUAGES } },
    male_clinician: nullable({ type: 'boolean' }),
    female_clinician: nullable({ type: 'boolean' }),
    video: nullable({ type: 'boolean' }),
    evenings: nullable({ type: 'boolean' }),
    weekends: nullable({ type: 'boolean' }),
    insurance: nullable({ type: 'string', enum: INSURANCE }),
    symptom: { type: 'boolean' },
  },
}

const SYSTEM = `You turn a short request for a clinic, written in English or Arabic, into search filters for a directory of clinics in the Emirate of Abu Dhabi, UAE.
Fill only what the person actually asked for. Use null (or an empty list) for everything they did not mention. Never guess.
- area: "abu_dhabi" (Abu Dhabi city, including Mussafah, Khalifa City, Reem, Yas, Saadiyat), "al_ain", "al_dhafra" (Madinat Zayed, Ruwais, Ghayathi, Liwa), or "online" only if they want no visit at all.
- languages: languages they want to be seen in. ar Arabic, en English, hi Hindi, ur Urdu, ml Malayalam, tl Tagalog/Filipino.
- male_clinician: true only if they ask for a man (male doctor, "a man to talk to").
- female_clinician: true only if they ask for a woman (female doctor, lady doctor, طبيبة). Never set both.
- video: true if they want a video, phone or online consultation from home.
- evenings: true if they ask for after work, evening or night. weekends: true for Saturday, Sunday or the weekend.
- insurance: "thiqa", "basic", "enhanced", or "self_pay" (cash, paying myself), only if named.
- symptom: true if the text describes a symptom, pain, lump, injury or other health complaint, rather than only a preference.
You do not choose the kind of care or specialty, and you do not give health advice.`

const KEYS = ['area', 'languages', 'male_clinician', 'female_clinician', 'video', 'evenings', 'weekends', 'insurance', 'symptom']

/** Keeps only known values. Returns the app's filter shape (CareFilter in src/lib/companion/directory.ts). */
export function sanitise(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const filter = {}
  if (AREAS.includes(raw.area)) filter.area = raw.area
  if (Array.isArray(raw.languages)) {
    const langs = [...new Set(raw.languages.filter((l) => LANGUAGES.includes(l)))]
    if (langs.length) filter.languages = langs
  }
  if (raw.female_clinician === true) filter.femaleClinician = true
  else if (raw.male_clinician === true) filter.maleClinician = true
  if (raw.video === true) filter.telehealth = true
  if (raw.evenings === true) filter.evenings = true
  if (raw.weekends === true) filter.weekends = true
  if (INSURANCE.includes(raw.insurance)) filter.insurance = raw.insurance
  return { filter, symptom: raw.symptom === true }
}

export async function handler(event) {
  const started = Date.now()
  if (method(event) === 'OPTIONS') return resp(204, '')
  if (method(event) !== 'POST') return resp(405, { error: 'method_not_allowed' })
  if (!aiConfigured()) return resp(503, { error: 'ai_not_configured' })

  const a = await allow('navigate', clientIp(event))
  if (!a.ok) return limited(a)

  const parsed = readJson(event, 2_000)
  if (!parsed.ok) return parsed.res
  const text = typeof parsed.body.text === 'string' ? parsed.body.text.trim().slice(0, 200) : ''
  if (text.length < 2) return resp(400, { error: 'bad_request' })

  // Input guardrail: an emergency is answered by fixed text, never by the model.
  if (_internal.EMERGENCY_RE.some((r) => r.test(text))) return resp(200, { emergency: true, filter: null })

  const out = await callModel(
    [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: text },
    ],
    { temperature: 0, max_completion_tokens: 300, response_format: { type: 'json_schema', json_schema: { name: 'care_search_filters', strict: true, schema: SCHEMA } } },
    10_000,
  )
  if (!out.ok) {
    console.log(JSON.stringify({ evt: 'nav_error', status: out.status, filtered: !!out.filtered, ms: Date.now() - started }))
    return resp(out.filtered ? 200 : 502, out.filtered ? { filter: null } : { error: 'upstream' })
  }
  let raw
  try {
    raw = JSON.parse(out.text)
  } catch {
    return resp(502, { error: 'upstream' })
  }
  const clean = sanitise(raw)
  if (!clean || !KEYS.every((k) => k in raw)) return resp(502, { error: 'upstream' })
  console.log(JSON.stringify({ evt: 'nav_ok', fields: Object.keys(clean.filter).length, symptom: clean.symptom, ms: Date.now() - started }))
  return resp(200, clean)
}

export const _nav = { SCHEMA, SYSTEM }
