import { CalendarClock, ChevronDown, CircleCheck, Download, FlaskConical, LockKeyhole, TriangleAlert, Video } from 'lucide-react'
import { useState } from 'react'
import { addDays, fmtDateTime, fmtDay, today as todayOf } from '../lib/companion/dates'
import { MODE_LABEL, ORDER_LABEL } from '../lib/companion/journey'
import type { OrderKind, VisitMode } from '../lib/companion/journey'
import { LAB_KINDS, SOURCE_LABEL } from '../lib/companion/labs'
import type { LabKind } from '../lib/companion/labs'
import { useI18n } from '../lib/i18n'
import { toFhir } from '../lib/referral'
import type { ReferralSummary, Review } from '../lib/referral'
import { LEVEL_LABEL } from '../lib/services'
import type { Level } from '../lib/types'
import { LEVELS } from '../lib/types'
import { CHART, TrendChart } from './charts'
import { Callout, LayerLabel, LevelPill, Sources } from './ui'

const ORDER_CHOICES: { kind: OrderKind; weeks: number }[] = [
  { kind: 'semen_repeat', weeks: 12 },
  { kind: 'testosterone_am', weeks: 2 },
  { kind: 'hba1c', weeks: 2 },
  { kind: 'bp_home', weeks: 1 },
  { kind: 'ifhas', weeks: 4 },
  { kind: 'ultrasound', weeks: 2 },
]
const PREFER_LABEL = {
  weekday_morning: { en: 'weekday mornings', ar: 'صباح أيام الأسبوع' },
  weekday_evening: { en: 'weekday evenings', ar: 'مساء أيام الأسبوع' },
  weekend: { en: 'weekends', ar: 'نهاية الأسبوع' },
} as const

/** `sent` describes the encrypted reply to the patient's phone; leave it out for on-device examples. */
export type ReplyState = 'idle' | 'sending' | 'sent' | 'failed'

interface Props {
  r: ReferralSummary
  review?: Review
  onReview: (r: Review) => void
  /** When set, the decision travels back to the patient, so the clinician can name themselves and add a note. */
  toPatient?: boolean
  sent?: ReplyState
}

/** One shared summary, as a clinician reads it: the suggested step, the evidence, and the clinician's own decision. */
export function ReferralDetail({ r, review, onReview, toPatient = false, sent = 'idle' }: Props) {
  const { t, lang } = useI18n()
  const when = (iso: string) => new Date(iso).toLocaleString(lang === 'ar' ? 'ar-AE' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })
  const [mode, setMode] = useState<'view' | 'change'>('view')
  const [level, setLevel] = useState<Level>(review?.level ?? r.level)
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [reviewer, setReviewer] = useState(review?.reviewer ?? '')
  const [editing, setEditing] = useState(!review)
  const [offerOn, setOfferOn] = useState(r.request?.purpose === 'teleconsult')
  const [offerDate, setOfferDate] = useState(addDays(todayOf(), 3))
  const [offerTime, setOfferTime] = useState(r.request?.prefer?.includes('weekday_evening') ? '19:00' : '10:00')
  const [offerMode, setOfferMode] = useState<VisitMode>(r.request?.purpose === 'teleconsult' ? 'video' : 'in_person')
  const [orders, setOrders] = useState<OrderKind[]>([])

  const download = () => {
    const blob = new Blob([JSON.stringify(toFhir(r), null, 2)], { type: 'application/fhir+json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${r.pseudoId}.fhir.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }
  const save = (decision: Review['decision']) => {
    onReview({
      decision,
      level: decision === 'agree' ? r.level : level,
      reason: (decision === 'agree' ? note : reason).trim().slice(0, 600),
      at: new Date().toISOString(),
      reviewer: toPatient ? reviewer.trim().slice(0, 80) || t({ en: 'Clinician', ar: 'الطبيب' }) : 'Demo clinician',
      offer: toPatient && offerOn && offerDate && offerTime ? { at: `${offerDate}T${offerTime}`, mode: offerMode, providerId: r.request?.providerId, providerName: r.request?.providerName } : undefined,
      orders: toPatient && orders.length ? ORDER_CHOICES.filter((o) => orders.includes(o.kind)).map((o) => ({ kind: o.kind, inWeeks: o.weeks })) : undefined,
    })
    setEditing(false)
    setMode('view')
  }

  return (
    <article className="surface divide-y divide-line self-start overflow-hidden">
      <header className="flex flex-wrap items-start justify-between gap-3 px-5 py-4 sm:px-6">
        <div>
          <h2 className="font-mono text-lg font-semibold text-ink">{r.pseudoId}</h2>
          <p className="text-sm text-muted">
            {r.firstName ? `${r.firstName} · ` : ''}
            {t({ en: 'Age', ar: 'العمر' })} {r.age} · {when(r.createdAt)} · {r.engineVersion}
          </p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={download}>
          <Download className="h-4 w-4" aria-hidden />
          FHIR
        </button>
      </header>

      <p className="border-b border-line bg-canvas px-5 py-2.5 text-xs text-muted sm:px-6">
        {t({
          en: 'Shared by the person for their own care. Not to be used for employment, insurance, visa or any decision unrelated to their care. Do not copy it into other records without their agreement.',
          ar: 'شاركه الشخص من أجل رعايته فقط. لا يُستخدم للتوظيف أو التأمين أو التأشيرة أو أي قرار لا يتعلق برعايته، ولا يُنسخ إلى سجلات أخرى دون موافقته.',
        })}
      </p>

      <section className={`space-y-1.5 px-5 py-4 sm:px-6 ${r.emergency ? 'bg-red-50/70' : ''}`}>
        <LayerLabel layer="rules">{t({ en: 'Suggested by clinical rules', ar: 'مقترح من القواعد السريرية' })}</LayerLabel>
        <div className="flex flex-wrap items-center gap-2.5">
          <p className={`text-base font-semibold ${r.emergency ? 'text-red-800' : 'text-ink'}`}>{t(r.step)}</p>
          <LevelPill level={r.level} />
        </div>
      </section>

      {r.request && (
        <section className="flex items-start gap-3 bg-sky-50/60 px-5 py-4 sm:px-6">
          {r.request.purpose === 'teleconsult' ? <Video className="mt-0.5 h-5 w-5 shrink-0 text-sky-700" aria-hidden /> : <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-sky-700" aria-hidden />}
          <div className="text-sm">
            <p className="font-semibold text-ink">{r.request.purpose === 'teleconsult' ? t({ en: 'Asks for a video consultation', ar: 'يطلب استشارة بالفيديو' }) : t({ en: 'Asks for a review and an appointment', ar: 'يطلب مراجعة وموعداً' })}</p>
            <p className="text-muted">
              {r.request.providerName ? `${t(r.request.providerName)} · ` : ''}
              {r.request.prefer?.length ? `${t({ en: 'Prefers', ar: 'يفضّل' })} ${r.request.prefer.map((p) => t(PREFER_LABEL[p])).join(', ')}` : t({ en: 'No time preference', ar: 'لا تفضيل للوقت' })}
            </p>
          </div>
        </section>
      )}

      {r.labs && r.labs.length > 0 && <SharedLabs labs={r.labs} />}

      {r.exposures && r.exposures.length > 0 && (
        <section className="px-5 py-4 text-sm sm:px-6">
          <h3 className="font-semibold text-ink">{t({ en: 'Work exposures (self-reported)', ar: 'التعرّض في العمل (مُبلَّغ ذاتياً)' })}</h3>
          <p className="mt-1 text-body">{r.exposures.map(t).join(' · ')}</p>
        </section>
      )}

      <section className="space-y-3 px-5 py-4 sm:px-6">
        <h3 className="text-sm font-semibold text-ink">{t({ en: 'Signals and evidence', ar: 'المؤشرات والأدلة' })}</h3>
        {r.flags.length === 0 && <p className="text-sm text-muted">{t({ en: 'No risk signals.', ar: 'لا توجد مؤشرات خطر.' })}</p>}
        <ul className="space-y-3">
          {r.flags.map((f) => (
            <li key={f.id} className="rounded-lg border border-line p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-ink">{t(f.title)}</span>
                <span className="font-mono text-[11px] text-faint">{f.id}</span>
              </div>
              <p className="mt-1 text-sm text-body">{f.because.map(t).join('; ')}</p>
              <p className="mt-1 text-sm text-muted">{t(f.action)}</p>
              <div className="mt-2">
                <Sources ids={f.sources} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      {(r.dataIssues.length > 0 || r.semen || (r.declined && r.declined.length > 0)) && (
        <section className="space-y-3 px-5 py-4 sm:px-6">
          {r.dataIssues.length > 0 && (
            <Callout tone="warn" title={t({ en: 'Data-quality notes', ar: 'ملاحظات جودة البيانات' })}>
              <ul className="list-disc ps-5">
                {r.dataIssues.map((d, i) => (
                  <li key={i}>{t(d)}</li>
                ))}
              </ul>
            </Callout>
          )}
          {r.semen && (
            <div>
              <h3 className="text-sm font-semibold text-ink">{t({ en: 'Semen analysis (self-reported)', ar: 'تحليل السائل المنوي (مُبلَّغ ذاتياً)' })}</h3>
              <p className="mt-1 text-sm text-body">{r.semen.map((v) => `${t(v.label)}: ${v.value}`).join(' · ')}</p>
            </div>
          )}
          {r.declined && r.declined.length > 0 && (
            <p className="text-sm text-muted">
              {t({ en: 'Chose not to answer:', ar: 'اختار عدم الإجابة عن:' })} {r.declined.map(t).join('; ')}
            </p>
          )}
        </section>
      )}

      {r.answers && (
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-3.5 hover:bg-canvas/70 sm:px-6">
            <LayerLabel layer="you">
              {r.answers.length} {t({ en: 'shared answers', ar: 'إجابة مشتركة' })}
            </LayerLabel>
            <ChevronDown className="h-4 w-4 text-faint transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <dl className="grid gap-3 px-5 pb-5 text-sm sm:grid-cols-2 sm:px-6">
            {r.answers.map((x, i) => (
              <div key={i}>
                <dt className="text-muted">{t(x.q)}</dt>
                <dd className="font-medium text-ink">{t(x.a)}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}

      <section className="space-y-3 bg-gold-50 px-5 py-5 sm:px-6">
        <LayerLabel layer="human" />
        {review && !editing ? (
          <div className="space-y-1.5 text-sm">
            <p className="text-ink">
              <span className="font-semibold">{review.decision === 'agree' ? t({ en: 'Confirmed:', ar: 'تم التأكيد:' }) : t({ en: 'Changed to:', ar: 'تم التعديل إلى:' })}</span> {t(LEVEL_LABEL[review.level])}
            </p>
            {review.reason && <p className="text-body">“{review.reason}”</p>}
            {review.offer && (
              <p className="text-body">
                {t({ en: 'Appointment offered:', ar: 'موعد مقترح:' })} {fmtDateTime(review.offer.at, lang)} · {t(MODE_LABEL[review.offer.mode])}
              </p>
            )}
            {review.orders && review.orders.length > 0 && (
              <p className="text-body">
                {t({ en: 'Tests requested:', ar: 'تحاليل مطلوبة:' })} {review.orders.map((o) => t(ORDER_LABEL[o.kind])).join(', ')}
              </p>
            )}
            <p className="text-xs text-muted">
              {review.reviewer} · {when(review.at)}
            </p>
            {toPatient && sent === 'sent' && (
              <p className="flex items-center gap-1.5 font-medium text-emerald-700">
                <LockKeyhole className="h-4 w-4" aria-hidden />
                {t({ en: 'Sent to the patient’s phone, encrypted.', ar: 'أُرسل مشفّراً إلى هاتف المريض.' })}
              </p>
            )}
            {toPatient && sent === 'sending' && <p className="text-muted">{t({ en: 'Sending to the patient…', ar: 'جارٍ الإرسال إلى المريض…' })}</p>}
            {toPatient && sent === 'failed' && (
              <p className="flex items-center gap-1.5 font-medium text-red-700">
                <TriangleAlert className="h-4 w-4" aria-hidden />
                {t({ en: 'Could not send it. The patient may have withdrawn the summary. Your decision is saved on this device only.', ar: 'تعذّر الإرسال، فقد يكون المريض سحب الملخص. قرارك محفوظ على هذا الجهاز فقط.' })}
              </p>
            )}
            <button type="button" className="text-sm font-semibold text-brand-700 hover:underline" onClick={() => setEditing(true)}>
              {t({ en: 'Revise decision', ar: 'مراجعة القرار' })}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {toPatient && (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5">
                  <span className="text-sm font-medium text-ink">{t({ en: 'Your name and role', ar: 'اسمك وصفتك' })}</span>
                  <input className="input" maxLength={80} value={reviewer} onChange={(e) => setReviewer(e.target.value)} placeholder={t({ en: 'e.g. Dr A., family physician', ar: 'مثال: د. أ.، طبيب أسرة' })} />
                </label>
                {mode === 'view' && (
                  <label className="grid gap-1.5">
                    <span className="text-sm font-medium text-ink">{t({ en: 'Note to the patient (optional)', ar: 'ملاحظة للمريض (اختيارية)' })}</span>
                    <input className="input" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t({ en: 'e.g. Book through the clinic app', ar: 'مثال: احجز عبر تطبيق العيادة' })} />
                  </label>
                )}
              </div>
            )}
            {toPatient && (
              <div className="space-y-3 rounded-lg border border-line bg-white p-4">
                <label className="flex items-center gap-2 text-sm font-medium text-ink">
                  <input type="checkbox" className="h-4 w-4 accent-brand-700" checked={offerOn} onChange={(e) => setOfferOn(e.target.checked)} />
                  {t({ en: 'Offer an appointment', ar: 'اقترح موعداً' })}
                </label>
                {offerOn && (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <input type="date" className="input" value={offerDate} onChange={(e) => setOfferDate(e.target.value)} aria-label={t({ en: 'Date', ar: 'التاريخ' })} />
                    <input type="time" className="input" value={offerTime} onChange={(e) => setOfferTime(e.target.value)} aria-label={t({ en: 'Time', ar: 'الوقت' })} />
                    <select className="input" value={offerMode} onChange={(e) => setOfferMode(e.target.value as VisitMode)} aria-label={t({ en: 'How', ar: 'الطريقة' })}>
                      {(['video', 'in_person', 'phone'] as const).map((m) => (
                        <option key={m} value={m}>
                          {t(MODE_LABEL[m])}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <fieldset className="space-y-2">
                  <legend className="flex items-center gap-1.5 text-sm font-medium text-ink">
                    <FlaskConical className="h-4 w-4 text-muted" aria-hidden />
                    {t({ en: 'Tests to do before the visit', ar: 'تحاليل قبل الزيارة' })}
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {ORDER_CHOICES.map((o) => {
                      const on = orders.includes(o.kind)
                      return (
                        <button key={o.kind} type="button" aria-pressed={on} onClick={() => setOrders((x) => (on ? x.filter((y) => y !== o.kind) : [...x, o.kind]))} className={`inline-flex min-h-8 items-center rounded-full border px-3 py-1 text-xs font-medium ${on ? 'border-brand-700 bg-brand-50 text-brand-800' : 'border-line-strong bg-white text-body hover:bg-canvas'}`}>
                          {t(ORDER_LABEL[o.kind])} · {t({ en: `within ${o.weeks} wk`, ar: `خلال ${o.weeks} أسبوع` })}
                        </button>
                      )
                    })}
                  </div>
                </fieldset>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-primary" onClick={() => save('agree')}>
                <CircleCheck className="h-4 w-4" aria-hidden />
                {t({ en: 'Confirm suggested step', ar: 'تأكيد الخطوة المقترحة' })}
              </button>
              <button type="button" className={`btn ${mode === 'change' ? 'btn-ghost' : 'btn-secondary'}`} onClick={() => setMode(mode === 'change' ? 'view' : 'change')}>
                {t({ en: 'Change step', ar: 'تغيير الخطوة' })}
              </button>
            </div>
            {mode === 'change' && (
              <div className="grid gap-3 rounded-lg border border-line bg-white p-4">
                <label className="grid gap-1.5">
                  <span className="text-sm font-medium text-ink">{t({ en: 'New next step', ar: 'الخطوة التالية الجديدة' })}</span>
                  <select className="input" value={level} onChange={(e) => setLevel(e.target.value as Level)}>
                    {LEVELS.map((l) => (
                      <option key={l} value={l}>
                        {t(LEVEL_LABEL[l])}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1.5">
                  <span className="text-sm font-medium text-ink">{t({ en: 'Reason (required)', ar: 'السبب (مطلوب)' })}</span>
                  <textarea className="textarea min-h-20" maxLength={600} value={reason} onChange={(e) => setReason(e.target.value)} />
                </label>
                <button type="button" className="btn btn-primary justify-self-start" disabled={reason.trim().length < 3} onClick={() => save('change')}>
                  {t({ en: 'Save decision', ar: 'حفظ القرار' })}
                </button>
              </div>
            )}
            {toPatient && (
              <p className="flex items-start gap-1.5 text-xs text-muted">
                <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                {t({ en: 'Your decision is encrypted on this device and shown only on the patient’s phone.', ar: 'يُشفَّر قرارك على هذا الجهاز ولا يظهر إلا على هاتف المريض.' })}
              </p>
            )}
          </div>
        )}
      </section>
    </article>
  )
}

/** Results over time that the person chose to share, as small charts with the same reference lines they see. */
function SharedLabs({ labs }: { labs: NonNullable<ReferralSummary['labs']> }) {
  const { t, lang } = useI18n()
  const kinds = [...new Set(labs.map((l) => l.kind))].filter((k) => k !== 'lens') as LabKind[]
  const charts: { key: string; title: string; unit: string; points: { date: string; value: number; note?: string }[]; home: { date: string; value: number }[]; low?: number; high?: number }[] = []
  for (const k of kinds) {
    for (const f of LAB_KINDS[k].fields) {
      const pts = labs.filter((l) => l.kind === k && l.values[f.id] !== undefined).map((l) => ({ date: l.date, value: l.values[f.id], note: t(SOURCE_LABEL[l.source]) }))
      const home = k === 'semen' ? labs.filter((l) => l.kind === 'lens' && l.values[f.id] !== undefined).map((l) => ({ date: l.date, value: l.values[f.id] })) : []
      if (pts.length) charts.push({ key: `${k}-${f.id}`, title: `${t(LAB_KINDS[k].label)}: ${t(f.label)}`, unit: t(f.unit), points: pts, home, low: f.low, high: f.high })
    }
  }
  return (
    <details className="group" open>
      <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-3.5 hover:bg-canvas/70 sm:px-6">
        <span className="text-sm font-semibold text-ink">
          {t({ en: 'Results over time', ar: 'النتائج مع الوقت' })} <span className="font-normal text-muted">· {labs.length} · {t({ en: 'latest', ar: 'الأحدث' })} {fmtDay(labs[labs.length - 1].date, lang)}</span>
        </span>
        <ChevronDown className="h-4 w-4 text-faint transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="grid gap-x-6 gap-y-4 px-5 pb-5 sm:grid-cols-2 sm:px-6">
        {charts.map((c) => (
          <figure key={c.key} className="min-w-0 space-y-1">
            <figcaption className="text-xs font-medium text-ink">
              {c.title} <span className="font-normal text-muted">({c.unit})</span>
            </figcaption>
            <TrendChart
              series={[
                { id: 'lab', label: t({ en: 'Lab or reading', ar: 'مخبري أو قراءة' }), color: CHART.s1, points: c.points },
                ...(c.home.length ? [{ id: 'home', label: t({ en: 'Home estimate', ar: 'تقدير منزلي' }), color: CHART.s2, hollow: true, points: c.home }] : []),
              ]}
              threshold={c.low !== undefined ? { value: c.low, side: 'below', label: String(c.low) } : c.high !== undefined ? { value: c.high, side: 'above', label: String(c.high) } : undefined}
              unit={c.unit}
              lang={lang}
              title={c.title}
              height={140}
            />
          </figure>
        ))}
      </div>
    </details>
  )
}
