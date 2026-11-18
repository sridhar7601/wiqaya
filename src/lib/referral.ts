import { assess } from './engine'
import { QUESTION_BY_ID, optionLabel, visibleQuestions } from './questions'
import type { Question } from './questions'
import { nextSteps } from './services'
import type { Booking, OrderKind } from './companion/journey'
import { LAB_KINDS, SOURCE_LABEL } from './companion/labs'
import type { LabKind, LabSource } from './companion/labs'
import { rid } from './storage'
import type { Answers, L10n, Level } from './types'

export interface ShareOptions {
  includeAnswers: boolean
  includeSemen: boolean
  includeDeclined: boolean
  firstName: string
}

export interface SharedFlag {
  id: string
  level: Level | 'info'
  title: L10n
  because: L10n[]
  action: L10n
  sources: string[]
}

/** What a clinician receives. Built only from what the person chose to share. */
export interface ReferralSummary {
  id: string
  createdAt: string
  origin: 'device' | 'synthetic'
  pseudoId: string
  firstName?: string
  age?: number
  level: Level
  emergency: boolean
  step: L10n
  flags: SharedFlag[]
  dataIssues: L10n[]
  answers?: { q: L10n; a: L10n }[]
  semen?: { label: L10n; value: string }[]
  declined?: L10n[]
  /** Results over time, only those the person ticked. */
  labs?: SharedLab[]
  /** Work exposures, only if the person chose to include them. */
  exposures?: L10n[]
  request?: ShareRequest
  engineVersion: string
}

/** A clinician's decision on a shared summary: confirm the suggested step, or change it with a reason. */
export interface Review {
  decision: 'agree' | 'change'
  level: Level
  /** Required when the step is changed; an optional note to the patient otherwise. */
  reason: string
  at: string
  reviewer: string
  /** An appointment the clinician offers; the person accepts it on their phone. */
  offer?: Booking
  /** Tests the clinician asks for, which become steps in the person's care journey. */
  orders?: { kind: OrderKind; inWeeks: number }[]
}

/** A lab result the person chose to include, in the shared summary. */
export interface SharedLab {
  kind: LabKind
  date: string
  values: Record<string, number>
  source: LabSource
}

/** What the person asks for when sharing: a review, or a teleconsultation at preferred times. */
export interface ShareRequest {
  purpose: 'review' | 'teleconsult'
  providerId?: string
  providerName?: L10n
  prefer?: ('weekday_morning' | 'weekday_evening' | 'weekend')[]
  note?: string
}

const join = (parts: L10n[]): L10n => ({ en: parts.map((p) => p.en).join(', '), ar: parts.map((p) => p.ar).join('، ') })

export function answerText(q: Question, a: Answers): L10n | null {
  if (q.type === 'single') {
    const v = a[q.id]
    return typeof v === 'string' ? optionLabel(q.id, v) : null
  }
  if (q.type === 'multi') {
    const v = a[q.id]
    return Array.isArray(v) && v.length ? join(v.map((x) => optionLabel(q.id, x))) : null
  }
  const parts: L10n[] = []
  for (const f of q.fields ?? []) {
    const v = a[f.id]
    if (v === undefined || v === '') continue
    parts.push({ en: `${f.label.en}: ${v} ${f.unit.en}`, ar: `${f.label.ar}: ${v} ${f.unit.ar}` })
  }
  return parts.length ? join(parts) : null
}

const isDeclined = (a: Answers, id: string) => {
  const v = a[id]
  return v === 'prefer_not' || (Array.isArray(v) && v.includes('prefer_not'))
}

export function buildSummary(
  a: Answers,
  opts: ShareOptions,
  origin: ReferralSummary['origin'] = 'device',
  fixed?: { id?: string; pseudoId?: string; createdAt?: string },
): ReferralSummary {
  const as = assess(a)
  const { main } = nextSteps(as)
  const age = typeof a.age === 'number' ? a.age : undefined
  const qs = visibleQuestions(a).filter((q) => q.id !== 'semen')

  const answers = opts.includeAnswers
    ? qs
        .filter((q) => !isDeclined(a, q.id))
        .map((q) => {
          const text = answerText(q, a)
          return text ? { q: q.text, a: text } : null
        })
        .filter((x): x is { q: L10n; a: L10n } => x !== null)
    : undefined

  const semenQ = QUESTION_BY_ID.semen
  const semen =
    opts.includeSemen && a.semen_done === 'yes'
      ? (semenQ.fields ?? [])
          .filter((f) => a[f.id] !== undefined && a[f.id] !== '')
          .map((f) => ({ label: f.label, value: `${a[f.id]} ${f.unit.en}` }))
      : undefined

  return {
    id: fixed?.id ?? rid('ref-'),
    createdAt: fixed?.createdAt ?? new Date().toISOString(),
    origin,
    pseudoId: fixed?.pseudoId ?? `WQ-${rid().slice(0, 6).toUpperCase()}`,
    firstName: opts.firstName.trim() || undefined,
    age,
    level: as.level,
    emergency: as.emergency,
    step: main.title,
    flags: as.flags.map((f) => ({ id: f.id, level: f.level, title: f.title, because: f.because, action: f.action, sources: f.sources })),
    dataIssues: as.dataIssues.map((d) => d.message),
    answers,
    semen: semen?.length ? semen : undefined,
    declined: opts.includeDeclined ? as.declined.map((id) => QUESTION_BY_ID[id].text) : undefined,
    engineVersion: as.engineVersion,
  }
}

/** FHIR R4 collection bundle: what would travel to a family doctor through Malaffi in a pilot. */
export function toFhir(s: ReferralSummary): Record<string, unknown> {
  const pid = `urn:uuid:${s.id}-patient`
  const priority = s.emergency ? 'stat' : s.level === 'urgent' ? 'urgent' : 'routine'
  const entry: Record<string, unknown>[] = [
    {
      fullUrl: pid,
      resource: {
        resourceType: 'Patient',
        identifier: [{ system: 'urn:wiqaya:pseudonym', value: s.pseudoId }],
        ...(s.firstName ? { name: [{ given: [s.firstName] }] } : {}),
        gender: 'male',
      },
    },
    {
      fullUrl: `urn:uuid:${s.id}-consent`,
      resource: {
        resourceType: 'Consent',
        status: 'active',
        scope: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/consentscope', code: 'patient-privacy' }] },
        category: [{ text: 'Person chose to share this screening summary with a clinician' }],
        patient: { reference: pid },
        dateTime: s.createdAt,
        provision: { type: 'permit' },
      },
    },
    {
      fullUrl: `urn:uuid:${s.id}-risk`,
      resource: {
        resourceType: 'RiskAssessment',
        status: 'final',
        subject: { reference: pid },
        occurrenceDateTime: s.createdAt,
        method: { text: `Wiqaya deterministic screening rules ${s.engineVersion}` },
        prediction: [{ outcome: { text: `Suggested next step: ${s.step.en}` }, qualitativeRisk: { text: s.level } }],
        note: [
          { text: 'Screening result, not a diagnosis. Requires clinician review.' },
          ...s.flags.map((f) => ({ text: `${f.title.en}. ${f.because.map((b) => b.en).join('; ')}` })),
        ],
      },
    },
    {
      fullUrl: `urn:uuid:${s.id}-request`,
      resource: {
        resourceType: 'ServiceRequest',
        status: 'draft',
        intent: 'proposal',
        priority,
        subject: { reference: pid },
        code: { text: s.step.en },
        reasonCode: s.flags.filter((f) => f.level !== 'info').map((f) => ({ text: f.title.en })),
        authoredOn: s.createdAt,
      },
    },
  ]
  if (s.age !== undefined) {
    entry.push({
      fullUrl: `urn:uuid:${s.id}-age`,
      resource: { resourceType: 'Observation', status: 'final', code: { text: 'Age' }, subject: { reference: pid }, valueQuantity: { value: s.age, unit: 'a' } },
    })
  }
  for (const [i, v] of (s.semen ?? []).entries()) {
    entry.push({
      fullUrl: `urn:uuid:${s.id}-semen-${i}`,
      resource: { resourceType: 'Observation', status: 'final', code: { text: `Semen analysis: ${v.label.en}` }, subject: { reference: pid }, valueString: v.value },
    })
  }
  // Results over time, coded with LOINC where a code exists. A home estimate is never coded as a lab result.
  for (const [i, l] of (s.labs ?? []).entries()) {
    const info = LAB_KINDS[l.kind]
    const base = { resourceType: 'Observation', status: 'final', subject: { reference: pid }, effectiveDateTime: l.date, note: [{ text: `Source: ${SOURCE_LABEL[l.source].en}` }] }
    if (l.kind === 'bp') {
      entry.push({
        fullUrl: `urn:uuid:${s.id}-lab-${i}`,
        resource: {
          ...base,
          category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'vital-signs' }] }],
          code: { coding: [{ system: 'http://loinc.org', code: '85354-9', display: 'Blood pressure panel' }] },
          component: info.fields
            .filter((f) => l.values[f.id] !== undefined)
            .map((f) => ({ code: { coding: [{ system: 'http://loinc.org', code: f.loinc, display: f.label.en }] }, valueQuantity: { value: l.values[f.id], unit: 'mmHg', system: 'http://unitsofmeasure.org', code: 'mm[Hg]' } })),
        },
      })
      continue
    }
    for (const f of info.fields) {
      const v = l.values[f.id]
      if (v === undefined) continue
      const home = l.kind === 'lens'
      entry.push({
        fullUrl: `urn:uuid:${s.id}-lab-${i}-${f.id}`,
        resource: {
          ...base,
          status: home ? 'preliminary' : 'final',
          category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: home ? 'survey' : l.kind === 'weight' ? 'vital-signs' : 'laboratory' }] }],
          code: !home && f.loinc ? { coding: [{ system: 'http://loinc.org', code: f.loinc, display: f.label.en }] } : { text: `${f.label.en} (home estimate from a phone video, not a lab result)` },
          valueQuantity: { value: v, unit: f.unit.en },
          ...(home ? { method: { text: 'Wiqaya Lens smartphone video estimate (research prototype)' } } : {}),
        },
      })
    }
  }
  if (s.answers?.length) {
    entry.push({
      fullUrl: `urn:uuid:${s.id}-qr`,
      resource: {
        resourceType: 'QuestionnaireResponse',
        status: 'completed',
        subject: { reference: pid },
        authored: s.createdAt,
        item: s.answers.map((x, i) => ({ linkId: String(i + 1), text: x.q.en, answer: [{ valueString: x.a.en }] })),
      },
    })
  }
  // Purpose of use travels with the data: treatment only (HL7 v3 ActReason TREAT), so receiving systems can refuse other uses.
  return { resourceType: 'Bundle', type: 'collection', timestamp: s.createdAt, meta: { security: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ActReason', code: 'TREAT', display: 'treatment' }] }, entry }
}

export function summaryText(s: ReferralSummary, lang: 'en' | 'ar'): string {
  const L = (x: L10n) => x[lang]
  const lines: string[] = []
  lines.push(lang === 'ar' ? 'ملخص فحص الصحة الإنجابية (فحص أولي وليس تشخيصاً)' : 'Reproductive health screening summary (screening, not a diagnosis)')
  lines.push(lang === 'ar' ? 'للرعاية فقط: لا يُستخدم للتوظيف أو التأمين أو أي قرار آخر.' : 'For care only: not for employment, insurance or any other decision.')
  lines.push(`${lang === 'ar' ? 'المعرّف' : 'ID'}: ${s.pseudoId}${s.firstName ? ` (${s.firstName})` : ''}${s.age ? ` · ${s.age}` : ''}`)
  lines.push(`${lang === 'ar' ? 'الخطوة المقترحة' : 'Suggested next step'}: ${L(s.step)}`)
  for (const f of s.flags) lines.push(`• ${L(f.title)}: ${f.because.map(L).join('; ')}`)
  if (s.semen?.length) lines.push(...s.semen.map((v) => `  ${L(v.label)}: ${v.value}`))
  if (s.answers?.length) lines.push('', ...s.answers.map((x) => `${L(x.q)} ${L(x.a)}`))
  lines.push('', `${s.engineVersion} · ${new Date(s.createdAt).toLocaleString()}`)
  return lines.join('\n')
}
