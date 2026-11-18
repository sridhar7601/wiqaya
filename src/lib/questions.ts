import type { Answers, L10n, Sex } from './types'
import { sexOf } from './types'

export type QType = 'single' | 'multi' | 'number' | 'numbers'

export interface Option {
  value: string
  label: L10n
  /** Selecting this clears every other choice (e.g. "None of these"). */
  exclusive?: boolean
}

export interface NumberField {
  id: string
  label: L10n
  unit: L10n
  min: number
  max: number
  step?: number
}

export interface Question {
  id: string
  section: SectionId
  type: QType
  text: L10n
  help?: L10n
  options?: Option[]
  fields?: NumberField[]
  /** Every field is optional (only used by 'numbers'). */
  optional?: boolean
  sensitive?: boolean
  showIf?: (a: Answers) => boolean
  /** Asked only in a check for this sex. */
  only?: Sex
  /** Wording for a woman's check (Arabic is gendered, and some options differ). Same id, same answer key. */
  female?: { text?: L10n; help?: L10n; options?: Option[] }
}

export type SectionId = 'about' | 'safety' | 'family' | 'body' | 'cycle' | 'health' | 'intimate' | 'lifestyle' | 'tests'

export const SECTIONS: Record<SectionId, L10n> = {
  about: { en: 'About you', ar: 'معلومات عنك' },
  safety: { en: 'Safety check', ar: 'فحص السلامة' },
  family: { en: 'Family plans', ar: 'خطط الأسرة' },
  body: { en: 'Body & development', ar: 'الجسم والنمو' },
  cycle: { en: 'Periods & cycle', ar: 'الدورة الشهرية' },
  health: { en: 'Health & medicines', ar: 'الصحة والأدوية' },
  intimate: { en: 'Private health', ar: 'الصحة الخاصة' },
  lifestyle: { en: 'Daily life', ar: 'نمط الحياة' },
  tests: { en: 'Checks & tests', ar: 'الفحوصات والتحاليل' },
}

const YES: Option = { value: 'yes', label: { en: 'Yes', ar: 'نعم' } }
const NO: Option = { value: 'no', label: { en: 'No', ar: 'لا' } }
const UNSURE: Option = { value: 'unsure', label: { en: 'Not sure', ar: 'لا أعرف' } }
const PREFER_NOT: Option = { value: 'prefer_not', label: { en: 'Prefer not to say', ar: 'أفضّل عدم الإجابة' }, exclusive: true }
const NONE: Option = { value: 'none', label: { en: 'None of these', ar: 'لا شيء مما سبق' }, exclusive: true }

const isF = (a: Answers) => sexOf(a) === 'female'

export const QUESTIONS: Question[] = [
  {
    id: 'sex',
    section: 'about',
    type: 'single',
    text: { en: 'Who is this check for?', ar: 'لمن هذا الفحص؟' },
    help: {
      en: 'Reproductive health is different for men and women, so the questions are too. You can do a check for each partner.',
      ar: 'تختلف الصحة الإنجابية بين الرجل والمرأة، لذلك تختلف الأسئلة أيضاً. يمكن لكل شريك إجراء فحصه الخاص.',
    },
    options: [
      { value: 'male', label: { en: 'Me, and I am a man', ar: 'لي، وأنا رجل' } },
      { value: 'female', label: { en: 'Me, and I am a woman', ar: 'لي، وأنا امرأة' } },
    ],
  },
  {
    id: 'age',
    section: 'about',
    type: 'number',
    text: { en: 'How old are you?', ar: 'كم عمرك؟' },
    help: {
      en: 'Some advice depends on age. We never ask for your date of birth or your name.',
      ar: 'تعتمد بعض النصائح على العمر. لا نطلب تاريخ ميلادك أو اسمك أبداً.',
    },
    fields: [{ id: 'age', label: { en: 'Age', ar: 'العمر' }, unit: { en: 'years', ar: 'سنة' }, min: 10, max: 100 }],
  },
  {
    id: 'urgent_symptoms',
    section: 'safety',
    type: 'multi',
    text: {
      en: 'First, a quick safety check. Do you have any of these right now?',
      ar: 'أولاً، فحص سريع للسلامة. هل تعاني الآن من أيٍّ مما يلي؟',
    },
    help: {
      en: 'These need a doctor quickly, so we always ask about them first.',
      ar: 'تحتاج هذه الأعراض إلى طبيب بسرعة، لذلك نسأل عنها دائماً أولاً.',
    },
    options: [
      { value: 'sudden_pain', label: { en: 'Sudden, severe pain in a testicle or the scrotum', ar: 'ألم مفاجئ وشديد في الخصية أو كيس الصفن' } },
      { value: 'swelling_fever', label: { en: 'A painful, swollen testicle with fever', ar: 'خصية متورمة ومؤلمة مع حرارة' } },
      { value: 'new_lump', label: { en: 'A new lump or hard area in a testicle', ar: 'كتلة جديدة أو منطقة صلبة في الخصية' } },
      NONE,
    ],
    female: {
      text: { en: 'First, a quick safety check. Do you have any of these right now?', ar: 'أولاً، فحص سريع للسلامة. هل تعانين الآن من أيٍّ مما يلي؟' },
      help: { en: 'These need a doctor quickly, so we always ask about them first.', ar: 'تحتاج هذه الأعراض إلى طبيب بسرعة، لذلك نسأل عنها دائماً أولاً.' },
      options: [
        {
          value: 'ectopic_signs',
          label: {
            en: 'Severe pain low in the belly, especially on one side, with a late period or a positive pregnancy test, or with fainting',
            ar: 'ألم شديد أسفل البطن، خاصة في جهة واحدة، مع تأخر الدورة أو اختبار حمل إيجابي، أو مع إغماء',
          },
        },
        {
          value: 'heavy_bleeding',
          label: {
            en: 'Very heavy bleeding (soaking a pad or tampon every hour for 2 hours or more), or bleeding while pregnant',
            ar: 'نزيف غزير جداً (تبليل فوطة أو سدادة كل ساعة لساعتين أو أكثر)، أو نزيف أثناء الحمل',
          },
        },
        { value: 'pelvic_fever', label: { en: 'Pain low in the belly with fever or unusual discharge', ar: 'ألم أسفل البطن مع حرارة أو إفرازات غير معتادة' } },
        NONE,
      ],
    },
  },
  {
    id: 'body',
    section: 'about',
    type: 'numbers',
    optional: true,
    text: { en: 'Your height and weight (optional)', ar: 'طولك ووزنك (اختياري)' },
    help: {
      en: 'Used only to work out your body mass index (BMI), on your phone.',
      ar: 'يُستخدمان فقط لحساب مؤشر كتلة الجسم على هاتفك.',
    },
    fields: [
      { id: 'height_cm', label: { en: 'Height', ar: 'الطول' }, unit: { en: 'cm', ar: 'سم' }, min: 100, max: 250 },
      { id: 'weight_kg', label: { en: 'Weight', ar: 'الوزن' }, unit: { en: 'kg', ar: 'كغ' }, min: 30, max: 350 },
    ],
  },
  {
    id: 'ttc',
    section: 'family',
    type: 'single',
    text: { en: 'Are you and your partner trying to have a child?', ar: 'هل تحاول أنت وشريكة حياتك الإنجاب؟' },
    help: {
      en: 'Many men check their health before starting a family. There is no right or wrong answer.',
      ar: 'يفحص كثير من الرجال صحتهم قبل تكوين أسرة. لا توجد إجابة صحيحة أو خاطئة.',
    },
    female: {
      text: { en: 'Are you and your partner trying to have a child?', ar: 'هل تحاولين أنتِ وشريك حياتك الإنجاب؟' },
      help: {
        en: 'It helps to know where you are now, whether that is trying, planning, or not thinking about it yet. There is no right or wrong answer.',
        ar: 'من المفيد أن نعرف أين أنتِ الآن: تحاولين، أو تخططين، أو لم تفكري في الأمر بعد. لا توجد إجابة صحيحة أو خاطئة.',
      },
    },
    options: [
      { value: 'yes', label: { en: 'Yes, we are trying now', ar: 'نعم، نحاول الآن' } },
      { value: 'planning', label: { en: 'Planning to in the next year', ar: 'نخطط لذلك خلال العام القادم' } },
      { value: 'not_now', label: { en: 'Not at the moment', ar: 'ليس في الوقت الحالي' } },
      PREFER_NOT,
    ],
  },
  {
    id: 'ttc_months',
    section: 'family',
    type: 'single',
    text: { en: 'How long have you been trying?', ar: 'منذ متى تحاولان؟' },
    options: [
      { value: 'lt6', label: { en: 'Less than 6 months', ar: 'أقل من 6 أشهر' } },
      { value: '6to12', label: { en: '6 to 12 months', ar: 'من 6 إلى 12 شهراً' } },
      { value: 'gt12', label: { en: 'More than 12 months', ar: 'أكثر من 12 شهراً' } },
    ],
    showIf: (a) => a.ttc === 'yes',
  },
  {
    id: 'partner_age',
    section: 'family',
    type: 'single',
    text: { en: 'Is your partner 35 or older?', ar: 'هل عمر شريكة حياتك 35 عاماً أو أكثر؟' },
    help: {
      en: 'Guidelines suggest checking sooner when the female partner is 35 or older.',
      ar: 'توصي الإرشادات بالفحص في وقت أبكر عندما يكون عمر الشريكة 35 عاماً أو أكثر.',
    },
    options: [
      { value: 'under35', label: { en: 'Under 35', ar: 'أقل من 35' } },
      { value: '35plus', label: { en: '35 or older', ar: '35 أو أكثر' } },
      PREFER_NOT,
    ],
    only: 'male',
    showIf: (a) => a.ttc === 'yes',
  },
  {
    id: 'plans_when',
    section: 'family',
    type: 'single',
    only: 'female',
    text: { en: 'If you would like children in the future, roughly when?', ar: 'إذا كنتِ ترغبين في الإنجاب مستقبلاً، فمتى تقريباً؟' },
    help: {
      en: 'Fertility changes with age, so the timing you have in mind changes what is worth knowing now. It is fine to be unsure.',
      ar: 'تتغير الخصوبة مع العمر، لذلك يغيّر التوقيت الذي تفكرين فيه ما يفيد معرفته الآن. لا بأس إن لم تكوني متأكدة.',
    },
    options: [
      { value: '1to2y', label: { en: 'In the next 1–2 years', ar: 'خلال سنة إلى سنتين' } },
      { value: '3to5y', label: { en: 'In 3–5 years', ar: 'خلال 3 إلى 5 سنوات' } },
      { value: 'gt5y', label: { en: 'More than 5 years from now', ar: 'بعد أكثر من 5 سنوات' } },
      { value: 'unsure', label: { en: 'I have not decided yet', ar: 'لم أقرر بعد' } },
      { value: 'none', label: { en: 'I do not plan to have children', ar: 'لا أخطط للإنجاب' } },
      PREFER_NOT,
    ],
    showIf: (a) => a.ttc === 'not_now' || a.ttc === 'prefer_not',
  },
  {
    id: 'cycle',
    section: 'cycle',
    type: 'single',
    only: 'female',
    text: { en: 'How would you describe your periods over the last year?', ar: 'كيف تصفين دورتك الشهرية خلال العام الماضي؟' },
    help: {
      en: 'Your cycle is one of the best everyday signs of whether you ovulate each month. Count from the first day of one period to the first day of the next.',
      ar: 'الدورة الشهرية من أفضل العلامات اليومية على حدوث التبويض كل شهر. احسبي من أول يوم في دورة إلى أول يوم في الدورة التالية.',
    },
    options: [
      { value: 'regular', label: { en: 'Regular: every 21–35 days, and fairly predictable', ar: 'منتظمة: كل 21 إلى 35 يوماً، ويمكن توقعها' } },
      { value: 'irregular', label: { en: 'Irregular: the gap changes a lot from month to month', ar: 'غير منتظمة: تتغير المدة كثيراً من شهر لآخر' } },
      { value: 'rare', label: { en: 'Infrequent: usually more than 35 days apart, or fewer than 9 a year', ar: 'متباعدة: غالباً أكثر من 35 يوماً بين الدورتين، أو أقل من 9 دورات في السنة' } },
      { value: 'none_3m', label: { en: 'No period for 3 months or more (and not pregnant or breastfeeding)', ar: 'لا دورة منذ 3 أشهر أو أكثر (دون حمل أو رضاعة)' } },
      { value: 'hormonal', label: { en: 'I use hormonal contraception or another hormone treatment, so I cannot tell', ar: 'أستخدم وسيلة منع حمل هرمونية أو علاجاً هرمونياً، لذلك لا أستطيع المعرفة' } },
      PREFER_NOT,
    ],
  },
  {
    id: 'anat',
    section: 'body',
    only: 'male',
    type: 'multi',
    text: { en: 'Have any of these ever applied to you?', ar: 'هل ينطبق عليك أيٌّ مما يلي؟' },
    options: [
      {
        value: 'undescended',
        label: {
          en: 'A testicle that had not come down at birth (or needed surgery as a child)',
          ar: 'خصية لم تنزل عند الولادة (أو احتاجت إلى جراحة في الطفولة)',
        },
      },
      {
        value: 'varicocele',
        label: {
          en: 'A heavy, dragging feeling or visible twisted veins in the scrotum',
          ar: 'إحساس بالثقل أو أوردة متعرّجة ظاهرة في كيس الصفن',
        },
      },
      {
        value: 'injury_surgery',
        label: {
          en: 'Injury, torsion or surgery of the testicles or groin (e.g. hernia repair)',
          ar: 'إصابة أو التواء أو جراحة في الخصيتين أو الأربية (مثل إصلاح الفتق)',
        },
      },
      NONE,
      PREFER_NOT,
    ],
  },
  {
    id: 'mumps',
    section: 'body',
    only: 'male',
    type: 'single',
    text: {
      en: 'Have you had mumps with painful, swollen testicles after puberty?',
      ar: 'هل أُصبت بالنكاف مع تورّم وألم في الخصيتين بعد البلوغ؟',
    },
    options: [YES, NO, UNSURE],
  },
  {
    id: 'sti_now',
    section: 'intimate',
    type: 'single',
    sensitive: true,
    text: {
      en: 'Right now, do you have discharge, burning when passing urine, or genital sores?',
      ar: 'هل تعاني حالياً من إفرازات أو حرقة عند التبول أو تقرحات في الأعضاء التناسلية؟',
    },
    help: { en: 'These are common and treatable. Your answer stays private.', ar: 'هذه أعراض شائعة وقابلة للعلاج، وإجابتك تبقى سرية.' },
    options: [YES, NO, PREFER_NOT],
    female: {
      text: {
        en: 'Right now, do you have unusual discharge, burning when passing urine, or genital sores?',
        ar: 'هل تعانين حالياً من إفرازات غير معتادة أو حرقة عند التبول أو تقرحات في الأعضاء التناسلية؟',
      },
    },
  },
  {
    id: 'sti_past',
    section: 'intimate',
    type: 'single',
    sensitive: true,
    text: {
      en: 'Have you ever been treated for a genital or sexually transmitted infection?',
      ar: 'هل سبق أن عولجت من عدوى تناسلية أو منقولة جنسياً؟',
    },
    options: [YES, NO, PREFER_NOT],
  },
  {
    id: 'gyn_symptoms',
    section: 'intimate',
    type: 'multi',
    sensitive: true,
    only: 'female',
    text: { en: 'In the last few months, have you had any of these?', ar: 'خلال الأشهر الأخيرة، هل عانيتِ من أيٍّ مما يلي؟' },
    help: {
      en: 'Optional and private. These are common and treatable, and many women live with them for years before getting help.',
      ar: 'سؤال اختياري وسري. هذه مشكلات شائعة وقابلة للعلاج، وتعيش معها نساء كثيرات سنوات قبل طلب المساعدة.',
    },
    options: [
      { value: 'severe_period_pain', label: { en: 'Period pain bad enough to stop you working, studying or sleeping', ar: 'ألم الدورة لدرجة تمنعك من العمل أو الدراسة أو النوم' } },
      { value: 'pain_sex', label: { en: 'Deep pain during or after sex', ar: 'ألم عميق أثناء العلاقة الزوجية أو بعدها' } },
      { value: 'heavy_periods', label: { en: 'Heavy periods (flooding, clots, or changing protection every 1–2 hours)', ar: 'دورة غزيرة (تدفق شديد أو جلطات أو تغيير الفوطة كل ساعة أو ساعتين)' } },
      { value: 'bleeding_between', label: { en: 'Bleeding between periods or after sex', ar: 'نزيف بين الدورات أو بعد العلاقة الزوجية' } },
      { value: 'hair_acne', label: { en: 'New excess hair on the face or body, or persistent acne', ar: 'شعر زائد جديد في الوجه أو الجسم، أو حب شباب مستمر' } },
      NONE,
      PREFER_NOT,
    ],
  },
  {
    id: 'gyn_history',
    section: 'health',
    type: 'multi',
    sensitive: true,
    only: 'female',
    text: { en: 'Has a doctor ever told you that you have, or had, any of these?', ar: 'هل أخبركِ طبيب يوماً بأن لديكِ، أو كان لديكِ، أيٌّ مما يلي؟' },
    options: [
      { value: 'pcos', label: { en: 'Polycystic ovary syndrome (PCOS)', ar: 'متلازمة تكيّس المبايض' } },
      { value: 'endometriosis', label: { en: 'Endometriosis', ar: 'بطانة الرحم المهاجرة' } },
      { value: 'fibroids', label: { en: 'Fibroids', ar: 'أورام ليفية في الرحم' } },
      { value: 'pid', label: { en: 'A pelvic infection (for example chlamydia or pelvic inflammatory disease)', ar: 'التهاب في الحوض (مثل الكلاميديا أو مرض التهاب الحوض)' } },
      { value: 'ectopic', label: { en: 'An ectopic pregnancy', ar: 'حمل خارج الرحم' } },
      { value: 'pelvic_surgery', label: { en: 'Surgery on the ovaries, tubes or womb', ar: 'جراحة في المبايض أو قناتي فالوب أو الرحم' } },
      { value: 'miscarriage2', label: { en: 'Two or more miscarriages', ar: 'إجهاضان أو أكثر' } },
      NONE,
      PREFER_NOT,
    ],
  },
  {
    id: 'conditions',
    section: 'health',
    type: 'multi',
    text: { en: 'Do you have any of these health conditions?', ar: 'هل لديك أيٌّ من الحالات الصحية التالية؟' },
    options: [
      { value: 'diabetes', label: { en: 'Diabetes', ar: 'السكري' } },
      { value: 'high_bp', label: { en: 'High blood pressure', ar: 'ارتفاع ضغط الدم' } },
      { value: 'high_chol', label: { en: 'High cholesterol', ar: 'ارتفاع الكوليسترول' } },
      { value: 'snoring', label: { en: 'Loud snoring with daytime tiredness', ar: 'شخير عالٍ مع تعب خلال النهار' } },
      { value: 'thyroid', label: { en: 'Thyroid condition', ar: 'مشكلة في الغدة الدرقية' } },
      { value: 'cancer_past', label: { en: 'Past cancer treated with chemotherapy or radiotherapy', ar: 'سرطان سابق عولج بالعلاج الكيميائي أو الإشعاعي' } },
      { value: 'cancer_planned', label: { en: 'Cancer treatment that is about to start', ar: 'علاج للسرطان على وشك البدء' } },
      NONE,
    ],
  },
  {
    id: 'meds',
    section: 'health',
    type: 'multi',
    only: 'male',
    text: { en: 'Do you currently use any of these?', ar: 'هل تستخدم حالياً أيّاً مما يلي؟' },
    help: {
      en: 'Some medicines and supplements affect sperm. Never stop a prescribed medicine on your own.',
      ar: 'تؤثر بعض الأدوية والمكملات على الحيوانات المنوية. لا توقف أي دواء موصوف من تلقاء نفسك.',
    },
    options: [
      {
        value: 'testosterone',
        label: { en: 'Testosterone, anabolic steroids or SARMs (including for the gym)', ar: 'تستوستيرون أو ستيرويدات بنائية أو SARMs (بما في ذلك لأغراض رياضية)' },
      },
      { value: 'five_ari', label: { en: 'Hair-loss tablets (finasteride or dutasteride)', ar: 'أقراص لتساقط الشعر (فيناسترايد أو دوتاسترايد)' } },
      { value: 'antidepressants', label: { en: 'Antidepressants', ar: 'مضادات الاكتئاب' } },
      { value: 'opioids', label: { en: 'Strong painkillers (opioids)', ar: 'مسكنات قوية (أفيونية)' } },
      NONE,
      PREFER_NOT,
    ],
  },
  {
    id: 'meds_f',
    section: 'health',
    type: 'multi',
    only: 'female',
    text: { en: 'Do you currently take any of these?', ar: 'هل تتناولين حالياً أيّاً مما يلي؟' },
    help: {
      en: 'Some medicines are best changed before a pregnancy. Never stop a prescribed medicine on your own.',
      ar: 'يُفضّل تعديل بعض الأدوية قبل الحمل. لا توقفي أي دواء موصوف من تلقاء نفسك.',
    },
    options: [
      { value: 'valproate', label: { en: 'Medicine for epilepsy, migraine or mood (for example valproate or topiramate)', ar: 'دواء للصرع أو الصداع النصفي أو المزاج (مثل فالبروات أو توبيرامات)' } },
      { value: 'isotretinoin', label: { en: 'Acne tablets (isotretinoin)', ar: 'أقراص حب الشباب (إيزوتريتينوين)' } },
      { value: 'methotrexate', label: { en: 'Methotrexate or another medicine for arthritis or skin conditions', ar: 'ميثوتريكسات أو دواء آخر للمفاصل أو الأمراض الجلدية' } },
      { value: 'long_term', label: { en: 'Another long-term medicine (for example for blood pressure, diabetes or thyroid)', ar: 'دواء آخر طويل الأمد (مثل أدوية الضغط أو السكري أو الغدة الدرقية)' } },
      NONE,
      PREFER_NOT,
    ],
  },
  {
    id: 'sexual',
    only: 'male',
    section: 'intimate',
    type: 'multi',
    sensitive: true,
    text: { en: 'In the last few months, have you noticed any of these?', ar: 'خلال الأشهر الأخيرة، هل لاحظت أيّاً مما يلي؟' },
    help: {
      en: 'Optional and private. These are common, treatable, and can be early signs of other health issues.',
      ar: 'سؤال اختياري وسري. هذه مشكلات شائعة وقابلة للعلاج، وقد تكون علامات مبكرة لمشكلات صحية أخرى.',
    },
    options: [
      { value: 'low_desire', label: { en: 'Lower sexual desire than usual', ar: 'رغبة جنسية أقل من المعتاد' } },
      { value: 'erection', label: { en: 'Difficulty getting or keeping an erection', ar: 'صعوبة في حدوث الانتصاب أو استمراره' } },
      { value: 'ejaculation', label: { en: 'Pain, very little fluid or no fluid when ejaculating', ar: 'ألم أو سائل قليل جداً أو انعدام السائل عند القذف' } },
      NONE,
      PREFER_NOT,
    ],
  },
  {
    id: 'tobacco',
    section: 'lifestyle',
    type: 'single',
    text: {
      en: 'Do you use tobacco or nicotine (cigarettes, shisha, medwakh or vape)?',
      ar: 'هل تستخدم التبغ أو النيكوتين (سجائر، شيشة، مدواخ، سجائر إلكترونية)؟',
    },
    female: {
      text: {
        en: 'Do you use tobacco or nicotine (cigarettes, shisha, medwakh or vape)?',
        ar: 'هل تستخدمين التبغ أو النيكوتين (سجائر، شيشة، مدواخ، سجائر إلكترونية)؟',
      },
    },
    options: [
      { value: 'no', label: { en: 'No', ar: 'لا' } },
      { value: 'sometimes', label: { en: 'Sometimes', ar: 'أحياناً' } },
      { value: 'daily', label: { en: 'Daily', ar: 'يومياً' } },
    ],
  },
  {
    id: 'heat',
    section: 'lifestyle',
    only: 'male',
    type: 'multi',
    text: { en: 'Do any of these apply to you regularly?', ar: 'هل ينطبق عليك أيٌّ مما يلي بشكل منتظم؟' },
    options: [
      { value: 'outdoor_heat', label: { en: 'Working outdoors in the heat', ar: 'العمل في الهواء الطلق في الحر' } },
      { value: 'sauna', label: { en: 'Sauna, hot tub or very hot baths', ar: 'الساونا أو الأحواض الساخنة أو الحمامات الساخنة جداً' } },
      { value: 'sitting', label: { en: 'Sitting for long hours (e.g. driving, laptop on lap)', ar: 'الجلوس لساعات طويلة (مثل القيادة أو وضع الحاسوب على الحِجر)' } },
      NONE,
    ],
  },
  {
    id: 'activity',
    section: 'lifestyle',
    type: 'single',
    text: {
      en: 'On how many days a week are you active for 30 minutes or more?',
      ar: 'كم يوماً في الأسبوع تمارس نشاطاً بدنياً لمدة 30 دقيقة أو أكثر؟',
    },
    female: {
      text: {
        en: 'On how many days a week are you active for 30 minutes or more?',
        ar: 'كم يوماً في الأسبوع تمارسين نشاطاً بدنياً لمدة 30 دقيقة أو أكثر؟',
      },
    },
    options: [
      { value: '0to1', label: { en: '0–1 days', ar: '0-1 يوم' } },
      { value: '2to4', label: { en: '2–4 days', ar: '2-4 أيام' } },
      { value: '5plus', label: { en: '5 or more days', ar: '5 أيام أو أكثر' } },
    ],
  },
  {
    id: 'sleep',
    section: 'lifestyle',
    type: 'single',
    text: { en: 'How much do you usually sleep at night?', ar: 'كم ساعة تنام عادةً في الليل؟' },
    female: { text: { en: 'How much do you usually sleep at night?', ar: 'كم ساعة تنامين عادةً في الليل؟' } },
    options: [
      { value: 'lt6', label: { en: 'Less than 6 hours', ar: 'أقل من 6 ساعات' } },
      { value: '6to8', label: { en: '6–8 hours', ar: '6-8 ساعات' } },
      { value: 'gt8', label: { en: 'More than 8 hours', ar: 'أكثر من 8 ساعات' } },
    ],
  },
  {
    id: 'folic',
    section: 'lifestyle',
    type: 'single',
    only: 'female',
    text: { en: 'Are you taking folic acid (400 micrograms a day)?', ar: 'هل تتناولين حمض الفوليك (400 ميكروغرام يومياً)؟' },
    help: {
      en: 'It is recommended from at least a month before trying until 12 weeks of pregnancy.',
      ar: 'يُنصح به من شهر على الأقل قبل محاولة الحمل حتى الأسبوع الثاني عشر من الحمل.',
    },
    options: [YES, NO, UNSURE],
    showIf: (a) => a.ttc === 'yes' || a.ttc === 'planning' || a.plans_when === '1to2y',
  },
  {
    id: 'last_check',
    section: 'tests',
    type: 'single',
    text: {
      en: 'When did you last have a routine health check (such as IFHAS periodic screening)?',
      ar: 'متى أجريت آخر فحص صحي دوري (مثل الفحص الدوري «إفحص»)؟',
    },
    options: [
      { value: 'lt1y', label: { en: 'Within the last year', ar: 'خلال العام الماضي' } },
      { value: '1to3y', label: { en: '1–3 years ago', ar: 'منذ 1-3 سنوات' } },
      { value: 'gt3y', label: { en: 'More than 3 years ago, or never', ar: 'منذ أكثر من 3 سنوات أو لم أُجرِه أبداً' } },
      UNSURE,
    ],
  },
  {
    id: 'semen_done',
    section: 'tests',
    only: 'male',
    type: 'single',
    text: { en: 'Have you ever had a semen analysis?', ar: 'هل سبق أن أجريت تحليلاً للسائل المنوي؟' },
    options: [
      { value: 'yes', label: { en: 'Yes, and I have the results', ar: 'نعم، ولديّ النتائج' } },
      { value: 'yes_no_results', label: { en: "Yes, but I don't have the results", ar: 'نعم، لكن النتائج ليست لديّ' } },
      { value: 'no', label: { en: 'No', ar: 'لا' } },
    ],
  },
  {
    id: 'semen',
    section: 'tests',
    type: 'numbers',
    optional: true,
    text: { en: 'Enter any values you have (leave blank if unknown)', ar: 'أدخل ما لديك من قيم (اتركها فارغة إن لم تكن تعرفها)' },
    help: {
      en: 'We compare them with the WHO 2021 reference values. One result is never a diagnosis.',
      ar: 'نقارنها بالقيم المرجعية لمنظمة الصحة العالمية لعام 2021. نتيجة واحدة لا تعني تشخيصاً أبداً.',
    },
    fields: [
      { id: 'volume_ml', label: { en: 'Volume', ar: 'الحجم' }, unit: { en: 'mL', ar: 'مل' }, min: 0, max: 20, step: 0.1 },
      { id: 'concentration', label: { en: 'Sperm concentration', ar: 'تركيز الحيوانات المنوية' }, unit: { en: 'million/mL', ar: 'مليون/مل' }, min: 0, max: 500, step: 0.1 },
      { id: 'total_motility', label: { en: 'Total motility', ar: 'الحركة الكلية' }, unit: { en: '%', ar: '%' }, min: 0, max: 100 },
      { id: 'progressive', label: { en: 'Progressive motility', ar: 'الحركة التقدمية' }, unit: { en: '%', ar: '%' }, min: 0, max: 100 },
      { id: 'morphology', label: { en: 'Normal forms (morphology)', ar: 'الأشكال الطبيعية' }, unit: { en: '%', ar: '%' }, min: 0, max: 100 },
    ],
    only: 'male',
    showIf: (a) => a.semen_done === 'yes',
  },
  {
    id: 'hormone_done',
    section: 'tests',
    type: 'single',
    only: 'female',
    text: {
      en: 'Have you had a blood test for egg reserve (AMH) or reproductive hormones (such as FSH or thyroid)?',
      ar: 'هل أجريتِ تحليل دم لمخزون البويضات (AMH) أو للهرمونات الإنجابية (مثل FSH أو الغدة الدرقية)؟',
    },
    options: [
      { value: 'yes', label: { en: 'Yes, and I have the results', ar: 'نعم، ولديّ النتائج' } },
      { value: 'yes_no_results', label: { en: "Yes, but I don't have the results", ar: 'نعم، لكن النتائج ليست لديّ' } },
      { value: 'no', label: { en: 'No', ar: 'لا' } },
    ],
  },
  {
    id: 'hormones',
    section: 'tests',
    type: 'numbers',
    optional: true,
    only: 'female',
    text: { en: 'Enter any values you have (leave blank if unknown)', ar: 'أدخلي ما لديكِ من قيم (اتركيها فارغة إن لم تكوني تعرفينها)' },
    help: {
      en: 'If your AMH is in pmol/L, divide it by 7.14 to get ng/mL. FSH is most useful from day 2–5 of a period. One result is never a diagnosis.',
      ar: 'إذا كانت نتيجة AMH بوحدة pmol/L فاقسميها على 7.14 لتحصلي على ng/mL. يكون FSH أكثر فائدة في اليوم 2 إلى 5 من الدورة. نتيجة واحدة لا تعني تشخيصاً أبداً.',
    },
    fields: [
      { id: 'amh', label: { en: 'AMH (anti-Müllerian hormone)', ar: 'هرمون AMH' }, unit: { en: 'ng/mL', ar: 'نانوغرام/مل' }, min: 0, max: 30, step: 0.01 },
      { id: 'fsh', label: { en: 'FSH (day 2–5)', ar: 'هرمون FSH (اليوم 2-5)' }, unit: { en: 'IU/L', ar: 'وحدة/لتر' }, min: 0, max: 200, step: 0.1 },
      { id: 'tsh', label: { en: 'TSH (thyroid)', ar: 'هرمون TSH (الغدة الدرقية)' }, unit: { en: 'mIU/L', ar: 'ملي وحدة/لتر' }, min: 0, max: 100, step: 0.01 },
    ],
    showIf: (a) => a.hormone_done === 'yes',
  },
  {
    id: 'family_hx',
    section: 'tests',
    type: 'single',
    text: {
      en: 'Has anyone in your close family had difficulty having children, or a known genetic condition?',
      ar: 'هل عانى أحد أفراد عائلتك المقربين من صعوبة في الإنجاب، أو لديه حالة وراثية معروفة؟',
    },
    options: [YES, NO, UNSURE],
  },
  {
    id: 'menopause_fh',
    section: 'tests',
    type: 'single',
    only: 'female',
    text: { en: 'Did your mother or a sister go through menopause before the age of 45?', ar: 'هل انقطعت الدورة الشهرية لدى والدتك أو إحدى أخواتك قبل سن 45؟' },
    help: {
      en: 'Early menopause can run in families. Knowing this helps you plan, and it is fine not to know.',
      ar: 'قد يتكرر انقطاع الطمث المبكر في العائلة. معرفة ذلك تساعدك على التخطيط، ولا بأس إن لم تعرفي.',
    },
    options: [YES, NO, UNSURE],
  },
]

export const QUESTION_BY_ID: Record<string, Question> = Object.fromEntries(QUESTIONS.map((q) => [q.id, q]))

/** The label of an answer, in whichever wording it was offered (a woman's check has its own options for some questions). */
export function optionLabel(questionId: string, value: string): L10n {
  const q = QUESTION_BY_ID[questionId]
  const opt = q?.female?.options?.find((o) => o.value === value) ?? q?.options?.find((o) => o.value === value)
  return opt?.label ?? { en: value, ar: value }
}

/** A question as this person sees it: a woman's wording replaces the default where there is one. */
export function forPerson(q: Question, a: Answers): Question {
  if (!isF(a) || !q.female) return q
  return { ...q, text: q.female.text ?? q.text, help: q.female.help ?? q.help, options: q.female.options ?? q.options }
}

export function visibleQuestions(a: Answers): Question[] {
  const sex = sexOf(a)
  return QUESTIONS.filter((q) => (!q.only || q.only === sex) && (!q.showIf || q.showIf(a))).map((q) => forPerson(q, a))
}
