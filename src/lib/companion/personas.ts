import type { Review } from '../referral'
import type { Answers, L10n } from '../types'
import type { CheckIn } from './checkins'
import type { ConsentEvent } from './consents'
import { CONSENT_TEXT_VERSION } from './consents'
import type { Day } from './dates'
import { addDays, weekStart } from './dates'
import { PROVIDERS } from './directory'
import type { WorkProfile } from './exposures'
import type { JourneyStep } from './journey'
import { ruleStep } from './journey'
import type { LabEntry, LabKind, LabSource } from './labs'
import type { DailySignal } from './trends'

/**
 * Example people for judges and testers. Every value is invented. Dates are relative to today, so the
 * story always looks current. Opening an example never touches the person's own data (see storage.ts).
 */
export type PersonaId = 'omar' | 'yousef' | 'mariam' | 'fatima'
export const PERSONA_IDS: PersonaId[] = ['omar', 'yousef', 'mariam', 'fatima']

export interface Persona {
  id: PersonaId
  name: L10n
  summary: L10n
}

export const PERSONAS: Persona[] = [
  {
    id: 'omar',
    name: { en: 'Omar, 34', ar: 'عمر، 34' },
    summary: {
      en: 'Site engineer, works outdoors. Trying for a child for over a year. Five months on the plan: one low lab result, cooler work habits, quit shisha, a better repeat test.',
      ar: 'مهندس موقع يعمل في الخارج، يحاول الإنجاب منذ أكثر من عام. خمسة أشهر على الخطة: نتيجة مخبرية منخفضة، وعادات عمل أكثر برودة، وترك الشيشة، وتحليل متكرر أفضل.',
    },
  },
  {
    id: 'yousef',
    name: { en: 'Yousef, 45', ar: 'يوسف، 45' },
    summary: {
      en: 'Office worker in Al Ain, not planning children. Came for erection worries; the check found high blood pressure and raised sugar. Now in primary care, with a doctor’s appointment offered.',
      ar: 'موظف مكتبي في العين، لا يخطط للإنجاب. جاء بسبب مخاوف الانتصاب، فوجد الفحص ضغط دم مرتفعاً وسكراً أعلى من المعتاد. يتابع الآن مع الرعاية الأولية، مع موعد مقترح من الطبيب.',
    },
  },
  {
    id: 'mariam',
    name: { en: 'Mariam, 31', ar: 'مريم، 31' },
    summary: {
      en: 'Marketing manager in Abu Dhabi. Would like children in 3–5 years; irregular periods, and her mother’s menopause came early. Eight months of cycle tracking, a family-doctor visit that found PCOS, and a counselling call about timing offered.',
      ar: 'مديرة تسويق في أبوظبي، ترغب في الإنجاب خلال 3 إلى 5 سنوات. دورتها غير منتظمة، وانقطع الطمث مبكراً لدى والدتها. ثمانية أشهر من تتبع الدورة، وزيارة لطبيب الأسرة كشفت تكيّس المبايض، وعرض لجلسة استشارة حول التوقيت.',
    },
  },
  {
    id: 'fatima',
    name: { en: 'Fatima, 38', ar: 'فاطمة، 38' },
    summary: {
      en: 'Teacher in Al Ain, trying for 7 months. At 38 that is the point to be assessed, not to wait a year. The check said so on day one; a couple fertility assessment is booked 25 days later, and her husband was invited to do his own check.',
      ar: 'معلمة في العين تحاول الإنجاب منذ 7 أشهر. في سن 38 هذا هو وقت التقييم وليس انتظار عام كامل. قال الفحص ذلك منذ اليوم الأول، وحُجز تقييم خصوبة للزوجين بعد 25 يوماً، ودُعي زوجها لإجراء فحصه الخاص.',
    },
  },
]

/** Small deterministic random numbers, so an example looks the same every time it opens. */
function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const iso = (day: Day, hhmm = '10:00') => `${day}T${hhmm}:00.000Z`
const lab = (kind: LabKind, date: Day, values: Record<string, number>, source: LabSource, n: number): LabEntry => ({ id: `ex-lab-${n}`, kind, date, values, source, addedAt: iso(date) })
const lerp = (a: number, b: number, p: number) => a + (b - a) * Math.min(1, Math.max(0, p))
const round1 = (n: number) => Math.round(n * 10) / 10
const provider = (id: string) => PROVIDERS.find((p) => p.id === id)?.name

function omar(T: Day): Record<string, unknown> {
  const d = (n: number) => addDays(T, n)
  const start = d(-150)
  const answers: Answers = {
    age: 34,
    urgent_symptoms: ['none'],
    height_cm: 176,
    weight_kg: 98,
    ttc: 'yes',
    ttc_months: 'gt12',
    partner_age: 'under35',
    anat: ['none'],
    mumps: 'no',
    sti_now: 'no',
    sti_past: 'no',
    conditions: ['none'],
    meds: ['none'],
    sexual: ['none'],
    tobacco: 'daily',
    heat: ['outdoor_heat'],
    activity: '0to1',
    sleep: 'lt6',
    last_check: 'gt3y',
    semen_done: 'no',
    family_hx: 'no',
  }
  let n = 0
  const labs: LabEntry[] = [
    lab('bp', d(-140), { sys: 138, dia: 88 }, 'checkin', n++),
    lab('semen', d(-126), { volume_ml: 2.8, concentration: 11, total_motility: 44, progressive: 34, morphology: 5 }, 'photo', n++),
    lab('testosterone', d(-118), { total_t: 13.8 }, 'clinician', n++),
    lab('bp', d(-100), { sys: 134, dia: 86 }, 'checkin', n++),
    lab('lens', d(-62), { total_motility: 38, progressive: 27 }, 'lens', n++),
    lab('bp', d(-60), { sys: 130, dia: 84 }, 'checkin', n++),
    lab('semen', d(-30), { volume_ml: 3.1, concentration: 19, total_motility: 47, progressive: 35, morphology: 5 }, 'photo', n++),
    lab('bp', d(-20), { sys: 126, dia: 80 }, 'checkin', n++),
  ]

  const checkins: CheckIn[] = []
  const first = weekStart(d(-147))
  for (let w = 0; ; w++) {
    const week = addDays(first, w * 7)
    if (week > d(-3)) break
    const month = Number(week.slice(5, 7))
    const summer = month >= 6 && month <= 9
    const p = w / 20
    checkins.push({
      id: `ex-ci-${w}`,
      week,
      at: iso(addDays(week, 2), '19:00'),
      redFlags: [],
      heatDays: summer ? (w < 4 ? '6to7' : '3to5') : month === 10 ? '1to2' : '0',
      nicotine: w < 6 ? 'daily' : w < 12 ? 'some' : 'none',
      sleep: w < 5 ? 'lt6' : '6to8',
      active: w < 4 ? '0to1' : w < 12 ? '2to4' : '5plus',
      weightKg: w % 2 === 0 ? round1(lerp(98, 92, p)) : undefined,
    })
  }

  const r = rng(34)
  const signals: DailySignal[] = []
  for (let i = 150; i >= 1; i--) {
    const day = d(-i)
    const p = (150 - i) / 149
    const weekend = [5, 6].includes(new Date(`${day}T12:00:00`).getDay())
    signals.push({
      date: day,
      steps: Math.round(lerp(4500, 8100, p) * (weekend ? 0.85 : 1) * (0.85 + r() * 0.3)),
      sleepH: round1(lerp(5.4, 7.0, p) + (r() - 0.5) * 0.8),
      restingHr: Math.round(lerp(74, 66, p) + (r() - 0.5) * 3),
      weightKg: i % 3 === 0 ? round1(lerp(98, 92, p) + (r() - 0.5) * 0.6) : undefined,
    })
  }

  const r1: Review = {
    decision: 'change',
    level: 'specialist',
    reason: 'Concentration was below the usual range on one test. Please repeat the semen analysis in 12 weeks. Meanwhile keep cool at work and stop shisha.',
    at: iso(d(-120), '08:30'),
    reviewer: 'Dr. Example, fertility specialist',
    orders: [
      { kind: 'semen_repeat', inWeeks: 12 },
      { kind: 'testosterone_am', inWeeks: 1 },
    ],
  }
  const r2: Review = {
    decision: 'agree',
    level: 'specialist',
    reason: 'Better on the repeat test. Let us go through both results together by video.',
    at: iso(d(-25), '09:10'),
    reviewer: 'Dr. Example, andrology',
    offer: { at: `${d(5)}T10:30`, mode: 'video', providerId: 'p15', providerName: provider('p15') },
  }

  const journey: JourneyStep[] = [
    ruleStep('fertility', iso(start), { status: 'done', booking: { at: `${d(-128)}T17:00`, mode: 'in_person', providerId: 'p08', providerName: provider('p08') }, doneAt: iso(d(-128), '18:00') }),
    ruleStep('lab_test', iso(start), { status: 'done', doneAt: iso(d(-126), '09:00') }),
    ruleStep('primary', iso(start), { status: 'done', booking: { at: `${d(-110)}T20:00`, mode: 'video', providerId: 'p05', providerName: provider('p05') }, doneAt: iso(d(-110), '20:30') }),
    ruleStep('screening', iso(start), { status: 'booked', booking: { at: `${d(12)}T08:30`, mode: 'in_person', providerId: 'p01', providerName: provider('p01') } }),
    {
      ...ruleStep('specialist', r1.at),
      status: 'booked',
      booking: { ...(r2.offer as NonNullable<Review['offer']>), by: r2.reviewer },
    },
    {
      id: `clin:${r1.at}:order:semen_repeat`,
      kind: 'order',
      origin: 'clinician',
      status: 'done',
      title: { en: 'Repeat semen analysis', ar: 'إعادة تحليل السائل المنوي' },
      why: { en: `Requested by ${r1.reviewer}.`, ar: `طلبه ${r1.reviewer}.` },
      services: ['lab', 'fertility', 'andrology'],
      dueBy: d(-36),
      doneAt: iso(d(-30), '09:00'),
      createdAt: r1.at,
      updatedAt: iso(d(-30), '09:00'),
      by: r1.reviewer,
    },
    {
      id: `clin:${r1.at}:order:testosterone_am`,
      kind: 'order',
      origin: 'clinician',
      status: 'done',
      title: { en: 'Morning testosterone blood test', ar: 'تحليل التستوستيرون الصباحي' },
      why: { en: `Requested by ${r1.reviewer}.`, ar: `طلبه ${r1.reviewer}.` },
      services: ['lab', 'primary'],
      dueBy: d(-113),
      doneAt: iso(d(-118), '08:00'),
      createdAt: r1.at,
      updatedAt: iso(d(-118), '08:00'),
      by: r1.reviewer,
    },
  ]

  const work: WorkProfile = { occupation: 'outdoor', nightShifts: false, extra: [], city: 'abu_dhabi', heatAlerts: true, updatedAt: iso(start) }
  const consents: ConsentEvent[] = [
    { scope: 'ai_explain', granted: true, at: iso(start, '18:05'), version: CONSENT_TEXT_VERSION, via: 'prompt' },
    { scope: 'weather', granted: true, at: iso(start, '18:20'), version: CONSENT_TEXT_VERSION, via: 'settings' },
    { scope: 'ai_report', granted: true, at: iso(d(-126), '12:00'), version: CONSENT_TEXT_VERSION, via: 'prompt' },
  ]

  return {
    answers,
    consent: { version: 'consent-0.1', at: iso(start, '18:00'), aiOptIn: true },
    consents,
    planStart: start,
    labs,
    checkins,
    signals,
    signalsSource: { kind: 'apple-health', importedAt: iso(d(-1), '21:00') },
    work,
    replies: [
      { reply: r1, receivedAt: iso(d(-120), '10:00') },
      { reply: r2, receivedAt: iso(d(-25), '11:00') },
    ],
    journey,
    metrics: { started: 1, completed: 1, durationsSec: [262], trust: [5], clarity: [4] },
    surveyDone: true,
  }
}

function yousef(T: Day): Record<string, unknown> {
  const d = (n: number) => addDays(T, n)
  const start = d(-75)
  const answers: Answers = {
    age: 45,
    urgent_symptoms: ['none'],
    height_cm: 172,
    weight_kg: 104,
    ttc: 'not_now',
    anat: ['none'],
    mumps: 'no',
    sti_now: 'no',
    sti_past: 'no',
    conditions: ['high_bp', 'snoring'],
    meds: ['none'],
    sexual: ['erection'],
    tobacco: 'no',
    heat: ['sitting'],
    activity: '0to1',
    sleep: '6to8',
    last_check: 'gt3y',
    semen_done: 'no',
    family_hx: 'no',
  }
  let n = 0
  const labs: LabEntry[] = [
    lab('bp', d(-70), { sys: 146, dia: 94 }, 'checkin', n++),
    lab('bp', d(-56), { sys: 148, dia: 96 }, 'checkin', n++),
    lab('bp', d(-40), { sys: 142, dia: 92 }, 'clinician', n++),
    lab('hba1c', d(-40), { hba1c: 6.1 }, 'clinician', n++),
    lab('testosterone', d(-40), { total_t: 9.2 }, 'clinician', n++),
    lab('bp', d(-21), { sys: 138, dia: 88 }, 'checkin', n++),
    lab('bp', d(-7), { sys: 134, dia: 86 }, 'checkin', n++),
  ]
  const checkins: CheckIn[] = []
  const first = weekStart(d(-73))
  for (let w = 0; ; w++) {
    const week = addDays(first, w * 7)
    if (week > d(-3)) break
    checkins.push({
      id: `ex-ci-${w}`,
      week,
      at: iso(addDays(week, 1), '21:00'),
      redFlags: [],
      heatDays: w % 3 === 0 ? '1to2' : '0',
      nicotine: 'none',
      sleep: '6to8',
      active: w < 5 ? '0to1' : '2to4',
      weightKg: round1(lerp(104, 101, w / 10)),
    })
  }
  const r1: Review = {
    decision: 'agree',
    level: 'primary',
    reason: 'Your blood pressure has been high on several readings and your HbA1c is above the usual range. Please measure your blood pressure at home morning and evening for 7 days, and repeat the testosterone test in the morning. We will review everything together.',
    at: iso(d(-35), '07:45'),
    reviewer: 'Dr. Example, family physician',
    orders: [
      { kind: 'bp_home', inWeeks: 1 },
      { kind: 'testosterone_am', inWeeks: 6 },
    ],
    offer: { at: `${d(3)}T09:00`, mode: 'in_person', providerId: 'p03', providerName: provider('p03') },
  }
  const journey: JourneyStep[] = [
    ruleStep('primary', iso(start), { status: 'done', booking: { at: `${d(-48)}T19:30`, mode: 'video', providerId: 'p05', providerName: provider('p05') }, doneAt: iso(d(-48), '20:00') }),
    ruleStep('screening', iso(start), { status: 'done', booking: { at: `${d(-40)}T08:00`, mode: 'in_person', providerId: 'p03', providerName: provider('p03') }, doneAt: iso(d(-40), '09:30') }),
    {
      id: `clin:${r1.at}:order:bp_home`,
      kind: 'order',
      origin: 'clinician',
      status: 'done',
      title: { en: 'Home blood pressure readings for 7 days', ar: 'قياس ضغط الدم في المنزل لمدة 7 أيام' },
      why: { en: `Requested by ${r1.reviewer}.`, ar: `طلبه ${r1.reviewer}.` },
      services: [],
      dueBy: d(-28),
      doneAt: iso(d(-21), '21:00'),
      createdAt: r1.at,
      updatedAt: iso(d(-21), '21:00'),
      by: r1.reviewer,
    },
    {
      id: `clin:${r1.at}:order:testosterone_am`,
      kind: 'order',
      origin: 'clinician',
      status: 'todo',
      title: { en: 'Morning testosterone blood test', ar: 'تحليل التستوستيرون الصباحي' },
      why: { en: `Requested by ${r1.reviewer}.`, ar: `طلبه ${r1.reviewer}.` },
      services: ['lab', 'primary'],
      dueBy: d(7),
      createdAt: r1.at,
      updatedAt: r1.at,
      by: r1.reviewer,
    },
    {
      id: `clin:${r1.at}:offer`,
      kind: 'appointment',
      origin: 'clinician',
      status: 'todo',
      title: { en: `Appointment offered by ${r1.reviewer}`, ar: `موعد مقترح من ${r1.reviewer}` },
      why: { en: 'Accept it to add it to your journey and your calendar.', ar: 'اقبله لإضافته إلى رحلتك وتقويمك.' },
      services: [],
      offer: { ...(r1.offer as NonNullable<Review['offer']>), by: r1.reviewer },
      createdAt: r1.at,
      updatedAt: r1.at,
      by: r1.reviewer,
    },
  ]
  const work: WorkProfile = { occupation: 'office', nightShifts: false, extra: [], city: 'al_ain', heatAlerts: false, updatedAt: iso(start) }
  return {
    answers,
    consent: { version: 'consent-0.1', at: iso(start, '20:00'), aiOptIn: true },
    consents: [{ scope: 'ai_explain', granted: true, at: iso(start, '20:10'), version: CONSENT_TEXT_VERSION, via: 'prompt' }] satisfies ConsentEvent[],
    planStart: start,
    labs,
    checkins,
    signals: [],
    work,
    replies: [{ reply: r1, receivedAt: iso(d(-35), '09:00') }],
    journey,
    metrics: { started: 1, completed: 1, durationsSec: [318], trust: [4], clarity: [5] },
    surveyDone: true,
  }
}

/** Cycle starts every `lengths[i]` days from `first`, as recorded in weekly check-ins. */
function periodStarts(first: Day, lengths: number[]): Day[] {
  const out = [first]
  for (const l of lengths) out.push(addDays(out[out.length - 1], l))
  return out
}

function mariam(T: Day): Record<string, unknown> {
  const d = (n: number) => addDays(T, n)
  const start = d(-240)
  const answers: Answers = {
    sex: 'female',
    age: 31,
    urgent_symptoms: ['none'],
    height_cm: 163,
    weight_kg: 72,
    ttc: 'not_now',
    plans_when: '3to5y',
    cycle: 'irregular',
    gyn_symptoms: ['hair_acne'],
    gyn_history: ['none'],
    sti_now: 'no',
    sti_past: 'no',
    conditions: ['none'],
    meds_f: ['none'],
    tobacco: 'no',
    activity: '0to1',
    sleep: '6to8',
    last_check: '1to3y',
    hormone_done: 'no',
    family_hx: 'no',
    menopause_fh: 'yes',
  }
  // Cycles: long and uneven at first, a little steadier as activity and weight improved.
  const starts = periodStarts(d(-236), [44, 38, 51, 36, 41, 34])
  let n = 0
  const labs: LabEntry[] = [
    lab('weight', d(-236), { weight_kg: 72 }, 'typed', n++),
    lab('ovarian', d(-700), { amh: 6.4 }, 'typed', n++),
    lab('ovarian', d(-55), { amh: 5.8, fsh: 6.1, tsh: 2.1 }, 'clinician', n++),
    lab('bp', d(-55), { sys: 118, dia: 76 }, 'clinician', n++),
    lab('hba1c', d(-55), { hba1c: 5.4 }, 'clinician', n++),
    lab('weight', d(-30), { weight_kg: 68.5 }, 'typed', n++),
  ]
  const checkins: CheckIn[] = []
  const first = weekStart(d(-236))
  for (let w = 0; ; w++) {
    const week = addDays(first, w * 7)
    if (week > d(-3)) break
    const periodStart = starts.find((x) => x >= week && x <= addDays(week, 6))
    checkins.push({
      id: `ex-ci-${w}`,
      week,
      at: iso(addDays(week, 3), '21:30'),
      redFlags: [],
      heatDays: '0',
      nicotine: 'none',
      sleep: w % 5 === 0 ? 'lt6' : '6to8',
      active: w < 6 ? '0to1' : w < 16 ? '2to4' : '5plus',
      weightKg: w % 3 === 0 ? round1(lerp(72, 68.5, w / 30)) : undefined,
      ...(periodStart ? { periodStart } : {}),
    })
  }
  const r1: Review = {
    decision: 'agree',
    level: 'primary',
    reason:
      'Your cycles, your symptoms and the ultrasound fit polycystic ovary syndrome (PCOS). It is common and does not mean you cannot have children; your AMH is not low. Nothing needs treating now. Keep up the activity, and come back when you plan to try or if your periods stop for 3 months. Because of your mother’s early menopause, I have offered a short call to talk through timing. It is a conversation, not a recommendation.',
    at: iso(d(-45), '11:15'),
    reviewer: 'Dr. Example, family physician',
    orders: [{ kind: 'ifhas', inWeeks: 6 }],
    offer: { at: `${d(9)}T19:00`, mode: 'video', providerId: 'p19', providerName: provider('p19') },
  }
  const journey: JourneyStep[] = [
    ruleStep('primary', iso(start), { status: 'done', booking: { at: `${d(-62)}T18:30`, mode: 'in_person', providerId: 'p17', providerName: provider('p17') }, doneAt: iso(d(-62), '19:00') }, 'female'),
    ruleStep('testing', iso(start), { status: 'done', doneAt: iso(d(-55), '09:00') }, 'female'),
    ruleStep('preservation', iso(start), { status: 'booked', booking: { ...(r1.offer as NonNullable<Review['offer']>), by: r1.reviewer } }, 'female'),
    {
      id: `clin:${r1.at}:order:ifhas`,
      kind: 'order',
      origin: 'clinician',
      status: 'todo',
      title: { en: 'Routine health check (IFHAS)', ar: 'الفحص الصحي الدوري («إفحص»)' },
      why: { en: `Requested by ${r1.reviewer}.`, ar: `طلبه ${r1.reviewer}.` },
      services: ['screening'],
      dueBy: d(20),
      createdAt: r1.at,
      updatedAt: r1.at,
      by: r1.reviewer,
    },
  ]
  const work: WorkProfile = { occupation: 'office', nightShifts: false, extra: [], city: 'abu_dhabi', heatAlerts: false, updatedAt: iso(start) }
  return {
    answers,
    consent: { version: 'consent-0.1', at: iso(start, '21:00'), aiOptIn: true },
    consents: [
      { scope: 'ai_explain', granted: true, at: iso(start, '21:10'), version: CONSENT_TEXT_VERSION, via: 'prompt' },
      { scope: 'ai_ask', granted: true, at: iso(d(-60), '22:00'), version: CONSENT_TEXT_VERSION, via: 'prompt' },
    ] satisfies ConsentEvent[],
    planStart: start,
    labs,
    checkins,
    signals: [],
    work,
    // She already accepted the doctor's offer (it is the booked preservation call above), so the stored reply
    // carries no open offer: otherwise the same call would show a second time as "appointment offered".
    replies: [{ reply: { ...r1, offer: undefined }, receivedAt: iso(d(-45), '12:00') }],
    journey,
    metrics: { started: 1, completed: 1, durationsSec: [281], trust: [5], clarity: [5] },
    surveyDone: true,
  }
}

function fatima(T: Day): Record<string, unknown> {
  const d = (n: number) => addDays(T, n)
  const start = d(-21)
  const answers: Answers = {
    sex: 'female',
    age: 38,
    urgent_symptoms: ['none'],
    height_cm: 160,
    weight_kg: 63,
    ttc: 'yes',
    ttc_months: '6to12',
    cycle: 'regular',
    gyn_symptoms: ['none'],
    gyn_history: ['none'],
    sti_now: 'no',
    sti_past: 'no',
    conditions: ['none'],
    meds_f: ['none'],
    tobacco: 'no',
    activity: '2to4',
    sleep: '6to8',
    folic: 'yes',
    last_check: 'lt1y',
    hormone_done: 'no',
    family_hx: 'no',
    menopause_fh: 'unsure',
  }
  let n = 0
  const labs: LabEntry[] = [lab('ovarian', d(-12), { amh: 1.3, fsh: 8.2, tsh: 1.9 }, 'photo', n++)]
  const checkins: CheckIn[] = []
  const first = weekStart(d(-21))
  const starts = periodStarts(d(-40), [29, 28])
  for (let w = 0; ; w++) {
    const week = addDays(first, w * 7)
    if (week > d(-3)) break
    const periodStart = starts.find((x) => x >= week && x <= addDays(week, 6))
    checkins.push({ id: `ex-ci-${w}`, week, at: iso(addDays(week, 2), '20:00'), redFlags: [], heatDays: '0', nicotine: 'none', sleep: '6to8', active: '2to4', ...(periodStart ? { periodStart } : {}) })
  }
  const journey: JourneyStep[] = [
    ruleStep('fertility', iso(start), { status: 'booked', booking: { at: `${d(4)}T16:30`, mode: 'in_person', providerId: 'p09', providerName: provider('p09') } }, 'female'),
    ruleStep('lab_test', iso(start), { status: 'done', doneAt: iso(d(-12), '08:30') }, 'female'),
  ]
  const work: WorkProfile = { occupation: 'office', nightShifts: false, extra: [], city: 'al_ain', heatAlerts: false, updatedAt: iso(start) }
  return {
    answers,
    consent: { version: 'consent-0.1', at: iso(start, '20:00'), aiOptIn: true },
    consents: [{ scope: 'ai_explain', granted: true, at: iso(start, '20:05'), version: CONSENT_TEXT_VERSION, via: 'prompt' }] satisfies ConsentEvent[],
    planStart: start,
    labs,
    checkins,
    signals: [],
    work,
    replies: [],
    journey,
    metrics: { started: 1, completed: 1, durationsSec: [244], trust: [5], clarity: [4] },
    surveyDone: true,
  }
}

/** Storage keys and values for an example person, as of `today`. */
export function personaData(id: PersonaId, today: Day): Record<string, unknown> {
  if (id === 'mariam') return mariam(today)
  if (id === 'fatima') return fatima(today)
  return id === 'omar' ? omar(today) : yousef(today)
}
