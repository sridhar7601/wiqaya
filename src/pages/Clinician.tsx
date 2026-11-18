import { CircleCheck, Clock, Info, Link2, Siren, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ReferralDetail } from '../components/ReferralDetail'
import type { ReplyState } from '../components/ReferralDetail'
import { Callout, LevelPill } from '../components/ui'
import { CASES } from '../eval/cases'
import { openShare, sendReply } from '../lib/handoff'
import type { FailReason, InboxLink } from '../lib/handoff'
import { useI18n } from '../lib/i18n'
import { buildSummary } from '../lib/referral'
import type { ReferralSummary, Review } from '../lib/referral'
import { useStored } from '../lib/storage'

const SEED = ['C45', 'C47', 'C43', 'C38', 'C29', 'C28', 'C23', 'C16']
const SEED_DATE = '2026-11-09T09:00:00.000Z'

/** What this device knows about a summary that arrived by private link. */
type Linked = { state: 'loading' } | { state: 'ready'; summary: ReferralSummary; reply: Review | null } | { state: 'gone'; reason: FailReason }

interface Row {
  key: string
  r: ReferralSummary
  link?: InboxLink
}

export default function Clinician() {
  const { t } = useI18n()
  const [deviceRefs] = useStored<ReferralSummary[]>('referrals', [])
  const [reviews, setReviews] = useStored<Record<string, Review>>('reviews', {})
  const [inbox, setInbox] = useStored<InboxLink[]>('inbox', [])
  const [linked, setLinked] = useState<Record<string, Linked>>({})
  const [sent, setSent] = useState<Record<string, ReplyState>>({})

  // Fetch and decrypt every summary that reached this device by link, once each. "peek" does not count as a new opening.
  const asked = useRef(new Set<string>())
  useEffect(() => {
    for (const l of inbox) {
      if (asked.current.has(l.id)) continue
      asked.current.add(l.id)
      setLinked((x) => ({ ...x, [l.id]: { state: 'loading' } }))
      void openShare(l.id, l.secret, true).then((o) => {
        setLinked((x) => ({ ...x, [l.id]: o.ok ? { state: 'ready', summary: o.summary, reply: o.reply } : { state: 'gone', reason: o.reason } }))
      })
    }
  }, [inbox])

  const seeded = useMemo(
    () =>
      SEED.map((id) => CASES.find((c) => c.id === id)!).map((c, i) =>
        buildSummary(c.answers, { includeAnswers: true, includeSemen: true, includeDeclined: true, firstName: '' }, 'synthetic', {
          id: `syn-${c.id}`,
          pseudoId: `SYN-${c.id.slice(1)}`,
          createdAt: new Date(Date.parse(SEED_DATE) + i * 37 * 60000).toISOString(),
        }),
      ),
    [],
  )

  const fromLinks: Row[] = inbox.flatMap((l) => {
    const x = linked[l.id]
    return x?.state === 'ready' ? [{ key: `link-${l.id}`, r: x.summary, link: l }] : []
  })
  const gone = inbox.filter((l) => linked[l.id]?.state === 'gone')
  const rows: Row[] = [...fromLinks, ...deviceRefs.map((r) => ({ key: r.id, r })), ...seeded.map((r) => ({ key: r.id, r }))]

  const reviewOf = (row: Row): Review | undefined => {
    const x = row.link ? linked[row.link.id] : undefined
    return reviews[row.key] ?? (x?.state === 'ready' ? (x.reply ?? undefined) : undefined)
  }

  const [selKey, setSelKey] = useState<string | undefined>()
  const sel = rows.find((r) => r.key === selKey) ?? rows[0]
  const pending = rows.filter((r) => !reviewOf(r)).length
  const urgent = rows.filter((r) => r.r.level === 'urgent' && !reviewOf(r)).length

  const onReview = (row: Row, rv: Review) => {
    setReviews((x) => ({ ...x, [row.key]: rv }))
    if (!row.link) return
    setSent((x) => ({ ...x, [row.key]: 'sending' }))
    void sendReply(row.link.id, row.link.secret, rv).then((o) => setSent((x) => ({ ...x, [row.key]: o.ok ? 'sent' : 'failed' })))
  }

  return (
    <div className="container-app space-y-6 py-8 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="eyebrow">{t({ en: 'Clinician view', ar: 'عرض الطبيب' })}</p>
          <h1 className="title">{t({ en: 'Referral inbox', ar: 'صندوق الإحالات' })}</h1>
        </div>
        <dl className="flex gap-2">
          {[
            { icon: Clock, label: t({ en: 'Awaiting review', ar: 'بانتظار المراجعة' }), value: pending, cls: 'text-ink' },
            { icon: Siren, label: t({ en: 'Urgent', ar: 'عاجل' }), value: urgent, cls: urgent ? 'text-red-700' : 'text-ink' },
            { icon: CircleCheck, label: t({ en: 'Reviewed', ar: 'تمت مراجعتها' }), value: rows.length - pending, cls: 'text-ink' },
          ].map((s) => (
            <div key={s.label} className="surface min-w-28 px-4 py-2.5">
              <dt className="flex items-center gap-1.5 text-xs font-medium text-muted">
                <s.icon className="h-3.5 w-3.5" aria-hidden />
                {s.label}
              </dt>
              <dd className={`text-xl font-semibold tabular-nums ${s.cls}`}>{s.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <Callout tone="info" icon={Info}>
        {t({
          en: 'Summaries marked “Private link” were shared by a person and decrypted on this device: the server cannot read them. The rest are synthetic examples. In a pilot, consented HL7 FHIR summaries would arrive here through Malaffi. The suggested step is never final: you confirm or change it, and the decision is recorded.',
          ar: 'الملخصات المعلَّمة بـ«رابط خاص» شاركها أصحابها وفُكّ تشفيرها على هذا الجهاز، ولا يستطيع الخادم قراءتها. أما البقية فأمثلة اصطناعية. في المرحلة التجريبية تصل ملخصات HL7 FHIR بموافقة المريض إلى هنا عبر «ملفي». الخطوة المقترحة ليست نهائية أبداً: تؤكدها أو تغيّرها، ويُسجَّل قرارك.',
        })}
      </Callout>

      {gone.length > 0 && (
        <ul className="space-y-2">
          {gone.map((l) => {
            const x = linked[l.id]
            const reason = x?.state === 'gone' ? x.reason : 'error'
            return (
              <li key={l.id} className="surface flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className="text-body">
                  {reason === 'withdrawn'
                    ? t({ en: 'A summary you opened earlier was withdrawn by the patient. It is no longer stored anywhere.', ar: 'سحب المريض ملخصاً فتحته سابقاً، ولم يعد محفوظاً في أي مكان.' })
                    : reason === 'expired'
                      ? t({ en: 'A summary you opened earlier has expired and was deleted.', ar: 'انتهت صلاحية ملخص فتحته سابقاً وحُذف.' })
                      : t({ en: 'A shared summary could not be loaded right now.', ar: 'تعذّر تحميل ملخص مشترك الآن.' })}
                </span>
                <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-canvas hover:text-ink" onClick={() => setInbox((x) => x.filter((y) => y.id !== l.id))}>
                  <X className="h-4 w-4" aria-hidden />
                  <span className="sr-only">{t({ en: 'Dismiss', ar: 'إخفاء' })}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <ul className="surface h-fit divide-y divide-line overflow-hidden" aria-label={t({ en: 'Referrals', ar: 'الإحالات' })}>
          {rows.map((row) => {
            const { r } = row
            const rv = reviewOf(row)
            const active = sel?.key === row.key
            return (
              <li key={row.key}>
                <button type="button" onClick={() => setSelKey(row.key)} className={`w-full px-4 py-3.5 text-start transition-colors ${active ? 'bg-brand-25' : 'hover:bg-canvas/70'}`} aria-current={active}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${rv ? 'bg-emerald-500' : r.level === 'urgent' ? 'bg-red-500' : 'bg-amber-400'}`} aria-hidden />
                      <span className="font-mono text-sm font-semibold text-ink">{r.pseudoId}</span>
                    </span>
                    <LevelPill level={rv?.level ?? r.level} />
                  </div>
                  <p className="mt-1 line-clamp-1 text-sm text-body">{r.flags.map((f) => t(f.title)).join(' · ') || t({ en: 'No risk signals', ar: 'لا مؤشرات خطر' })}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
                    <span>
                      {t({ en: 'Age', ar: 'العمر' })} {r.age}
                    </span>
                    <span aria-hidden>·</span>
                    {row.link ? (
                      <span className="inline-flex items-center gap-1 font-medium text-brand-700">
                        <Link2 className="h-3 w-3" aria-hidden />
                        {t({ en: 'Private link', ar: 'رابط خاص' })}
                      </span>
                    ) : (
                      <span>{r.origin === 'synthetic' ? t({ en: 'Synthetic', ar: 'اصطناعي' }) : t({ en: 'Sent from this device', ar: 'مُرسل من هذا الجهاز' })}</span>
                    )}
                    <span aria-hidden>·</span>
                    <span>{rv ? t({ en: 'Reviewed', ar: 'تمت المراجعة' }) : t({ en: 'Awaiting review', ar: 'بانتظار المراجعة' })}</span>
                  </p>
                </button>
              </li>
            )
          })}
        </ul>

        {sel && <ReferralDetail key={sel.key} r={sel.r} review={reviewOf(sel)} onReview={(rv) => onReview(sel, rv)} toPatient={!!sel.link} sent={sent[sel.key]} />}
      </div>
    </div>
  )
}
