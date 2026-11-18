import type { L10n } from '../types'
import type { Day } from './dates'
import { addDays, daysBetween, weekStart } from './dates'

/**
 * The weekly check-in: about 20 seconds of taps. It starts with the same safety question as the full check,
 * so a red flag is caught whenever it appears, not only on day one.
 */
export type HeatDays = '0' | '1to2' | '3to5' | '6to7'
export type Nicotine = 'none' | 'some' | 'daily'
export type Sleep = 'lt6' | '6to8' | 'gt8'
export type Active = '0to1' | '2to4' | '5plus'
export type RedFlag = 'sudden_pain' | 'swelling_fever' | 'new_lump' | 'ectopic_signs' | 'heavy_bleeding' | 'pelvic_fever'

export interface CheckIn {
  id: string
  /** Monday of the week it covers. One check-in per week; doing it again replaces it. */
  week: Day
  at: string
  redFlags: RedFlag[]
  heatDays: HeatDays
  nicotine: Nicotine
  sleep: Sleep
  active: Active
  weightKg?: number
  sys?: number
  dia?: number
  /** Women: the day a period started this week, if one did. A run of these gives cycle lengths over time. */
  periodStart?: Day
}

export interface Choice<T extends string> {
  value: T
  label: L10n
}

export const HEAT_CHOICES: Choice<HeatDays>[] = [
  { value: '0', label: { en: 'None', ar: 'لا شيء' } },
  { value: '1to2', label: { en: '1–2 days', ar: '1-2 يوم' } },
  { value: '3to5', label: { en: '3–5 days', ar: '3-5 أيام' } },
  { value: '6to7', label: { en: '6–7 days', ar: '6-7 أيام' } },
]
export const NICOTINE_CHOICES: Choice<Nicotine>[] = [
  { value: 'none', label: { en: 'None', ar: 'لا شيء' } },
  { value: 'some', label: { en: 'Some days', ar: 'بعض الأيام' } },
  { value: 'daily', label: { en: 'Every day', ar: 'كل يوم' } },
]
export const SLEEP_CHOICES: Choice<Sleep>[] = [
  { value: 'lt6', label: { en: 'Under 6 h', ar: 'أقل من 6 ساعات' } },
  { value: '6to8', label: { en: '6–8 h', ar: '6-8 ساعات' } },
  { value: 'gt8', label: { en: 'Over 8 h', ar: 'أكثر من 8 ساعات' } },
]
export const ACTIVE_CHOICES: Choice<Active>[] = [
  { value: '0to1', label: { en: '0–1 days', ar: '0-1 يوم' } },
  { value: '2to4', label: { en: '2–4 days', ar: '2-4 أيام' } },
  { value: '5plus', label: { en: '5+ days', ar: '5 أيام أو أكثر' } },
]
export const RED_FLAG_CHOICES: Choice<RedFlag>[] = [
  { value: 'sudden_pain', label: { en: 'Sudden, severe pain in a testicle', ar: 'ألم مفاجئ وشديد في الخصية' } },
  { value: 'swelling_fever', label: { en: 'A painful, swollen testicle with fever', ar: 'خصية متورمة ومؤلمة مع حرارة' } },
  { value: 'new_lump', label: { en: 'A new lump or hard area', ar: 'كتلة أو منطقة صلبة جديدة' } },
]

/** The same three warning signs as a woman's first check. */
export const RED_FLAG_CHOICES_F: Choice<RedFlag>[] = [
  { value: 'ectopic_signs', label: { en: 'Severe pain low in the belly with a late period, or with fainting', ar: 'ألم شديد أسفل البطن مع تأخر الدورة أو مع إغماء' } },
  { value: 'heavy_bleeding', label: { en: 'Very heavy bleeding, or bleeding while pregnant', ar: 'نزيف غزير جداً، أو نزيف أثناء الحمل' } },
  { value: 'pelvic_fever', label: { en: 'Pain low in the belly with fever or unusual discharge', ar: 'ألم أسفل البطن مع حرارة أو إفرازات غير معتادة' } },
]

/** The four habits that help sperm and heart health, as the check-in measures them. */
export interface Habits {
  coolWeek: boolean
  nicotineFree: boolean
  enoughSleep: boolean
  active: boolean
}

export function habitsOf(c: CheckIn): Habits {
  return {
    coolWeek: c.heatDays === '0' || c.heatDays === '1to2',
    nicotineFree: c.nicotine === 'none',
    enoughSleep: c.sleep !== 'lt6',
    active: c.active !== '0to1',
  }
}

/** The habits counted for this person: keeping cool matters for sperm, not eggs, so a woman's list leaves it out. */
export const habitKeys = (female: boolean): (keyof Habits)[] => (female ? ['nicotineFree', 'enoughSleep', 'active'] : ['coolWeek', 'nicotineFree', 'enoughSleep', 'active'])

export const habitCount = (c: CheckIn, female = false) => habitKeys(female).filter((k) => habitsOf(c)[k]).length

export const HABIT_LABEL: Record<keyof Habits, L10n> = {
  coolWeek: { en: 'Kept cool', ar: 'تجنّب الحرارة' },
  nicotineFree: { en: 'No nicotine', ar: 'دون نيكوتين' },
  enoughSleep: { en: '6+ hours sleep', ar: 'نوم 6 ساعات أو أكثر' },
  active: { en: 'Active 2+ days', ar: 'نشاط يومين أو أكثر' },
}

/** Newest first, one per week (the latest saved wins). */
export function byWeek(list: CheckIn[]): CheckIn[] {
  const seen = new Map<Day, CheckIn>()
  for (const c of [...list].sort((a, b) => a.at.localeCompare(b.at))) seen.set(c.week, c)
  return [...seen.values()].sort((a, b) => b.week.localeCompare(a.week))
}

/** Replaces this week's check-in if there is one. */
export function upsertCheckIn(list: CheckIn[], c: CheckIn): CheckIn[] {
  return [c, ...list.filter((x) => x.week !== c.week)]
}

export const dueThisWeek = (list: CheckIn[], day: Day) => !list.some((c) => c.week === weekStart(day))

/** Check-ins whose week starts within the last `days` days. */
export function recent(list: CheckIn[], day: Day, days: number): CheckIn[] {
  return byWeek(list).filter((c) => daysBetween(c.week, day) < days && daysBetween(c.week, day) >= -6)
}

/** Weeks in a row with a check-in, counting back from this week (or last week, if this one is not done yet). */
export function streak(list: CheckIn[], day: Day): number {
  const weeks = new Set(list.map((c) => c.week))
  let w = weekStart(day)
  if (!weeks.has(w)) w = addDays(w, -7)
  let n = 0
  while (weeks.has(w)) {
    n++
    w = addDays(w, -7)
  }
  return n
}
