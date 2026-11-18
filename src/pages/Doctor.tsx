import { CircleSlash, Clock, LockKeyhole, Unplug } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ReferralDetail } from '../components/ReferralDetail'
import type { ReplyState } from '../components/ReferralDetail'
import { Callout } from '../components/ui'
import { openShare, parseToken, sendReply } from '../lib/handoff'
import type { FailReason, InboxLink, OpenedShare } from '../lib/handoff'
import { useI18n } from '../lib/i18n'
import type { Review } from '../lib/referral'
import { useStored } from '../lib/storage'

type State = { s: 'loading' } | ({ s: 'ready' } & OpenedShare) | { s: 'failed'; reason: FailReason | 'invalid' }

/** What a doctor sees after scanning the QR code or opening the link: the summary, decrypted on this device. */
export default function Doctor() {
  const { t, lang } = useI18n()
  const { token } = useParams()
  const link = useMemo(() => parseToken(token), [token])
  const [state, setState] = useState<State>(link ? { s: 'loading' } : { s: 'failed', reason: 'invalid' })
  const [, setInbox] = useStored<InboxLink[]>('inbox', [])
  const [review, setReview] = useState<Review | undefined>()
  const [sent, setSent] = useState<ReplyState>('idle')
  const asked = useRef(false)

  useEffect(() => {
    if (!link || asked.current) return
    asked.current = true
    void openShare(link.id, link.secret).then((o) => {
      if (!o.ok) return setState({ s: 'failed', reason: o.reason })
      setState({ s: 'ready', summary: o.summary, createdAt: o.createdAt, expiresAt: o.expiresAt, reply: o.reply })
      setReview(o.reply ?? undefined)
      // Remember the link on this device so it also appears in the referral inbox.
      setInbox((x) => (x.some((y) => y.id === link.id) ? x : [{ ...link, addedAt: Date.now() }, ...x]))
    })
  }, [link, setInbox])

  if (state.s === 'loading') {
    return (
      <div className="container-flow py-16">
        <p className="text-center text-muted" aria-live="polite">
          {t({ en: 'Opening the summary…', ar: 'جارٍ فتح الملخص…' })}
        </p>
      </div>
    )
  }

  if (state.s === 'failed') {
    const view = {
      withdrawn: { icon: CircleSlash, title: { en: 'The patient withdrew this summary', ar: 'سحب المريض هذا الملخص' }, body: { en: 'It was deleted and is no longer stored anywhere. Ask the patient to share it again if you still need it.', ar: 'حُذف ولم يعد محفوظاً في أي مكان. اطلب من المريض مشاركته مجدداً إن كنت ما زلت بحاجة إليه.' } },
      expired: { icon: Clock, title: { en: 'This link has expired', ar: 'انتهت صلاحية هذا الرابط' }, body: { en: 'Shared summaries are deleted automatically after the time the patient chose. Ask the patient for a new link.', ar: 'تُحذف الملخصات المشتركة تلقائياً بعد المدة التي اختارها المريض. اطلب من المريض رابطاً جديداً.' } },
      forbidden: { icon: LockKeyhole, title: { en: 'This link cannot open the summary', ar: 'لا يستطيع هذا الرابط فتح الملخص' }, body: { en: 'The key in the link does not match. Check that the whole link was copied, or scan the QR code again.', ar: 'المفتاح الموجود في الرابط غير مطابق. تأكد من نسخ الرابط كاملاً، أو امسح رمز QR مجدداً.' } },
      invalid: { icon: LockKeyhole, title: { en: 'This link is not complete', ar: 'هذا الرابط غير مكتمل' }, body: { en: 'Check that the whole link was copied, or scan the QR code again.', ar: 'تأكد من نسخ الرابط كاملاً، أو امسح رمز QR مجدداً.' } },
      busy: { icon: Clock, title: { en: 'Please try again in a few minutes', ar: 'يُرجى المحاولة بعد بضع دقائق' }, body: { en: 'Too many requests came from this network in a short time.', ar: 'وردت طلبات كثيرة من هذه الشبكة خلال وقت قصير.' } },
      unavailable: { icon: Unplug, title: { en: 'The hand-off service is not available right now', ar: 'خدمة تسليم الملخصات غير متاحة الآن' }, body: { en: 'Nothing was lost. Please try again shortly.', ar: 'لم يُفقد شيء. يُرجى المحاولة بعد قليل.' } },
      error: { icon: Unplug, title: { en: 'Something went wrong', ar: 'حدث خطأ ما' }, body: { en: 'Please try again shortly.', ar: 'يُرجى المحاولة بعد قليل.' } },
    }[state.reason]
    return (
      <div className="container-flow py-16">
        <div className="surface surface-pad space-y-4">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-canvas text-muted ring-1 ring-inset ring-line">
            <view.icon className="h-6 w-6" strokeWidth={1.75} aria-hidden />
          </span>
          <h1 className="title">{t(view.title)}</h1>
          <p className="text-body">{t(view.body)}</p>
          <Link to="/" className="btn btn-secondary">
            {t({ en: 'About Wiqaya', ar: 'عن «وقاية»' })}
          </Link>
        </div>
      </div>
    )
  }

  const when = new Date(state.expiresAt).toLocaleString(lang === 'ar' ? 'ar-AE' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })
  const onReview = (rv: Review) => {
    if (!link) return
    setReview(rv)
    setSent('sending')
    void sendReply(link.id, link.secret, rv).then((o) => setSent(o.ok ? 'sent' : 'failed'))
  }

  return (
    <div className="container-app max-w-3xl space-y-6 py-8 sm:py-10">
      <div className="space-y-1">
        <p className="eyebrow">{t({ en: 'Shared with you by a patient', ar: 'شاركه معك أحد المرضى' })}</p>
        <h1 className="title">{t({ en: 'Reproductive health screening summary', ar: 'ملخص فحص الصحة الإنجابية' })}</h1>
      </div>

      <Callout tone="info" icon={LockKeyhole}>
        {t({
          en: 'This summary was encrypted on the patient’s phone and decrypted here, on your device. The server that carried it cannot read it. It will be deleted on',
          ar: 'شُفّر هذا الملخص على هاتف المريض وفُكّ تشفيره هنا على جهازك. الخادم الذي نقله لا يستطيع قراءته. سيُحذف في',
        })}{' '}
        <span className="font-semibold">{when}</span>
        {t({ en: ', or sooner if the patient withdraws it. It is a screening result, not a diagnosis.', ar: '، أو قبل ذلك إذا سحبه المريض. وهو نتيجة فحص أولي وليس تشخيصاً.' })}
      </Callout>

      <ReferralDetail r={state.summary} review={review} onReview={onReview} toPatient sent={sent} />

      <p className="text-sm text-muted">
        <Link to="/clinician" className="link">
          {t({ en: 'See all summaries opened on this device', ar: 'عرض جميع الملخصات المفتوحة على هذا الجهاز' })}
        </Link>
      </p>
    </div>
  )
}
