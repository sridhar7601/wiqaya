import type { CheckIn } from '../lib/companion/checkins'
import { addDays, today, weekStart } from '../lib/companion/dates'
import type { Day } from '../lib/companion/dates'
import { newEntry } from '../lib/companion/labs'
import type { LabEntry } from '../lib/companion/labs'
import { personaData } from '../lib/companion/personas'
import type { WorkProfile } from '../lib/companion/exposures'
import { companionView } from '../lib/companion/view'
import type { CompanionInput, CompanionView } from '../lib/companion/view'
import type { L10n } from '../lib/types'

/**
 * Clinical boundaries across the care pathway, checked live on the two invented example people.
 * Each check changes one thing and looks at who decides the next step and what it is.
 */
export interface BoundaryCheck {
  id: string
  rule: L10n
  got: string
  pass: boolean
}

type Input = Omit<CompanionInput, 'today'>

const base = (id: 'omar' | 'yousef', T: Day): Input => {
  const d = personaData(id, T) as unknown as Input
  return { ...d, journey: d.journey ?? [] }
}
const view = (c: Input, T: Day) => companionView({ ...c, today: T })
const show = (v: CompanionView) => `${v.emergency ? 'emergency' : v.level} · ${v.decidedBy}`
const normalSemen = (T: Day): LabEntry => newEntry('semen', T, { volume_ml: 3, concentration: 40, total_motility: 55, progressive: 45, morphology: 6 }, 'typed')

export function boundaryChecks(T: Day = today()): BoundaryCheck[] {
  const omar = base('omar', T)
  const yousef = base('yousef', T)
  const out: BoundaryCheck[] = []
  const add = (id: string, rule: L10n, got: string, pass: boolean) => out.push({ id, rule, got, pass })

  // 1. With no clinician involved, the fixed rules decide.
  const rulesOnly = view({ ...omar, replies: [] }, T)
  add('rules_decide', { en: 'With no clinician involved, the fixed rules decide the next step', ar: 'دون تدخّل طبيب، تحدد القواعد الثابتة الخطوة التالية' }, show(rulesOnly), rulesOnly.decidedBy === 'rules' && rulesOnly.level === rulesOnly.rulesLevel)

  // 2. A clinician's decision from the last 90 days replaces the rules' suggestion.
  const reviewed = view(omar, T)
  add('clinician_decides', { en: 'A clinician’s decision from the last 90 days replaces the rules’ suggestion', ar: 'قرار الطبيب خلال آخر 90 يوماً يحل محل اقتراح القواعد' }, show(reviewed), reviewed.decidedBy === 'clinician' && reviewed.level === reviewed.review?.level)

  // 3. Only a clinician can lower the step: here the clinician chose family doctor care.
  const lowered = view({ ...omar, replies: omar.replies.map((r) => ({ ...r, reply: { ...r.reply, level: 'primary' as const } })) }, T)
  add('only_clinician_lowers', { en: 'Only a clinician can lower the step, never the app or the AI', ar: 'الطبيب وحده يستطيع خفض الخطوة، لا التطبيق ولا الذكاء الاصطناعي' }, `${show(lowered)} (rules: ${lowered.rulesLevel})`, lowered.level === 'primary' && lowered.decidedBy === 'clinician')

  // 4. A warning sign in a check-in overrides everything, including the clinician's decision.
  const red = view({ ...omar, checkins: [...omar.checkins, { id: 'eval-red', week: weekStart(T), at: `${T}T08:00:00.000Z`, redFlags: ['sudden_pain'], heatDays: '0', nicotine: 'none', sleep: '6to8', active: '2to4' } satisfies CheckIn] }, T)
  add('red_flag_wins', { en: 'A warning sign in a weekly check-in overrides everything, including the clinician', ar: 'العلامة التحذيرية في التسجيل الأسبوعي تتقدّم على كل شيء، حتى قرار الطبيب' }, show(red), red.decidedBy === 'red_flag' && (red.emergency || red.level === 'urgent'))

  // 5. A clinician's decision expires after 90 days: the rules take over again until the next review.
  const expired = view({ ...omar, replies: omar.replies.map((r) => ({ ...r, reply: { ...r.reply, at: `${addDays(T, -120)}T09:00:00.000Z` } })) }, T)
  add('review_expires', { en: 'A clinician’s decision expires after 90 days, and the rules take over until the next review', ar: 'ينتهي قرار الطبيب بعد 90 يوماً، وتتولى القواعد حتى المراجعة التالية' }, show(expired), expired.decidedBy === 'rules')

  // 6. A better result never lowers the step by itself: it is flagged for the clinician.
  const better = view({ ...omar, labs: [...omar.labs, normalSemen(T)] }, T)
  add('better_result_flagged', { en: 'A better result never lowers the step by itself; it is flagged for the clinician', ar: 'النتيجة الأفضل لا تخفض الخطوة وحدها، بل تُعرض على الطبيب' }, `${show(better)} · ${better.newSinceReview} new`, better.level === reviewed.level && better.newSinceReview > reviewed.newSinceReview)
  const betterRules = view({ ...omar, replies: [], labs: [...omar.labs, normalSemen(T)] }, T)
  add('better_result_rules', { en: 'With rules only, one normal result after two low ones keeps the specialist step', ar: 'مع القواعد وحدها، نتيجة طبيعية بعد نتيجتين منخفضتين لا تلغي خطوة الأخصائي' }, show(betterRules), betterRules.level === rulesOnly.level)

  // 7. A job is never a diagnosis: work exposures add advice but never raise the step.
  const office: WorkProfile = { occupation: 'office', nightShifts: false, extra: [], heatAlerts: false, updatedAt: `${T}T08:00:00.000Z` }
  const plant: WorkProfile = { ...office, occupation: 'oil_gas', nightShifts: true, extra: ['pesticides', 'metals', 'radiation'] }
  const a = view({ ...yousef, replies: [], work: office }, T)
  const b = view({ ...yousef, replies: [], work: plant }, T)
  add('job_never_raises', { en: 'Work exposures add advice but never raise the step', ar: 'التعرّض في العمل يضيف نصائح لكنه لا يرفع الخطوة أبداً' }, `${a.rulesLevel} → ${b.rulesLevel}`, a.rulesLevel === b.rulesLevel && b.flags.filter((f) => f.id.startsWith('EX_')).every((f) => f.level === 'selfcare' || f.level === 'info'))

  // 8. A home estimate is never treated as a lab result: at most it suggests a lab test, and a later lab replaces it.
  const lensOnly: Input = { answers: { age: 30, urgent_symptoms: ['none'] }, labs: [newEntry('lens', T, { total_motility: 20, progressive: 12 }, 'lens')], checkins: [], signals: [], work: null, replies: [], journey: [], planStart: T }
  const l1 = view(lensOnly, T)
  const l2 = view({ ...lensOnly, labs: [...lensOnly.labs, { ...normalSemen(T), addedAt: new Date(Date.now() + 1000).toISOString() }] }, T)
  add('home_estimate_limited', { en: 'A low home estimate only leads to a lab test, and a later lab result replaces it', ar: 'التقدير المنزلي المنخفض يقود إلى تحليل مخبري فقط، ونتيجة المختبر اللاحقة تحل محله' }, `${l1.rulesLevel} → ${l2.rulesLevel}`, l1.rulesLevel === 'primary' && l1.desired.some((s) => s.kind === 'lab_test') && !l2.flags.some((f) => f.id === 'LT_LENS_LOW'))

  return out
}
