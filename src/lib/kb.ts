import type { L10n } from './types'

/** Short, reviewed answers to common questions. Shown to everyone; no AI needed. */
export interface KbEntry {
  id: string
  q: L10n
  a: L10n
}

export const SEMEN_PREP: KbEntry = {
  id: 'semen_prep',
  q: { en: 'How do I prepare for a semen analysis?', ar: 'كيف أستعد لتحليل السائل المنوي؟' },
  a: {
    en: 'Avoid ejaculation for 2–7 days before the test. The sample is collected privately, usually at the lab, or at home if the lab allows and it reaches them within an hour. Results vary from one sample to the next, so an unusual result is normally repeated before any conclusion.',
    ar: 'تجنّب القذف لمدة 2-7 أيام قبل التحليل. تُجمع العينة بشكل خاص، عادةً في المختبر، أو في المنزل إذا سمح المختبر بذلك ووصلت إليه خلال ساعة. تتفاوت النتائج من عينة لأخرى، لذا تُعاد النتيجة غير المعتادة عادةً قبل الوصول إلى أي استنتاج.',
  },
}

export const KB: KbEntry[] = [
  {
    id: 'not_diagnosis',
    q: { en: 'Is this a diagnosis?', ar: 'هل هذا تشخيص؟' },
    a: {
      en: 'No. This is a screening check. It points out signals worth acting on and the right place to go. Only a clinician, with an examination and tests, can make a diagnosis.',
      ar: 'لا. هذا فحص أولي يبيّن المؤشرات التي تستحق الاهتمام والمكان المناسب للتوجّه إليه. التشخيص يكون فقط من خلال الطبيب بعد الفحص السريري والتحاليل.',
    },
  },
  {
    id: 'why_men',
    q: { en: 'My partner has already had tests. Do I need one too?', ar: 'أجرت شريكة حياتي فحوصات بالفعل، فهل أحتاج أنا أيضاً إلى فحص؟' },
    a: {
      en: 'Yes. A male factor plays a part in around half of couples who have difficulty conceiving. Checking both partners early avoids months of waiting and helps choose the right path.',
      ar: 'نعم. يسهم عامل لدى الرجل في نحو نصف حالات الأزواج الذين يواجهون صعوبة في الإنجاب. فحص الشريكين مبكراً يوفّر أشهراً من الانتظار ويساعد على اختيار المسار الصحيح.',
    },
  },
  SEMEN_PREP,
  {
    id: 'home_test',
    q: { en: 'Are at-home sperm tests reliable?', ar: 'هل اختبارات الحيوانات المنوية المنزلية موثوقة؟' },
    a: {
      en: 'Home tests usually only measure sperm count. They can be a private first step, but they do not check movement, shape or volume, so they do not replace a lab test, especially if you have symptoms or have been trying for a while.',
      ar: 'تقيس الاختبارات المنزلية عادةً عدد الحيوانات المنوية فقط. قد تكون خطوة أولى خاصة، لكنها لا تفحص الحركة أو الشكل أو الحجم، لذا لا تغني عن التحليل المخبري، خاصة إذا كانت لديك أعراض أو كنت تحاول الإنجاب منذ فترة.',
    },
  },
  {
    id: 'lifestyle_time',
    q: { en: 'How long do lifestyle changes take to help?', ar: 'كم يستغرق تغيير نمط الحياة ليُحدث فرقاً؟' },
    a: {
      en: 'New sperm take about two months to form, so changes such as stopping smoking, losing weight or avoiding heat usually take two to three months to show in test results.',
      ar: 'تحتاج الحيوانات المنوية الجديدة إلى نحو شهرين لتتكوّن، لذا تحتاج تغييرات مثل الإقلاع عن التدخين أو إنقاص الوزن أو تجنّب الحرارة عادةً إلى شهرين أو ثلاثة أشهر ليظهر أثرها في نتائج التحاليل.',
    },
  },
  {
    id: 'specialist_visit',
    q: { en: "What happens at a men's health specialist?", ar: 'ماذا يحدث عند زيارة أخصائي صحة الرجل؟' },
    a: {
      en: 'Usually a private conversation about your health, a short examination, and a semen analysis. Some men also have a blood test for hormones or an ultrasound. You can ask for a male doctor.',
      ar: 'عادةً محادثة خاصة عن صحتك، وفحص سريري قصير، وتحليل للسائل المنوي. وقد يحتاج بعض الرجال أيضاً إلى تحليل دم للهرمونات أو فحص بالموجات فوق الصوتية. يمكنك طلب طبيب رجل.',
    },
  },
  {
    id: 'who_sees',
    q: { en: 'Who can see my answers?', ar: 'من يستطيع رؤية إجاباتي؟' },
    a: {
      en: 'Only you. Your answers stay on this device. If you choose to share a summary with a doctor, you pick exactly what goes in it, and you can delete everything at any time.',
      ar: 'أنت فقط. تبقى إجاباتك على هذا الجهاز. إذا اخترت مشاركة ملخص مع طبيب، فأنت من يحدد ما يتضمنه بالضبط، ويمكنك حذف كل شيء في أي وقت.',
    },
  },
]
