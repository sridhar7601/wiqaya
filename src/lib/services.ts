import type { Assessment, L10n, Level, Sex } from './types'
import { LEVEL_RANK } from './types'

export type StepKey = Level | 'emergency'

export interface Step {
  key: StepKey
  title: L10n
  how: L10n
  options: L10n[]
}

export const LEVEL_LABEL: Record<Level, L10n> = {
  selfcare: { en: 'Self-care and healthy habits', ar: 'العناية الذاتية والعادات الصحية' },
  primary: { en: 'See your family doctor', ar: 'راجع طبيب الأسرة' },
  fertility: { en: 'Fertility services', ar: 'خدمات الخصوبة' },
  specialist: { en: 'Specialist (andrology, urology or gynaecology)', ar: 'أخصائي (ذكورة أو مسالك أو أمراض نساء)' },
  urgent: { en: 'Urgent medical assessment', ar: 'تقييم طبي عاجل' },
}

export const LEVEL_SHORT: Record<Level, L10n> = {
  selfcare: { en: 'Self-care', ar: 'عناية ذاتية' },
  primary: { en: 'Primary care', ar: 'رعاية أولية' },
  fertility: { en: 'Fertility', ar: 'خصوبة' },
  specialist: { en: 'Specialist', ar: 'أخصائي' },
  urgent: { en: 'Urgent', ar: 'عاجل' },
}

export const STEPS: Record<StepKey, Step> = {
  emergency: {
    key: 'emergency',
    title: { en: 'Go to the emergency department now', ar: 'توجّه إلى قسم الطوارئ الآن' },
    how: { en: 'Call 998 for an ambulance, or go straight to the nearest emergency department.', ar: 'اتصل بالرقم 998 لطلب الإسعاف، أو توجّه مباشرة إلى أقرب قسم طوارئ.' },
    options: [
      { en: 'Do not wait to see if it settles. Time matters.', ar: 'لا تنتظر لترى إن كان سيهدأ؛ الوقت مهم.' },
      { en: 'Do not eat or drink until you have been seen, in case you need surgery.', ar: 'لا تأكل ولا تشرب حتى يتم فحصك، تحسباً لاحتياجك إلى جراحة.' },
    ],
  },
  urgent: {
    key: 'urgent',
    title: { en: 'Get an urgent medical assessment', ar: 'احصل على تقييم طبي عاجل' },
    how: {
      en: 'See a doctor today or within the next few days, as explained below. This is not something to put off.',
      ar: 'راجع طبيباً اليوم أو خلال الأيام القليلة القادمة كما هو موضح أدناه. لا تؤجّل ذلك.',
    },
    options: [
      { en: 'Urgent care or the emergency department for pain, swelling or fever.', ar: 'عيادة الحالات العاجلة أو قسم الطوارئ في حال الألم أو التورم أو الحرارة.' },
      { en: 'For a lump: book a doctor within days and ask for an ultrasound.', ar: 'في حال وجود كتلة: احجز موعداً مع طبيب خلال أيام واطلب فحصاً بالموجات فوق الصوتية.' },
    ],
  },
  specialist: {
    key: 'specialist',
    title: { en: "See a men's health specialist (andrology / urology)", ar: 'راجع أخصائي صحة الرجل (أمراض الذكورة / المسالك البولية)' },
    how: {
      en: 'Ask your family doctor for a referral, or book directly where your insurance allows.',
      ar: 'اطلب تحويلاً من طبيب الأسرة، أو احجز مباشرة إذا كان تأمينك يسمح بذلك.',
    },
    options: [
      { en: 'A semen analysis is usually the first test. See how to prepare below.', ar: 'تحليل السائل المنوي هو عادةً الفحص الأول. اطّلع أدناه على طريقة الاستعداد له.' },
      { en: 'You can ask for a male doctor.', ar: 'يمكنك طلب طبيب رجل.' },
      { en: 'Bring your summary. You choose what goes in it.', ar: 'أحضر ملخصك، وأنت من يختار ما يتضمنه.' },
    ],
  },
  fertility: {
    key: 'fertility',
    title: { en: 'Book a fertility assessment', ar: 'احجز تقييماً للخصوبة' },
    how: {
      en: 'Many fertility services assess both partners together. Your part is quick and private.',
      ar: 'تقيّم كثير من خدمات الخصوبة الشريكين معاً، ودورك فيها سريع وخاص.',
    },
    options: [
      { en: 'Your part: a short history, an examination and a semen analysis.', ar: 'دورك: أسئلة قصيرة وفحص سريري وتحليل للسائل المنوي.' },
      {
        en: 'At-home sperm tests can be a private first step, but they do not replace a lab test.',
        ar: 'قد تكون اختبارات الحيوانات المنوية المنزلية خطوة أولى خاصة، لكنها لا تغني عن التحليل المخبري.',
      },
      { en: 'You can ask for a male doctor.', ar: 'يمكنك طلب طبيب رجل.' },
    ],
  },
  primary: {
    key: 'primary',
    title: { en: 'See your family doctor (primary care)', ar: 'راجع طبيب الأسرة (الرعاية الأولية)' },
    how: {
      en: 'Book a routine visit or a teleconsultation. Your family doctor can do the checks and refer you on if needed.',
      ar: 'احجز زيارة روتينية أو استشارة عن بُعد. يستطيع طبيب الأسرة إجراء الفحوصات وتحويلك عند الحاجة.',
    },
    options: [
      { en: 'A teleconsultation is fine for a first conversation.', ar: 'الاستشارة عن بُعد مناسبة للمحادثة الأولى.' },
      { en: 'Ask to combine it with your routine health check (IFHAS, for Thiqa cardholders).', ar: 'اطلب دمجها مع فحصك الصحي الدوري («إفحص» لحاملي بطاقة «ثقة»).' },
      { en: 'You can ask for a male doctor.', ar: 'يمكنك طلب طبيب رجل.' },
    ],
  },
  selfcare: {
    key: 'selfcare',
    title: { en: 'Keep up the habits that help', ar: 'حافظ على العادات المفيدة' },
    how: {
      en: 'Nothing here needs a doctor right now. Small changes make a real difference over time.',
      ar: 'لا شيء هنا يحتاج إلى طبيب الآن. التغييرات الصغيرة تُحدث فرقاً حقيقياً مع الوقت.',
    },
    options: [
      { en: 'New sperm take about two months to form, so a change in habits shows in a test after two to three months.', ar: 'تحتاج الحيوانات المنوية الجديدة إلى نحو شهرين لتتكوّن، لذا يظهر أثر تغيير العادات في التحليل بعد شهرين إلى ثلاثة أشهر.' },
      { en: 'Come back to this check whenever something changes.', ar: 'عُد إلى هذا الفحص كلما تغيّر شيء.' },
    ],
  },
}

/** A woman's next steps: the same five levels, her own services and wording (Arabic addresses her directly). */
export const STEPS_F: Record<StepKey, Step> = {
  emergency: {
    key: 'emergency',
    title: { en: 'Go to the emergency department now', ar: 'توجّهي إلى قسم الطوارئ الآن' },
    how: { en: 'Call 998 for an ambulance, or go straight to the nearest emergency department.', ar: 'اتصلي بالرقم 998 لطلب الإسعاف، أو توجّهي مباشرة إلى أقرب قسم طوارئ.' },
    options: [
      { en: 'Do not wait to see if it settles. Time matters.', ar: 'لا تنتظري لتري إن كان سيهدأ؛ الوقت مهم.' },
      { en: 'If you feel faint or dizzy, lie down and call 998 rather than driving yourself.', ar: 'إذا شعرتِ بدوار أو إغماء فاستلقي واتصلي بالرقم 998 بدلاً من القيادة بنفسك.' },
    ],
  },
  urgent: {
    key: 'urgent',
    title: { en: 'Get an urgent medical assessment', ar: 'احصلي على تقييم طبي عاجل' },
    how: { en: 'See a doctor today, as explained below. This is not something to put off.', ar: 'راجعي طبيباً اليوم كما هو موضح أدناه. لا تؤجّلي ذلك.' },
    options: [
      { en: 'Urgent care or the emergency department for pain, heavy bleeding or fever.', ar: 'عيادة الحالات العاجلة أو قسم الطوارئ في حال الألم أو النزيف الغزير أو الحرارة.' },
      { en: 'Before cancer treatment: ask your team for a fertility-preservation referral now.', ar: 'قبل علاج السرطان: اطلبي من فريقك تحويلاً لحفظ الخصوبة الآن.' },
    ],
  },
  specialist: {
    key: 'specialist',
    title: { en: 'See a women’s health specialist (gynaecology or reproductive medicine)', ar: 'راجعي أخصائية صحة المرأة (أمراض النساء أو الطب الإنجابي)' },
    how: { en: 'Ask your family doctor for a referral, or book directly where your insurance allows.', ar: 'اطلبي تحويلاً من طبيب الأسرة، أو احجزي مباشرة إذا كان تأمينك يسمح بذلك.' },
    options: [
      { en: 'Blood tests and an ultrasound are the usual first tests.', ar: 'تحاليل الدم والتصوير بالموجات فوق الصوتية هي عادةً الفحوصات الأولى.' },
      { en: 'You can ask for a female doctor.', ar: 'يمكنك طلب طبيبة.' },
      { en: 'Bring your summary. You choose what goes in it.', ar: 'أحضري ملخصك، وأنتِ من يختار ما يتضمنه.' },
    ],
  },
  fertility: {
    key: 'fertility',
    title: { en: 'Book a fertility assessment for you both', ar: 'احجزي تقييماً للخصوبة لكما معاً' },
    how: { en: 'Fertility services assess both partners together. Half of the reasons can lie with either partner.', ar: 'تقيّم خدمات الخصوبة الشريكين معاً، فقد يكون السبب لدى أيٍّ منهما.' },
    options: [
      { en: 'Your part: a history, blood tests early in your cycle and an ultrasound.', ar: 'دورك: أسئلة عن تاريخك الصحي، وتحاليل دم في بداية الدورة، وتصوير بالموجات فوق الصوتية.' },
      { en: 'Your partner’s part: a semen analysis, which can be booked at the same time.', ar: 'دور شريكك: تحليل للسائل المنوي يمكن حجزه في الوقت نفسه.' },
      { en: 'You can ask for a female doctor.', ar: 'يمكنك طلب طبيبة.' },
    ],
  },
  primary: {
    key: 'primary',
    title: { en: 'See your family doctor or a women’s health clinic', ar: 'راجعي طبيب الأسرة أو عيادة صحة المرأة' },
    how: { en: 'Book a routine visit or a teleconsultation. They can do the checks and refer you on if needed.', ar: 'احجزي زيارة روتينية أو استشارة عن بُعد. يمكنهم إجراء الفحوصات وتحويلك عند الحاجة.' },
    options: [
      { en: 'A teleconsultation is fine for a first conversation.', ar: 'الاستشارة عن بُعد مناسبة للمحادثة الأولى.' },
      { en: 'Ask to combine it with your routine health check (IFHAS, for Thiqa cardholders), which now includes reproductive health at 20–35.', ar: 'اطلبي دمجها مع فحصك الصحي الدوري («إفحص» لحاملات بطاقة «ثقة»)، الذي يشمل الآن الصحة الإنجابية للفئة 20-35.' },
      { en: 'You can ask for a female doctor.', ar: 'يمكنك طلب طبيبة.' },
    ],
  },
  selfcare: {
    key: 'selfcare',
    title: { en: 'Keep up the habits that help', ar: 'حافظي على العادات المفيدة' },
    how: { en: 'Nothing here needs a doctor right now. Small changes make a real difference over time.', ar: 'لا شيء هنا يحتاج إلى طبيب الآن. التغييرات الصغيرة تُحدث فرقاً حقيقياً مع الوقت.' },
    options: [
      { en: 'Eggs take about three months to mature before ovulation, so habits started now count for the cycles ahead.', ar: 'تحتاج البويضة إلى نحو ثلاثة أشهر لتنضج قبل التبويض، لذا تفيد العادات التي تبدئينها الآن في الدورات القادمة.' },
      { en: 'Your plans and your body change: come back to this check every year, or whenever something changes.', ar: 'تتغير خططك وجسمك: عودي إلى هذا الفحص كل عام، أو كلما تغيّر شيء.' },
    ],
  },
}

export const stepFor = (key: StepKey, sex: Sex = 'male'): Step => (sex === 'female' ? STEPS_F : STEPS)[key]

/** The main next step, plus the lower-level steps that other flags also point to. */
export function nextSteps(as: Assessment): { main: Step; also: Step[] } {
  const S = as.sex === 'female' ? STEPS_F : STEPS
  const main = as.emergency ? S.emergency : S[as.level]
  const seen = new Set<Level>()
  for (const f of as.flags) {
    if (f.level === 'info' || f.level === as.level) continue
    if (LEVEL_RANK[f.level] < LEVEL_RANK[as.level]) seen.add(f.level)
  }
  const also = [...seen].sort((x, y) => LEVEL_RANK[y] - LEVEL_RANK[x]).map((l) => S[l])
  return { main, also }
}

/** Always shown: when to stop and seek urgent help, whatever the result. */
export const SAFETY_NET: L10n[] = [
  { en: 'Sudden, severe pain in a testicle: go to the emergency department or call 998.', ar: 'ألم مفاجئ وشديد في الخصية: توجّه إلى الطوارئ أو اتصل بالرقم 998.' },
  { en: 'A painful swollen testicle with fever: get seen the same day.', ar: 'خصية متورمة ومؤلمة مع حرارة: راجع الطبيب في اليوم نفسه.' },
  { en: 'A new lump or hard area: see a doctor within days.', ar: 'كتلة أو منطقة صلبة جديدة: راجع طبيباً خلال أيام.' },
]

export const SAFETY_NET_F: L10n[] = [
  { en: 'Severe pain low in the belly with a late period, or fainting: go to the emergency department or call 998.', ar: 'ألم شديد أسفل البطن مع تأخر الدورة أو إغماء: توجّهي إلى الطوارئ أو اتصلي بالرقم 998.' },
  { en: 'Soaking a pad every hour, or any bleeding in pregnancy: get seen the same day.', ar: 'تبليل فوطة كل ساعة، أو أي نزيف أثناء الحمل: راجعي الطبيب في اليوم نفسه.' },
  { en: 'Pelvic pain with fever or unusual discharge: get seen the same day.', ar: 'ألم في الحوض مع حرارة أو إفرازات غير معتادة: راجعي الطبيب في اليوم نفسه.' },
]

export const safetyNet = (sex: Sex): L10n[] => (sex === 'female' ? SAFETY_NET_F : SAFETY_NET)
