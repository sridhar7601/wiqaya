import type { Review } from '../referral'
import type { CareOption, L10n, Level, Sex } from '../types'
import type { Day } from './dates'
import { addDays, daysBetween } from './dates'
import type { ServiceKind } from './directory'

/**
 * The care journey: the steps that turn a result into care, and their status (to do → booked → done).
 * Steps come from two places only: the fixed rules, and a clinician's reply. The AI never adds a step.
 * Times are local "YYYY-MM-DDTHH:mm" strings, so a booking means the same hour wherever the phone is.
 */
export type StepKind = 'emergency' | 'urgent' | 'specialist' | 'fertility' | 'primary' | 'screening' | 'lab_test' | 'retest' | 'occupational' | 'counselling' | 'preservation' | 'testing' | 'appointment' | 'order'
export type StepStatus = 'todo' | 'booked' | 'done' | 'skipped'
export type VisitMode = 'in_person' | 'video' | 'phone'

export interface Booking {
  at: string
  mode: VisitMode
  providerId?: string
  providerName?: L10n
  /** Set when the clinician arranged it. */
  by?: string
}

export interface JourneyStep {
  id: string
  kind: StepKind
  origin: 'rules' | 'clinician'
  status: StepStatus
  title: L10n
  why: L10n
  services: ServiceKind[]
  createdAt: string
  updatedAt: string
  dueBy?: Day
  booking?: Booking
  /** A clinician's appointment offer, waiting for the person to accept. */
  offer?: Booking
  doneAt?: string
  by?: string
}

/** What a clinician may add when replying: an appointment offer and tests to do. */
export type OrderKind = 'semen_repeat' | 'testosterone_am' | 'hba1c' | 'bp_home' | 'ifhas' | 'ultrasound' | 'ovarian_reserve' | 'pelvic_ultrasound' | 'thyroid'

export interface ReplyPlan {
  offer?: Booking
  orders?: { kind: OrderKind; inWeeks: number }[]
}

export const ORDER_LABEL: Record<OrderKind, L10n> = {
  semen_repeat: { en: 'Repeat semen analysis', ar: 'إعادة تحليل السائل المنوي' },
  testosterone_am: { en: 'Morning testosterone blood test', ar: 'تحليل التستوستيرون الصباحي' },
  hba1c: { en: 'HbA1c blood test', ar: 'تحليل السكر التراكمي' },
  bp_home: { en: 'Home blood pressure readings for 7 days', ar: 'قياس ضغط الدم في المنزل لمدة 7 أيام' },
  ifhas: { en: 'Routine health check (IFHAS)', ar: 'الفحص الصحي الدوري («إفحص»)' },
  ultrasound: { en: 'Scrotal ultrasound', ar: 'تصوير بالموجات فوق الصوتية لكيس الصفن' },
  ovarian_reserve: { en: 'AMH and early-cycle FSH blood tests', ar: 'تحليلا AMH وFSH في بداية الدورة' },
  pelvic_ultrasound: { en: 'Pelvic ultrasound', ar: 'تصوير الحوض بالموجات فوق الصوتية' },
  thyroid: { en: 'Thyroid blood test (TSH)', ar: 'تحليل الغدة الدرقية (TSH)' },
}

const ORDER_SERVICES: Record<OrderKind, ServiceKind[]> = {
  semen_repeat: ['lab', 'fertility', 'andrology'],
  testosterone_am: ['lab', 'primary'],
  hba1c: ['lab', 'primary', 'screening'],
  bp_home: [],
  ifhas: ['screening'],
  ultrasound: ['andrology', 'lab'],
  ovarian_reserve: ['lab', 'fertility', 'womens'],
  pelvic_ultrasound: ['womens', 'fertility'],
  thyroid: ['lab', 'primary'],
}

export const MODE_LABEL: Record<VisitMode, L10n> = {
  in_person: { en: 'In person', ar: 'حضورياً' },
  video: { en: 'Video call', ar: 'مكالمة فيديو' },
  phone: { en: 'Phone call', ar: 'مكالمة هاتفية' },
}

interface Template {
  title: L10n
  why: L10n
  services: ServiceKind[]
}

type RuleKind = Exclude<StepKind, 'appointment' | 'order'>

const TEMPLATES: Record<RuleKind, Template> = {
  emergency: {
    title: { en: 'Get emergency help now: call 998', ar: 'اطلب المساعدة الطارئة الآن: اتصل بالرقم 998' },
    why: { en: 'Something you reported can need treatment within hours. Do not book an appointment for this.', ar: 'قد يحتاج ما ذكرته إلى علاج خلال ساعات. لا تحجز موعداً لهذا.' },
    services: [],
  },
  urgent: {
    title: { en: 'Get seen today', ar: 'احصل على فحص اليوم' },
    why: { en: 'This should be checked quickly: urgent care or an emergency department.', ar: 'يجب فحص هذا بسرعة: في الرعاية العاجلة أو قسم الطوارئ.' },
    services: ['urgent'],
  },
  specialist: {
    title: { en: "See a men's health specialist", ar: 'راجع أخصائي صحة الرجل' },
    why: { en: 'An andrology or urology specialist can examine you and decide on tests. Your family doctor can refer you if your insurance needs it.', ar: 'يستطيع أخصائي الذكورة أو المسالك فحصك وتحديد التحاليل. ويمكن لطبيب الأسرة تحويلك إذا تطلّب تأمينك ذلك.' },
    services: ['andrology', 'telehealth'],
  },
  fertility: {
    title: { en: 'Book a fertility assessment for you both', ar: 'احجز تقييماً للخصوبة لكما معاً' },
    why: { en: 'Fertility services assess both partners together. Your part is quick and private.', ar: 'تقيّم خدمات الخصوبة الشريكين معاً، ودورك فيها سريع وخاص.' },
    services: ['fertility'],
  },
  primary: {
    title: { en: 'See your family doctor', ar: 'راجع طبيب الأسرة' },
    why: { en: 'A teleconsultation is fine for a first conversation. Your family doctor can do the checks and refer you on.', ar: 'الاستشارة عن بُعد مناسبة للمحادثة الأولى، ويستطيع طبيب الأسرة إجراء الفحوصات وتحويلك.' },
    services: ['primary', 'telehealth'],
  },
  screening: {
    title: { en: 'Book your routine health check', ar: 'احجز فحصك الصحي الدوري' },
    why: { en: 'One visit checks weight, blood pressure, sugar and cholesterol, which affect both heart and sperm. For Thiqa holders it is IFHAS, which since 2025 also includes reproductive health screening at ages 20–35. Book in the Sahatna app.', ar: 'زيارة واحدة تفحص الوزن وضغط الدم والسكر والكوليسترول، وهي تؤثر على القلب والحيوانات المنوية معاً. لحاملي بطاقة «ثقة» هو برنامج «إفحص»، الذي يشمل منذ 2025 فحص الصحة الإنجابية للفئة العمرية 20-35. احجز عبر تطبيق «صحتنا».' },
    services: ['screening'],
  },
  lab_test: {
    title: { en: 'Get a lab semen analysis', ar: 'أجرِ تحليلاً مخبرياً للسائل المنوي' },
    why: { en: 'It is usually the first test, and the only way to know the numbers.', ar: 'هو عادةً التحليل الأول، والطريقة الوحيدة لمعرفة الأرقام.' },
    services: ['lab', 'fertility'],
  },
  retest: {
    title: { en: 'Repeat the semen analysis', ar: 'أعد تحليل السائل المنوي' },
    why: { en: 'About 3 months after a low result, a new test shows sperm made under your new habits.', ar: 'بعد نحو 3 أشهر من نتيجة منخفضة، يُظهر تحليل جديد حيوانات منوية تكوّنت في ظل عاداتك الجديدة.' },
    services: ['lab', 'fertility', 'andrology'],
  },
  occupational: {
    title: { en: 'Ask occupational health about your work exposures (optional)', ar: 'اسأل الصحة المهنية عن التعرّض في عملك (اختياري)' },
    why: { en: 'They can check your protection at work and whether any test is worthwhile.', ar: 'يمكنهم مراجعة وسائل الحماية في عملك وما إذا كان أي تحليل مفيداً.' },
    services: ['occupational'],
  },
  counselling: {
    title: { en: 'Book a preconception counselling visit', ar: 'احجز زيارة استشارة ما قبل الحمل' },
    why: { en: 'One conversation covers folic acid, vaccines, medicines, long-term conditions and timing. A teleconsultation is fine to start.', ar: 'محادثة واحدة تغطي حمض الفوليك واللقاحات والأدوية والحالات المزمنة والتوقيت. الاستشارة عن بُعد مناسبة للبداية.' },
    services: ['womens', 'primary', 'telehealth'],
  },
  preservation: {
    title: { en: 'Optional: talk through fertility preservation', ar: 'اختياري: ناقش خيارات حفظ الخصوبة' },
    why: { en: 'A discussion, not a recommendation: what age means for you, what egg freezing involves, its chances and its cost. The choice stays yours.', ar: 'مناقشة وليست توصية: ماذا يعني العمر لك، وما يتضمنه تجميد البويضات، وفرص نجاحه وتكلفته. والقرار يبقى لك.' },
    services: ['fertility', 'telehealth'],
  },
  testing: {
    title: { en: 'Ask about simple tests for your cycle', ar: 'اسأل عن تحاليل بسيطة للدورة' },
    why: { en: 'Blood tests (and sometimes an ultrasound) can find why cycles are irregular or absent. Your family doctor or a women’s health clinic can arrange them.', ar: 'يمكن لتحاليل الدم (وأحياناً التصوير بالموجات فوق الصوتية) معرفة سبب عدم انتظام الدورة أو غيابها. يستطيع طبيب الأسرة أو عيادة صحة المرأة ترتيبها.' },
    services: ['womens', 'primary', 'lab'],
  },
}

/** A woman's version of the steps whose wording or service differs. Arabic addresses her directly. */
const TEMPLATES_F: Partial<Record<RuleKind, Template>> = {
  urgent: {
    title: { en: 'Get seen today', ar: 'احصلي على فحص اليوم' },
    why: { en: 'This should be checked quickly: urgent care or an emergency department.', ar: 'يجب فحص هذا بسرعة: في الرعاية العاجلة أو قسم الطوارئ.' },
    services: ['urgent'],
  },
  specialist: {
    title: { en: 'See a women’s health specialist', ar: 'راجعي أخصائية صحة المرأة' },
    why: { en: 'A gynaecology or reproductive medicine specialist can examine you and decide on tests. Your family doctor can refer you if your insurance needs it.', ar: 'تستطيع أخصائية النساء أو الطب الإنجابي فحصك وتحديد التحاليل. ويمكن لطبيب الأسرة تحويلك إذا تطلّب تأمينك ذلك.' },
    services: ['womens', 'fertility', 'telehealth'],
  },
  fertility: {
    title: { en: 'Book a fertility assessment for you both', ar: 'احجزي تقييماً للخصوبة لكما معاً' },
    why: { en: 'Fertility services assess both partners together: for you, a few blood tests and an ultrasound; for your partner, a semen analysis.', ar: 'تقيّم خدمات الخصوبة الشريكين معاً: لكِ بعض تحاليل الدم وتصوير بالموجات فوق الصوتية، ولشريكك تحليل للسائل المنوي.' },
    services: ['fertility'],
  },
  primary: {
    title: { en: 'See your family doctor or a women’s health clinic', ar: 'راجعي طبيب الأسرة أو عيادة صحة المرأة' },
    why: { en: 'A teleconsultation is fine for a first conversation. They can do the checks and refer you on.', ar: 'الاستشارة عن بُعد مناسبة للمحادثة الأولى، ويمكنهم إجراء الفحوصات وتحويلك.' },
    services: ['primary', 'womens', 'telehealth'],
  },
  screening: {
    title: { en: 'Book your routine health check', ar: 'احجزي فحصك الصحي الدوري' },
    why: { en: 'One visit checks weight, blood pressure, sugar and cholesterol, which matter for fertility and pregnancy. For Thiqa holders it is IFHAS, which since 2025 also includes reproductive health screening at ages 20–35. Book in the Sahatna app.', ar: 'زيارة واحدة تفحص الوزن وضغط الدم والسكر والكوليسترول، وهي مهمة للخصوبة والحمل. لحاملات بطاقة «ثقة» هو برنامج «إفحص»، الذي يشمل منذ 2025 فحص الصحة الإنجابية للفئة العمرية 20-35. احجزي عبر تطبيق «صحتنا».' },
    services: ['screening'],
  },
  lab_test: {
    title: { en: 'Ask about fertility tests', ar: 'اسألي عن تحاليل الخصوبة' },
    why: { en: 'Usually blood tests on day 2–5 of a period (AMH, FSH, thyroid) and an ultrasound. They describe your reserve today, not your chances.', ar: 'عادةً تحاليل دم في اليوم 2 إلى 5 من الدورة (AMH وFSH والغدة الدرقية) وتصوير بالموجات فوق الصوتية. وهي تصف مخزونك اليوم، لا فرصك.' },
    services: ['lab', 'fertility', 'womens'],
  },
  occupational: {
    title: { en: 'Ask occupational health about your work exposures (optional)', ar: 'اسألي الصحة المهنية عن التعرّض في عملك (اختياري)' },
    why: { en: 'They can check your protection at work, including what changes if you become pregnant.', ar: 'يمكنهم مراجعة وسائل الحماية في عملك، بما في ذلك ما يتغير إذا أصبحتِ حاملاً.' },
    services: ['occupational'],
  },
  counselling: {
    title: { en: 'Book a preconception counselling visit', ar: 'احجزي زيارة استشارة ما قبل الحمل' },
    why: { en: 'One conversation covers folic acid, vaccines such as rubella, medicines, long-term conditions, carrier screening and timing. A teleconsultation is fine to start.', ar: 'محادثة واحدة تغطي حمض الفوليك واللقاحات مثل الحصبة الألمانية والأدوية والحالات المزمنة والفحص الوراثي والتوقيت. الاستشارة عن بُعد مناسبة للبداية.' },
    services: ['womens', 'primary', 'telehealth'],
  },
  preservation: {
    title: { en: 'Optional: talk through fertility preservation', ar: 'اختياري: ناقشي خيارات حفظ الخصوبة' },
    why: { en: 'A discussion, not a recommendation: what age means for you, what egg freezing involves, its chances and its cost. The choice stays yours.', ar: 'مناقشة وليست توصية: ماذا يعني العمر لكِ، وما يتضمنه تجميد البويضات، وفرص نجاحه وتكلفته. والقرار يبقى لكِ.' },
    services: ['fertility', 'telehealth'],
  },
  testing: {
    title: { en: 'Ask about simple tests for your cycle', ar: 'اسألي عن تحاليل بسيطة للدورة' },
    why: { en: 'Blood tests (and sometimes an ultrasound) can find why cycles are irregular or absent. Your family doctor or a women’s health clinic can arrange them.', ar: 'يمكن لتحاليل الدم (وأحياناً التصوير بالموجات فوق الصوتية) معرفة سبب عدم انتظام الدورة أو غيابها. يستطيع طبيب الأسرة أو عيادة صحة المرأة ترتيبها.' },
    services: ['womens', 'primary', 'lab'],
  },
}

const template = (kind: RuleKind, sex: Sex): Template => (sex === 'female' ? TEMPLATES_F[kind] : undefined) ?? TEMPLATES[kind]

export interface DesiredStep {
  kind: RuleKind
  dueBy?: Day
}

export interface PlanInput {
  level: Level
  emergency: boolean
  /** Lower-level steps other findings point to (e.g. primary care alongside a fertility assessment). */
  also: Level[]
  screeningDue: boolean
  needsLabTest: boolean
  retestDue?: Day
  occupationalHealth: boolean
  /** Choices that findings opened (counselling, a preservation discussion, tests). */
  options?: CareOption[]
}

/** The rule-based steps that should exist now. Pure: same input, same steps. */
export function desiredSteps(p: PlanInput): DesiredStep[] {
  if (p.emergency) return [{ kind: 'emergency' }]
  const out: DesiredStep[] = []
  const main = p.level === 'selfcare' ? [] : [p.level]
  for (const l of [...main, ...p.also]) {
    if (l === 'selfcare') continue
    if (!out.some((s) => s.kind === l)) out.push({ kind: l })
  }
  if (p.level === 'urgent') return out
  if (p.needsLabTest) out.push({ kind: 'lab_test' })
  if (p.retestDue) out.push({ kind: 'retest', dueBy: p.retestDue })
  if (p.screeningDue) out.push({ kind: 'screening' })
  if (p.occupationalHealth) out.push({ kind: 'occupational' })
  // Options come last and never replace the main step: they are offered, not required.
  for (const o of ['testing', 'counselling', 'preservation'] as const) if (p.options?.includes(o) && !(o === 'testing' && p.needsLabTest)) out.push({ kind: o })
  return out
}

/**
 * Adds rule steps that are newly needed and drops rule steps that are no longer needed and were never
 * started. Anything booked or done stays, as history. Clinician steps are never touched.
 */
export function syncJourney(existing: JourneyStep[], desired: DesiredStep[], nowIso: string, sex: Sex = 'male'): JourneyStep[] {
  const want = new Map(desired.map((d) => [`rule:${d.kind}`, d]))
  const out: JourneyStep[] = []
  for (const s of existing) {
    if (s.origin !== 'rules') {
      out.push(s)
      continue
    }
    const d = want.get(s.id)
    if (d) {
      out.push(s.status === 'todo' && s.dueBy !== d.dueBy ? { ...s, dueBy: d.dueBy, updatedAt: nowIso } : s)
      want.delete(s.id)
    } else if (s.status !== 'todo') out.push(s)
  }
  for (const [id, d] of want) {
    const t = template(d.kind, sex)
    out.push({ id, kind: d.kind, origin: 'rules', status: 'todo', title: t.title, why: t.why, services: t.services, createdAt: nowIso, updatedAt: nowIso, dueBy: d.dueBy })
  }
  return out
}

/** A rule step built from its template, for example data and tests. */
export function ruleStep(kind: DesiredStep['kind'], nowIso: string, patch: Partial<JourneyStep> = {}, sex: Sex = 'male'): JourneyStep {
  const t = template(kind, sex)
  return { id: `rule:${kind}`, kind, origin: 'rules', status: 'todo', title: t.title, why: t.why, services: t.services, createdAt: nowIso, updatedAt: nowIso, ...patch }
}

/** Turns a clinician's reply into steps. Safe to call again with the same reply: nothing is duplicated. */
export function applyReply(existing: JourneyStep[], reply: Review & ReplyPlan, today: Day, nowIso: string): JourneyStep[] {
  const base = `clin:${reply.at}`
  const out = [...existing]
  const add = (s: JourneyStep) => {
    if (!out.some((x) => x.id === s.id)) out.push(s)
  }
  if (reply.offer) {
    add({
      id: `${base}:offer`,
      kind: 'appointment',
      origin: 'clinician',
      status: 'todo',
      title: { en: `Appointment offered by ${reply.reviewer}`, ar: `موعد مقترح من ${reply.reviewer}` },
      why: { en: 'Accept it to add it to your journey and your calendar.', ar: 'اقبله لإضافته إلى رحلتك وتقويمك.' },
      services: [],
      offer: { ...reply.offer, by: reply.reviewer },
      createdAt: nowIso,
      updatedAt: nowIso,
      by: reply.reviewer,
    })
  }
  for (const o of reply.orders ?? []) {
    add({
      id: `${base}:order:${o.kind}`,
      kind: 'order',
      origin: 'clinician',
      status: 'todo',
      title: ORDER_LABEL[o.kind],
      why: { en: `Requested by ${reply.reviewer}.`, ar: `طلبه ${reply.reviewer}.` },
      services: ORDER_SERVICES[o.kind],
      dueBy: addDays(today, Math.max(0, Math.round(o.inWeeks * 7))),
      createdAt: nowIso,
      updatedAt: nowIso,
      by: reply.reviewer,
    })
  }
  return out
}

export function updateStep(list: JourneyStep[], id: string, patch: Partial<JourneyStep>, nowIso: string): JourneyStep[] {
  return list.map((s) => (s.id === id ? { ...s, ...patch, updatedAt: nowIso } : s))
}

export const acceptOffer = (list: JourneyStep[], id: string, nowIso: string) =>
  list.map((s) => (s.id === id && s.offer ? { ...s, status: 'booked' as const, booking: s.offer, offer: undefined, updatedAt: nowIso } : s))

const ORDER: Record<StepKind, number> = { emergency: 0, urgent: 1, appointment: 2, specialist: 3, fertility: 4, primary: 5, testing: 6, lab_test: 6, order: 7, retest: 7, counselling: 8, screening: 8, preservation: 9, occupational: 9 }
const STATUS_ORDER: Record<StepStatus, number> = { booked: 0, todo: 1, done: 2, skipped: 3 }

/** Open steps first (booked, then to do, by importance), then finished ones, newest first. */
export function sortSteps(list: JourneyStep[]): JourneyStep[] {
  return [...list].sort((a, b) => {
    const open = (s: JourneyStep) => (s.status === 'done' || s.status === 'skipped' ? 1 : 0)
    if (open(a) !== open(b)) return open(a) - open(b)
    if (open(a)) return (b.doneAt ?? b.updatedAt).localeCompare(a.doneAt ?? a.updatedAt)
    return STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || ORDER[a.kind] - ORDER[b.kind] || (a.booking?.at ?? '').localeCompare(b.booking?.at ?? '')
  })
}

/**
 * The two pathway measures the challenge names, from the journey's own timestamps:
 * time to appropriate evaluation (start → first clinician-facing step done) and referral completion
 * (clinician steps and main rule steps that were completed).
 */
export function journeyMeasures(list: JourneyStep[], start: Day): { daysToEvaluation?: number; referralsDone: number; referralsOpen: number } {
  const clinical: StepKind[] = ['specialist', 'fertility', 'primary', 'urgent', 'appointment', 'screening', 'counselling', 'preservation', 'testing']
  const done = list.filter((s) => clinical.includes(s.kind) && s.status === 'done' && s.doneAt).sort((a, b) => (a.doneAt as string).localeCompare(b.doneAt as string))
  const first = done[0]
  return {
    daysToEvaluation: first ? daysBetween(start, (first.doneAt as string).slice(0, 10)) : undefined,
    referralsDone: list.filter((s) => clinical.includes(s.kind) && s.status === 'done').length,
    referralsOpen: list.filter((s) => clinical.includes(s.kind) && (s.status === 'todo' || s.status === 'booked')).length,
  }
}

export const isOpen = (s: JourneyStep) => s.status === 'todo' || s.status === 'booked'
