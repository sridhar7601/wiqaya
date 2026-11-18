import { ArrowRight, Check, Copy, EyeOff, HeartHandshake, LockKeyhole, Share2, UserRound } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Qr } from '../components/Qr'
import { INVITE_FROM, INVITE_MESSAGE, INVITE_WELCOME, inviteLink, isInviteFrom } from '../lib/companion/invite'
import type { InviteFrom } from '../lib/companion/invite'
import { useI18n } from '../lib/i18n'
import type { L10n } from '../lib/types'

const FROM_LABEL: Record<InviteFrom, { title: L10n; body: L10n }> = {
  partner: { title: { en: 'From you to your partner', ar: 'منكِ إلى شريك حياتك' }, body: { en: 'For a woman starting fertility checks.', ar: 'للمرأة التي تبدأ فحوصات الخصوبة.' } },
  clinic: { title: { en: 'From a clinic to a patient’s partner', ar: 'من عيادة إلى شريك حياة المريضة' }, body: { en: 'Print the code or send the link with the couple’s appointment.', ar: 'اطبع الرمز أو أرسل الرابط مع موعد الزوجين.' } },
  friend: { title: { en: 'From a friend', ar: 'من صديق' }, body: { en: 'A plain, private invitation.', ar: 'دعوة خاصة بسيطة.' } },
}

/** Makes an invitation link and QR code. Nothing is stored or sent: the link only says who invited. */
export function InviteMaker() {
  const { t, lang } = useI18n()
  const [from, setFrom] = useState<InviteFrom>('partner')
  const [copied, setCopied] = useState(false)
  const link = useMemo(() => inviteLink(from, lang), [from, lang])
  const message = `${t(INVITE_MESSAGE[from])}\n${link}`
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <div className="container-flow space-y-6 py-8 sm:py-10">
      <div className="space-y-2">
        <p className="eyebrow">{t({ en: 'Invite', ar: 'دعوة' })}</p>
        <h1 className="title">{t({ en: 'Invite him to a private check', ar: 'ادعه إلى فحص خاص' })}</h1>
        <p className="text-muted">
          {t({
            en: 'Men often join fertility care only after their partner has had her tests. An invitation lets him start in parallel, privately.',
            ar: 'كثيراً ما ينضم الرجل إلى رعاية الخصوبة بعد أن تجري شريكته فحوصاتها فقط. تتيح له الدعوة أن يبدأ بالتوازي وبخصوصية.',
          })}
        </p>
      </div>

      <fieldset className="grid gap-2.5">
        <legend className="sr-only">{t({ en: 'Who is inviting', ar: 'من يدعو' })}</legend>
        {INVITE_FROM.map((f) => (
          <button key={f} type="button" className="option" aria-pressed={from === f} onClick={() => setFrom(f)}>
            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${from === f ? 'border-brand-700' : 'border-line-strong'}`} aria-hidden>
              {from === f && <span className="h-2.5 w-2.5 rounded-full bg-brand-700" />}
            </span>
            <span className="min-w-0">
              <span className="block">{t(FROM_LABEL[f].title)}</span>
              <span className="block text-sm font-normal text-muted">{t(FROM_LABEL[f].body)}</span>
            </span>
          </button>
        ))}
      </fieldset>

      <section className="surface overflow-hidden">
        <div className="grid gap-5 p-5 sm:grid-cols-[160px_1fr] sm:p-6">
          <div className="mx-auto w-40 rounded-lg border border-line bg-white p-2 sm:mx-0">
            <Qr text={link} label={t({ en: 'QR code of the invitation', ar: 'رمز QR للدعوة' })} className="h-auto w-full" />
          </div>
          <div className="min-w-0 space-y-3">
            <p className="rounded-lg bg-canvas px-3.5 py-3 text-sm whitespace-pre-line text-ink">{message}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-primary btn-sm" onClick={() => void copy()}>
                {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
                {copied ? t({ en: 'Copied', ar: 'تم النسخ' }) : t({ en: 'Copy message', ar: 'انسخ الرسالة' })}
              </button>
              {typeof navigator.share === 'function' && (
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => void navigator.share({ text: t(INVITE_MESSAGE[from]), url: link }).catch(() => {})}>
                  <Share2 className="h-4 w-4" aria-hidden />
                  {t({ en: 'Send…', ar: 'إرسال…' })}
                </button>
              )}
              <a href={link} target="_blank" rel="noopener" className="btn btn-secondary btn-sm">
                {t({ en: 'See what he sees', ar: 'شاهد ما سيراه' })}
              </a>
            </div>
          </div>
        </div>
        <ul className="space-y-1.5 border-t border-line bg-canvas px-5 py-4 text-sm text-body sm:px-6">
          <li className="flex gap-2">
            <EyeOff className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
            {t({ en: 'You will not be told whether he opens it, takes the check, or what he answers.', ar: 'لن تُبلَّغ إن فتحها أو أجرى الفحص أو بما أجاب.' })}
          </li>
          <li className="flex gap-2">
            <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
            {t({ en: 'The link holds no name or number. It only says who invited.', ar: 'لا يحمل الرابط اسماً أو رقماً، بل يذكر فقط من وجّه الدعوة.' })}
          </li>
        </ul>
      </section>
    </div>
  )
}

/** What the invited man sees. */
export default function InviteLanding() {
  const { t } = useI18n()
  const { from } = useParams()
  const f: InviteFrom = isInviteFrom(from) ? from : 'friend'
  const w = INVITE_WELCOME[f]
  return (
    <div className="container-flow space-y-6 py-10 sm:py-14">
      <div className="space-y-3">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
          <HeartHandshake className="h-6 w-6" strokeWidth={1.75} aria-hidden />
        </span>
        <h1 className="title">{t(w.title)}</h1>
        <p className="lead">{t(w.body)}</p>
      </div>
      <ul className="surface divide-y divide-line">
        {[
          { icon: UserRound, text: { en: 'No account, no name, no phone number. About 5 minutes.', ar: 'دون حساب أو اسم أو رقم هاتف، ونحو 5 دقائق.' } },
          { icon: LockKeyhole, text: { en: 'Your answers stay on your phone. You decide whether anything is shared, and with whom.', ar: 'تبقى إجاباتك على هاتفك، وأنت من يقرر إن شُورك شيء ومع من.' } },
          { icon: Check, text: { en: 'You get a clear next step: from simple habits to the right clinic, in Arabic or English.', ar: 'تحصل على خطوة تالية واضحة: من عادات بسيطة إلى العيادة المناسبة، بالعربية أو الإنجليزية.' } },
        ].map((x) => (
          <li key={x.text.en} className="flex gap-3 px-5 py-4 text-sm text-body">
            <x.icon className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" strokeWidth={1.75} aria-hidden />
            {t(x.text)}
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link to="/check" className="btn btn-primary btn-lg">
          {t({ en: 'Start my private check', ar: 'ابدأ فحصي الخاص' })}
          <ArrowRight className="icon-dir h-4 w-4" aria-hidden />
        </Link>
        <Link to="/privacy" className="btn btn-secondary btn-lg">
          {t({ en: 'How my data is handled', ar: 'كيف تُعامل بياناتي' })}
        </Link>
      </div>
    </div>
  )
}
