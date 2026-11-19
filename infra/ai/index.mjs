/**
 * AI explainer: a thin, guarded proxy to an OpenAI model, either through the OpenAI API or Azure OpenAI.
 * Runs as an AWS Lambda (function URL behind CloudFront), as a Vercel function (api/explain.mjs),
 * or locally (dev-server.mjs). No database; request bodies are never logged.
 *
 * Env (OpenAI API, used when OPENAI_API_KEY is set):
 *   OPENAI_API_KEY            key (keep it in Lambda/Vercel env, never in the repo)
 *   OPENAI_MODEL              default gpt-4.1
 *   OPENAI_BASE_URL           default https://api.openai.com/v1
 * Env (Azure OpenAI, used otherwise):
 *   AZURE_OPENAI_ENDPOINT     https://<resource>.openai.azure.com
 *   AZURE_OPENAI_DEPLOYMENT   your deployment name (e.g. gpt-4o-mini)
 *   AZURE_OPENAI_API_KEY      key (keep it in Lambda/Vercel env, never in the repo)
 *   AZURE_OPENAI_API_VERSION  default 2024-10-21; use "v1" for the newer /openai/v1 API
 * Both:
 *   AI_REASONING_EFFORT       only for reasoning models (gpt-5 family), e.g. "low" (AZURE_OPENAI_REASONING_EFFORT also works)
 * Env (Google Vertex AI, used when a service-account key is set and OPENAI_API_KEY is not):
 *   GCP_SERVICE_ACCOUNT_JSON  the key file's contents (for Vercel), or
 *   GOOGLE_APPLICATION_CREDENTIALS  a path to the key file (local); keep it outside the repo
 *   VERTEX_MODEL              default google/gemini-3-flash-preview
 *   GOOGLE_CLOUD_PROJECT      default: the key's project_id
 *   GOOGLE_CLOUD_LOCATION     default global
 *   ORIGIN_SECRET             optional; when set, requests must carry x-origin-secret (CloudFront adds it)
 */
import { createSign } from 'node:crypto'
import { readFileSync } from 'node:fs'

const LEVELS = new Set(['selfcare', 'primary', 'fertility', 'specialist', 'urgent'])
const MAX_BODY = 12_000
const RATE = { windowMs: 10 * 60_000, max: 20 }
const hits = new Map()

const EMERGENCY_RE = [
  /\b(sudden|severe|worst)\b.{0,30}\bpain\b/i,
  /\b(can'?t|cannot) (breathe|pass urine|pee)\b/i,
  /\bchest pain\b/i,
  /\b(suicid|kill myself|end my life)/i,
  /\b(heavy|lots of) bleeding\b/i,
  /ألم (مفاجئ|شديد)/,
  /انتحار|أنهي حياتي/,
  /نزيف/,
  /ألم في الصدر/,
]

// Output guardrails: no diagnosis claims, no dosing.
// Diagnosis phrases are allowed when negated in the same sentence ("this does not mean you are infertile").
const DIAGNOSIS_RE = [
  /\b(you are|you['’]re) (infertile|sterile)\b/gi,
  /\byou (definitely |probably |clearly )?(have|are suffering from) (a |an )?(varicocele|cancer|torsion|infertility|azoospermia|hypogonadism|low testosterone|an? (sexually transmitted )?infection)\b/gi,
  /(أنت|انت) (عقيم|مصاب ب)/g,
  /لديك (سرطان|دوالي|عقم|التواء|انعدام)/g,
]
// Doses are never allowed, negated or not.
const DOSE_RE = [/\b\d+(\.\d+)?\s?(mg|mcg|µg|iu)\b/i, /\d+\s?(ملغ|مجم|ميكروغرام)/]
const NEGATION_BEFORE = /(\bnot\b|\bnever\b|\bno\b|n['’]t\b|\bunlikely\b|لا|ليس|ليست|لن)[^.!?؟\n]{0,30}$/i

export function violates(text) {
  if (DOSE_RE.some((r) => r.test(text))) return true
  for (const re of DIAGNOSIS_RE) {
    for (const m of text.matchAll(re)) {
      const before = text.slice(Math.max(0, m.index - 40), m.index)
      if (!NEGATION_BEFORE.test(before)) return true
    }
  }
  return false
}

const SAFE_FALLBACK = {
  en: 'I can’t give a reliable explanation for this one. Your next step above was decided by fixed clinical rules and is complete on its own. Your family doctor can talk it through with you.',
  ar: 'لا أستطيع تقديم شرح موثوق لهذه الحالة. خطوتك التالية أعلاه حددتها قواعد سريرية ثابتة وهي مكتملة بذاتها، ويمكن لطبيب الأسرة مناقشتها معك.',
}
const EMERGENCY_LINE = {
  en: 'This needs emergency care now: call 998 or go to the nearest emergency department.',
  ar: 'هذه حالة تحتاج إلى رعاية طارئة الآن: اتصل بالرقم 998 أو توجّه إلى أقرب قسم طوارئ.',
}

const SYSTEM = (lang) => `You are the plain-language helper inside "Wiqaya", a men's reproductive and preventive health screening app used in Abu Dhabi, UAE.
You receive a screening result that fixed clinical rules have ALREADY decided, and sometimes a general question from the user.
Follow these rules strictly:
- Never diagnose. Never say the person has, or does not have, a condition. Use words like "can", "may", "worth checking".
- Never change, soften or contradict the suggested next step or its urgency. State it accurately.
- If the result is an emergency, or the question describes sudden severe pain, fever with a swollen testicle, heavy bleeding, chest pain or thoughts of self-harm, first tell them to call 998 or go to the nearest emergency department now.
- No medicine doses. Never tell anyone to start or stop a prescribed medicine.
- Respect religious, social and cultural sensitivities. Do not assume marital status, family plans or sexual behaviour. No blame, no stigma. Warm, discreet, plain words.
- Use only the facts provided plus widely accepted general health information. If the question is outside men's reproductive or preventive health, or you are unsure, say so briefly and suggest their family doctor.
- Do not ask for or repeat personal details.
- Reply in ${lang === 'ar' ? 'simple Modern Standard Arabic' : 'plain English'}. At most 120 words. Short paragraphs or up to 4 bullet points. No headings, no tables.`

function resp(statusCode, body, extra = {}) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }
}

function header(event, name) {
  const h = event.headers || {}
  return h[name] ?? h[name.toLowerCase()] ?? Object.entries(h).find(([k]) => k.toLowerCase() === name)?.[1]
}

function rateLimited(ip) {
  const now = Date.now()
  const list = (hits.get(ip) || []).filter((t) => now - t < RATE.windowMs)
  list.push(now)
  hits.set(ip, list)
  if (hits.size > 5000) hits.clear()
  return list.length > RATE.max
}

const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '')

const MODES = new Set(['ask', 'explain', 'prep'])
/** Who set the next step, as the model is told. The model never changes it. */
const DECIDED = {
  rules: 'fixed clinical rules',
  clinician: "the person's own clinician, after reviewing their summary",
  red_flag: 'fixed clinical rules, because of a warning sign',
}

function validate(body) {
  const lang = body.lang === 'ar' ? 'ar' : 'en'
  const mode = MODES.has(body.mode) ? body.mode : 'explain'
  const r = body.result
  if (!r || typeof r !== 'object' || !LEVELS.has(r.level)) return null
  const flags = Array.isArray(r.flags)
    ? r.flags.slice(0, 40).map((f) => ({ title: str(f?.title, 200), why: str(f?.why, 700), action: str(f?.action, 400), info: !!f?.info }))
    : []
  const question = mode === 'ask' ? str(body.question, 400).trim() : ''
  if (mode === 'ask' && question.length < 3) return null
  // Reviewed notes (src/lib/notes.ts) chosen on the phone for this question. With notes, answers must cite them.
  const notes =
    mode === 'ask' && Array.isArray(body.notes)
      ? body.notes
          .slice(0, 4)
          .map((n) => ({ id: str(n?.id, 40), q: str(n?.q, 200), a: str(n?.a, 900) }))
          .filter((n) => n.id && n.a)
      : []
  const decidedBy = Object.hasOwn(DECIDED, body.decidedBy) ? body.decidedBy : 'rules'
  const prep =
    mode === 'prep'
      ? {
          visit: str(body.visit, 120).trim(),
          questions: Array.isArray(body.questions) ? body.questions.slice(0, 3).map((q) => str(q, 200).trim()).filter(Boolean) : [],
        }
      : null
  return { lang, mode, question, notes, decidedBy, prep, result: { level: r.level, emergency: !!r.emergency, step: str(r.step, 200), flags } }
}

function userMessage({ mode, question, notes = [], decidedBy = 'rules', prep, result }) {
  const lines = [
    `Suggested next step (decided by ${DECIDED[decidedBy] ?? DECIDED.rules}): ${result.step}`,
    `Emergency: ${result.emergency ? 'YES' : 'no'}`,
    'Findings:',
    ...(result.flags.length
      ? result.flags.map((f) => `- ${f.info ? '(for information only) ' : ''}${f.title}: ${f.why} What to do: ${f.action}`)
      : ['- No risk signals were found.']),
    '',
  ]
  if (mode === 'ask' && notes.length) {
    lines.push(
      'Reviewed notes:',
      ...notes.map((n, i) => `[${i + 1}] ${n.q} ${n.a}`),
      '',
      `The user asks: """${question}"""`,
      'Answer only from the reviewed notes, citing them like [1]. If they do not answer the question, reply with exactly NO_NOTE.',
    )
  } else if (mode === 'ask') {
    lines.push(`The user asks: """${question}"""`, 'Answer the question in the context of this result.')
  } else if (mode === 'prep') {
    lines.push(`Visit: ${prep?.visit || 'the suggested next step above'}`)
    if (prep?.questions.length) lines.push('The person wants to ask:', ...prep.questions.map((q) => `- """${q}"""`))
    lines.push('', 'Write the visit preparation.')
  } else {
    lines.push('Explain this result to the person simply: what it means, why the next step makes sense, and one or two practical things they can do now.')
  }
  return lines.join('\n')
}

/** Grounded answers: the model may use only the numbered notes, and must cite them. */
const GROUNDED = (lang) => `${SYSTEM(lang)}
For this question you are given numbered reviewed notes, written by the team from clinical guidelines.
- Use only the reviewed notes and the findings. Do not add other medical facts, numbers or advice.
- After each sentence that uses a note, put its number in square brackets, like [1] or [2].
- If the notes do not answer the question, reply with exactly NO_NOTE and nothing else.`

/** Visit preparation: what to say first and what to ask. Fixed JSON shape, checked by code. */
const PREP = (lang) => `You help a man prepare for a health visit booked through "Wiqaya", a men's reproductive and preventive health app in Abu Dhabi, UAE.
You receive his next step, which fixed clinical rules or his clinician have ALREADY decided, the findings, the type of visit, and sometimes his own questions.
Return JSON with:
- "opening": what he can say in the first minute, in the first person ("I am here because ..."), at most 60 words, using only the findings given.
- "questions": 3 to 5 short questions to ask the clinician, specific to the findings, the step and the visit type. Put his own questions first, rephrased clearly.
Rules: never diagnose or say what he has. Never suggest that the step is unnecessary or could wait. No medicine names or doses. Tests or treatments may appear only as questions ("Should I repeat the semen analysis?"). Do not assume marital status or family plans beyond what the findings say. No blame. Plain words.
Write both in ${lang === 'ar' ? 'simple Modern Standard Arabic' : 'plain English'}.`

const PREP_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['opening', 'questions'],
  properties: { opening: { type: 'string' }, questions: { type: 'array', items: { type: 'string' } } },
}

const NO_NOTE = {
  en: 'Our notes don’t cover that question yet, so I can’t answer it reliably. Your family doctor can help, and you can add the question to your visit notes.',
  ar: 'لا تغطي ملاحظاتنا هذا السؤال بعد، لذا لا أستطيع الإجابة عنه بشكل موثوق. يستطيع طبيب الأسرة مساعدتك، ويمكنك إضافة السؤال إلى ملاحظات زيارتك.',
}

/** Checks a grounded answer: it must cite at least one note it was given. Unknown note numbers are removed. */
export function checkGrounded(text, notes) {
  if (/\bNO_NOTE\b/.test(text)) return { noNote: true }
  const inRange = (d) => Number(d) >= 1 && Number(d) <= notes.length
  const cited = [...new Set([...text.matchAll(/\[(\d{1,2})\]/g)].map((m) => m[1]).filter(inRange).map(Number))]
  if (!cited.length) return { noNote: true, uncited: true }
  const clean = text.replace(/\s?\[(\d{1,2})\]/g, (m, d) => (inRange(d) ? m : '')).trim()
  return { text: clean, cited: cited.sort((a, b) => a - b).map((n) => notes[n - 1].id) }
}

/** Checks a visit preparation item by item: anything that breaks the output rules is dropped. */
export function checkPrep(raw) {
  if (!raw || typeof raw !== 'object') return null
  let dropped = 0
  let opening = str(raw.opening, 600).trim()
  if (opening && violates(opening)) {
    opening = ''
    dropped++
  }
  const all = Array.isArray(raw.questions) ? raw.questions.slice(0, 5).map((q) => str(q, 240).trim()).filter(Boolean) : []
  const questions = all.filter((q) => !violates(q))
  dropped += all.length - questions.length
  if (!opening && !questions.length) return null
  return { opening, questions, guardrail: dropped ? 'trimmed' : 'pass' }
}

const vertexConfigured = () => !!(process.env.GCP_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS)
const provider = () =>
  process.env.OPENAI_API_KEY
    ? 'openai'
    : vertexConfigured()
      ? 'vertex'
      : process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_DEPLOYMENT && process.env.AZURE_OPENAI_API_KEY
        ? 'azure'
        : null

/** True when an AI provider is configured. Shared with the report reader (report.mjs). */
export const aiConfigured = () => provider() !== null

const vertexModel = () => process.env.VERTEX_MODEL || 'google/gemini-3-flash-preview'

/** The model in use, as reported on the Evidence page ("openai:gpt-4.1", "azure:<deployment>", "vertex:google/gemini-3-flash-preview"). */
export const modelName = () => {
  const p = provider()
  return p === 'openai' ? `openai:${process.env.OPENAI_MODEL || 'gpt-4.1'}` : p === 'azure' ? `azure:${process.env.AZURE_OPENAI_DEPLOYMENT}` : p === 'vertex' ? `vertex:${vertexModel()}` : 'none'
}

/**
 * Vertex AI signs in with a Google service-account key: the key signs a short JWT, which Google exchanges for a
 * one-hour access token. The token is cached in memory and renewed five minutes before it expires.
 */
let vertexToken = { value: '', exp: 0 }
let vertexAccount = null
function serviceAccount() {
  if (vertexAccount) return vertexAccount
  const raw = process.env.GCP_SERVICE_ACCOUNT_JSON || readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8')
  vertexAccount = JSON.parse(raw)
  return vertexAccount
}
async function vertexAccessToken() {
  if (vertexToken.value && Date.now() < vertexToken.exp - 5 * 60_000) return vertexToken.value
  const sa = serviceAccount()
  const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  const tokenUri = sa.token_uri || 'https://oauth2.googleapis.com/token'
  const unsigned = `${b64u({ alg: 'RS256', typ: 'JWT' })}.${b64u({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/cloud-platform', aud: tokenUri, iat: now, exp: now + 3600 })}`
  const assertion = `${unsigned}.${createSign('RSA-SHA256').update(unsigned).sign(sa.private_key, 'base64url')}`
  const res = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  })
  const data = await res.json()
  if (!res.ok || !data.access_token) throw new Error('vertex_auth')
  vertexToken = { value: data.access_token, exp: Date.now() + (data.expires_in || 3600) * 1000 }
  return vertexToken.value
}

/** Where a chat-completions request goes, and how it is authenticated. */
async function target() {
  if (provider() === 'vertex') {
    const project = process.env.GOOGLE_CLOUD_PROJECT || serviceAccount().project_id
    const location = process.env.GOOGLE_CLOUD_LOCATION || 'global'
    const host = location === 'global' ? 'aiplatform.googleapis.com' : `${location}-aiplatform.googleapis.com`
    return {
      url: `https://${host}/v1/projects/${encodeURIComponent(project)}/locations/${encodeURIComponent(location)}/endpoints/openapi/chat/completions`,
      headers: { authorization: `Bearer ${await vertexAccessToken()}` },
      model: vertexModel(),
    }
  }
  if (provider() === 'openai') {
    const base = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '')
    return { url: `${base}/chat/completions`, headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, model: process.env.OPENAI_MODEL || 'gpt-4.1' }
  }
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT.replace(/\/+$/, '')
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT
  const version = process.env.AZURE_OPENAI_API_VERSION || '2024-10-21'
  return version === 'v1'
    ? { url: `${endpoint}/openai/v1/chat/completions`, headers: { 'api-key': process.env.AZURE_OPENAI_API_KEY }, model: deployment }
    : {
        url: `${endpoint}/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=${encodeURIComponent(version)}`,
        headers: { 'api-key': process.env.AZURE_OPENAI_API_KEY },
        model: null,
      }
}

/** `extra` is merged into the request (e.g. response_format for the report reader). */
export async function callModel(messages, extra = {}, timeoutMs = 20_000) {
  let url, headers, model
  try {
    ;({ url, headers, model } = await target())
  } catch {
    // The service-account key could not be read or exchanged for a token.
    return { ok: false, status: 502 }
  }
  // Gemini 3 always thinks before answering, and the thinking counts against max_completion_tokens: keep it low
  // and give it its own headroom, or answers are cut off mid-sentence and JSON arrives incomplete.
  const vertex = provider() === 'vertex'
  const effort = process.env.AI_REASONING_EFFORT || process.env.AZURE_OPENAI_REASONING_EFFORT || (vertex ? 'low' : '')
  const send = async (withTemperature) => {
    // Generous cap: reasoning models spend part of it thinking. The prompt keeps the visible answer short.
    const payload = { messages, max_completion_tokens: 1500, ...extra }
    if (vertex) payload.max_completion_tokens += 2000
    if (model) payload.model = model
    if (effort) payload.reasoning_effort = effort
    if (effort || !withTemperature) delete payload.temperature
    else payload.temperature ??= 0.2
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), timeoutMs)
    try {
      return await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify(payload),
        signal: ctl.signal,
      })
    } finally {
      clearTimeout(timer)
    }
  }

  try {
    let res = await send(true)
    if (res.status === 400) {
      const text = await res.text()
      // A content filter can trip on medical sexual-health words: answer with the safe fallback, not an error.
      if (/content_filter|ResponsibleAIPolicyViolation/i.test(text)) return { ok: false, status: 400, filtered: true }
      // Some newer (reasoning) models reject a custom temperature: retry without it.
      if (/temperature/i.test(text)) res = await send(false)
      else return { ok: false, status: 400 }
    }
    if (!res.ok) return { ok: false, status: res.status }
    const data = await res.json()
    const choice = data?.choices?.[0]
    if (choice?.finish_reason === 'content_filter') return { ok: false, status: 200, filtered: true }
    const text = choice?.message?.content
    return typeof text === 'string' && text.trim() ? { ok: true, text: text.trim() } : { ok: false, status: 502 }
  } catch {
    // The model did not answer in time, or the network failed: report it as an upstream problem, never crash.
    return { ok: false, status: 504 }
  }
}

export async function handler(event) {
  const started = Date.now()
  const method = event.requestContext?.http?.method || event.httpMethod || 'GET'
  if (method === 'OPTIONS') return resp(204, '')
  if (method !== 'POST') return resp(405, { error: 'method_not_allowed' })

  const secret = process.env.ORIGIN_SECRET
  if (secret && header(event, 'x-origin-secret') !== secret) return resp(403, { error: 'forbidden' })

  if (!aiConfigured()) return resp(503, { error: 'ai_not_configured' })

  const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : event.body || ''
  if (raw.length > MAX_BODY) return resp(413, { error: 'too_large' })

  const ip = header(event, 'x-forwarded-for')?.split(',')[0]?.trim() || event.requestContext?.http?.sourceIp || 'unknown'
  if (rateLimited(ip)) return resp(429, { error: 'rate_limited' })

  let body
  try {
    body = JSON.parse(raw || '{}')
  } catch {
    return resp(400, { error: 'bad_json' })
  }
  const req = validate(body)
  if (!req) return resp(400, { error: 'bad_request' })

  // Input guardrail: an emergency in the question is answered by fixed text, never by the model.
  if (req.mode === 'ask' && EMERGENCY_RE.some((r) => r.test(req.question))) {
    return resp(200, { emergency: true, text: EMERGENCY_LINE[req.lang] })
  }

  // Visit preparation for an emergency makes no sense: the only preparation is to go now.
  if (req.mode === 'prep' && req.result.emergency) return resp(200, { emergency: true, text: EMERGENCY_LINE[req.lang] })

  if (req.mode === 'prep') {
    const out = await callModel(
      [
        { role: 'system', content: PREP(req.lang) },
        { role: 'user', content: userMessage(req) },
      ],
      { max_completion_tokens: 700, response_format: { type: 'json_schema', json_schema: { name: 'visit_preparation', strict: true, schema: PREP_SCHEMA } } },
    )
    if (!out.ok) {
      console.log(JSON.stringify({ evt: 'ai_error', mode: 'prep', status: out.status, filtered: !!out.filtered, ms: Date.now() - started }))
      // Filtered or failed: the app shows its fixed preparation instead.
      return out.filtered ? resp(200, { guardrail: 'filtered' }) : resp(502, { error: 'upstream' })
    }
    let checked = null
    try {
      checked = checkPrep(JSON.parse(out.text))
    } catch {
      /* not JSON */
    }
    console.log(JSON.stringify({ evt: 'ai_ok', mode: 'prep', lang: req.lang, level: req.result.level, guardrail: checked?.guardrail ?? 'blocked', ms: Date.now() - started }))
    return resp(200, checked ?? { guardrail: 'blocked' })
  }

  const isGrounded = req.mode === 'ask' && req.notes.length > 0
  const out = await callModel([
    { role: 'system', content: isGrounded ? GROUNDED(req.lang) : SYSTEM(req.lang) },
    { role: 'user', content: userMessage(req) },
  ])
  if (!out.ok && out.filtered) {
    console.log(JSON.stringify({ evt: 'ai_filtered', mode: req.mode, ms: Date.now() - started }))
    const text = req.result.emergency ? `${EMERGENCY_LINE[req.lang]}\n\n${SAFE_FALLBACK[req.lang]}` : SAFE_FALLBACK[req.lang]
    return resp(200, { text, guardrail: 'filtered' })
  }
  if (!out.ok) {
    console.log(JSON.stringify({ evt: 'ai_error', status: out.status, ms: Date.now() - started }))
    return resp(502, { error: 'upstream' })
  }

  let text = out.text
  let guardrail = 'pass'
  let cited
  if (isGrounded) {
    const g = checkGrounded(text, req.notes)
    if (g.noNote) {
      text = NO_NOTE[req.lang]
      guardrail = g.uncited ? 'uncited' : 'no_note'
      cited = []
    } else {
      text = g.text
      cited = g.cited
    }
  }
  if (violates(text)) {
    text = SAFE_FALLBACK[req.lang]
    guardrail = 'blocked'
    cited = isGrounded ? [] : undefined
  }
  if (req.result.emergency && !text.includes('998')) {
    text = `${EMERGENCY_LINE[req.lang]}\n\n${text}`
    guardrail = guardrail === 'pass' ? 'emergency_prefixed' : guardrail
  }
  console.log(JSON.stringify({ evt: 'ai_ok', mode: req.mode, grounded: isGrounded, lang: req.lang, level: req.result.level, guardrail, ms: Date.now() - started }))
  return resp(200, cited ? { text, guardrail, cited } : { text, guardrail })
}

/** Older name, kept so existing imports keep working. */
export const callAzure = callModel

// Exposed for tests.
export const _internal = { validate, userMessage, violates, checkGrounded, checkPrep, EMERGENCY_RE, NO_NOTE }
