import { AMH_LOW, FSH_RAISED, TSH_RANGE } from '../engine'
import type { Answers, CareOption, FiredFlag, L10n, Sex } from '../types'
import { sexOf } from '../types'
import type { CheckIn } from './checkins'
import { byWeek } from './checkins'
import type { Day } from './dates'
import { daysBetween, fmtDay } from './dates'
import type { LabEntry, LabField } from './labs'
import { LAB_KINDS, ofKind } from './labs'

/**
 * Rules over time ("trend rules", part of rules-0.2.0). Fixed and explainable, like the first-check rules:
 * each finding says which results triggered it, on which dates, and cites its source.
 *
 * Boundaries kept here, on purpose:
 * - A home estimate (Lens) never counts as a lab result. At most it suggests getting a lab test.
 * - A better result never lowers the next step by itself. An earlier low result still stands until a
 *   clinician reviews both; the app only says "improved" for information.
 * - Very high blood pressure always shows the 998 instructions.
 */

export interface DailySignal {
  date: Day
  steps?: number
  sleepH?: number
  restingHr?: number
  weightKg?: number
  exerciseMin?: number
}

export interface TrendInput {
  answers: Answers
  labs: LabEntry[]
  checkins: CheckIn[]
  signals: DailySignal[]
  today: Day
}

type Level = FiredFlag['level']

interface TrendRule {
  id: string
  category: FiredFlag['category']
  level: Level
  emergency?: boolean
  changeable: boolean
  sources: string[]
  title: L10n
  why: L10n
  action: L10n
  /** Applies only to this sex; rules without it apply to both. */
  sex?: Sex
  option?: CareOption
  test: (c: TrendInput) => L10n[] | null
}

/** One cycle: from one period start to the next, as recorded in weekly check-ins. */
export interface CycleLength {
  start: Day
  days: number
}

/**
 * Cycle lengths over time, from the period starts in weekly check-ins. A gap of more than 90 days is not
 * counted as a cycle (a missed check-in is more likely than a 3-month cycle); the gap rule looks at it instead.
 */
export function cycleLengths(checkins: CheckIn[]): CycleLength[] {
  const starts = [...new Set(byWeek(checkins).map((x) => x.periodStart).filter((d): d is Day => !!d))].sort()
  const out: CycleLength[] = []
  for (let i = 1; i < starts.length; i++) {
    const days = daysBetween(starts[i - 1], starts[i])
    if (days >= 10 && days <= 90) out.push({ start: starts[i - 1], days })
  }
  return out
}

const lastPeriod = (checkins: CheckIn[]): Day | undefined =>
  byWeek(checkins)
    .map((x) => x.periodStart)
    .filter((d): d is Day => !!d)
    .sort()
    .at(-1)

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))
const day = (d: Day): L10n => ({ en: fmtDay(d, 'en'), ar: fmtDay(d, 'ar') })
const lab = (c: TrendInput) => ofKind(c.labs, 'semen')
const field = (kind: 'semen' | 'lens' | 'ovarian', id: string) => LAB_KINDS[kind].fields.find((f) => f.id === id) as LabField
const lowFields = (e: LabEntry) => LAB_KINDS[e.kind].fields.filter((f) => f.low !== undefined && e.values[f.id] !== undefined && e.values[f.id] < f.low)

function valueLine(e: LabEntry, f: LabField): L10n {
  const d = day(e.date)
  return { en: `${f.label.en}: ${fmt(e.values[f.id])} ${f.unit.en} on ${d.en}`, ar: `${f.label.ar}: ${fmt(e.values[f.id])} ${f.unit.ar} في ${d.ar}` }
}

const tryingNow = (a: Answers) => a.ttc === 'yes' || a.ttc === 'planning'

export const TREND_RULES: TrendRule[] = [
  {
    id: 'LT_SEMEN_LOW_TWICE',
    sex: 'male',
    category: 'test',
    level: 'specialist',
    changeable: true,
    sources: ['WHO2021', 'SEMEN_VARIABILITY', 'AUA2020'],
    title: { en: 'Below the usual range on two tests', ar: 'أقل من المعدل المعتاد في تحليلين' },
    why: {
      en: 'Because results vary from one sample to the next, a value that is low on two tests taken weeks apart is more meaningful than one low result.',
      ar: 'لأن النتائج تتفاوت من عينة لأخرى، فإن القيمة المنخفضة في تحليلين يفصل بينهما أسابيع أهم من نتيجة منخفضة واحدة.',
    },
    action: {
      en: "Bring both results to a men's health specialist, who may order hormone tests or an examination.",
      ar: 'أحضر النتيجتين إلى أخصائي صحة الرجل، فقد يطلب فحوصات هرمونية أو فحصاً سريرياً.',
    },
    test: (c) => {
      const tests = lab(c)
      if (tests.length < 2) return null
      const [prev, last] = tests.slice(-2)
      if (daysBetween(prev.date, last.date) < 28) return null
      const both = lowFields(last).filter((f) => lowFields(prev).some((g) => g.id === f.id))
      return both.length ? both.flatMap((f) => [valueLine(prev, f), valueLine(last, f)]) : null
    },
  },
  {
    id: 'LT_SEMEN_RECENT_LOW',
    sex: 'male',
    category: 'test',
    level: 'specialist',
    changeable: true,
    sources: ['WHO2021', 'AUA2020', 'SEMEN_VARIABILITY'],
    title: { en: 'A recent lab result below the usual range', ar: 'نتيجة مخبرية حديثة أقل من المعدل المعتاد' },
    why: {
      en: 'One result below the WHO lower limit is not a diagnosis, but it is worth a specialist review. A later better result does not cancel it: the specialist looks at all results together.',
      ar: 'نتيجة واحدة أقل من الحد الأدنى لمنظمة الصحة العالمية لا تعني تشخيصاً، لكنها تستحق مراجعة الأخصائي. ولا تلغيها نتيجة أفضل لاحقة، فالأخصائي ينظر إلى جميع النتائج معاً.',
    },
    action: {
      en: "Share your results with a men's health specialist. A repeat test is usually done about 3 months later.",
      ar: 'شارك نتائجك مع أخصائي صحة الرجل. يُعاد التحليل عادةً بعد نحو 3 أشهر.',
    },
    test: (c) => {
      const recentLow = lab(c).filter((e) => daysBetween(e.date, c.today) <= 365 && lowFields(e).length > 0)
      if (!recentLow.length) return null
      const e = recentLow[recentLow.length - 1]
      return lowFields(e).map((f) => valueLine(e, f))
    },
  },
  {
    id: 'LT_SEMEN_IMPROVED',
    sex: 'male',
    category: 'test',
    level: 'info',
    changeable: true,
    sources: ['SEMEN_VARIABILITY', 'SPERM_CYCLE'],
    title: { en: 'Your latest lab result is better', ar: 'نتيجتك المخبرية الأحدث أفضل' },
    why: {
      en: 'Values that were low are now within the usual range. Changes like this can follow about 3 months of new habits, and results also vary naturally between tests.',
      ar: 'القيم التي كانت منخفضة أصبحت ضمن المعدل المعتاد. قد تأتي هذه التغيرات بعد نحو 3 أشهر من العادات الجديدة، كما تتفاوت النتائج طبيعياً بين التحاليل.',
    },
    action: {
      en: 'Keep the habits that help, and review both results with your doctor. This does not change your next step on its own.',
      ar: 'حافظ على العادات المفيدة، وراجع النتيجتين مع طبيبك. هذا لا يغيّر خطوتك التالية بمفرده.',
    },
    test: (c) => {
      const tests = lab(c)
      if (tests.length < 2) return null
      const [prev, last] = tests.slice(-2)
      const better = lowFields(prev).filter((f) => last.values[f.id] !== undefined && last.values[f.id] >= (f.low as number))
      return better.length ? better.flatMap((f) => [valueLine(prev, f), valueLine(last, f)]) : null
    },
  },
  {
    id: 'LT_LENS_LOW',
    sex: 'male',
    category: 'test',
    level: 'primary',
    changeable: true,
    sources: ['WHO2021', 'HOME_SPERM_TESTS'],
    title: { en: 'Home estimate below the usual range', ar: 'تقدير منزلي أقل من المعدل المعتاد' },
    why: {
      en: 'Your home estimate of moving sperm was low. A home estimate can be wrong in both directions, so the next step is a proper lab test, not a conclusion.',
      ar: 'كان تقديرك المنزلي للحيوانات المنوية المتحركة منخفضاً. قد يخطئ التقدير المنزلي في الاتجاهين، لذا فالخطوة التالية تحليل مخبري، لا استنتاج.',
    },
    action: {
      en: 'Book a lab semen analysis through your family doctor or a fertility service.',
      ar: 'احجز تحليلاً مخبرياً للسائل المنوي عبر طبيب الأسرة أو خدمة الخصوبة.',
    },
    test: (c) => {
      const est = ofKind(c.labs, 'lens').at(-1)
      if (!est) return null
      if (lab(c).some((e) => e.date >= est.date)) return null // a lab test since then takes over
      const low = lowFields(est)
      return low.length ? low.map((f) => valueLine(est, field('lens', f.id))) : null
    },
  },
  {
    id: 'LT_LENS_OK',
    sex: 'male',
    category: 'test',
    level: 'info',
    changeable: false,
    sources: ['NICE_CG156', 'HOME_SPERM_TESTS'],
    title: { en: 'Home estimate looks within the usual range', ar: 'يبدو التقدير المنزلي ضمن المعدل المعتاد' },
    why: {
      en: 'A home estimate checks only movement and cannot rule a problem out.',
      ar: 'يقيس التقدير المنزلي الحركة فقط، ولا يستطيع استبعاد وجود مشكلة.',
    },
    action: {
      en: 'If you have been trying for a child for 12 months (6 if your partner is 35 or older), get a lab test anyway.',
      ar: 'إذا كنتما تحاولان الإنجاب منذ 12 شهراً (أو 6 أشهر إذا كان عمر الشريكة 35 عاماً أو أكثر)، فأجرِ تحليلاً مخبرياً على أي حال.',
    },
    test: (c) => {
      const est = ofKind(c.labs, 'lens').at(-1)
      if (!est || lowFields(est).length || lab(c).some((e) => e.date >= est.date)) return null
      return [valueLine(est, field('lens', 'total_motility'))]
    },
  },
  {
    id: 'LT_BP_VERY_HIGH',
    category: 'metabolic',
    level: 'urgent',
    changeable: true,
    sources: ['BP_GUIDE'],
    title: { en: 'Very high blood pressure reading', ar: 'قراءة ضغط دم مرتفعة جداً' },
    why: {
      en: 'A reading above 180 (top number) or above 120 (bottom number) needs prompt attention.',
      ar: 'القراءة التي تتجاوز 180 (الرقم الأعلى) أو 120 (الرقم الأدنى) تحتاج إلى اهتمام سريع.',
    },
    action: {
      en: 'Sit quietly for 5 minutes and measure again. If it is still this high, see a doctor today. If you also have chest pain, shortness of breath, weakness, trouble speaking or changes in vision, call 998 now.',
      ar: 'اجلس بهدوء 5 دقائق ثم أعد القياس. إذا بقي مرتفعاً هكذا فراجع طبيباً اليوم. وإذا رافقه ألم في الصدر أو ضيق في التنفس أو ضعف أو صعوبة في الكلام أو تغيّر في الرؤية، فاتصل بالرقم 998 فوراً.',
    },
    test: (c) => {
      const last = ofKind(c.labs, 'bp').at(-1)
      if (!last || daysBetween(last.date, c.today) > 7) return null
      const { sys = 0, dia = 0 } = last.values
      return sys > 180 || dia > 120 ? [{ en: `${sys}/${dia} mmHg on ${day(last.date).en}`, ar: `${sys}/${dia} ملم زئبق في ${day(last.date).ar}` }] : null
    },
  },
  {
    id: 'LT_BP_HIGH_TWICE',
    category: 'metabolic',
    level: 'primary',
    changeable: true,
    sources: ['BP_GUIDE'],
    title: { en: 'Blood pressure high on two days', ar: 'ضغط دم مرتفع في يومين' },
    why: {
      en: 'Readings at or above 140/90 on two different days are a sign worth checking. High blood pressure is common, usually has no symptoms, and is treatable.',
      ar: 'القراءات التي تبلغ 140/90 أو أكثر في يومين مختلفين علامة تستحق الفحص. ارتفاع ضغط الدم شائع، وغالباً بلا أعراض، وقابل للعلاج.',
    },
    action: {
      en: 'See your family doctor and bring your readings. Your routine health check (IFHAS, for Thiqa cardholders) also measures it.',
      ar: 'راجع طبيب الأسرة وأحضر قراءاتك. ويقيسه أيضاً فحصك الصحي الدوري («إفحص» لحاملي بطاقة «ثقة»).',
    },
    test: (c) => {
      const high = ofKind(c.labs, 'bp').filter((e) => daysBetween(e.date, c.today) <= 90 && ((e.values.sys ?? 0) >= 140 || (e.values.dia ?? 0) >= 90))
      const days = [...new Set(high.map((e) => e.date))]
      if (days.length < 2) return null
      return high.slice(-2).map((e) => ({ en: `${e.values.sys}/${e.values.dia} mmHg on ${day(e.date).en}`, ar: `${e.values.sys}/${e.values.dia} ملم زئبق في ${day(e.date).ar}` }))
    },
  },
  {
    id: 'LT_HBA1C_HIGH',
    category: 'metabolic',
    level: 'primary',
    changeable: true,
    sources: ['ADA_SOC'],
    title: { en: 'HbA1c above the usual range', ar: 'السكر التراكمي أعلى من المعدل المعتاد' },
    why: {
      en: 'HbA1c shows your average blood sugar over about 3 months. From 5.7% it is above the usual range; from 6.5% it is at the level doctors use to check for diabetes. Blood sugar also affects sperm and erections.',
      ar: 'يُظهر السكر التراكمي متوسط سكر الدم خلال نحو 3 أشهر. من 5.7% يكون أعلى من المعدل المعتاد، ومن 6.5% يبلغ المستوى الذي يعتمده الأطباء للتحقق من السكري. ويؤثر سكر الدم أيضاً على الحيوانات المنوية والانتصاب.',
    },
    action: {
      en: 'See your family doctor. Only a doctor can confirm what the result means, usually with a repeat test.',
      ar: 'راجع طبيب الأسرة. الطبيب وحده يؤكد معنى النتيجة، وغالباً بإعادة التحليل.',
    },
    test: (c) => {
      const last = ofKind(c.labs, 'hba1c').at(-1)
      if (!last || (last.values.hba1c ?? 0) < 5.7) return null
      return [{ en: `HbA1c ${fmt(last.values.hba1c)}% on ${day(last.date).en}`, ar: `السكر التراكمي ${fmt(last.values.hba1c)}% في ${day(last.date).ar}` }]
    },
  },
  {
    id: 'LT_TESTOSTERONE_LOW',
    sex: 'male',
    category: 'metabolic',
    level: 'primary',
    changeable: true,
    sources: ['AUA_T2018'],
    title: { en: 'Testosterone low on one test', ar: 'التستوستيرون منخفض في تحليل واحد' },
    why: {
      en: 'Testosterone changes through the day and from day to day, so doctors confirm a low result with a second morning test before deciding anything.',
      ar: 'يتغيّر التستوستيرون خلال اليوم ومن يوم لآخر، لذا يؤكد الأطباء النتيجة المنخفضة بتحليل صباحي ثانٍ قبل اتخاذ أي قرار.',
    },
    action: {
      en: 'See your family doctor for a repeat morning test. If you are trying for a child, do not start testosterone unless a specialist advises it: it can stop sperm production.',
      ar: 'راجع طبيب الأسرة لإعادة التحليل صباحاً. وإذا كنت تحاول الإنجاب، فلا تبدأ التستوستيرون إلا بنصيحة أخصائي، فقد يوقف إنتاج الحيوانات المنوية.',
    },
    test: (c) => {
      const last = ofKind(c.labs, 'testosterone').at(-1)
      if (!last || (last.values.total_t ?? 99) >= 10.4) return null
      return [{ en: `${fmt(last.values.total_t)} nmol/L on ${day(last.date).en}`, ar: `${fmt(last.values.total_t)} نانومول/لتر في ${day(last.date).ar}` }]
    },
  },
  {
    id: 'LT_WEIGHT_DOWN',
    category: 'lifestyle',
    level: 'info',
    changeable: true,
    sources: ['BMI_SPERM'],
    title: { en: 'Weight down by 5% or more', ar: 'انخفض الوزن 5% أو أكثر' },
    why: {
      en: 'Losing extra weight helps heart health, and in a trial of men with obesity, sperm counts rose after weight loss.',
      ar: 'يفيد إنقاص الوزن الزائد صحة القلب، وفي تجربة على رجال يعانون من السمنة ارتفع عدد الحيوانات المنوية بعد إنقاص الوزن.',
    },
    action: { en: 'Keep going at a steady pace.', ar: 'استمر بوتيرة ثابتة.' },
    test: (c) => {
      const w = weights(c)
      if (w.length < 2) return null
      const first = w[0]
      const last = w[w.length - 1]
      return last.kg <= first.kg * 0.95
        ? [{ en: `${fmt(first.kg)} kg on ${day(first.date).en} → ${fmt(last.kg)} kg on ${day(last.date).en}`, ar: `${fmt(first.kg)} كغ في ${day(first.date).ar} ← ${fmt(last.kg)} كغ في ${day(last.date).ar}` }]
        : null
    },
  },
  {
    id: 'LT_HEAT_WEEKS',
    sex: 'male',
    category: 'lifestyle',
    level: 'selfcare',
    changeable: true,
    sources: ['HEAT_REVIEW', 'SPERM_CYCLE'],
    title: { en: 'Several hot weeks in a row', ar: 'عدة أسابيع حارة متتالية' },
    why: {
      en: 'New sperm take about two months to form, so heat in these weeks can show in a test two to three months from now.',
      ar: 'تحتاج الحيوانات المنوية الجديدة إلى نحو شهرين لتتكوّن، لذا قد تظهر حرارة هذه الأسابيع في تحليل بعد شهرين إلى ثلاثة أشهر.',
    },
    action: {
      en: 'Plan cool breaks, loose cotton underwear and water. If a semen test is planned, mention the hot weeks to your doctor.',
      ar: 'خطّط لفترات راحة باردة، وارتدِ ملابس داخلية قطنية فضفاضة، واشرب الماء. وإذا كان تحليل السائل المنوي مقرراً فأخبر طبيبك بالأسابيع الحارة.',
    },
    test: (c) => {
      const last6 = byWeek(c.checkins).filter((x) => daysBetween(x.week, c.today) <= 42)
      const hot = last6.filter((x) => x.heatDays === '3to5' || x.heatDays === '6to7')
      return hot.length >= 3 ? [{ en: `${hot.length} of your last ${last6.length} weekly check-ins had 3 or more hot days`, ar: `${hot.length} من آخر ${last6.length} تسجيلات أسبوعية شملت 3 أيام حارة أو أكثر` }] : null
    },
  },
  {
    id: 'LT_SLEEP_SHORT',
    category: 'lifestyle',
    level: 'selfcare',
    changeable: true,
    sources: ['SHIFT_SLEEP'],
    title: { en: 'Short sleep most nights', ar: 'نوم قصير معظم الليالي' },
    why: {
      en: 'Regular sleep under 6 hours affects weight, blood pressure, mood and reproductive health.',
      ar: 'يؤثر النوم المنتظم لأقل من 6 ساعات على الوزن وضغط الدم والمزاج والصحة الإنجابية.',
    },
    action: { en: 'Aim for a fixed bedtime and 7 hours where you can.', ar: 'حاول تثبيت موعد النوم والنوم 7 ساعات قدر الإمكان.' },
    test: (c) => {
      const nights = c.signals.filter((s) => s.sleepH !== undefined && daysBetween(s.date, c.today) <= 14)
      if (nights.length >= 7) {
        const avg = nights.reduce((a, s) => a + (s.sleepH as number), 0) / nights.length
        return avg < 6 ? [{ en: `Average ${avg.toFixed(1)} h a night over the last 2 weeks (from your phone)`, ar: `متوسط ${avg.toFixed(1)} ساعة في الليلة خلال الأسبوعين الماضيين (من هاتفك)` }] : null
      }
      const recentWeeks = byWeek(c.checkins).filter((x) => daysBetween(x.week, c.today) <= 28)
      const short = recentWeeks.filter((x) => x.sleep === 'lt6')
      return recentWeeks.length >= 3 && short.length >= 3 ? [{ en: `${short.length} of your last ${recentWeeks.length} check-ins: under 6 hours`, ar: `${short.length} من آخر ${recentWeeks.length} تسجيلات: أقل من 6 ساعات` }] : null
    },
  },

  // ---- Women: cycle and hormones over time ----
  {
    id: 'LT_CYCLE_IRREGULAR',
    sex: 'female',
    category: 'history',
    level: 'primary',
    changeable: true,
    option: 'testing',
    sources: ['PCOS2023', 'FIGO2018'],
    title: { en: 'Your cycles have been irregular lately', ar: 'كانت دوراتك غير منتظمة مؤخراً' },
    why: {
      en: 'Cycles shorter than 21 days, longer than 35, or varying by more than about 9 days from one to the next can mean ovulation is not regular. It is common, often has a simple reason, and is worth checking rather than waiting.',
      ar: 'الدورات الأقصر من 21 يوماً أو الأطول من 35، أو التي يتغير طولها بأكثر من نحو 9 أيام من دورة لأخرى، قد تعني أن التبويض غير منتظم. هذا شائع، وغالباً سببه بسيط، ويستحق الفحص بدل الانتظار.',
    },
    action: { en: 'Share your cycle record with your family doctor or a women’s health clinic.', ar: 'شاركي سجل دورتك مع طبيب الأسرة أو عيادة صحة المرأة.' },
    test: (c) => {
      const last = cycleLengths(c.checkins).slice(-4)
      if (last.length < 3) return null
      const days = last.map((x) => x.days)
      const out = days.some((d) => d < 21 || d > 35)
      const spread = Math.max(...days) - Math.min(...days)
      if (!out && spread <= 9) return null
      return [{ en: `Your last ${days.length} cycles: ${days.join(', ')} days`, ar: `آخر ${days.length} دورات: ${days.join('، ')} يوماً` }]
    },
  },
  {
    id: 'LT_CYCLE_GAP',
    sex: 'female',
    category: 'history',
    level: 'primary',
    changeable: true,
    option: 'testing',
    sources: ['ESHRE_POI2024', 'PCOS2023'],
    title: { en: 'No period recorded for over 3 months', ar: 'لم تُسجَّل دورة منذ أكثر من 3 أشهر' },
    why: {
      en: 'You have kept checking in, but no period start has been recorded for more than 90 days. If you are not pregnant, breastfeeding or using hormones, this is worth checking.',
      ar: 'واصلتِ التسجيل، لكن لم تُسجَّل بداية دورة منذ أكثر من 90 يوماً. إذا لم تكوني حاملاً أو مرضعة أو تستخدمين هرمونات، فهذا يستحق الفحص.',
    },
    action: { en: 'Do a pregnancy test, then see your family doctor or a women’s health clinic.', ar: 'أجري اختبار حمل، ثم راجعي طبيب الأسرة أو عيادة صحة المرأة.' },
    test: (c) => {
      const lp = lastPeriod(c.checkins)
      if (!lp) return null
      const gap = daysBetween(lp, c.today)
      const since = byWeek(c.checkins).filter((x) => x.week > lp).length
      return gap > 90 && since >= 8 ? [{ en: `Last period recorded on ${day(lp).en} (${gap} days ago)`, ar: `آخر دورة مسجلة في ${day(lp).ar} (قبل ${gap} يوماً)` }] : null
    },
  },
  {
    id: 'LT_AMH_LOW',
    sex: 'female',
    category: 'test',
    level: 'primary',
    changeable: false,
    option: 'preservation',
    sources: ['ASRM_ORT2020', 'AMH_STEINER2017'],
    title: { en: 'Egg reserve (AMH) lower than typical', ar: 'مخزون البويضات (AMH) أقل من المعتاد' },
    why: {
      en: 'AMH shows roughly how many eggs remain, not their quality, and it does not predict natural pregnancy. A lower value matters most for timing and for planning IVF or egg freezing.',
      ar: 'يُظهر AMH تقريباً عدد البويضات المتبقية لا جودتها، ولا يتنبأ بالحمل الطبيعي. تكون أهمية القيمة المنخفضة أكبر في التوقيت وفي التخطيط لأطفال الأنابيب أو تجميد البويضات.',
    },
    action: { en: 'Talk it through with your doctor or a fertility specialist: what it means at your age, and whether your plans should change.', ar: 'ناقشي النتيجة مع طبيبك أو أخصائية الخصوبة: ماذا تعني في عمرك، وهل ينبغي تغيير خططك.' },
    test: (c) => {
      const e = ofKind(c.labs, 'ovarian').filter((x) => x.values.amh !== undefined).at(-1)
      return e && e.values.amh < AMH_LOW ? [valueLine(e, field('ovarian', 'amh'))] : null
    },
  },
  {
    id: 'LT_AMH_DIRECTION',
    sex: 'female',
    category: 'test',
    level: 'info',
    changeable: false,
    sources: ['ASRM_ORT2020'],
    title: { en: 'How your AMH has changed', ar: 'كيف تغيّر AMH لديكِ' },
    why: {
      en: 'AMH falls slowly with age for everyone. The direction over several years tells you more than any single value, and labs differ, so the same lab is best for comparing.',
      ar: 'ينخفض AMH ببطء مع العمر لدى الجميع. يخبرك الاتجاه على مدى عدة سنوات أكثر من أي قيمة منفردة، وتختلف المختبرات، لذا يُفضّل المختبر نفسه للمقارنة.',
    },
    action: { en: 'Bring the dates and values to your next visit.', ar: 'أحضري التواريخ والقيم إلى زيارتك القادمة.' },
    test: (c) => {
      const list = ofKind(c.labs, 'ovarian').filter((x) => x.values.amh !== undefined)
      if (list.length < 2) return null
      const a = list[0]
      const b = list[list.length - 1]
      const years = daysBetween(a.date, b.date) / 365.25
      if (years < 0.5) return null
      return [valueLine(a, field('ovarian', 'amh')), valueLine(b, field('ovarian', 'amh')), { en: `Over ${years.toFixed(1)} years`, ar: `على مدى ${years.toFixed(1)} سنة` }]
    },
  },
  {
    id: 'LT_FSH_RAISED',
    sex: 'female',
    category: 'test',
    level: 'primary',
    changeable: false,
    sources: ['ASRM_ORT2020'],
    title: { en: 'Early-cycle FSH above 10', ar: 'هرمون FSH أعلى من 10 في بداية الدورة' },
    why: { en: 'A raised FSH early in the cycle can be a sign of a lower egg reserve. It varies from cycle to cycle.', ar: 'قد يكون ارتفاع FSH في بداية الدورة علامة على انخفاض مخزون البويضات، ويتفاوت من دورة لأخرى.' },
    action: { en: 'Discuss it with your doctor, who may repeat it alongside AMH.', ar: 'ناقشيه مع طبيبك، فقد يعيده مع تحليل AMH.' },
    test: (c) => {
      const e = ofKind(c.labs, 'ovarian').filter((x) => x.values.fsh !== undefined).at(-1)
      return e && e.values.fsh >= FSH_RAISED ? [valueLine(e, field('ovarian', 'fsh'))] : null
    },
  },
  {
    id: 'LT_TSH_OUT',
    sex: 'female',
    category: 'test',
    level: 'primary',
    changeable: true,
    sources: ['ATA2017'],
    title: { en: 'Thyroid test outside the usual range', ar: 'تحليل الغدة الدرقية خارج المعدل المعتاد' },
    why: { en: 'Thyroid levels affect cycles and ovulation, and they matter most before and during pregnancy. Treatment is simple.', ar: 'تؤثر مستويات الغدة الدرقية على الدورة والتبويض، وتزداد أهميتها قبل الحمل وأثناءه، وعلاجها بسيط.' },
    action: { en: 'See your family doctor to repeat it and decide on treatment.', ar: 'راجعي طبيب الأسرة لإعادة التحليل وتحديد العلاج.' },
    test: (c) => {
      const e = ofKind(c.labs, 'ovarian').filter((x) => x.values.tsh !== undefined).at(-1)
      return e && (e.values.tsh < TSH_RANGE[0] || e.values.tsh > TSH_RANGE[1]) ? [valueLine(e, field('ovarian', 'tsh'))] : null
    },
  },
]

/** Weights over time from lab entries, check-ins and the phone, oldest first, one per day. */
export function weights(c: Pick<TrendInput, 'labs' | 'checkins' | 'signals'>): { date: Day; kg: number }[] {
  const byDay = new Map<Day, number>()
  for (const s of c.signals) if (s.weightKg !== undefined) byDay.set(s.date, s.weightKg)
  for (const x of c.checkins) if (x.weightKg !== undefined) byDay.set(x.week, x.weightKg)
  for (const e of ofKind(c.labs, 'weight')) if (e.values.weight_kg !== undefined) byDay.set(e.date, e.values.weight_kg)
  return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, kg]) => ({ date, kg }))
}

export function trendFlags(c: TrendInput): FiredFlag[] {
  const out: FiredFlag[] = []
  const sex = sexOf(c.answers)
  for (const r of TREND_RULES) {
    if (r.sex && r.sex !== sex) continue
    const because = r.test(c)
    if (!because) continue
    out.push({ id: r.id, category: r.category, level: r.level, emergency: r.emergency ?? false, changeable: r.changeable, title: r.title, why: r.why, action: r.action, because, sources: r.sources, ...(r.option ? { option: r.option } : {}) })
  }
  // The two-test rule says more than the one-test rule: show one of them.
  return out.some((f) => f.id === 'LT_SEMEN_LOW_TWICE') ? out.filter((f) => f.id !== 'LT_SEMEN_RECENT_LOW') : out
}

export const isTrying = tryingNow
