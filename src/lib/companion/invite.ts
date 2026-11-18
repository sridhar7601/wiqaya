import type { L10n } from '../types'

/**
 * Invitations. The challenge's core problem: men often enter care only after their partner has been
 * assessed. A fertility clinic, or the partner herself, can hand him a private link to his own check.
 *
 * Privacy: the link carries only who invited (partner / clinic / friend), never a name or an id. Nobody is
 * told whether he opened it, took the check, or what he answered. Counting how many checks started from
 * each kind of invitation is possible in a pilot, as anonymous totals only.
 */
export type InviteFrom = 'partner' | 'clinic' | 'friend'
export const INVITE_FROM: InviteFrom[] = ['partner', 'clinic', 'friend']

export const isInviteFrom = (s: string | undefined): s is InviteFrom => s === 'partner' || s === 'clinic' || s === 'friend'

export function inviteLink(from: InviteFrom, lang: 'en' | 'ar'): string {
  return `${window.location.origin}${window.location.pathname}#/i/${from}${lang === 'ar' ? '?lang=ar' : ''}`
}

/** The message the inviter sends with the link. Neutral words; nothing in it reveals a health concern. */
export const INVITE_MESSAGE: Record<InviteFrom, L10n> = {
  partner: {
    en: 'I did my checks, and this is a private 5-minute one for men. No name or account needed, and nobody sees your answers unless you choose to share them.',
    ar: 'أجريتُ فحوصاتي، وهذا فحص خاص للرجال يستغرق 5 دقائق، دون اسم أو حساب، ولا يرى أحد إجاباتك إلا إذا اخترت مشاركتها.',
  },
  clinic: {
    en: 'Our fertility service assesses both partners. This private 5-minute check helps you prepare. No name or account needed, and we only see a summary if you choose to share it.',
    ar: 'تقيّم خدمة الخصوبة لدينا الشريكين معاً. يساعدك هذا الفحص الخاص الذي يستغرق 5 دقائق على الاستعداد، دون اسم أو حساب، ولا نرى ملخصاً إلا إذا اخترت مشاركته.',
  },
  friend: {
    en: 'A private 5-minute health check for men. No name or account needed.',
    ar: 'فحص صحي خاص للرجال يستغرق 5 دقائق، دون اسم أو حساب.',
  },
}

/** What he sees when he opens the link. */
export const INVITE_WELCOME: Record<InviteFrom, { title: L10n; body: L10n }> = {
  partner: {
    title: { en: 'Your partner thought you might find this useful', ar: 'رأت شريكة حياتك أن هذا قد يفيدك' },
    body: {
      en: 'Fertility services check both partners together, because a difficulty can come from either side. This check is yours alone: she will not be told whether you take it, or what you answer.',
      ar: 'تفحص خدمات الخصوبة الشريكين معاً، لأن الصعوبة قد تأتي من أيٍّ منهما. هذا الفحص لك وحدك: لن تُبلَّغ إن أجريته أو بما أجبت.',
    },
  },
  clinic: {
    title: { en: 'Your partner’s fertility service invited you', ar: 'دعتك خدمة الخصوبة التي تتابع شريكة حياتك' },
    body: {
      en: 'Fertility services assess both partners. Doing this private check now can save a visit later. The clinic only sees a summary if you choose to send one.',
      ar: 'تقيّم خدمات الخصوبة الشريكين معاً. قد يوفّر عليك هذا الفحص الخاص زيارة لاحقاً. ولا ترى العيادة ملخصاً إلا إذا اخترت إرساله.',
    },
  },
  friend: {
    title: { en: 'A private health check for men', ar: 'فحص صحي خاص للرجال' },
    body: {
      en: 'Five minutes, no account and no name. See what may affect your fertility and long-term health, and where to go next.',
      ar: 'خمس دقائق، دون حساب أو اسم. اعرف ما قد يؤثر على خصوبتك وصحتك على المدى الطويل، وإلى أين تتجه بعد ذلك.',
    },
  },
}
