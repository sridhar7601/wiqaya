import { assess } from './engine'
import { ageBand } from '../eval/cases'
import type { Answers, Assessment, CareOption, L10n, Level, Sex } from './types'

/**
 * The health-system view. In a pilot, it would count only people who said yes to "count me in anonymous
 * statistics", and only as totals: no row, answer or result ever leaves a phone, and any group smaller than
 * MIN_CELL is hidden. Here it runs on an INVENTED population, so the page can show what the view would look
 * like. The proportions below are rough planning assumptions, not Abu Dhabi data, and are labelled as such.
 *
 * Each invented person goes through the same fixed rules as a real check. Nothing here is a prediction
 * about any individual, and nothing is ever used to decide about a person.
 */
export const MIN_CELL = 10
export const COHORT_SIZE = 10000

export type Area = 'abu_dhabi' | 'al_ain' | 'al_dhafra'
export interface Person {
  answers: Answers
  lang: 'ar' | 'en'
  area: Area
  as: Assessment
}

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

/** Picks a value by weight: pick(r, [['a', 3], ['b', 1]]) returns 'a' three times as often as 'b'. */
function pick<T>(r: () => number, items: [T, number][]): T {
  const total = items.reduce((s, [, w]) => s + w, 0)
  let x = r() * total
  for (const [v, w] of items) {
    x -= w
    if (x < 0) return v
  }
  return items[items.length - 1][0]
}
const chance = (r: () => number, p: number) => r() < p

function person(r: () => number): Person {
  const sex: Sex = chance(r, 0.5) ? 'female' : 'male'
  const age = 18 + Math.floor(r() * 28) // 18–45
  const lang = chance(r, 0.45) ? 'ar' : 'en'
  const area = pick<Area>(r, [['abu_dhabi', 60], ['al_ain', 30], ['al_dhafra', 10]])
  const height = sex === 'female' ? 158 + r() * 14 : 168 + r() * 16
  const bmi = 19 + r() * 10 + (chance(r, 0.3) ? r() * 9 : 0)
  const ttc = pick(r, [['yes', 16], ['planning', 14], ['not_now', 62], ['prefer_not', 8]])
  const a: Answers = {
    sex,
    age,
    urgent_symptoms: chance(r, 0.004) ? [sex === 'female' ? 'pelvic_fever' : 'swelling_fever'] : ['none'],
    height_cm: Math.round(height),
    weight_kg: Math.round(bmi * (height / 100) ** 2),
    ttc,
    sti_now: chance(r, 0.02) ? 'yes' : 'no',
    sti_past: chance(r, 0.06) ? 'yes' : 'no',
    conditions: chance(r, 0.06) ? ['diabetes'] : chance(r, 0.05) ? ['thyroid'] : ['none'],
    tobacco: pick(r, sex === 'female' ? [['no', 88], ['sometimes', 8], ['daily', 4]] : [['no', 70], ['sometimes', 12], ['daily', 18]]),
    activity: pick(r, [['0to1', 40], ['2to4', 42], ['5plus', 18]]),
    sleep: pick(r, [['lt6', 22], ['6to8', 70], ['gt8', 8]]),
    last_check: pick(r, [['lt1y', 35], ['1to3y', 30], ['gt3y', 25], ['unsure', 10]]),
    family_hx: chance(r, 0.06) ? 'yes' : 'no',
  }
  if (ttc === 'yes') a.ttc_months = pick(r, [['lt6', 40], ['6to12', 30], ['gt12', 30]])
  if (sex === 'female') {
    if (ttc === 'not_now' || ttc === 'prefer_not') a.plans_when = pick(r, [['1to2y', 15], ['3to5y', 25], ['gt5y', 20], ['unsure', 25], ['none', 15]])
    a.cycle = pick(r, [['regular', 70], ['irregular', 13], ['rare', 7], ['none_3m', 2], ['hormonal', 8]])
    a.gyn_symptoms = chance(r, 0.1) ? ['severe_period_pain'] : chance(r, 0.08) ? ['heavy_periods'] : chance(r, 0.06) ? ['hair_acne'] : ['none']
    a.gyn_history = chance(r, 0.07) ? ['pcos'] : chance(r, 0.03) ? ['endometriosis'] : chance(r, 0.02) ? ['pid'] : ['none']
    a.meds_f = chance(r, 0.02) ? ['valproate'] : ['none']
    if (ttc === 'yes' || ttc === 'planning') a.folic = pick(r, [['yes', 45], ['no', 40], ['unsure', 15]])
    a.hormone_done = chance(r, 0.08) ? 'yes' : 'no'
    if (a.hormone_done === 'yes') a.amh = Math.round(Math.max(0.1, 4.5 - (age - 25) * 0.2 + (r() - 0.5) * 3) * 10) / 10
    a.menopause_fh = pick(r, [['no', 70], ['yes', 5], ['unsure', 25]])
  } else {
    if (ttc === 'yes') a.partner_age = pick(r, [['under35', 70], ['35plus', 30]])
    a.anat = chance(r, 0.05) ? ['varicocele'] : chance(r, 0.01) ? ['undescended'] : ['none']
    a.mumps = chance(r, 0.01) ? 'yes' : 'no'
    a.meds = chance(r, 0.03) ? ['testosterone'] : ['none']
    a.sexual = chance(r, age > 38 ? 0.15 : 0.05) ? ['erection'] : ['none']
    a.heat = chance(r, 0.25) ? ['outdoor_heat'] : chance(r, 0.15) ? ['sitting'] : ['none']
    a.semen_done = chance(r, 0.06) ? 'yes' : 'no'
  }
  return { answers: a, lang, area, as: assess(a) }
}

let cached: Person[] | null = null
/** The invented population, the same every time (fixed seed). */
export function cohort(n = COHORT_SIZE, seed = 2026): Person[] {
  if (n === COHORT_SIZE && seed === 2026 && cached) return cached
  const r = rng(seed)
  const out = Array.from({ length: n }, () => person(r))
  if (n === COHORT_SIZE && seed === 2026) cached = out
  return out
}

/** A count that is hidden when the group is too small to show safely. */
export interface Cell {
  n: number
  hidden: boolean
}
export const cell = (n: number): Cell => ({ n, hidden: n > 0 && n < MIN_CELL })

const hasFlag = (p: Person, ...ids: string[]) => p.as.flags.some((f) => ids.includes(f.id))
const hasOption = (p: Person, o: CareOption) => p.as.flags.some((f) => f.option === o)
const isF = (p: Person) => p.as.sex === 'female'

/** Groups who may benefit from earlier advice: each is a fixed definition over the rules' own output. */
export interface Insight {
  id: string
  title: L10n
  /** Who is in the denominator. */
  of: L10n
  count: Cell
  base: number
  /** What a health system could do for this group, without deciding anything about a person. */
  offer: L10n
}

function insight(people: Person[], id: string, title: L10n, of: L10n, inBase: (p: Person) => boolean, inGroup: (p: Person) => boolean, offer: L10n): Insight {
  const base = people.filter(inBase)
  return { id, title, of, base: base.length, count: cell(base.filter(inGroup).length), offer }
}

export function insights(people: Person[] = cohort()): Insight[] {
  const eligible = people.filter((p) => p.as.eligible && !p.as.emergency)
  return [
    insight(
      eligible,
      'timing',
      { en: 'Women 30–42 who would like children later', ar: 'نساء بين 30 و42 يرغبن في الإنجاب لاحقاً' },
      { en: 'women 30–42 not trying yet', ar: 'نساء بين 30 و42 لا يحاولن بعد' },
      (p) => isF(p) && (p.answers.age as number) >= 30 && (p.answers.age as number) <= 42 && p.answers.ttc !== 'yes',
      (p) => hasFlag(p, 'PR_TIMING'),
      { en: 'Offer a timing conversation (including what egg freezing involves) through family medicine or IFHAS, before options narrow.', ar: 'تقديم محادثة حول التوقيت (بما في ذلك ما يتضمنه تجميد البويضات) عبر طب الأسرة أو «إفحص»، قبل أن تضيق الخيارات.' },
    ),
    insight(
      eligible,
      'cycles',
      { en: 'Women with irregular or absent periods', ar: 'نساء لديهن دورة غير منتظمة أو غائبة' },
      { en: 'all women', ar: 'جميع النساء' },
      isF,
      (p) => hasFlag(p, 'GY_IRREGULAR', 'GY_NO_PERIODS'),
      { en: 'Simple tests in primary care; PCOS is common and manageable, and finding it early helps with weight, sugar and future fertility.', ar: 'تحاليل بسيطة في الرعاية الأولية؛ تكيّس المبايض شائع ويمكن التعامل معه، واكتشافه مبكراً يفيد في الوزن والسكر والخصوبة مستقبلاً.' },
    ),
    insight(
      eligible,
      'age_adjusted',
      { en: 'Women 35+ trying for 6–12 months, or 40+ trying at all', ar: 'نساء من 35 يحاولن منذ 6-12 شهراً، أو من 40 يحاولن' },
      { en: 'women trying now', ar: 'نساء يحاولن الآن' },
      (p) => isF(p) && p.answers.ttc === 'yes',
      (p) => hasFlag(p, 'FS_DURATION') && p.answers.ttc_months !== 'gt12',
      { en: 'Assess the couple now rather than at 12 months; this is where earlier action changes the most.', ar: 'تقييم الزوجين الآن بدلاً من الانتظار 12 شهراً؛ هنا يُحدث التدخل المبكر أكبر فرق.' },
    ),
    insight(
      eligible,
      'men_no_test',
      { en: 'Men trying for over a year with no semen analysis', ar: 'رجال يحاولون منذ أكثر من عام دون تحليل للسائل المنوي' },
      { en: 'men trying now', ar: 'رجال يحاولون الآن' },
      (p) => !isF(p) && p.answers.ttc === 'yes',
      (p) => p.answers.ttc_months === 'gt12' && p.answers.semen_done !== 'yes',
      { en: 'Start the man’s assessment in parallel with his partner’s, not after it.', ar: 'بدء تقييم الرجل بالتوازي مع تقييم شريكته، لا بعده.' },
    ),
    insight(
      eligible,
      'preconception',
      { en: 'Planning a pregnancy within about a year', ar: 'تخطط للحمل خلال عام تقريباً' },
      { en: 'all women', ar: 'جميع النساء' },
      isF,
      (p) => hasFlag(p, 'PR_PRECONCEPTION'),
      { en: 'A preconception visit: folic acid, rubella immunity, medicines and long-term conditions.', ar: 'زيارة ما قبل الحمل: حمض الفوليك، والمناعة ضد الحصبة الألمانية، والأدوية، والحالات المزمنة.' },
    ),
    insight(
      eligible,
      'overdue',
      { en: 'Overdue routine check with a weight, sugar or blood-pressure finding', ar: 'فحص دوري متأخر مع مؤشر في الوزن أو السكر أو الضغط' },
      { en: 'everyone', ar: 'الجميع' },
      () => true,
      (p) => p.as.screeningDue && p.as.flags.some((f) => f.category === 'metabolic'),
      { en: 'Steer into IFHAS: the same visit covers heart, diabetes and, from 2025, reproductive health at 20–35.', ar: 'التوجيه إلى «إفحص»: الزيارة نفسها تشمل القلب والسكري، ومنذ 2025 الصحة الإنجابية للفئة 20-35.' },
    ),
  ]
}

/** Next steps by group (sex × age band), for the table. Hidden cells stay hidden in every view. */
export interface GroupRow {
  sex: Sex
  band: string
  n: number
  levels: Record<Level, Cell>
  options: Record<CareOption, Cell>
}

const LEVELS: Level[] = ['selfcare', 'primary', 'fertility', 'specialist', 'urgent']
export function byGroup(people: Person[] = cohort()): GroupRow[] {
  const rows = new Map<string, Person[]>()
  for (const p of people) {
    if (!p.as.eligible) continue
    const k = `${p.as.sex}|${ageBand(p.answers.age)}`
    rows.set(k, [...(rows.get(k) ?? []), p])
  }
  return [...rows.entries()]
    .map(([k, ps]) => {
      const [sex, band] = k.split('|') as [Sex, string]
      return {
        sex,
        band,
        n: ps.length,
        levels: Object.fromEntries(LEVELS.map((l) => [l, cell(ps.filter((p) => p.as.level === l).length)])) as Record<Level, Cell>,
        options: Object.fromEntries((['testing', 'counselling', 'preservation'] as CareOption[]).map((o) => [o, cell(ps.filter((p) => hasOption(p, o)).length)])) as Record<CareOption, Cell>,
      }
    })
    .sort((a, b) => a.sex.localeCompare(b.sex) || a.band.localeCompare(b.band))
}

/** Reach: does the advice reach Arabic and English speakers, and each area, in proportion? */
export interface ReachRow {
  key: string
  label: L10n
  shareOfPopulation: number
  shareOfAdvised: number
}
const AREA_NAME: Record<Area, L10n> = { abu_dhabi: { en: 'Abu Dhabi city', ar: 'مدينة أبوظبي' }, al_ain: { en: 'Al Ain', ar: 'العين' }, al_dhafra: { en: 'Al Dhafra', ar: 'الظفرة' } }
export function reach(people: Person[] = cohort()): ReachRow[] {
  const el = people.filter((p) => p.as.eligible)
  const advised = el.filter((p) => p.as.level !== 'selfcare' || p.as.flags.some((f) => f.option))
  const row = (key: string, label: L10n, f: (p: Person) => boolean): ReachRow => ({ key, label, shareOfPopulation: el.filter(f).length / el.length, shareOfAdvised: advised.filter(f).length / advised.length })
  return [
    row('ar', { en: 'Arabic speakers', ar: 'الناطقون بالعربية' }, (p) => p.lang === 'ar'),
    row('en', { en: 'English speakers', ar: 'الناطقون بالإنجليزية' }, (p) => p.lang === 'en'),
    row('female', { en: 'Women', ar: 'النساء' }, isF),
    row('male', { en: 'Men', ar: 'الرجال' }, (p) => !isF(p)),
    ...(Object.keys(AREA_NAME) as Area[]).map((a) => row(a, AREA_NAME[a], (p) => p.area === a)),
  ]
}

/**
 * Earlier action, modelled against a fixed comparison: "wait for 12 months of trying, then seek help",
 * which is how many couples still act. The age-adjusted rules (6 months from 35, straight away from 40, or
 * at once with a known cause) bring assessment forward. Months tried are taken as the middle of the answer
 * band (under 6 → 3, 6–12 → 9). This is a model of the rules' effect, not a measured outcome.
 */
export function monthsEarlier(people: Person[] = cohort()): { women: number; meanMonths: number; totalMonths: number } {
  const mid: Record<string, number> = { lt6: 3, '6to12': 9 }
  const earlier = people.filter((p) => isF(p) && p.answers.ttc === 'yes' && hasFlag(p, 'FS_DURATION') && p.answers.ttc_months !== 'gt12')
  const months = earlier.map((p) => 12 - (mid[p.answers.ttc_months as string] ?? 12))
  const total = months.reduce((a, b) => a + b, 0)
  return { women: earlier.length, meanMonths: earlier.length ? total / earlier.length : 0, totalMonths: total }
}
