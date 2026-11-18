import type { FiredFlag, L10n, Sex } from '../types'

/**
 * Work and environment profile. A job is never a diagnosis: exposures only add protective advice, and a
 * suggestion to mention the job to a doctor. They never raise the next step on their own.
 */
export type Occupation =
  | 'office'
  | 'driver'
  | 'outdoor'
  | 'oil_gas'
  | 'agri_pest'
  | 'metal_weld'
  | 'kitchen_laundry'
  | 'radiation_aviation'
  | 'security'
  | 'other'

export type Exposure = 'heat' | 'sitting' | 'solvents' | 'pesticides' | 'metals' | 'radiation' | 'night'

export type City = 'abu_dhabi' | 'al_ain' | 'al_dhafra'

export interface WorkProfile {
  occupation: Occupation
  nightShifts: boolean
  /** Extra exposures the person ticked, on top of those that come with the job. */
  extra: Exposure[]
  city?: City
  /** The person allowed a weather lookup for their city (only the city is sent). */
  heatAlerts: boolean
  updatedAt: string
}

export const OCCUPATIONS: { value: Occupation; label: L10n; exposures: Exposure[] }[] = [
  { value: 'office', label: { en: 'Office or desk work', ar: 'عمل مكتبي' }, exposures: ['sitting'] },
  { value: 'driver', label: { en: 'Driver (taxi, delivery, truck, bus)', ar: 'سائق (أجرة، توصيل، شاحنة، حافلة)' }, exposures: ['sitting', 'heat'] },
  { value: 'outdoor', label: { en: 'Outdoor construction or site work', ar: 'عمل إنشائي أو ميداني في الخارج' }, exposures: ['heat'] },
  { value: 'oil_gas', label: { en: 'Oil, gas or petrochemical plant', ar: 'منشأة نفط أو غاز أو بتروكيماويات' }, exposures: ['heat', 'solvents'] },
  { value: 'agri_pest', label: { en: 'Farming, gardening or pest control', ar: 'زراعة أو بستنة أو مكافحة آفات' }, exposures: ['heat', 'pesticides'] },
  { value: 'metal_weld', label: { en: 'Welding, metalwork or battery work', ar: 'لحام أو أعمال معادن أو بطاريات' }, exposures: ['heat', 'metals'] },
  { value: 'kitchen_laundry', label: { en: 'Kitchen, bakery or laundry', ar: 'مطبخ أو مخبز أو مغسلة' }, exposures: ['heat'] },
  { value: 'radiation_aviation', label: { en: 'Radiology, nuclear medicine or flight crew', ar: 'أشعة أو طب نووي أو طاقم طيران' }, exposures: ['radiation'] },
  { value: 'security', label: { en: 'Security, police or armed forces', ar: 'أمن أو شرطة أو قوات مسلحة' }, exposures: ['heat'] },
  { value: 'other', label: { en: 'Other, or prefer not to say', ar: 'غير ذلك، أو أفضّل عدم الإجابة' }, exposures: [] },
]

export const EXTRA_EXPOSURES: { value: Exposure; label: L10n }[] = [
  { value: 'heat', label: { en: 'Strong heat (outdoors, ovens, furnaces, sauna)', ar: 'حرارة شديدة (في الخارج، أفران، سونا)' } },
  { value: 'sitting', label: { en: 'Sitting for long hours, or a laptop on the lap', ar: 'الجلوس لساعات طويلة أو الحاسوب على الحِجر' } },
  { value: 'solvents', label: { en: 'Paints, fuels or solvents', ar: 'دهانات أو وقود أو مذيبات' } },
  { value: 'pesticides', label: { en: 'Pesticides or weed killers', ar: 'مبيدات حشرية أو عشبية' } },
  { value: 'metals', label: { en: 'Lead or metal fumes', ar: 'الرصاص أو أبخرة المعادن' } },
  { value: 'radiation', label: { en: 'Radiation at work', ar: 'إشعاع في العمل' } },
]

export const CITIES: { value: City; label: L10n; lat: number; lon: number }[] = [
  { value: 'abu_dhabi', label: { en: 'Abu Dhabi city', ar: 'مدينة أبوظبي' }, lat: 24.45118, lon: 54.39696 },
  { value: 'al_ain', label: { en: 'Al Ain', ar: 'العين' }, lat: 24.19167, lon: 55.76056 },
  { value: 'al_dhafra', label: { en: 'Al Dhafra (Madinat Zayed)', ar: 'الظفرة (مدينة زايد)' }, lat: 23.6999, lon: 53.74756 },
]

export function exposuresOf(w: WorkProfile | null): Exposure[] {
  if (!w) return []
  const base = OCCUPATIONS.find((o) => o.value === w.occupation)?.exposures ?? []
  const all = new Set<Exposure>([...base, ...w.extra])
  if (w.nightShifts) all.add('night')
  return [...all]
}

interface ExposureInfo {
  id: string
  level: 'selfcare' | 'info'
  title: L10n
  why: L10n
  action: L10n
  sources: string[]
  /** When true, the care journey offers an occupational-health visit (optional). */
  occupationalHealth?: boolean
}

export const EXPOSURE_INFO: Record<Exposure, ExposureInfo> = {
  heat: {
    id: 'EX_HEAT',
    level: 'selfcare',
    title: { en: 'Regular heat at work', ar: 'التعرّض المنتظم للحرارة في العمل' },
    why: {
      en: 'Sperm are made best a few degrees below body temperature. Regular strong heat can lower sperm quality, and it usually recovers once the heat is reduced.',
      ar: 'تُنتَج الحيوانات المنوية بأفضل شكل عند حرارة أقل ببضع درجات من حرارة الجسم. قد تُضعف الحرارة الشديدة المنتظمة جودتها، وعادةً ما تتحسن بعد تقليل التعرّض.',
    },
    action: {
      en: 'Take cool breaks in the shade, drink water, wear loose cotton underwear, and keep to the midday work break (no outdoor work 12:30–3:00 pm, 15 June–15 September).',
      ar: 'خذ فترات راحة باردة في الظل، واشرب الماء، والبس ملابس داخلية قطنية فضفاضة، والتزم باستراحة منتصف النهار (لا عمل في الخارج من 12:30 إلى 3:00 عصراً، من 15 يونيو إلى 15 سبتمبر).',
    },
    sources: ['HEAT_REVIEW', 'MIDDAY_BREAK'],
  },
  sitting: {
    id: 'EX_SITTING',
    level: 'selfcare',
    title: { en: 'Long hours seated', ar: 'الجلوس لساعات طويلة' },
    why: {
      en: 'Long drives and a laptop on the lap raise the temperature of the scrotum.',
      ar: 'ترفع القيادة الطويلة ووضع الحاسوب على الحِجر حرارة كيس الصفن.',
    },
    action: {
      en: 'Stand up and walk for a few minutes every hour or two, avoid seat heating, and keep the laptop on a desk.',
      ar: 'قف وامشِ بضع دقائق كل ساعة أو ساعتين، وتجنّب تدفئة المقعد، وضع الحاسوب على مكتب.',
    },
    sources: ['DRIVERS_HEAT', 'LAPTOP_HEAT'],
  },
  solvents: {
    id: 'EX_SOLVENTS',
    level: 'info',
    title: { en: 'Solvents or fuels at work', ar: 'مذيبات أو وقود في العمل' },
    why: {
      en: 'Some organic solvents have been linked with poorer semen quality.',
      ar: 'رُبطت بعض المذيبات العضوية بانخفاض جودة السائل المنوي.',
    },
    action: {
      en: 'Use the protective equipment your site provides. If you are trying for a child, tell your doctor what you work with.',
      ar: 'استخدم معدات الحماية التي يوفرها موقع العمل. إذا كنت تحاول الإنجاب، فأخبر طبيبك بما تتعامل معه في عملك.',
    },
    sources: ['SOLVENTS'],
    occupationalHealth: true,
  },
  pesticides: {
    id: 'EX_PESTICIDES',
    level: 'info',
    title: { en: 'Pesticides at work', ar: 'مبيدات في العمل' },
    why: {
      en: 'Studies of men who handle pesticides often find lower semen quality.',
      ar: 'كثيراً ما تجد الدراسات انخفاض جودة السائل المنوي لدى الرجال الذين يتعاملون مع المبيدات.',
    },
    action: {
      en: 'Wear gloves and a mask when mixing or spraying, wash before eating, and tell your doctor about your work if you are trying for a child.',
      ar: 'البس القفازات والكمامة عند الخلط أو الرش، واغسل يديك قبل الأكل، وأخبر طبيبك بطبيعة عملك إذا كنت تحاول الإنجاب.',
    },
    sources: ['PESTICIDES'],
    occupationalHealth: true,
  },
  metals: {
    id: 'EX_METALS',
    level: 'info',
    title: { en: 'Lead or metal fumes at work', ar: 'الرصاص أو أبخرة المعادن في العمل' },
    why: {
      en: 'High lead exposure can lower sperm count. Welding also adds heat.',
      ar: 'قد يخفّض التعرّض العالي للرصاص عدد الحيوانات المنوية، كما يضيف اللحام حرارة.',
    },
    action: {
      en: 'Use fume extraction and a respirator. Ask your occupational health service whether a blood lead test is right for you.',
      ar: 'استخدم شفط الأبخرة وجهاز التنفس. واسأل خدمة الصحة المهنية إن كان تحليل الرصاص في الدم مناسباً لك.',
    },
    sources: ['LEAD'],
    occupationalHealth: true,
  },
  radiation: {
    id: 'EX_RADIATION',
    level: 'info',
    title: { en: 'Radiation at work', ar: 'الإشعاع في العمل' },
    why: {
      en: 'The testes are sensitive to radiation. Work limits keep doses low, so the main protection is following them.',
      ar: 'الخصيتان حساستان للإشعاع. تُبقي حدود العمل الجرعات منخفضة، لذا فالحماية الأهم هي الالتزام بها.',
    },
    action: {
      en: 'Wear your dose badge and shielding, and mention your work to your doctor if you are trying for a child.',
      ar: 'البس شارة قياس الجرعة والدروع الواقية، واذكر طبيعة عملك لطبيبك إذا كنت تحاول الإنجاب.',
    },
    sources: ['RADIATION'],
  },
  night: {
    id: 'EX_NIGHT',
    level: 'selfcare',
    title: { en: 'Night or rotating shifts', ar: 'مناوبات ليلية أو متغيرة' },
    why: {
      en: 'Shift work often cuts and disturbs sleep, and short sleep affects both heart and reproductive health.',
      ar: 'كثيراً ما تقلّل المناوبات النوم وتضطربه، ويؤثر قلة النوم على صحة القلب والصحة الإنجابية.',
    },
    action: {
      en: 'Protect a fixed block of sleep in a dark, cool room, and keep caffeine to the first half of your shift.',
      ar: 'خصّص فترة نوم ثابتة في غرفة مظلمة وباردة، واقتصر على الكافيين في النصف الأول من مناوبتك.',
    },
    sources: ['SHIFT_SLEEP'],
  },
}

/** Exposure findings in the same shape as the rule engine's, so they show and export the same way. */
/**
 * A woman's version: heat and long sitting matter for sperm, not eggs, so they are left out. The rest is
 * about planning a pregnancy, when protection rules at work change. Kept deliberately modest: tell
 * occupational health and your doctor, follow the protection, and nothing here raises the next step.
 */
const FEMALE_INFO: Partial<Record<Exposure, Pick<ExposureInfo, 'why' | 'action' | 'sources'>>> = {
  solvents: {
    why: { en: 'Some solvents are best avoided when planning a pregnancy and in early pregnancy, often before you know you are pregnant.', ar: 'يُفضّل تجنّب بعض المذيبات عند التخطيط للحمل وفي بدايته، وغالباً قبل أن تعرفي أنكِ حامل.' },
    action: { en: 'Use the protection your site provides, and tell occupational health early if you are planning a pregnancy.', ar: 'استخدمي وسائل الحماية التي يوفرها موقع العمل، وأخبري الصحة المهنية مبكراً إذا كنتِ تخططين للحمل.' },
    sources: ['WHO_PRECONCEPTION'],
  },
  pesticides: {
    why: { en: 'Handling pesticides is one of the work exposures worth reviewing before a pregnancy.', ar: 'التعامل مع المبيدات من أنواع التعرّض في العمل التي تستحق المراجعة قبل الحمل.' },
    action: { en: 'Wear gloves and a mask when mixing or spraying, wash before eating, and ask occupational health what changes if you plan a pregnancy.', ar: 'ارتدي القفازات والكمامة عند الخلط أو الرش، واغسلي يديك قبل الأكل، واسألي الصحة المهنية عما يتغير إذا خططتِ للحمل.' },
    sources: ['WHO_PRECONCEPTION'],
  },
  metals: {
    why: { en: 'Lead stored in the body can pass to a baby in pregnancy, so it is worth knowing your level before trying.', ar: 'يمكن أن ينتقل الرصاص المخزّن في الجسم إلى الجنين أثناء الحمل، لذا من المفيد معرفة مستواه قبل المحاولة.' },
    action: { en: 'Use fume extraction and a respirator, and ask occupational health whether a blood lead test is right before a pregnancy.', ar: 'استخدمي شفط الأبخرة وجهاز التنفس، واسألي الصحة المهنية إن كان تحليل الرصاص في الدم مناسباً قبل الحمل.' },
    sources: ['WHO_PRECONCEPTION'],
  },
  radiation: {
    why: { en: 'Dose limits at work are lower during pregnancy, and they only apply once your employer knows.', ar: 'حدود الجرعة في العمل أقل أثناء الحمل، ولا تُطبَّق إلا بعد علم جهة العمل.' },
    action: { en: 'Wear your dose badge and shielding, and tell your radiation protection officer as soon as you are pregnant.', ar: 'ارتدي شارة قياس الجرعة ووسائل الحماية، وأخبري مسؤول الوقاية من الإشعاع فور حدوث الحمل.' },
    sources: [],
  },
  night: {
    why: { en: 'Shift work often cuts and disturbs sleep, and short sleep is linked to irregular cycles and poorer metabolic health.', ar: 'كثيراً ما تقلّل المناوبات النوم وتضطربه، ويرتبط قلة النوم بعدم انتظام الدورة وضعف الصحة الأيضية.' },
    action: { en: 'Protect a fixed block of sleep in a dark, cool room, and keep caffeine to the first half of your shift.', ar: 'احمي فترة نوم ثابتة في غرفة مظلمة وباردة، واقتصري على الكافيين في النصف الأول من مناوبتك.' },
    sources: ['SHIFT_SLEEP'],
  },
}

export function exposureFlags(w: WorkProfile | null, sex: Sex = 'male'): FiredFlag[] {
  const occ = w ? OCCUPATIONS.find((o) => o.value === w.occupation) : undefined
  return exposuresOf(w).filter((e) => sex === 'male' || FEMALE_INFO[e]).map((e) => {
    const x = sex === 'female' ? { ...EXPOSURE_INFO[e], ...FEMALE_INFO[e] } : EXPOSURE_INFO[e]
    const fromJob = occ?.exposures.includes(e)
    const because: L10n[] = [
      e === 'night'
        ? { en: 'You said: night or rotating shifts', ar: 'إجابتك: مناوبات ليلية أو متغيرة' }
        : fromJob && occ
          ? { en: `You said: ${occ.label.en}`, ar: `إجابتك: ${occ.label.ar}` }
          : { en: 'You ticked this exposure', ar: 'اخترت هذا التعرّض' },
    ]
    return { id: x.id, category: 'lifestyle', level: x.level, emergency: false, changeable: true, title: x.title, why: x.why, action: x.action, because, sources: x.sources }
  })
}

export const needsOccupationalHealth = (w: WorkProfile | null) => exposuresOf(w).some((e) => EXPOSURE_INFO[e].occupationalHealth)
