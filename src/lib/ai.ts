import type { CareFilter } from './companion/directory'
import { retrieve } from './notes'
import type { Note } from './notes'
import { nextSteps, stepFor } from './services'
import type { Assessment, FiredFlag, Lang, Level, Sex } from './types'

/**
 * The AI helper only rewrites the rule-based result in plain words or answers a general question.
 * It receives the result summary (flag titles and actions), never the person's answers or identity,
 * and it cannot change the next step.
 */
const ENDPOINT = (import.meta.env.VITE_AI_URL as string | undefined) || '/api/explain'

/** The AI service named in every consent text. One place to change if the provider changes. */
export const AI_PROVIDER = 'Microsoft Azure OpenAI'

export type AiProblem = 'unavailable' | 'error' | 'emergency' | 'no_note'

/**
 * `notes` are the reviewed notes sent with a question, in order, so that [1] in the text is notes[0].
 * `cited` are the ids of the notes the answer actually used.
 */
export type AiResult = { ok: true; text: string; notes?: Note[]; cited?: string[] } | { ok: false; reason: AiProblem }

/** What the AI is told about a result: titles and fixed rule texts, never the person's answers. */
export interface AiBasis {
  level: Level
  emergency: boolean
  step: string
  flags: { title: string; why: string; action: string; info: boolean }[]
  decidedBy?: 'rules' | 'clinician' | 'red_flag'
}

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

export function looksUrgent(text: string): boolean {
  return EMERGENCY_RE.some((r) => r.test(text))
}

const flagsOf = (flags: FiredFlag[], lang: Lang) => flags.map((f) => ({ title: f.title[lang], why: f.why[lang], action: f.action[lang], info: f.level === 'info' }))

export function resultPayload(as: Assessment, lang: Lang): AiBasis {
  const { main } = nextSteps(as)
  return { level: as.level, emergency: as.emergency, step: main.title[lang], flags: flagsOf(as.flags, lang) }
}

/** The same summary for the 90-day plan: the current step, all findings (trends and work included) and who decided. */
export function planPayload(v: { level: Level; emergency: boolean; flags: FiredFlag[]; decidedBy: AiBasis['decidedBy']; base?: { sex: Sex } }, lang: Lang): AiBasis {
  const step = stepFor(v.emergency ? 'emergency' : v.level, v.base?.sex)
  return { level: v.level, emergency: v.emergency, step: step.title[lang], flags: flagsOf(v.flags, lang), decidedBy: v.decidedBy }
}

type Posted = { status: number; data: Record<string, unknown> } | null

async function post(body: unknown, timeoutMs = 25000): Promise<Posted> {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal })
    const data = res.ok ? ((await res.json()) as Record<string, unknown>) : {}
    return { status: res.status, data }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

// 503 = not configured, 404 = no server, 429 = the rate limit or daily cap that protects the AI budget,
// 502/504 = the AI service itself did not answer
const unavailable = (p: Posted) => !p || [404, 429, 502, 503, 504].includes(p.status)

/** Plain-words explanation of a result or plan. */
export async function explainAi(basis: AiBasis, lang: Lang): Promise<AiResult> {
  const p = await post({ lang, mode: 'explain', result: basis, decidedBy: basis.decidedBy })
  if (unavailable(p)) return { ok: false, reason: 'unavailable' }
  if (p!.status !== 200) return { ok: false, reason: 'error' }
  const text = p!.data.text
  return typeof text === 'string' && text ? { ok: true, text } : { ok: false, reason: 'error' }
}

/**
 * A question, answered only from the reviewed notes that match it (chosen here, on the phone). With no
 * matching note the AI is not called at all, and the person is told there is no reviewed answer yet.
 */
export async function askGrounded(basis: AiBasis, lang: Lang, question: string, sex: Sex = 'male'): Promise<AiResult> {
  if (looksUrgent(question)) return { ok: false, reason: 'emergency' }
  const notes = retrieve(question, 3, sex)
  if (!notes.length) return { ok: false, reason: 'no_note' }
  const p = await post({
    lang,
    mode: 'ask',
    question: question.slice(0, 400),
    notes: notes.map((n) => ({ id: n.id, q: n.q[lang], a: n.a[lang] })),
    result: basis,
    decidedBy: basis.decidedBy,
  })
  if (unavailable(p)) return { ok: false, reason: 'unavailable' }
  if (p!.status !== 200) return { ok: false, reason: 'error' }
  const d = p!.data as { text?: string; emergency?: boolean; cited?: string[]; guardrail?: string }
  if (d.emergency) return { ok: false, reason: 'emergency' }
  if (d.guardrail === 'no_note' || d.guardrail === 'uncited') return { ok: false, reason: 'no_note' }
  return d.text ? { ok: true, text: d.text, notes, cited: d.cited ?? [] } : { ok: false, reason: 'error' }
}

export async function askAi(as: Assessment, lang: Lang, mode: 'explain' | 'ask', question?: string): Promise<AiResult> {
  const basis = resultPayload(as, lang)
  return mode === 'ask' ? askGrounded(basis, lang, question ?? '', as.sex) : explainAi(basis, lang)
}

export type PrepResult = { ok: true; opening: string; questions: string[] } | { ok: false; reason: AiProblem }

/** Visit preparation: what to say first and what to ask. The app has a fixed version that works without it. */
export async function prepVisit(basis: AiBasis, lang: Lang, visit: string, questions: string[]): Promise<PrepResult> {
  if (basis.emergency) return { ok: false, reason: 'emergency' }
  const p = await post({ lang, mode: 'prep', visit: visit.slice(0, 120), questions: questions.slice(0, 3).map((q) => q.slice(0, 200)), result: basis, decidedBy: basis.decidedBy })
  if (unavailable(p)) return { ok: false, reason: 'unavailable' }
  if (p!.status !== 200) return { ok: false, reason: 'error' }
  const d = p!.data as { opening?: string; questions?: string[]; emergency?: boolean }
  if (d.emergency) return { ok: false, reason: 'emergency' }
  const qs = Array.isArray(d.questions) ? d.questions.filter((q) => typeof q === 'string' && q) : []
  if (!d.opening && !qs.length) return { ok: false, reason: 'error' }
  return { ok: true, opening: typeof d.opening === 'string' ? d.opening : '', questions: qs }
}

const NAV_ENDPOINT = (import.meta.env.VITE_NAV_URL as string | undefined) || '/api/navigate'

/** What the care search understood. `symptom` means the words describe a complaint, not just a preference. */
export type SearchResult = { emergency: true } | { emergency?: false; filter: CareFilter; symptom: boolean } | null

/**
 * AI care search: the AI only turns the person's words into directory filters (area, language, male
 * clinician, video, evenings, weekends, insurance). It never sees a result and cannot choose a care level.
 * Returns null when the AI is off or unsure, and the app then uses the fixed word lists instead.
 */
export async function aiSearch(text: string): Promise<SearchResult> {
  if (looksUrgent(text)) return { emergency: true }
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), 12000)
  try {
    const res = await fetch(NAV_ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: text.slice(0, 200) }), signal: ctl.signal })
    if (!res.ok) return null
    const data = (await res.json()) as { filter?: CareFilter | null; symptom?: boolean; emergency?: boolean }
    if (data.emergency) return { emergency: true }
    return data.filter ? { filter: data.filter, symptom: !!data.symptom } : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
