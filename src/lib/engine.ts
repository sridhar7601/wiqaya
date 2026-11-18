import { optionLabel, QUESTIONS } from './questions'
import type { Answers, Assessment, CareOption, Category, DataIssue, FiredFlag, L10n, Level, Sex } from './types'
import { LEVEL_RANK, sexOf } from './types'

/**
 * Deterministic, explainable screening rules.
 * The AI never runs here: every flag, level and next step comes from these fixed rules,
 * so the same answers always give the same result.
 */
export const ENGINE_VERSION = 'rules-0.2.0'

/** WHO 2021 lower reference limits (5th centile). */
export const WHO2021 = {
  volume_ml: 1.4,
  concentration: 16,
  total_motility: 42,
  progressive: 30,
  morphology: 4,
} as const

type SemenKey = keyof typeof WHO2021
const SEMEN_KEYS: SemenKey[] = ['volume_ml', 'concentration', 'total_motility', 'progressive', 'morphology']
const SEMEN_LABEL: Record<SemenKey, L10n> = {
  volume_ml: { en: 'Volume', ar: 'الحجم' },
  concentration: { en: 'Concentration', ar: 'التركيز' },
  total_motility: { en: 'Total motility', ar: 'الحركة الكلية' },
  progressive: { en: 'Progressive motility', ar: 'الحركة التقدمية' },
  morphology: { en: 'Normal forms', ar: 'الأشكال الطبيعية' },
}
const SEMEN_UNIT: Record<SemenKey, L10n> = {
  volume_ml: { en: 'mL', ar: 'مل' },
  concentration: { en: 'million/mL', ar: 'مليون/مل' },
  total_motility: { en: '%', ar: '%' },
  progressive: { en: '%', ar: '%' },
  morphology: { en: '%', ar: '%' },
}
const SEMEN_MAX: Record<SemenKey, number> = { volume_ml: 15, concentration: 400, total_motility: 100, progressive: 100, morphology: 100 }

/** Hormone results a woman can enter. Reference points, not cut-offs for a diagnosis (see the rules). */
type HormoneKey = 'amh' | 'fsh' | 'tsh'
const HORMONE_KEYS: HormoneKey[] = ['amh', 'fsh', 'tsh']
const HORMONE_MAX: Record<HormoneKey, number> = { amh: 30, fsh: 200, tsh: 100 }
const HORMONE_LABEL: Record<HormoneKey, L10n> = { amh: { en: 'AMH', ar: 'AMH' }, fsh: { en: 'FSH', ar: 'FSH' }, tsh: { en: 'TSH', ar: 'TSH' } }
const HORMONE_UNIT: Record<HormoneKey, L10n> = { amh: { en: 'ng/mL', ar: 'نانوغرام/مل' }, fsh: { en: 'IU/L', ar: 'وحدة/لتر' }, tsh: { en: 'mIU/L', ar: 'ملي وحدة/لتر' } }
/** AMH below about 1 ng/mL is the usual reference point for a lower egg reserve (ASRM 2020; Bologna and POSEIDON criteria use 0.5–1.2). */
export const AMH_LOW = 1.0
/** Early-cycle FSH of 10 IU/L or more suggests a reduced reserve; 25 or more with absent periods is the POI threshold (ESHRE 2024). */
export const FSH_RAISED = 10
export const FSH_POI = 25
/** TSH reference range used before pregnancy (ATA 2017: most labs 0.4–4.0 mIU/L). */
export const TSH_RANGE = [0.4, 4.0] as const

interface Ctx {
  a: Answers
  sex: Sex
  age?: number
  bmi?: number
  semen: Partial<Record<SemenKey, number>>
  hormones: Partial<Record<HormoneKey, number>>
}

interface Rule {
  id: string
  category: Category
  level: Level | 'info'
  emergency?: boolean
  changeable: boolean
  sources: string[]
  title: L10n
  why: L10n
  action: L10n
  /** Applies only in a check for this sex. Rules without it apply to both. */
  sex?: Sex
  /** A woman's wording for a shared rule (and its own evidence where it differs). Same id, so every later step treats it alike. */
  female?: { title?: L10n; why?: L10n; action?: L10n; sources?: string[]; test?: (c: Ctx) => L10n[] | null }
  /** The choice this finding opens, besides the care level. */
  option?: CareOption
  /** Returns the evidence (from the person's own answers) when the rule fires, or null. */
  test: (c: Ctx) => L10n[] | null
}

// ---------- answer helpers ----------

export function arr(a: Answers, id: string): string[] {
  const v = a[id]
  if (Array.isArray(v)) return v
  return typeof v === 'string' ? [v] : []
}

export function one(a: Answers, id: string): string | undefined {
  const v = a[id]
  return typeof v === 'string' ? v : undefined
}

export function num(a: Answers, id: string): number | undefined {
  const v = a[id]
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : Number.NaN
  return Number.isFinite(n) ? n : undefined
}

function said(qid: string, value: string): L10n {
  const l = optionLabel(qid, value)
  return { en: `You said: ${l.en}`, ar: `إجابتك: ${l.ar}` }
}

const has =
  (qid: string, ...values: string[]) =>
  (c: Ctx): L10n[] | null => {
    const hits = arr(c.a, qid).filter((v) => values.includes(v))
    return hits.length ? hits.map((v) => said(qid, v)) : null
  }

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

// ---------- the rules ----------

export const RULES: Rule[] = [
  // ---- Red flags: always checked first, always win ----
  {
    id: 'RF_SEVERE_PAIN',
    sex: 'male',
    category: 'urgent',
    level: 'urgent',
    emergency: true,
    changeable: false,
    sources: ['EAU_SCROTUM'],
    title: { en: 'Sudden severe testicular pain', ar: 'ألم مفاجئ وشديد في الخصية' },
    why: {
      en: 'Sudden severe pain can mean testicular torsion (a twisted testicle). It is an emergency: the testicle can often only be saved if treated within hours.',
      ar: 'قد يدل الألم المفاجئ الشديد على التواء الخصية، وهي حالة طارئة: غالباً لا يمكن إنقاذ الخصية إلا إذا عولجت خلال ساعات.',
    },
    action: { en: 'Go to the nearest emergency department now or call 998. Do not wait.', ar: 'توجّه إلى أقرب قسم طوارئ الآن أو اتصل بالرقم 998. لا تنتظر.' },
    test: has('urgent_symptoms', 'sudden_pain'),
  },
  {
    id: 'RF_SWELLING_FEVER',
    sex: 'male',
    category: 'urgent',
    level: 'urgent',
    changeable: true,
    sources: ['EAU2024'],
    title: { en: 'Painful swelling with fever', ar: 'تورّم مؤلم مع حرارة' },
    why: {
      en: 'A painful, swollen testicle with fever can be a serious infection that needs treatment the same day.',
      ar: 'قد يشير تورّم الخصية المؤلم مع الحرارة إلى التهاب شديد يحتاج إلى علاج في اليوم نفسه.',
    },
    action: { en: 'Get a medical assessment today (urgent care or the emergency department).', ar: 'احصل على تقييم طبي اليوم (عيادة الحالات العاجلة أو قسم الطوارئ).' },
    test: has('urgent_symptoms', 'swelling_fever'),
  },
  {
    id: 'RF_LUMP',
    sex: 'male',
    category: 'urgent',
    level: 'urgent',
    changeable: false,
    sources: ['NICE_NG12'],
    title: { en: 'New lump or hardness in a testicle', ar: 'كتلة أو تصلّب جديد في الخصية' },
    why: {
      en: 'Most lumps are not cancer, but a new lump must be checked quickly. Testicular cancer is most common in young men and is very treatable when found early.',
      ar: 'معظم الكتل ليست سرطانية، لكن يجب فحص أي كتلة جديدة بسرعة. سرطان الخصية أكثر شيوعاً لدى الشباب، ونسبة الشفاء منه عالية جداً عند اكتشافه مبكراً.',
    },
    action: {
      en: 'See a doctor within the next few days and ask for an urgent scrotal ultrasound or urology review.',
      ar: 'راجع طبيباً خلال الأيام القليلة القادمة واطلب فحصاً عاجلاً بالموجات فوق الصوتية أو مراجعة أخصائي المسالك البولية.',
    },
    test: has('urgent_symptoms', 'new_lump'),
  },
  {
    id: 'RF_PRESERVATION',
    category: 'urgent',
    level: 'urgent',
    changeable: false,
    sources: ['AUA2020', 'EAU2024'],
    title: { en: 'Cancer treatment about to start', ar: 'علاج للسرطان على وشك البدء' },
    why: {
      en: 'Chemotherapy and radiotherapy can permanently affect sperm production. Sperm can be frozen before treatment starts, and that window is short.',
      ar: 'قد يؤثر العلاج الكيميائي والإشعاعي بشكل دائم على إنتاج الحيوانات المنوية. يمكن تجميد الحيوانات المنوية قبل بدء العلاج، وهذه الفرصة قصيرة.',
    },
    action: {
      en: 'Ask your cancer team about sperm freezing (fertility preservation) before your first treatment.',
      ar: 'اسأل فريق علاج السرطان عن تجميد الحيوانات المنوية (حفظ الخصوبة) قبل أول جلسة علاج.',
    },
    female: {
      sources: ['ASCO_FP2018', 'ESHRE_FP2020'],
      why: {
        en: 'Chemotherapy and radiotherapy can permanently reduce the number of eggs and bring menopause earlier. Eggs or embryos can be frozen before treatment starts, and that window is short, often about two weeks.',
        ar: 'قد يقلّل العلاج الكيميائي والإشعاعي عدد البويضات بشكل دائم ويقدّم موعد انقطاع الطمث. يمكن تجميد البويضات أو الأجنة قبل بدء العلاج، وهذه الفرصة قصيرة، غالباً نحو أسبوعين.',
      },
      action: {
        en: 'Ask your cancer team for an urgent fertility-preservation referral (egg, embryo or ovarian tissue freezing) before your first treatment.',
        ar: 'اطلبي من فريق علاج السرطان تحويلاً عاجلاً لحفظ الخصوبة (تجميد البويضات أو الأجنة أو نسيج المبيض) قبل أول جلسة علاج.',
      },
    },
    option: 'preservation',
    test: has('conditions', 'cancer_planned'),
  },

  // ---- Women's red flags ----
  {
    id: 'RF_ECTOPIC',
    sex: 'female',
    category: 'urgent',
    level: 'urgent',
    emergency: true,
    changeable: false,
    sources: ['NICE_NG126'],
    title: { en: 'Severe pain low in the belly, with a late period or fainting', ar: 'ألم شديد أسفل البطن مع تأخر الدورة أو إغماء' },
    why: {
      en: 'This can be an ectopic pregnancy (a pregnancy outside the womb), which can cause dangerous internal bleeding. It needs emergency care, even if a pregnancy test was negative or you are not sure.',
      ar: 'قد يدل ذلك على حمل خارج الرحم، وهو قد يسبب نزيفاً داخلياً خطيراً. يحتاج إلى رعاية طارئة، حتى لو كان اختبار الحمل سلبياً أو لم تكوني متأكدة.',
    },
    action: { en: 'Go to the nearest emergency department now or call 998. Do not wait.', ar: 'توجّهي إلى أقرب قسم طوارئ الآن أو اتصلي بالرقم 998. لا تنتظري.' },
    test: has('urgent_symptoms', 'ectopic_signs'),
  },
  {
    id: 'RF_HEAVY_BLEEDING',
    sex: 'female',
    category: 'urgent',
    level: 'urgent',
    changeable: false,
    sources: ['NICE_NG126', 'NICE_NG88'],
    title: { en: 'Very heavy bleeding, or bleeding in pregnancy', ar: 'نزيف غزير جداً أو نزيف أثناء الحمل' },
    why: {
      en: 'Bleeding this heavy can quickly cause a dangerous loss of blood, and bleeding in pregnancy always needs checking the same day.',
      ar: 'قد يسبب نزيف بهذه الغزارة فقداناً خطيراً للدم بسرعة، والنزيف أثناء الحمل يحتاج دائماً إلى فحص في اليوم نفسه.',
    },
    action: {
      en: 'Get a medical assessment today (urgent care or the emergency department). Call 998 if you feel faint or dizzy.',
      ar: 'احصلي على تقييم طبي اليوم (عيادة الحالات العاجلة أو قسم الطوارئ). اتصلي بالرقم 998 إذا شعرتِ بدوار أو إغماء.',
    },
    test: has('urgent_symptoms', 'heavy_bleeding'),
  },
  {
    id: 'RF_PELVIC_FEVER',
    sex: 'female',
    category: 'urgent',
    level: 'urgent',
    changeable: true,
    sources: ['CDC_STI2021'],
    title: { en: 'Pelvic pain with fever or unusual discharge', ar: 'ألم في الحوض مع حرارة أو إفرازات غير معتادة' },
    why: {
      en: 'This can be pelvic inflammatory disease, an infection that is very treatable but can scar the tubes that carry eggs if treatment is delayed.',
      ar: 'قد يدل ذلك على مرض التهاب الحوض، وهو عدوى قابلة للعلاج جداً، لكنها قد تترك ندوباً في قناتي فالوب إذا تأخر العلاج.',
    },
    action: { en: 'Get a medical assessment today, at urgent care or your family doctor.', ar: 'احصلي على تقييم طبي اليوم، في الرعاية العاجلة أو لدى طبيب الأسرة.' },
    test: has('urgent_symptoms', 'pelvic_fever'),
  },

  // ---- Men's health specialist (andrology / urology) ----
  {
    id: 'AN_UNDESCENDED',
    sex: 'male',
    category: 'anatomical',
    level: 'specialist',
    changeable: false,
    sources: ['AUA2020', 'EAU2024'],
    title: { en: 'Undescended testicle in childhood', ar: 'خصية معلّقة (غير نازلة) في الطفولة' },
    why: {
      en: 'A testicle that did not come down at birth, even if corrected by surgery, is linked to lower sperm production and a higher chance of testicular cancer.',
      ar: 'ترتبط الخصية التي لم تنزل عند الولادة، حتى لو صُحّحت بالجراحة، بانخفاض إنتاج الحيوانات المنوية وزيادة احتمال الإصابة بسرطان الخصية.',
    },
    action: {
      en: "Discuss it with a men's health specialist. A semen analysis is a sensible first test. Check your testicles yourself every month.",
      ar: 'ناقش ذلك مع أخصائي صحة الرجل؛ تحليل السائل المنوي فحص أولي مناسب. افحص خصيتيك ذاتياً كل شهر.',
    },
    test: has('anat', 'undescended'),
  },
  {
    id: 'AN_VARICOCELE',
    sex: 'male',
    category: 'anatomical',
    level: 'specialist',
    changeable: true,
    sources: ['AUA2020', 'EAU2024'],
    title: { en: 'Possible varicocele (enlarged scrotal veins)', ar: 'احتمال وجود دوالي الخصية' },
    why: {
      en: 'A dragging or heavy feeling, or visible twisted veins, can be a varicocele, the most common treatable cause of reduced sperm quality.',
      ar: 'قد يدل الإحساس بالثقل أو ظهور أوردة متعرّجة على دوالي الخصية، وهي من أكثر الأسباب الشائعة والقابلة للعلاج لانخفاض جودة الحيوانات المنوية.',
    },
    action: { en: 'A specialist can confirm it with a quick examination or an ultrasound.', ar: 'يمكن للأخصائي تأكيدها بفحص سريري سريع أو بالموجات فوق الصوتية.' },
    test: has('anat', 'varicocele'),
  },
  {
    id: 'AN_INJURY',
    sex: 'male',
    category: 'anatomical',
    level: 'specialist',
    changeable: false,
    sources: ['AUA2020'],
    title: { en: 'Past testicular injury, torsion or groin surgery', ar: 'إصابة سابقة في الخصية أو التواء أو جراحة في الأربية' },
    why: {
      en: 'Injury, torsion or surgery such as hernia repair can sometimes affect sperm production or the tubes that carry sperm.',
      ar: 'قد تؤثر الإصابة أو الالتواء أو بعض العمليات مثل إصلاح الفتق أحياناً على إنتاج الحيوانات المنوية أو على القنوات التي تنقلها.',
    },
    action: {
      en: 'Mention it to a specialist. A semen analysis helps show whether it matters for you.',
      ar: 'أخبر الأخصائي بذلك؛ يساعد تحليل السائل المنوي على معرفة ما إذا كان له تأثير لديك.',
    },
    test: has('anat', 'injury_surgery'),
  },
  {
    id: 'AN_MUMPS',
    sex: 'male',
    category: 'infectious',
    level: 'specialist',
    changeable: false,
    sources: ['EAU2024'],
    title: { en: 'Mumps with testicular swelling after puberty', ar: 'نكاف مع تورّم الخصيتين بعد البلوغ' },
    why: {
      en: 'Mumps orchitis after puberty can damage the cells that make sperm.',
      ar: 'قد يؤدي التهاب الخصية الناتج عن النكاف بعد البلوغ إلى تلف الخلايا المسؤولة عن إنتاج الحيوانات المنوية.',
    },
    action: {
      en: 'A semen analysis and a specialist review can show whether sperm production was affected.',
      ar: 'يمكن لتحليل السائل المنوي ومراجعة الأخصائي إظهار ما إذا تأثر إنتاج الحيوانات المنوية.',
    },
    test: (c) => (one(c.a, 'mumps') === 'yes' ? [said('mumps', 'yes')] : null),
  },
  {
    id: 'AN_CANCER_PAST',
    category: 'history',
    level: 'specialist',
    changeable: false,
    sources: ['AUA2020'],
    title: { en: 'Past chemotherapy or radiotherapy', ar: 'علاج كيميائي أو إشعاعي سابق' },
    why: { en: 'These treatments can reduce sperm production, sometimes for years.', ar: 'قد تقلّل هذه العلاجات إنتاج الحيوانات المنوية، أحياناً لسنوات.' },
    action: {
      en: 'A specialist can check your current sperm production and talk through your options.',
      ar: 'يمكن للأخصائي فحص إنتاج الحيوانات المنوية الحالي ومناقشة الخيارات المتاحة.',
    },
    female: {
      sources: ['ESHRE_FP2020', 'ESHRE_POI2024'],
      why: { en: 'These treatments can lower the number of eggs and bring menopause earlier, sometimes years later.', ar: 'قد تقلّل هذه العلاجات عدد البويضات وتقدّم موعد انقطاع الطمث، أحياناً بعد سنوات.' },
      action: {
        en: 'A women’s health or fertility specialist can check your egg reserve and talk through options, including egg freezing, while there is time.',
        ar: 'تستطيع أخصائية صحة المرأة أو الخصوبة فحص مخزون البويضات ومناقشة الخيارات، ومنها تجميد البويضات، ما دام الوقت متاحاً.',
      },
    },
    option: 'preservation',
    test: has('conditions', 'cancer_past'),
  },
  {
    id: 'AN_TESTOSTERONE',
    sex: 'male',
    category: 'lifestyle',
    level: 'specialist',
    changeable: true,
    sources: ['AUA2020'],
    title: { en: 'Testosterone, anabolic steroids or SARMs', ar: 'تستوستيرون أو ستيرويدات بنائية أو SARMs' },
    why: {
      en: 'Testosterone and steroids taken from outside switch off the body’s signal to make sperm. This is one of the most common reversible causes of very low sperm counts, including in men who use them for the gym.',
      ar: 'يوقف التستوستيرون والستيرويدات الخارجية الإشارة التي تحفّز الجسم على إنتاج الحيوانات المنوية، وهذا من أكثر الأسباب الشائعة والقابلة للعكس لانخفاض عددها بشدة، بما في ذلك لدى من يستخدمونها لأغراض رياضية.',
    },
    action: {
      en: "Talk to a men's health specialist before stopping. Recovery is usually possible but should be planned with a doctor.",
      ar: 'تحدّث مع أخصائي صحة الرجل قبل التوقف؛ التعافي ممكن عادةً، لكن يجب التخطيط له مع الطبيب.',
    },
    test: has('meds', 'testosterone'),
  },
  {
    id: 'AN_SEMEN',
    sex: 'male',
    category: 'test',
    level: 'specialist',
    changeable: true,
    sources: ['WHO2021', 'AUA2020'],
    title: { en: 'Semen analysis outside the usual range', ar: 'نتيجة تحليل السائل المنوي خارج المعدل المعتاد' },
    why: {
      en: 'One or more values are below the WHO 2021 lower reference limits. One test is not a diagnosis: results vary, and a repeat test is usually advised.',
      ar: 'قيمة واحدة أو أكثر أقل من الحدود الدنيا المرجعية لمنظمة الصحة العالمية (2021). نتيجة واحدة لا تعني تشخيصاً؛ فالنتائج تتفاوت، ويُنصح عادةً بإعادة التحليل.',
    },
    action: {
      en: "Share the result with a men's health specialist, who may repeat it and order hormone tests.",
      ar: 'شارك النتيجة مع أخصائي صحة الرجل، فقد يعيد التحليل ويطلب فحوصات هرمونية.',
    },
    test: (c) => {
      const out: L10n[] = []
      for (const k of SEMEN_KEYS) {
        const v = c.semen[k]
        if (v === undefined || v >= WHO2021[k]) continue
        if (k === 'concentration' && v === 0) {
          out.push({ en: 'No sperm seen in the sample (azoospermia)', ar: 'لم تظهر حيوانات منوية في العينة (انعدام النطاف)' })
          continue
        }
        out.push({
          en: `${SEMEN_LABEL[k].en}: ${fmt(v)} ${SEMEN_UNIT[k].en} (WHO lower limit ${WHO2021[k]})`,
          ar: `${SEMEN_LABEL[k].ar}: ${fmt(v)} ${SEMEN_UNIT[k].ar} (الحد الأدنى لمنظمة الصحة العالمية ${WHO2021[k]})`,
        })
      }
      return out.length ? out : null
    },
  },
  {
    id: 'AN_EJACULATION',
    sex: 'male',
    category: 'sexual',
    level: 'specialist',
    changeable: true,
    sources: ['EAU2024'],
    title: { en: 'Problems with ejaculation', ar: 'مشكلات في القذف' },
    why: {
      en: 'Pain, very little fluid or no fluid can point to a blockage or a nerve issue that a specialist can assess.',
      ar: 'قد يشير الألم أو قلة السائل أو انعدامه إلى انسداد أو مشكلة عصبية يمكن للأخصائي تقييمها.',
    },
    action: { en: "See a men's health specialist.", ar: 'راجع أخصائي صحة الرجل.' },
    test: has('sexual', 'ejaculation'),
  },

  // ---- Women's health specialist (gynaecology / reproductive medicine) ----
  {
    id: 'GY_RECURRENT_LOSS',
    sex: 'female',
    category: 'history',
    level: 'specialist',
    changeable: false,
    sources: ['ESHRE_RPL2022'],
    title: { en: 'Two or more miscarriages', ar: 'إجهاضان أو أكثر' },
    why: {
      en: 'Most miscarriages happen by chance and most women go on to have a baby. After two, guidelines advise looking for causes that can be treated, such as thyroid, clotting or womb-shape problems.',
      ar: 'تحدث معظم حالات الإجهاض صدفةً، وتنجب معظم النساء بعدها. بعد إجهاضين، توصي الإرشادات بالبحث عن أسباب قابلة للعلاج، مثل مشكلات الغدة الدرقية أو التخثر أو شكل الرحم.',
    },
    action: { en: 'Ask for a referral to a women’s health specialist or a recurrent pregnancy loss clinic.', ar: 'اطلبي تحويلاً إلى أخصائية صحة المرأة أو عيادة الإجهاض المتكرر.' },
    test: has('gyn_history', 'miscarriage2'),
  },
  {
    id: 'GY_POI',
    sex: 'female',
    category: 'test',
    level: 'specialist',
    changeable: false,
    sources: ['ESHRE_POI2024'],
    option: 'preservation',
    title: { en: 'High FSH with absent or infrequent periods', ar: 'ارتفاع FSH مع غياب الدورة أو تباعدها' },
    why: {
      en: 'An FSH of 25 or more with absent or infrequent periods can be a sign of premature ovarian insufficiency, when the ovaries slow down before 40. It needs a repeat test and a specialist, and it is important for bone and heart health too.',
      ar: 'قد يكون FSH بقيمة 25 أو أكثر مع غياب الدورة أو تباعدها علامة على قصور المبيض المبكر، أي تباطؤ عمل المبيضين قبل سن 40. يحتاج ذلك إلى إعادة التحليل ومراجعة أخصائية، وهو مهم لصحة العظام والقلب أيضاً.',
    },
    action: {
      en: 'See a women’s health specialist soon. Ask about a repeat FSH test and what it means for your plans.',
      ar: 'راجعي أخصائية صحة المرأة قريباً، واسألي عن إعادة تحليل FSH وما يعنيه ذلك لخططك.',
    },
    test: (c) => {
      const f = c.hormones.fsh
      const cyc = one(c.a, 'cycle')
      return f !== undefined && f >= FSH_POI && (cyc === 'rare' || cyc === 'none_3m')
        ? [{ en: `FSH ${fmt(f)} IU/L`, ar: `FSH ${fmt(f)} وحدة/لتر` }, said('cycle', cyc)]
        : null
    },
  },

  // ---- Fertility services (couple assessment) ----
  {
    id: 'FS_DURATION',
    category: 'history',
    level: 'fertility',
    changeable: false,
    sources: ['NICE_CG156', 'AUA2020'],
    title: { en: 'Trying for a child for a while', ar: 'محاولة الإنجاب منذ فترة' },
    why: {
      en: 'Guidelines advise assessing both partners after 12 months of trying, or after 6 months if the female partner is 35 or older. Men are often assessed late, so checking now saves time for both of you.',
      ar: 'توصي الإرشادات بتقييم الشريكين بعد 12 شهراً من المحاولة، أو بعد 6 أشهر إذا كان عمر الشريكة 35 عاماً أو أكثر. غالباً ما يتأخر تقييم الرجل، والفحص الآن يوفّر الوقت على كليكما.',
    },
    action: {
      en: 'Book an assessment at a fertility service. Your part is simple: a short history, an examination and a semen analysis.',
      ar: 'احجز تقييماً لدى خدمة الخصوبة. دورك بسيط: أسئلة قصيرة وفحص سريري وتحليل للسائل المنوي.',
    },
    female: {
      sources: ['NICE_CG156', 'ASRM_FEMALE_EVAL'],
      why: {
        en: 'Guidelines advise a fertility assessment after 12 months of trying, after 6 months from age 35, straight away from age 40, and sooner when there is a known reason such as absent periods or past pelvic infection. Both partners are assessed together.',
        ar: 'توصي الإرشادات بتقييم الخصوبة بعد 12 شهراً من المحاولة، وبعد 6 أشهر من سن 35، وفوراً من سن 40، وفي وقت أبكر عند وجود سبب معروف مثل غياب الدورة أو التهاب سابق في الحوض. ويُقيَّم الشريكان معاً.',
      },
      action: {
        en: 'Book a fertility assessment for you both. Your partner’s part (a semen analysis) is quick and can happen at the same time.',
        ar: 'احجزي تقييماً للخصوبة لكما معاً. دور شريكك (تحليل السائل المنوي) سريع ويمكن إجراؤه في الوقت نفسه.',
      },
      test: (c) => {
        if (one(c.a, 'ttc') !== 'yes') return null
        const m = one(c.a, 'ttc_months')
        const out: L10n[] = []
        const cause = [...arr(c.a, 'gyn_history').filter((v) => ['endometriosis', 'pid', 'ectopic', 'pelvic_surgery'].includes(v)).map((v) => said('gyn_history', v))]
        const cyc = one(c.a, 'cycle')
        if (cyc === 'rare' || cyc === 'none_3m') cause.push(said('cycle', cyc))
        if (m === 'gt12') out.push(said('ttc_months', m))
        else if (c.age !== undefined && c.age >= 40) out.push({ en: `You are ${c.age} and trying now`, ar: `عمرك ${c.age} عاماً وتحاولين الآن` })
        else if (m === '6to12' && c.age !== undefined && c.age >= 35) out.push(said('ttc_months', m), { en: `You are ${c.age}`, ar: `عمرك ${c.age} عاماً` })
        else if (cause.length && m) out.push(said('ttc_months', m))
        else return null
        return [...out, ...cause]
      },
    },
    test: (c) => {
      if (one(c.a, 'ttc') !== 'yes') return null
      const m = one(c.a, 'ttc_months')
      const p = one(c.a, 'partner_age')
      if (m === 'gt12') return [said('ttc_months', m)]
      if (m === '6to12' && p === '35plus') return [said('ttc_months', m), said('partner_age', p)]
      return null
    },
  },

  // ---- Family doctor (primary care) ----
  {
    id: 'PC_OBESITY',
    category: 'metabolic',
    level: 'primary',
    changeable: true,
    sources: ['AUA2020', 'ASRM2022'],
    title: { en: 'Weight in the obesity range (BMI 30 or more)', ar: 'وزن ضمن نطاق السمنة (مؤشر كتلة الجسم 30 أو أكثر)' },
    why: {
      en: 'Obesity lowers testosterone and sperm quality, and raises the risk of diabetes and heart disease. Losing even 5–10% of body weight can help.',
      ar: 'تخفض السمنة مستوى التستوستيرون وجودة الحيوانات المنوية، وتزيد خطر السكري وأمراض القلب. حتى خسارة 5-10% من الوزن قد تساعد.',
    },
    action: {
      en: 'See your family doctor for a blood sugar, blood pressure and cholesterol check, and support with weight.',
      ar: 'راجع طبيب الأسرة لفحص السكر وضغط الدم والكوليسترول، وللحصول على دعم في إنقاص الوزن.',
    },
    female: {
      sources: ['NICE_CG156', 'ASRM2022'],
      why: {
        en: 'Obesity can stop ovulation happening every month, and it raises the chance of diabetes and high blood pressure in pregnancy. Losing even 5–10% of body weight can bring cycles back to regular.',
        ar: 'قد تمنع السمنة حدوث التبويض كل شهر، وتزيد احتمال السكري وارتفاع الضغط أثناء الحمل. حتى خسارة 5-10% من الوزن قد تعيد انتظام الدورة.',
      },
      action: {
        en: 'See your family doctor for a blood sugar, blood pressure and cholesterol check, and support with weight.',
        ar: 'راجعي طبيب الأسرة لفحص السكر وضغط الدم والكوليسترول، وللحصول على دعم في إنقاص الوزن.',
      },
    },
    test: (c) => (c.bmi !== undefined && c.bmi >= 30 ? [{ en: `Your BMI is ${fmt(c.bmi)}`, ar: `مؤشر كتلة جسمك ${fmt(c.bmi)}` }] : null),
  },
  {
    id: 'PC_DIABETES',
    category: 'metabolic',
    level: 'primary',
    changeable: true,
    sources: ['EAU2024'],
    title: { en: 'Diabetes', ar: 'السكري' },
    why: {
      en: 'Diabetes can affect erections, ejaculation and sperm quality. Good control protects both your fertility and your long-term health.',
      ar: 'قد يؤثر السكري على الانتصاب والقذف وجودة الحيوانات المنوية. التحكم الجيد فيه يحمي خصوبتك وصحتك على المدى الطويل.',
    },
    action: { en: 'Review your diabetes control with your family doctor and mention your family plans.', ar: 'راجع مستوى التحكم بالسكري مع طبيب الأسرة وأخبره بخططك للإنجاب.' },
    female: {
      sources: ['ADA_SOC', 'WHO_PRECONCEPTION'],
      why: {
        en: 'Good blood-sugar control before pregnancy lowers the risk of miscarriage and of problems for the baby. Diabetes care plans usually change before trying.',
        ar: 'التحكم الجيد في السكر قبل الحمل يقلّل خطر الإجهاض والمشكلات لدى الجنين، وعادةً ما تتغير خطة علاج السكري قبل محاولة الحمل.',
      },
      action: { en: 'Review your diabetes control with your family doctor and tell them about your family plans.', ar: 'راجعي مستوى التحكم بالسكري مع طبيب الأسرة وأخبريه بخططك للإنجاب.' },
    },
    option: 'counselling',
    test: has('conditions', 'diabetes'),
  },
  {
    id: 'PC_BP_CHOL',
    category: 'metabolic',
    level: 'primary',
    changeable: true,
    sources: ['ED_CVD'],
    title: { en: 'High blood pressure or cholesterol', ar: 'ارتفاع ضغط الدم أو الكوليسترول' },
    why: {
      en: 'These affect blood vessels, including the ones needed for erections, and some blood-pressure medicines can affect sexual function.',
      ar: 'تؤثر هذه الحالات على الأوعية الدموية، بما فيها اللازمة للانتصاب، وقد تؤثر بعض أدوية الضغط على الوظيفة الجنسية.',
    },
    action: {
      en: 'Keep up regular reviews with your family doctor, and ask whether your medicines could affect fertility.',
      ar: 'حافظ على المراجعات الدورية مع طبيب الأسرة، واسأله إن كانت أدويتك قد تؤثر على الخصوبة.',
    },
    female: {
      sources: ['BP_GUIDE', 'WHO_PRECONCEPTION'],
      why: {
        en: 'High blood pressure matters in pregnancy, and some blood-pressure and cholesterol medicines should be changed before trying.',
        ar: 'لارتفاع ضغط الدم أهمية أثناء الحمل، ويجب تغيير بعض أدوية الضغط والكوليسترول قبل محاولة الحمل.',
      },
      action: {
        en: 'Keep up regular reviews with your family doctor, and ask which of your medicines are safe before and during pregnancy.',
        ar: 'حافظي على المراجعات الدورية مع طبيب الأسرة، واسأليه أيّ أدويتك آمنة قبل الحمل وأثناءه.',
      },
    },
    test: has('conditions', 'high_bp', 'high_chol'),
  },
  {
    id: 'PC_SLEEP_APNOEA',
    category: 'metabolic',
    level: 'primary',
    changeable: true,
    sources: ['EAU2024'],
    title: { en: 'Loud snoring with daytime tiredness', ar: 'شخير عالٍ مع تعب خلال النهار' },
    why: {
      en: 'This can be sleep apnoea, which is linked to low testosterone, weight gain and heart problems.',
      ar: 'قد يدل ذلك على انقطاع النفس أثناء النوم، المرتبط بانخفاض التستوستيرون وزيادة الوزن ومشكلات القلب.',
    },
    action: { en: 'Ask your family doctor about a sleep assessment.', ar: 'اسأل طبيب الأسرة عن تقييم لاضطرابات النوم.' },
    female: {
      sources: ['PCOS2023'],
      why: {
        en: 'This can be sleep apnoea, which is more common with PCOS and weight gain, and is linked to blood pressure and blood-sugar problems.',
        ar: 'قد يدل ذلك على انقطاع النفس أثناء النوم، وهو أكثر شيوعاً مع تكيّس المبايض وزيادة الوزن، ويرتبط بمشكلات الضغط والسكر.',
      },
      action: { en: 'Ask your family doctor about a sleep assessment.', ar: 'اسألي طبيب الأسرة عن تقييم لاضطرابات النوم.' },
    },
    test: has('conditions', 'snoring'),
  },
  {
    id: 'PC_THYROID',
    category: 'history',
    level: 'primary',
    changeable: true,
    sources: ['EAU2024'],
    title: { en: 'Thyroid condition', ar: 'مشكلة في الغدة الدرقية' },
    why: {
      en: 'Thyroid problems can affect hormones, sexual function and sperm.',
      ar: 'قد تؤثر مشكلات الغدة الدرقية على الهرمونات والوظيفة الجنسية والحيوانات المنوية.',
    },
    action: { en: 'Make sure your thyroid tests are up to date with your family doctor.', ar: 'تأكد من تحديث فحوصات الغدة الدرقية مع طبيب الأسرة.' },
    female: {
      sources: ['ATA2017'],
      why: {
        en: 'Thyroid problems can make periods irregular and affect ovulation, and thyroid levels need to be well controlled before and during pregnancy.',
        ar: 'قد تسبب مشكلات الغدة الدرقية عدم انتظام الدورة وتؤثر على التبويض، ويجب ضبط مستوياتها جيداً قبل الحمل وأثناءه.',
      },
      action: { en: 'Make sure your thyroid tests are up to date, and tell your doctor if you are planning a pregnancy.', ar: 'تأكدي من تحديث فحوصات الغدة الدرقية، وأخبري طبيبك إذا كنتِ تخططين للحمل.' },
    },
    test: has('conditions', 'thyroid'),
  },
  {
    id: 'PC_STI_NOW',
    category: 'infectious',
    level: 'primary',
    changeable: true,
    sources: ['EAU2024'],
    title: { en: 'Possible current genital infection', ar: 'احتمال وجود عدوى تناسلية حالية' },
    why: {
      en: 'Discharge, burning or sores can be signs of an infection. Most are easy to treat, and treating early protects your fertility and your partner.',
      ar: 'قد تكون الإفرازات أو الحرقة أو التقرحات علامات على عدوى. معظمها سهل العلاج، والعلاج المبكر يحمي خصوبتك ويحمي شريكة حياتك.',
    },
    action: {
      en: 'See your family doctor or a sexual health clinic for confidential testing.',
      ar: 'راجع طبيب الأسرة أو عيادة الصحة الجنسية لإجراء فحص سري.',
    },
    female: {
      sources: ['CDC_STI2021'],
      why: {
        en: 'Unusual discharge, burning or sores can be signs of an infection. Most are easy to treat, and treating early protects the tubes that carry eggs.',
        ar: 'قد تكون الإفرازات غير المعتادة أو الحرقة أو التقرحات علامات على عدوى. معظمها سهل العلاج، والعلاج المبكر يحمي قناتي فالوب.',
      },
      action: { en: 'See your family doctor or a women’s health clinic for confidential testing.', ar: 'راجعي طبيب الأسرة أو عيادة صحة المرأة لإجراء فحص سري.' },
    },
    test: (c) => (one(c.a, 'sti_now') === 'yes' ? [said('sti_now', 'yes')] : null),
  },
  {
    id: 'PC_MEDS',
    category: 'history',
    level: 'primary',
    changeable: true,
    sources: ['AUA2020'],
    title: { en: 'Medicines that can affect fertility', ar: 'أدوية قد تؤثر على الخصوبة' },
    why: {
      en: 'Some medicines for hair loss, mood or pain can affect sexual function or sperm in some men.',
      ar: 'قد تؤثر بعض أدوية تساقط الشعر أو المزاج أو الألم على الوظيفة الجنسية أو الحيوانات المنوية لدى بعض الرجال.',
    },
    action: {
      en: 'Do not stop any medicine on your own. Ask your doctor whether an alternative makes sense.',
      ar: 'لا توقف أي دواء من تلقاء نفسك. اسأل طبيبك إن كان هناك بديل مناسب.',
    },
    female: {
      sources: ['MHRA_VALPROATE', 'WHO_PRECONCEPTION'],
      title: { en: 'Medicines to review before a pregnancy', ar: 'أدوية تجب مراجعتها قبل الحمل' },
      why: {
        en: 'Some medicines for epilepsy, mood, migraine, acne or arthritis can harm a baby in early pregnancy, often before you know you are pregnant. Most can be switched safely, with planning.',
        ar: 'قد تضر بعض أدوية الصرع أو المزاج أو الصداع النصفي أو حب الشباب أو المفاصل بالجنين في بداية الحمل، وغالباً قبل أن تعرفي أنكِ حامل. ويمكن استبدال معظمها بأمان مع التخطيط.',
      },
      action: {
        en: 'Do not stop any medicine on your own. Ask your doctor for a medicine review before trying, and use reliable contraception until then.',
        ar: 'لا توقفي أي دواء من تلقاء نفسك. اطلبي من طبيبك مراجعة أدويتك قبل محاولة الحمل، واستخدمي وسيلة منع حمل موثوقة حتى ذلك الحين.',
      },
      test: (c) => {
        const risky = arr(c.a, 'meds_f').filter((v) => v === 'valproate' || v === 'isotretinoin' || v === 'methotrexate')
        const t = one(c.a, 'ttc')
        const planning = t === 'yes' || t === 'planning' || one(c.a, 'plans_when') === '1to2y'
        const hits = planning ? arr(c.a, 'meds_f').filter((v) => v !== 'none' && v !== 'prefer_not') : risky
        return hits.length ? hits.map((v) => said('meds_f', v)) : null
      },
    },
    option: 'counselling',
    test: has('meds', 'five_ari', 'antidepressants', 'opioids'),
  },
  {
    id: 'PC_ED_LIBIDO',
    sex: 'male',
    category: 'sexual',
    level: 'primary',
    changeable: true,
    sources: ['ED_CVD', 'EAU2024'],
    title: { en: 'Low desire or difficulty with erections', ar: 'ضعف الرغبة أو صعوبة في الانتصاب' },
    why: {
      en: 'These are common and treatable. Erection problems can also be an early warning sign of heart disease or diabetes, sometimes years before other symptoms.',
      ar: 'هذه مشكلات شائعة وقابلة للعلاج. وقد تكون صعوبة الانتصاب علامة إنذار مبكرة لأمراض القلب أو السكري، أحياناً قبل الأعراض الأخرى بسنوات.',
    },
    action: {
      en: 'See your family doctor for a short check of blood sugar, cholesterol, blood pressure and hormones.',
      ar: 'راجع طبيب الأسرة لفحص سريع للسكر والكوليسترول وضغط الدم والهرمونات.',
    },
    test: has('sexual', 'low_desire', 'erection'),
  },
  {
    id: 'PC_SCREENING_OVERDUE',
    category: 'screening',
    level: 'primary',
    changeable: true,
    sources: ['IFHAS'],
    title: { en: 'Routine health check is overdue', ar: 'الفحص الصحي الدوري متأخر' },
    why: {
      en: "Men often skip routine checks. Heart, diabetes and weight checks matter for fertility too, and Abu Dhabi's periodic adult screening covers them.",
      ar: 'كثيراً ما يؤجل الرجال الفحوصات الدورية. فحوصات القلب والسكري والوزن مهمة للخصوبة أيضاً، ويشملها برنامج الفحص الدوري للبالغين في أبوظبي.',
    },
    action: {
      en: 'Book a routine health check with your family doctor. If you hold a Thiqa card, IFHAS screening covers this every 3 years.',
      ar: 'احجز فحصاً صحياً دورياً لدى طبيب الأسرة. إذا كنت من حاملي بطاقة «ثقة»، فإن برنامج «إفحص» يغطي ذلك كل 3 سنوات.',
    },
    female: {
      why: {
        en: "Heart, diabetes and weight checks matter for fertility and pregnancy too. Abu Dhabi's periodic adult screening covers them, and since 2025 it includes reproductive health for ages 20–35.",
        ar: 'فحوصات القلب والسكري والوزن مهمة للخصوبة والحمل أيضاً. يشملها برنامج الفحص الدوري للبالغين في أبوظبي، ومنذ 2025 يشمل الصحة الإنجابية للفئة العمرية 20-35.',
      },
      action: {
        en: 'Book a routine health check with your family doctor. If you hold a Thiqa card, IFHAS screening covers this every 3 years.',
        ar: 'احجزي فحصاً صحياً دورياً لدى طبيب الأسرة. إذا كنتِ من حاملات بطاقة «ثقة»، فإن برنامج «إفحص» يغطي ذلك كل 3 سنوات.',
      },
    },
    test: (c) => {
      const v = one(c.a, 'last_check')
      return v === 'gt3y' || v === 'unsure' ? [said('last_check', v)] : null
    },
  },

  // ---- Women: family doctor or women's health clinic ----
  {
    id: 'GY_NO_PERIODS',
    sex: 'female',
    category: 'history',
    level: 'primary',
    changeable: true,
    sources: ['ESHRE_POI2024', 'PCOS2023'],
    title: { en: 'No period for 3 months or more', ar: 'لا دورة منذ 3 أشهر أو أكثر' },
    why: {
      en: 'Periods that stop without pregnancy, breastfeeding or hormones mean ovulation has paused. Common reasons are stress, weight change, very hard training, PCOS and thyroid or prolactin problems, and most are treatable.',
      ar: 'توقف الدورة دون حمل أو رضاعة أو هرمونات يعني أن التبويض توقف مؤقتاً. من الأسباب الشائعة التوتر وتغيّر الوزن والتمارين الشاقة جداً وتكيّس المبايض ومشكلات الغدة الدرقية أو هرمون الحليب، ومعظمها قابل للعلاج.',
    },
    action: {
      en: 'Do a pregnancy test, then see your family doctor or a women’s health clinic for a check and simple blood tests.',
      ar: 'أجري اختبار حمل، ثم راجعي طبيب الأسرة أو عيادة صحة المرأة للفحص وتحاليل دم بسيطة.',
    },
    option: 'testing',
    test: (c) => (one(c.a, 'cycle') === 'none_3m' ? [said('cycle', 'none_3m')] : null),
  },
  {
    id: 'GY_IRREGULAR',
    sex: 'female',
    category: 'history',
    level: 'primary',
    changeable: true,
    sources: ['PCOS2023', 'NICE_CG156'],
    title: { en: 'Irregular or infrequent periods', ar: 'دورة غير منتظمة أو متباعدة' },
    why: {
      en: 'Irregular cycles often mean ovulation does not happen every month. The most common reason is PCOS, which affects about 1 in 10 women and is very manageable; thyroid problems are another. Knowing early gives you more choices.',
      ar: 'غالباً ما تعني الدورة غير المنتظمة أن التبويض لا يحدث كل شهر. السبب الأكثر شيوعاً هو تكيّس المبايض، الذي يصيب نحو امرأة من كل 10 ويمكن التعامل معه جيداً، ومن الأسباب الأخرى مشكلات الغدة الدرقية. المعرفة المبكرة تمنحك خيارات أكثر.',
    },
    action: {
      en: 'See your family doctor or a women’s health clinic. A few blood tests and sometimes an ultrasound can find the reason.',
      ar: 'راجعي طبيب الأسرة أو عيادة صحة المرأة. يمكن لبعض تحاليل الدم وأحياناً التصوير بالموجات فوق الصوتية معرفة السبب.',
    },
    option: 'testing',
    test: (c) => {
      const cyc = one(c.a, 'cycle')
      if (cyc !== 'irregular' && cyc !== 'rare') return null
      const out = [said('cycle', cyc)]
      if (arr(c.a, 'gyn_symptoms').includes('hair_acne')) out.push(said('gyn_symptoms', 'hair_acne'))
      return out
    },
  },
  {
    id: 'GY_ENDO_SIGNS',
    sex: 'female',
    category: 'history',
    level: 'primary',
    changeable: true,
    sources: ['ESHRE_ENDO2022', 'NICE_NG73'],
    title: { en: 'Severe period pain or pain with sex', ar: 'ألم شديد مع الدورة أو أثناء العلاقة الزوجية' },
    why: {
      en: 'Pain that stops daily life is not something you have to put up with. It can be a sign of endometriosis, which on average takes years to diagnose and can affect fertility. Effective treatment exists.',
      ar: 'الألم الذي يوقف حياتك اليومية ليس أمراً عليكِ تحمّله. قد يكون علامة على بطانة الرحم المهاجرة، التي يستغرق تشخيصها سنوات في المتوسط وقد تؤثر على الخصوبة. ويوجد علاج فعّال.',
    },
    action: {
      en: 'See your family doctor or a women’s health clinic and describe the pain. Keeping a pain diary for 2–3 cycles helps.',
      ar: 'راجعي طبيب الأسرة أو عيادة صحة المرأة وصِفي الألم. يساعد تدوين الألم لمدة دورتين أو ثلاث.',
    },
    test: has('gyn_symptoms', 'severe_period_pain', 'pain_sex'),
  },
  {
    id: 'GY_HEAVY_PERIODS',
    sex: 'female',
    category: 'history',
    level: 'primary',
    changeable: true,
    sources: ['NICE_NG88'],
    title: { en: 'Heavy periods', ar: 'دورة غزيرة' },
    why: {
      en: 'Heavy periods are common and treatable, and often cause iron deficiency, which leaves you tired. Fibroids and polyps are possible causes.',
      ar: 'الدورة الغزيرة شائعة وقابلة للعلاج، وغالباً ما تسبب نقص الحديد الذي يشعرك بالتعب. ومن أسبابها المحتملة الأورام الليفية والزوائد.',
    },
    action: { en: 'See your family doctor for a blood count and a talk about treatment options.', ar: 'راجعي طبيب الأسرة لفحص صورة الدم ومناقشة خيارات العلاج.' },
    test: has('gyn_symptoms', 'heavy_periods'),
  },
  {
    id: 'GY_BLEEDING_BETWEEN',
    sex: 'female',
    category: 'history',
    level: 'primary',
    changeable: false,
    sources: ['NICE_NG12_GYN'],
    title: { en: 'Bleeding between periods or after sex', ar: 'نزيف بين الدورات أو بعد العلاقة الزوجية' },
    why: {
      en: 'This is usually caused by something minor, such as an infection or a polyp, but it should always be examined, and your cervical screening should be up to date.',
      ar: 'عادةً ما يكون سببه بسيطاً، مثل عدوى أو زائدة لحمية، لكن يجب فحصه دائماً، ويجب أن يكون فحص عنق الرحم الدوري محدّثاً.',
    },
    action: { en: 'See your family doctor or a women’s health clinic within the next few weeks for an examination.', ar: 'راجعي طبيب الأسرة أو عيادة صحة المرأة خلال الأسابيع القليلة القادمة لإجراء فحص.' },
    test: has('gyn_symptoms', 'bleeding_between'),
  },
  {
    id: 'GY_KNOWN_CONDITION',
    sex: 'female',
    category: 'history',
    level: 'primary',
    changeable: true,
    sources: ['PCOS2023', 'ESHRE_ENDO2022'],
    option: 'counselling',
    title: { en: 'A known condition that can affect fertility', ar: 'حالة معروفة قد تؤثر على الخصوبة' },
    why: {
      en: 'PCOS, endometriosis and fibroids are common, and most women with them have children. They can change the best timing, and the order of treatments, so it is worth planning with your doctor before you start trying.',
      ar: 'تكيّس المبايض وبطانة الرحم المهاجرة والأورام الليفية حالات شائعة، ومعظم النساء المصابات بها ينجبن. لكنها قد تغيّر التوقيت الأنسب وترتيب العلاجات، لذلك من المفيد التخطيط مع طبيبك قبل بدء المحاولة.',
    },
    action: {
      en: 'Ask your doctor or gynaecologist for a planning conversation: timing, any surgery, and when to seek help if pregnancy does not happen.',
      ar: 'اطلبي من طبيبك أو طبيبة النساء محادثة للتخطيط: التوقيت، وأي جراحة محتملة، ومتى تطلبين المساعدة إذا لم يحدث الحمل.',
    },
    test: (c) => {
      if (one(c.a, 'plans_when') === 'none') return null
      return has('gyn_history', 'pcos', 'endometriosis', 'fibroids')(c)
    },
  },
  {
    id: 'GY_AMH_LOW',
    sex: 'female',
    category: 'test',
    level: 'primary',
    changeable: false,
    sources: ['ASRM_ORT2020', 'AMH_STEINER2017'],
    option: 'preservation',
    title: { en: 'Egg reserve (AMH) lower than typical', ar: 'مخزون البويضات (AMH) أقل من المعتاد' },
    why: {
      en: 'AMH shows roughly how many eggs remain. It does not show egg quality, and on its own it does not predict whether you can get pregnant naturally. A lower value matters most for timing, and for planning IVF or egg freezing.',
      ar: 'يُظهر AMH تقريباً عدد البويضات المتبقية، لكنه لا يُظهر جودتها، ولا يتنبأ وحده بقدرتك على الحمل الطبيعي. تكون أهمية القيمة المنخفضة أكبر في التوقيت، وفي التخطيط لأطفال الأنابيب أو تجميد البويضات.',
    },
    action: {
      en: 'Talk it through with your doctor or a fertility specialist: what it means at your age, and whether your timing or options should change.',
      ar: 'ناقشي النتيجة مع طبيبك أو أخصائية الخصوبة: ماذا تعني في عمرك، وهل ينبغي تغيير توقيتك أو خياراتك.',
    },
    test: (c) => {
      const v = c.hormones.amh
      return v !== undefined && v < AMH_LOW ? [{ en: `AMH ${fmt(v)} ng/mL (reference point ${AMH_LOW})`, ar: `AMH ${fmt(v)} نانوغرام/مل (النقطة المرجعية ${AMH_LOW})` }] : null
    },
  },
  {
    id: 'GY_FSH_RAISED',
    sex: 'female',
    category: 'test',
    level: 'primary',
    changeable: false,
    sources: ['ASRM_ORT2020'],
    title: { en: 'Early-cycle FSH above 10', ar: 'هرمون FSH أعلى من 10 في بداية الدورة' },
    why: {
      en: 'A raised FSH early in the cycle can be a sign of a lower egg reserve. FSH varies from cycle to cycle, so one result is never the full picture.',
      ar: 'قد يكون ارتفاع FSH في بداية الدورة علامة على انخفاض مخزون البويضات. يتفاوت FSH من دورة لأخرى، لذلك لا تعطي نتيجة واحدة الصورة الكاملة.',
    },
    action: { en: 'Discuss it with your doctor, who may repeat it alongside AMH.', ar: 'ناقشيه مع طبيبك، فقد يعيده مع تحليل AMH.' },
    test: (c) => {
      const f = c.hormones.fsh
      return f !== undefined && f >= FSH_RAISED && f < FSH_POI ? [{ en: `FSH ${fmt(f)} IU/L`, ar: `FSH ${fmt(f)} وحدة/لتر` }] : null
    },
  },
  {
    id: 'GY_TSH',
    sex: 'female',
    category: 'test',
    level: 'primary',
    changeable: true,
    sources: ['ATA2017'],
    title: { en: 'Thyroid test outside the usual range', ar: 'تحليل الغدة الدرقية خارج المعدل المعتاد' },
    why: {
      en: 'An underactive or overactive thyroid can affect cycles and ovulation, and it is simple to treat. It matters most before and during pregnancy.',
      ar: 'قد يؤثر خمول الغدة الدرقية أو فرط نشاطها على الدورة والتبويض، وعلاجه بسيط. وتزداد أهميته قبل الحمل وأثناءه.',
    },
    action: { en: 'See your family doctor to repeat it and decide on treatment.', ar: 'راجعي طبيب الأسرة لإعادة التحليل وتحديد العلاج.' },
    test: (c) => {
      const v = c.hormones.tsh
      return v !== undefined && (v < TSH_RANGE[0] || v > TSH_RANGE[1])
        ? [{ en: `TSH ${fmt(v)} mIU/L (usual range ${TSH_RANGE[0]}–${TSH_RANGE[1]})`, ar: `TSH ${fmt(v)} ملي وحدة/لتر (المعدل المعتاد ${TSH_RANGE[0]}-${TSH_RANGE[1]})` }]
        : null
    },
  },
  {
    id: 'PR_PRECONCEPTION',
    sex: 'female',
    category: 'screening',
    level: 'primary',
    changeable: true,
    sources: ['WHO_PRECONCEPTION', 'FOLIC_USPSTF2023'],
    option: 'counselling',
    title: { en: 'Planning a pregnancy: a preconception check', ar: 'التخطيط للحمل: فحص ما قبل الحمل' },
    why: {
      en: 'One visit before trying covers folic acid, vaccines such as rubella, any long-term condition or medicine, weight, and genetic carrier screening. These are the things most likely to make a difference, and they are easiest to sort out early.',
      ar: 'زيارة واحدة قبل المحاولة تشمل حمض الفوليك، واللقاحات مثل الحصبة الألمانية، وأي حالة مزمنة أو دواء، والوزن، والفحص الوراثي للحاملين. هذه أكثر الأمور تأثيراً، ومعالجتها أسهل في وقت مبكر.',
    },
    action: {
      en: 'Book a preconception visit with your family doctor or a women’s health clinic. A teleconsultation is fine for the first conversation.',
      ar: 'احجزي زيارة ما قبل الحمل لدى طبيب الأسرة أو عيادة صحة المرأة. الاستشارة عن بُعد مناسبة للمحادثة الأولى.',
    },
    test: (c) => {
      const t = one(c.a, 'ttc')
      if (t === 'planning') return [said('ttc', t)]
      if (one(c.a, 'plans_when') === '1to2y') return [said('plans_when', '1to2y')]
      return null
    },
  },
  {
    id: 'PR_TIMING',
    sex: 'female',
    category: 'history',
    // Information plus an offered conversation, never a referral: age alone should not send anyone to a doctor.
    level: 'info',
    changeable: false,
    sources: ['ACOG_AGE2014', 'ASRM_OOCYTE2018', 'MENOPAUSE_FH'],
    option: 'preservation',
    title: { en: 'Thinking ahead about age and timing', ar: 'التفكير مبكراً في العمر والتوقيت' },
    why: {
      en: 'The number and quality of eggs fall with age, faster after about 35 and steeply after 40. It varies a lot between women, and no test can say exactly when it will become hard. Knowing early gives you time to choose, including whether to discuss egg freezing, which works best before 35.',
      ar: 'ينخفض عدد البويضات وجودتها مع العمر، بشكل أسرع بعد نحو 35 وبشدة بعد 40. يختلف ذلك كثيراً بين النساء، ولا يوجد تحليل يحدد بدقة متى يصبح الحمل صعباً. المعرفة المبكرة تمنحك وقتاً للاختيار، ومنه مناقشة تجميد البويضات الذي يكون أنجح قبل 35.',
    },
    action: {
      en: 'If you would like to, book a counselling conversation about timing and options. It is a discussion, not a recommendation, and the choice stays yours.',
      ar: 'إذا رغبتِ، احجزي جلسة استشارة حول التوقيت والخيارات. هي مناقشة وليست توصية، والقرار يبقى لكِ.',
    },
    test: (c) => {
      const age = c.age
      if (age === undefined || age > 42) return null
      const t = one(c.a, 'ttc')
      const w = one(c.a, 'plans_when')
      const out: L10n[] = [{ en: `You are ${age}`, ar: `عمرك ${age} عاماً` }]
      const fh = one(c.a, 'menopause_fh') === 'yes'
      if (fh) out.push(said('menopause_fh', 'yes'))
      const later = w === '3to5y' || w === 'gt5y' || w === 'unsure'
      if (later && (age >= 32 || (fh && age >= 25))) return [...out, said('plans_when', w)]
      if (age >= 35 && (t === 'planning' || w === '1to2y')) return [...out, t === 'planning' ? said('ttc', t) : said('plans_when', '1to2y')]
      return null
    },
  },

  // ---- Self-care (habits that help) ----
  {
    id: 'SC_TOBACCO',
    category: 'lifestyle',
    level: 'selfcare',
    changeable: true,
    sources: ['ASRM2022'],
    title: { en: 'Tobacco or nicotine use', ar: 'استخدام التبغ أو النيكوتين' },
    why: {
      en: 'Cigarettes, shisha, medwakh and vaping are linked to lower sperm quality and to heart disease.',
      ar: 'ترتبط السجائر والشيشة والمدواخ والسجائر الإلكترونية بانخفاض جودة الحيوانات المنوية وبأمراض القلب.',
    },
    action: {
      en: 'Cutting down helps; quitting helps most. Quit-smoking support is available through primary care.',
      ar: 'التقليل مفيد، والإقلاع أفضل. يتوفر دعم للإقلاع عن التدخين عبر الرعاية الأولية.',
    },
    female: {
      sources: ['ASRM2022', 'NICE_CG156'],
      why: {
        en: 'Smoking, shisha, medwakh and vaping are linked to lower fertility, earlier menopause and miscarriage, and to heart disease.',
        ar: 'يرتبط التدخين والشيشة والمدواخ والسجائر الإلكترونية بانخفاض الخصوبة وتبكير انقطاع الطمث والإجهاض، وبأمراض القلب.',
      },
      action: {
        en: 'Cutting down helps; quitting helps most. Quit-smoking support is available through primary care.',
        ar: 'التقليل مفيد، والإقلاع أفضل. يتوفر دعم للإقلاع عن التدخين عبر الرعاية الأولية.',
      },
    },
    test: (c) => {
      const v = one(c.a, 'tobacco')
      return v === 'sometimes' || v === 'daily' ? [said('tobacco', v)] : null
    },
  },
  {
    id: 'SC_HEAT',
    sex: 'male',
    category: 'lifestyle',
    level: 'selfcare',
    changeable: true,
    sources: ['EAU2024'],
    title: { en: 'Regular heat exposure', ar: 'التعرض المتكرر للحرارة' },
    why: {
      en: 'Sperm are made best slightly below body temperature. Regular saunas, hot tubs, long sitting or working in the heat may lower sperm quality, which usually recovers when exposure drops.',
      ar: 'تُنتَج الحيوانات المنوية بشكل أفضل في حرارة أقل قليلاً من حرارة الجسم. قد يؤدي التعرض المتكرر للساونا أو الأحواض الساخنة أو الجلوس الطويل أو العمل في الحر إلى خفض جودتها، وعادةً ما تتحسن عند تقليل التعرض.',
    },
    action: {
      en: 'Take breaks from sitting, wear loose clothing, limit saunas and hot tubs, and stay cool and hydrated at work.',
      ar: 'خذ فترات راحة من الجلوس، وارتدِ ملابس فضفاضة، وقلّل الساونا والأحواض الساخنة، وحافظ على البرودة وشرب الماء في العمل.',
    },
    test: has('heat', 'outdoor_heat', 'sauna', 'sitting'),
  },
  {
    id: 'SC_OVERWEIGHT',
    category: 'metabolic',
    level: 'selfcare',
    changeable: true,
    sources: ['ASRM2022'],
    title: { en: 'Weight above the healthy range (BMI 25–29.9)', ar: 'وزن أعلى من النطاق الصحي (مؤشر كتلة الجسم 25-29.9)' },
    why: {
      en: 'Extra weight can lower testosterone and sperm quality over time.',
      ar: 'قد تؤدي زيادة الوزن مع الوقت إلى خفض التستوستيرون وجودة الحيوانات المنوية.',
    },
    action: {
      en: 'Small, steady changes to food and activity help. Your routine check can include support with weight.',
      ar: 'تساعد التغييرات الصغيرة والمستمرة في الغذاء والنشاط، ويمكن أن يشمل فحصك الدوري دعماً لإدارة الوزن.',
    },
    female: {
      sources: ['NICE_CG156', 'ASRM2022'],
      why: { en: 'Extra weight can make ovulation less regular over time.', ar: 'قد تجعل زيادة الوزن التبويض أقل انتظاماً مع الوقت.' },
      action: {
        en: 'Small, steady changes to food and activity help. Your routine check can include support with weight.',
        ar: 'تساعد التغييرات الصغيرة والمستمرة في الغذاء والنشاط، ويمكن أن يشمل فحصك الدوري دعماً لإدارة الوزن.',
      },
    },
    test: (c) =>
      c.bmi !== undefined && c.bmi >= 25 && c.bmi < 30 ? [{ en: `Your BMI is ${fmt(c.bmi)}`, ar: `مؤشر كتلة جسمك ${fmt(c.bmi)}` }] : null,
  },
  {
    id: 'SC_INACTIVE',
    category: 'lifestyle',
    level: 'selfcare',
    changeable: true,
    sources: ['ASRM2022'],
    title: { en: 'Low physical activity', ar: 'قلة النشاط البدني' },
    why: { en: 'Regular activity supports a healthy weight, testosterone and heart health.', ar: 'يدعم النشاط المنتظم الوزن الصحي ومستوى التستوستيرون وصحة القلب.' },
    action: {
      en: 'Aim for 150 minutes of moderate activity a week. Brisk walking counts.',
      ar: 'استهدف 150 دقيقة من النشاط المعتدل أسبوعياً، والمشي السريع يُحتسب.',
    },
    female: {
      why: { en: 'Regular activity supports a healthy weight, regular cycles and heart health.', ar: 'يدعم النشاط المنتظم الوزن الصحي وانتظام الدورة وصحة القلب.' },
      action: { en: 'Aim for 150 minutes of moderate activity a week. Brisk walking counts.', ar: 'استهدفي 150 دقيقة من النشاط المعتدل أسبوعياً، والمشي السريع يُحتسب.' },
    },
    test: (c) => (one(c.a, 'activity') === '0to1' ? [said('activity', '0to1')] : null),
  },
  {
    id: 'SC_SLEEP',
    category: 'lifestyle',
    level: 'selfcare',
    changeable: true,
    sources: ['EAU2024'],
    title: { en: 'Short sleep', ar: 'قلة النوم' },
    why: {
      en: 'Regularly sleeping under 6 hours is linked to lower testosterone and poorer metabolic health.',
      ar: 'يرتبط النوم أقل من 6 ساعات بانتظام بانخفاض التستوستيرون وضعف الصحة الأيضية.',
    },
    action: { en: 'Aim for 7–8 hours, at a regular time.', ar: 'استهدف 7-8 ساعات من النوم بمواعيد منتظمة.' },
    female: {
      sources: ['ASRM2022'],
      why: { en: 'Regularly sleeping under 6 hours is linked to irregular cycles and poorer metabolic health.', ar: 'يرتبط النوم أقل من 6 ساعات بانتظام بعدم انتظام الدورة وضعف الصحة الأيضية.' },
      action: { en: 'Aim for 7–8 hours, at a regular time.', ar: 'استهدفي 7-8 ساعات من النوم بمواعيد منتظمة.' },
    },
    test: (c) => (one(c.a, 'sleep') === 'lt6' ? [said('sleep', 'lt6')] : null),
  },
  {
    id: 'SC_SCREENING_SOON',
    category: 'screening',
    level: 'selfcare',
    changeable: true,
    sources: ['IFHAS'],
    title: { en: 'Routine health check due soon', ar: 'موعد الفحص الصحي الدوري يقترب' },
    why: {
      en: 'Regular checks find heart, diabetes and weight problems early, and these matter for fertility too.',
      ar: 'تكشف الفحوصات الدورية مشكلات القلب والسكري والوزن مبكراً، وهي مهمة للخصوبة أيضاً.',
    },
    action: { en: 'Plan your next routine health check (IFHAS for Thiqa cardholders).', ar: 'خطّط لفحصك الصحي الدوري القادم («إفحص» لحاملي بطاقة «ثقة»).' },
    female: {
      action: { en: 'Plan your next routine health check (IFHAS for Thiqa cardholders).', ar: 'خطّطي لفحصك الصحي الدوري القادم («إفحص» لحاملات بطاقة «ثقة»).' },
    },
    test: (c) => (one(c.a, 'last_check') === '1to3y' ? [said('last_check', '1to3y')] : null),
  },

  {
    id: 'SC_FOLIC',
    sex: 'female',
    category: 'lifestyle',
    level: 'selfcare',
    changeable: true,
    sources: ['FOLIC_USPSTF2023'],
    title: { en: 'Start folic acid', ar: 'ابدئي بتناول حمض الفوليك' },
    why: {
      en: 'Folic acid taken before and in early pregnancy prevents most spinal cord problems in babies. It needs to start before pregnancy, because the spine forms in the first weeks.',
      ar: 'يقي حمض الفوليك المتناوَل قبل الحمل وفي بدايته من معظم مشكلات الحبل الشوكي لدى الأجنة. يجب البدء به قبل الحمل، لأن العمود الفقري يتكوّن في الأسابيع الأولى.',
    },
    action: {
      en: 'Take 400 micrograms of folic acid every day, from at least a month before trying until 12 weeks of pregnancy. Some women need a higher dose; ask your doctor.',
      ar: 'تناولي 400 ميكروغرام من حمض الفوليك يومياً، من شهر على الأقل قبل المحاولة حتى الأسبوع الثاني عشر من الحمل. تحتاج بعض النساء جرعة أعلى، فاسألي طبيبك.',
    },
    test: (c) => {
      const v = one(c.a, 'folic')
      return v === 'no' || v === 'unsure' ? [said('folic', v)] : null
    },
  },
  {
    id: 'SC_UNDERWEIGHT',
    sex: 'female',
    category: 'metabolic',
    level: 'selfcare',
    changeable: true,
    sources: ['NICE_CG156'],
    title: { en: 'Weight below the healthy range (BMI under 18.5)', ar: 'وزن أقل من النطاق الصحي (مؤشر كتلة الجسم أقل من 18.5)' },
    why: {
      en: 'Being underweight can stop ovulation and make periods irregular or absent. Reaching a healthy weight often brings regular cycles back.',
      ar: 'قد يوقف نقص الوزن التبويض ويجعل الدورة غير منتظمة أو غائبة، وغالباً ما يعيد الوصول إلى وزن صحي انتظام الدورة.',
    },
    action: { en: 'Eat regular, balanced meals, and ask your family doctor for support if it is hard to gain weight.', ar: 'تناولي وجبات منتظمة ومتوازنة، واطلبي دعم طبيب الأسرة إذا كانت زيادة الوزن صعبة.' },
    test: (c) => (c.bmi !== undefined && c.bmi < 18.5 ? [{ en: `Your BMI is ${fmt(c.bmi)}`, ar: `مؤشر كتلة جسمك ${fmt(c.bmi)}` }] : null),
  },

  // ---- Information only: shown and shareable, never changes the next step ----
  {
    id: 'INFO_STI_PAST',
    category: 'infectious',
    level: 'info',
    changeable: false,
    sources: ['AUA2020'],
    title: { en: 'Past genital infection', ar: 'عدوى تناسلية سابقة' },
    why: {
      en: 'Some past infections can affect the tubes that carry sperm. It helps a doctor to know this if you are planning a family.',
      ar: 'قد تؤثر بعض الالتهابات السابقة على القنوات التي تنقل الحيوانات المنوية، ومن المفيد أن يعرف الطبيب ذلك إذا كنت تخطط للإنجاب.',
    },
    action: { en: 'Mention it at your next check-up.', ar: 'اذكر ذلك في فحصك القادم.' },
    female: {
      sources: ['CDC_STI2021', 'NICE_CG156'],
      why: {
        en: 'Some past infections, such as chlamydia, can scar the tubes that carry eggs, often without symptoms. It helps a doctor to know this if you are planning a family.',
        ar: 'قد تترك بعض الالتهابات السابقة، مثل الكلاميديا، ندوباً في قناتي فالوب، غالباً دون أعراض. من المفيد أن يعرف الطبيب ذلك إذا كنتِ تخططين للإنجاب.',
      },
      action: { en: 'Mention it at your next check-up.', ar: 'اذكري ذلك في فحصك القادم.' },
    },
    test: (c) => (one(c.a, 'sti_past') === 'yes' ? [said('sti_past', 'yes')] : null),
  },
  {
    id: 'INFO_FAMILY',
    category: 'family',
    level: 'info',
    changeable: false,
    sources: ['AUA2020'],
    title: { en: 'Family history of fertility problems or genetic conditions', ar: 'تاريخ عائلي لمشكلات الخصوبة أو لحالات وراثية' },
    why: {
      en: 'Some fertility problems and genetic conditions run in families. Genetic counselling can help you plan with confidence.',
      ar: 'تنتقل بعض مشكلات الخصوبة والحالات الوراثية في العائلات، ويمكن أن تساعدك الاستشارة الوراثية على التخطيط بثقة.',
    },
    action: {
      en: 'Ask your doctor whether genetic counselling or preconception screening is right for you.',
      ar: 'اسأل طبيبك إن كانت الاستشارة الوراثية أو فحوصات ما قبل الحمل مناسبة لك.',
    },
    female: {
      action: {
        en: 'Ask your doctor whether genetic counselling or preconception screening is right for you.',
        ar: 'اسألي طبيبك إن كانت الاستشارة الوراثية أو فحوصات ما قبل الحمل مناسبة لك.',
      },
    },
    option: 'counselling',
    test: (c) => (one(c.a, 'family_hx') === 'yes' ? [said('family_hx', 'yes')] : null),
  },
  {
    id: 'INFO_AGE',
    sex: 'male',
    category: 'history',
    level: 'info',
    changeable: false,
    sources: ['EAU2024'],
    title: { en: 'Age 45 or over', ar: 'العمر 45 عاماً أو أكثر' },
    why: {
      en: 'Sperm quality slowly declines with age. That is not a problem on its own, but it is a reason not to delay a check if you are planning a family.',
      ar: 'تنخفض جودة الحيوانات المنوية تدريجياً مع التقدم في العمر. هذا ليس مشكلة بحد ذاته، لكنه سبب لعدم تأجيل الفحص إذا كنت تخطط للإنجاب.',
    },
    action: { en: 'If you are trying for a child, consider a check sooner rather than later.', ar: 'إذا كنت تحاول الإنجاب، ففكّر في إجراء الفحص في وقت مبكر.' },
    test: (c) => {
      const t = one(c.a, 'ttc')
      return c.age !== undefined && c.age >= 45 && (t === 'yes' || t === 'planning')
        ? [{ en: `You are ${c.age}`, ar: `عمرك ${c.age} عاماً` }]
        : null
    },
  },
  {
    id: 'INFO_PELVIC_HISTORY',
    sex: 'female',
    category: 'history',
    level: 'info',
    changeable: false,
    sources: ['NICE_CG156'],
    title: { en: 'Past pelvic infection, ectopic pregnancy or pelvic surgery', ar: 'التهاب سابق في الحوض أو حمل خارج الرحم أو جراحة في الحوض' },
    why: {
      en: 'These can affect the tubes that carry eggs. That is not a problem on its own, but if you start trying, it is a reason to ask for help sooner rather than waiting a full year.',
      ar: 'قد تؤثر هذه على قناتي فالوب. هذا ليس مشكلة بحد ذاته، لكن إذا بدأتِ المحاولة فهو سبب لطلب المساعدة مبكراً بدلاً من انتظار عام كامل.',
    },
    action: { en: 'Mention it at your next check-up, and to any fertility service.', ar: 'اذكري ذلك في فحصك القادم ولأي خدمة خصوبة.' },
    test: has('gyn_history', 'pid', 'ectopic', 'pelvic_surgery'),
  },
  {
    id: 'INFO_EARLY_MENOPAUSE_FH',
    sex: 'female',
    category: 'family',
    level: 'info',
    changeable: false,
    sources: ['MENOPAUSE_FH'],
    title: { en: 'Early menopause in the family', ar: 'انقطاع طمث مبكر في العائلة' },
    why: {
      en: 'Early menopause can run in families. It does not mean it will happen to you, but it is a reason not to leave plans too late.',
      ar: 'قد يتكرر انقطاع الطمث المبكر في العائلة. هذا لا يعني أنه سيحدث لكِ، لكنه سبب لعدم تأجيل الخطط كثيراً.',
    },
    action: { en: 'Mention it to your doctor. An AMH test can add to the picture if you are weighing up timing.', ar: 'أخبري طبيبك بذلك. قد يضيف تحليل AMH معلومات مفيدة إذا كنتِ تفكرين في التوقيت.' },
    test: (c) => (one(c.a, 'menopause_fh') === 'yes' ? [said('menopause_fh', 'yes')] : null),
  },
]

// ---------- data-quality gate ----------

function checkData(a: Answers): { issues: DataIssue[]; age?: number; bmi?: number; semen: Ctx['semen']; hormones: Ctx['hormones'] } {
  const issues: DataIssue[] = []
  const age = num(a, 'age')
  if (age === undefined) {
    issues.push({ id: 'DQ_AGE_MISSING', field: 'age', kind: 'missing', message: { en: 'Age is needed to give advice.', ar: 'نحتاج إلى العمر لتقديم النصيحة.' } })
  } else if (age < 10 || age > 100) {
    issues.push({
      id: 'DQ_AGE_RANGE',
      field: 'age',
      kind: 'implausible',
      message: { en: `Age ${age} looks unlikely. Please check it.`, ar: `يبدو أن العمر ${age} غير مرجّح، يُرجى التحقق منه.` },
    })
  }

  const h = num(a, 'height_cm')
  const w = num(a, 'weight_kg')
  const hOk = h === undefined || (h >= 120 && h <= 230)
  const wOk = w === undefined || (w >= 35 && w <= 300)
  if (!hOk)
    issues.push({
      id: 'DQ_HEIGHT',
      field: 'height_cm',
      kind: 'implausible',
      message: { en: `Height ${h} cm looks unlikely, so we did not use it.`, ar: `يبدو أن الطول ${h} سم غير مرجّح، لذلك لم نستخدمه.` },
    })
  if (!wOk)
    issues.push({
      id: 'DQ_WEIGHT',
      field: 'weight_kg',
      kind: 'implausible',
      message: { en: `Weight ${w} kg looks unlikely, so we did not use it.`, ar: `يبدو أن الوزن ${w} كغ غير مرجّح، لذلك لم نستخدمه.` },
    })
  const bmi = h !== undefined && w !== undefined && hOk && wOk ? Math.round((w / (h / 100) ** 2) * 10) / 10 : undefined

  const semen: Ctx['semen'] = {}
  const hormones: Ctx['hormones'] = {}
  if (sexOf(a) === 'female' && one(a, 'hormone_done') === 'yes') {
    for (const k of HORMONE_KEYS) {
      const v = num(a, k)
      if (v === undefined) continue
      if (v < 0 || v > HORMONE_MAX[k]) {
        issues.push({
          id: `DQ_HORMONE_${k.toUpperCase()}`,
          field: k,
          kind: 'implausible',
          message: {
            en: `${HORMONE_LABEL[k].en} ${v} ${HORMONE_UNIT[k].en} is outside the possible range, so we did not use it. Check the unit on your report.`,
            ar: `القيمة ${v} ${HORMONE_UNIT[k].ar} لـ${HORMONE_LABEL[k].ar} خارج النطاق الممكن، لذلك لم نستخدمها. تحققي من الوحدة في تقريرك.`,
          },
        })
        continue
      }
      hormones[k] = v
    }
    if (hormones.amh !== undefined && hormones.amh > 15) {
      issues.push({
        id: 'DQ_AMH_UNIT',
        field: 'amh',
        kind: 'inconsistent',
        message: {
          en: 'This AMH looks high for ng/mL. If your report says pmol/L, divide by 7.14 and enter it again.',
          ar: 'تبدو قيمة AMH مرتفعة بوحدة ng/mL. إذا كان تقريرك بوحدة pmol/L فاقسميها على 7.14 وأدخليها مجدداً.',
        },
      })
    }
  }

  if (sexOf(a) === 'male' && one(a, 'semen_done') === 'yes') {
    for (const k of SEMEN_KEYS) {
      const v = num(a, k)
      if (v === undefined) continue
      if (v < 0 || v > SEMEN_MAX[k]) {
        issues.push({
          id: `DQ_SEMEN_${k.toUpperCase()}`,
          field: k,
          kind: 'implausible',
          message: {
            en: `${SEMEN_LABEL[k].en} ${v} ${SEMEN_UNIT[k].en} is outside the possible range, so we did not use it.`,
            ar: `القيمة ${v} ${SEMEN_UNIT[k].ar} لـ${SEMEN_LABEL[k].ar} خارج النطاق الممكن، لذلك لم نستخدمها.`,
          },
        })
        continue
      }
      semen[k] = v
    }
    if (semen.progressive !== undefined && semen.total_motility !== undefined && semen.progressive > semen.total_motility) {
      issues.push({
        id: 'DQ_SEMEN_MOTILITY',
        field: 'progressive',
        kind: 'inconsistent',
        message: {
          en: 'Progressive motility cannot be higher than total motility. Please check both values on your report.',
          ar: 'لا يمكن أن تكون الحركة التقدمية أعلى من الحركة الكلية. يُرجى التحقق من القيمتين في تقريرك.',
        },
      })
    }
  }

  if (one(a, 'ttc') === 'yes' && !one(a, 'ttc_months')) {
    issues.push({
      id: 'DQ_TTC_MONTHS',
      field: 'ttc_months',
      kind: 'missing',
      message: { en: 'How long you have been trying helps decide the right next step.', ar: 'تساعد معرفة مدة المحاولة على تحديد الخطوة التالية المناسبة.' },
    })
  }
  return { issues, age, bmi, semen, hormones }
}

// ---------- main entry ----------

export function assess(a: Answers): Assessment {
  const { issues, age, bmi, semen, hormones } = checkData(a)
  const eligible = age !== undefined && age >= 18 && age <= 100
  const sex = sexOf(a)
  const ctx: Ctx = { a, sex, age, bmi, semen, hormones }

  const flags: FiredFlag[] = []
  if (eligible) {
    for (const r of RULES) {
      if (r.sex && r.sex !== sex) continue
      const w = sex === 'female' ? r.female : undefined
      const because = (w?.test ?? r.test)(ctx)
      if (!because) continue
      flags.push({
        id: r.id,
        category: r.category,
        level: r.level,
        emergency: r.emergency ?? false,
        changeable: r.changeable,
        title: w?.title ?? r.title,
        why: w?.why ?? r.why,
        action: w?.action ?? r.action,
        because,
        sources: w?.sources ?? r.sources,
        // Care options are offered in women's checks for now; men's journeys are unchanged.
        ...(sex === 'female' && r.option ? { option: r.option } : {}),
      })
    }
  }

  let level: Level = 'selfcare'
  for (const f of flags) if (f.level !== 'info' && LEVEL_RANK[f.level] > LEVEL_RANK[level]) level = f.level

  const declined = QUESTIONS.filter((q) => arr(a, q.id).includes('prefer_not')).map((q) => q.id)
  const lastCheck = one(a, 'last_check')

  return {
    engineVersion: ENGINE_VERSION,
    sex,
    eligible,
    level,
    emergency: flags.some((f) => f.emergency),
    flags,
    dataIssues: issues,
    declined,
    bmi,
    screeningDue: lastCheck === 'gt3y' || lastCheck === 'unsure' || lastCheck === '1to3y',
  }
}
