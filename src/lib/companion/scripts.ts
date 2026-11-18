import type { L10n, Sex } from '../types'
import type { ServiceKind } from './directory'

/**
 * "What to say when you book". Many men put off calling because they do not know how to ask.
 * Each script is short, neutral and needs no medical words. Reviewed wording, no AI involved.
 */
export const BOOKING_SCRIPTS: Record<ServiceKind, L10n> = {
  screening: {
    en: 'Hello, I would like to book my routine health check (IFHAS). I have a Thiqa card.',
    ar: 'مرحباً، أرغب في حجز فحصي الصحي الدوري («إفحص»). لديّ بطاقة «ثقة».',
  },
  primary: {
    en: 'Hello, I would like an appointment with a family doctor for a routine men’s health check. A male doctor, if possible.',
    ar: 'مرحباً، أرغب في موعد مع طبيب أسرة لفحص روتيني لصحة الرجل، ومع طبيب رجل إن أمكن.',
  },
  telehealth: {
    en: 'Hello, I would like a video consultation with a doctor about a routine men’s health question.',
    ar: 'مرحباً، أرغب في استشارة بالفيديو مع طبيب بشأن سؤال روتيني عن صحة الرجل.',
  },
  andrology: {
    en: 'Hello, I would like an appointment with a men’s health specialist (andrology or urology). Do I need a referral first?',
    ar: 'مرحباً، أرغب في موعد مع أخصائي صحة الرجل (أمراض الذكورة أو المسالك البولية). هل أحتاج إلى تحويل أولاً؟',
  },
  fertility: {
    en: 'Hello, my partner and I would like a fertility assessment. Can we book together? I would also like a semen analysis.',
    ar: 'مرحباً، نرغب أنا وشريكة حياتي في تقييم للخصوبة. هل يمكننا الحجز معاً؟ وأرغب أيضاً في تحليل للسائل المنوي.',
  },
  lab: {
    en: 'Hello, I would like to book a semen analysis. How should I prepare, and can the sample be given at the lab?',
    ar: 'مرحباً، أرغب في حجز تحليل للسائل المنوي. كيف أستعد له، وهل يمكن تقديم العينة في المختبر؟',
  },
  urgent: {
    en: 'I need to be seen today, please. I have pain or swelling in my testicle.',
    ar: 'أحتاج إلى الفحص اليوم من فضلك. لديّ ألم أو تورم في الخصية.',
  },
  occupational: {
    en: 'Hello, I would like an occupational health appointment to check my protection at work.',
    ar: 'مرحباً، أرغب في موعد مع الصحة المهنية لمراجعة وسائل الحماية في عملي.',
  },
  womens: {
    en: 'Hello, I would like an appointment at a women’s health clinic. Do I need a referral first?',
    ar: 'مرحباً، أرغب في موعد في عيادة صحة المرأة. هل أحتاج إلى تحويل أولاً؟',
  },
}

/** A woman's scripts, where the wording differs. */
const BOOKING_SCRIPTS_F: Partial<Record<ServiceKind, L10n>> = {
  primary: {
    en: 'Hello, I would like an appointment with a family doctor for a women’s health and family-planning check. A female doctor, if possible.',
    ar: 'مرحباً، أرغب في موعد مع طبيب أسرة لفحص صحة المرأة وتنظيم الأسرة، ومع طبيبة إن أمكن.',
  },
  telehealth: {
    en: 'Hello, I would like a video consultation with a doctor about planning a pregnancy.',
    ar: 'مرحباً، أرغب في استشارة بالفيديو مع طبيب بشأن التخطيط للحمل.',
  },
  fertility: {
    en: 'Hello, my partner and I would like a fertility assessment. Can we book together, and can my husband’s semen analysis be done at the same visit?',
    ar: 'مرحباً، نرغب أنا وزوجي في تقييم للخصوبة. هل يمكننا الحجز معاً، وهل يمكن إجراء تحليل السائل المنوي لزوجي في الزيارة نفسها؟',
  },
  lab: {
    en: 'Hello, I would like to book blood tests for AMH, FSH and thyroid. Do they need to be on a particular day of my cycle?',
    ar: 'مرحباً، أرغب في حجز تحاليل دم لـAMH وFSH والغدة الدرقية. هل يجب إجراؤها في يوم معين من الدورة؟',
  },
  urgent: {
    en: 'I need to be seen today, please. I have severe pain low in my belly, or heavy bleeding.',
    ar: 'أحتاج إلى الفحص اليوم من فضلك. لديّ ألم شديد أسفل البطن أو نزيف غزير.',
  },
}

export const bookingScript = (kind: ServiceKind, sex: Sex): L10n => (sex === 'female' ? BOOKING_SCRIPTS_F[kind] : undefined) ?? BOOKING_SCRIPTS[kind]

/** If they ask why: a calm, private answer. */
export const IF_ASKED: L10n = {
  en: 'If they ask why: “It is a routine check. I have a short summary I can share with the doctor by a private link.”',
  ar: 'إذا سألوا عن السبب: «إنه فحص روتيني، ولديّ ملخص قصير يمكنني مشاركته مع الطبيب عبر رابط خاص».',
}
