import { BellPlus, CalendarCheck2, CalendarPlus, Check, ChevronDown, CircleCheck, Copy, MessageSquareText, Phone, Search, Stethoscope, Video, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Callout, LayerLabel } from '../../components/ui'
import { PREP_KINDS, VisitPrep } from '../../components/VisitPrep'
import type { BringContext } from '../../components/VisitPrep'
import { planPayload } from '../../lib/ai'
import type { AiBasis } from '../../lib/ai'
import { addDays, fmtDateTime, fmtDay } from '../../lib/companion/dates'
import { findCare, SERVICE_LABEL } from '../../lib/companion/directory'
import type { City } from '../../lib/companion/exposures'
import { downloadIcs } from '../../lib/companion/ics'
import { acceptOffer, isOpen, journeyMeasures, MODE_LABEL, sortSteps, updateStep } from '../../lib/companion/journey'
import type { Booking, JourneyStep, VisitMode } from '../../lib/companion/journey'
import { bookingScript, IF_ASKED } from '../../lib/companion/scripts'
import { useCompanion } from '../../lib/companion/useCompanion'
import { useI18n } from '../../lib/i18n'
import { sexOf } from '../../lib/types'
import type { Sex } from '../../lib/types'
import { CompanionShell } from './Shell'

const STATUS: Record<JourneyStep['status'], { en: string; ar: string; cls: string }> = {
  todo: { en: 'To do', ar: 'للتنفيذ', cls: 'bg-slate-50 text-muted ring-slate-500/20' },
  booked: { en: 'Booked', ar: 'محجوز', cls: 'bg-sky-50 text-sky-700 ring-sky-600/20' },
  done: { en: 'Done', ar: 'تم', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' },
  skipped: { en: 'Skipped', ar: 'تم تخطيه', cls: 'bg-slate-50 text-faint ring-slate-500/10' },
}

export default function Journey() {
  const { t, lang } = useI18n()
  const c = useCompanion()
  const steps = sortSteps(c.journey)
  const open = steps.filter(isOpen)
  const closed = steps.filter((s) => !isOpen(s))
  const m = journeyMeasures(c.journey, c.planStart ?? c.today)
  const set = (fn: (list: JourneyStep[]) => JourneyStep[]) => c.setJourney(fn)
  const basis = planPayload(c.view, lang)
  const bring: BringContext = {
    semenReports: c.labs.filter((l) => l.kind === 'semen').length,
    bpReadings: c.labs.filter((l) => l.kind === 'bp').length,
    lensEstimates: c.labs.filter((l) => l.kind === 'lens').length,
    work: !!c.work && c.work.occupation !== 'office' && c.work.occupation !== 'other',
  }

  return (
    <CompanionShell
      title={t({ en: 'Your care journey', ar: 'رحلة رعايتك' })}
      intro={t({ en: 'Each step comes from the fixed rules or from your doctor. You choose when and where; nothing is booked without you.', ar: 'كل خطوة مصدرها القواعد الثابتة أو طبيبك. أنت تختار المكان والموعد، ولا يُحجز شيء دونك.' })}
    >
      {open.length === 0 && (
        <section className="surface surface-pad text-center text-sm text-muted">{t({ en: 'No open steps. Your weekly check-ins keep this up to date.', ar: 'لا توجد خطوات مفتوحة. تُبقي تسجيلاتك الأسبوعية هذا محدثاً.' })}</section>
      )}

      <ol className="space-y-3">
        {open.map((s) => (
          <li key={s.id}>
            <StepCard step={s} onChange={set} today={c.today} city={c.work?.city} basis={basis} bring={bring} sex={sexOf(c.answers)} />
          </li>
        ))}
      </ol>

      <section className="surface surface-pad flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <Video className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          </span>
          <div className="space-y-0.5">
            <h2 className="text-base font-semibold text-ink">{t({ en: 'Prefer to start with a teleconsultation?', ar: 'تفضّل البدء باستشارة عن بُعد؟' })}</h2>
            <p className="text-sm text-muted">{t({ en: 'Send your summary with a request for a video call at times that suit you. The doctor’s reply comes back here.', ar: 'أرسل ملخصك مع طلب مكالمة فيديو في الأوقات التي تناسبك، ويعود ردّ الطبيب إلى هنا.' })}</p>
          </div>
        </div>
        <Link to="/share?purpose=teleconsult" className="btn btn-secondary shrink-0">
          {t({ en: 'Request a teleconsultation', ar: 'اطلب استشارة عن بُعد' })}
        </Link>
      </section>

      <section className="grid grid-cols-3 gap-3">
        {[
          { label: { en: 'Days to first appointment', ar: 'أيام حتى أول موعد' }, value: m.daysToEvaluation === undefined ? '–' : String(m.daysToEvaluation) },
          { label: { en: 'Care steps completed', ar: 'خطوات رعاية مكتملة' }, value: String(m.referralsDone) },
          { label: { en: 'Still open', ar: 'ما زالت مفتوحة' }, value: String(m.referralsOpen) },
        ].map((x) => (
          <div key={x.label.en} className="surface px-4 py-3">
            <p className="text-2xl font-semibold text-ink">{x.value}</p>
            <p className="text-xs text-muted">{t(x.label)}</p>
          </div>
        ))}
      </section>
      <p className="-mt-3 text-xs text-faint">{t({ en: 'These are the pathway measures the challenge asks for, from your own journey. In a pilot they are counted anonymously across everyone.', ar: 'هذه مقاييس المسار التي يطلبها التحدي، من رحلتك أنت. وفي المرحلة التجريبية تُحسب دون كشف الهوية لدى الجميع.' })}</p>

      {closed.length > 0 && (
        <details className="surface group overflow-hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-sm font-medium text-ink hover:bg-canvas/70">
            {t({ en: `Finished steps (${closed.length})`, ar: `الخطوات المنتهية (${closed.length})` })}
            <ChevronDown className="h-4 w-4 text-faint transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <ul className="divide-y divide-line border-t border-line">
            {closed.map((s) => (
              <li key={s.id} className="flex items-start gap-3 px-5 py-3.5 text-sm">
                {s.status === 'done' ? <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden /> : <X className="mt-0.5 h-4 w-4 shrink-0 text-faint" aria-hidden />}
                <div className="min-w-0">
                  <p className="font-medium text-ink">{t(s.title)}</p>
                  <p className="text-muted">
                    {s.doneAt ? fmtDay(s.doneAt.slice(0, 10), lang) : ''}
                    {s.booking?.providerName ? ` · ${t(s.booking.providerName)}` : ''}
                    {s.origin === 'clinician' && s.by ? ` · ${s.by}` : ''}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}
    </CompanionShell>
  )
}

function StepCard({ step: s, onChange, today, city, basis, bring, sex }: { step: JourneyStep; onChange: (fn: (l: JourneyStep[]) => JourneyStep[]) => void; today: string; city?: City; basis: AiBasis; bring: BringContext; sex: Sex }) {
  const { t, lang } = useI18n()
  const [mode, setMode] = useState<'none' | 'book' | 'script'>('none')
  const [copied, setCopied] = useState(false)
  const now = () => new Date().toISOString()
  const service = s.services[0]
  const isClinician = s.origin === 'clinician'

  if (s.kind === 'emergency') {
    return (
      <article className="surface overflow-hidden border-red-300">
        <div className="space-y-3 bg-red-50/70 p-5">
          <h2 className="text-lg font-semibold text-red-950">{t(s.title)}</h2>
          <p className="text-sm text-red-950/80">{t(s.why)}</p>
          <a href="tel:998" className="btn btn-danger w-full">
            <Phone className="h-4 w-4" aria-hidden />
            {t({ en: 'Call 998 (ambulance)', ar: 'اتصل بالرقم 998 (الإسعاف)' })}
          </a>
        </div>
      </article>
    )
  }

  const calendar = (b: Booking) =>
    downloadIcs('appointment', [{ id: s.id.replace(/[^\w-]/g, ''), title: t({ en: 'Appointment', ar: 'موعد' }), start: b.at, minutes: 30, details: b.mode === 'video' ? t({ en: 'Video call', ar: 'مكالمة فيديو' }) : undefined }])
  const copy = async () => {
    if (!service) return
    try {
      await navigator.clipboard.writeText(t(bookingScript(service, sex)))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <article className={`surface overflow-hidden ${s.kind === 'urgent' ? 'border-red-200' : s.offer ? 'border-gold-300' : ''}`}>
      <div className="space-y-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS[s.status].cls}`}>{t(STATUS[s.status])}</span>
              {isClinician ? <LayerLabel layer="human">{s.by}</LayerLabel> : <LayerLabel layer="rules">{t({ en: 'From the clinical rules', ar: 'من القواعد السريرية' })}</LayerLabel>}
            </div>
            <h2 className="text-[17px] leading-snug font-semibold text-ink">{t(s.title)}</h2>
          </div>
          {s.dueBy && s.status === 'todo' && (
            <span className="rounded-md bg-canvas px-2 py-1 text-xs font-medium text-muted ring-1 ring-inset ring-line">
              {t({ en: 'By', ar: 'قبل' })} {fmtDay(s.dueBy, lang)}
            </span>
          )}
        </div>
        <p className="text-sm text-muted">{t(s.why)}</p>

        {s.offer && (
          <div className="space-y-3 rounded-lg border border-gold-300 bg-gold-50 px-4 py-3">
            <p className="text-sm text-ink">
              <span className="font-semibold">{fmtDateTime(s.offer.at, lang)}</span> · {t(MODE_LABEL[s.offer.mode])}
              {s.offer.providerName ? ` · ${t(s.offer.providerName)}` : ''}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  onChange((l) => acceptOffer(l, s.id, now()))
                  if (s.offer) calendar(s.offer)
                }}
              >
                <Check className="h-4 w-4" aria-hidden />
                {t({ en: 'Accept and add to calendar', ar: 'اقبل وأضِف إلى التقويم' })}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange((l) => updateStep(l, s.id, { status: 'skipped', offer: undefined }, now()))}>
                {t({ en: 'Not this time', ar: 'ليس هذا الموعد' })}
              </button>
            </div>
            <p className="text-xs text-muted">{t({ en: 'Your answer reaches the clinic when it confirms the booking in a pilot. In this prototype it stays on your phone.', ar: 'في المرحلة التجريبية يصل ردك إلى العيادة عند تأكيد الحجز، وفي هذا النموذج يبقى على هاتفك.' })}</p>
          </div>
        )}

        {s.booking && s.status === 'booked' && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-sky-200 bg-sky-50/60 px-4 py-3">
            <p className="flex items-center gap-2 text-sm text-ink">
              <CalendarCheck2 className="h-4 w-4 shrink-0 text-sky-700" aria-hidden />
              <span>
                <span className="font-semibold">{fmtDateTime(s.booking.at, lang)}</span> · {t(MODE_LABEL[s.booking.mode])}
                {s.booking.providerName ? ` · ${t(s.booking.providerName)}` : ''}
              </span>
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => s.booking && calendar(s.booking)}>
                <BellPlus className="h-4 w-4" aria-hidden />
                {t({ en: 'Add to calendar', ar: 'أضِف إلى التقويم' })}
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => onChange((l) => updateStep(l, s.id, { status: 'done', doneAt: now() }, now()))}>
                <Check className="h-4 w-4" aria-hidden />
                {t({ en: 'It happened', ar: 'تمّ الموعد' })}
              </button>
            </div>
          </div>
        )}

        {s.status === 'todo' && !s.offer && (
          <div className="flex flex-wrap gap-2">
            {s.services.length > 0 && (
              <Link to={`/me/care?step=${encodeURIComponent(s.id)}`} className="btn btn-primary btn-sm">
                <Search className="h-4 w-4" aria-hidden />
                {t({ en: 'Find care', ar: 'ابحث عن رعاية' })}
              </Link>
            )}
            {service && (
              <button type="button" className={`btn btn-sm ${mode === 'script' ? 'btn-ghost' : 'btn-secondary'}`} onClick={() => setMode(mode === 'script' ? 'none' : 'script')}>
                <MessageSquareText className="h-4 w-4" aria-hidden />
                {t({ en: 'What to say', ar: 'ماذا أقول' })}
              </button>
            )}
            <button type="button" className={`btn btn-sm ${mode === 'book' ? 'btn-ghost' : 'btn-secondary'}`} onClick={() => setMode(mode === 'book' ? 'none' : 'book')}>
              <CalendarPlus className="h-4 w-4" aria-hidden />
              {t({ en: 'I booked it', ar: 'لقد حجزت' })}
            </button>
            {s.kind === 'order' && s.services.length === 0 && (
              <Link to="/me/results?add=bp" className="btn btn-secondary btn-sm">
                {t({ en: 'Add readings', ar: 'أضِف القراءات' })}
              </Link>
            )}
            {(s.kind === 'occupational' || s.kind === 'screening' || s.kind === 'order') && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange((l) => updateStep(l, s.id, { status: s.kind === 'order' ? 'done' : 'skipped', doneAt: s.kind === 'order' ? now() : undefined }, now()))}>
                {s.kind === 'order' ? t({ en: 'Mark as done', ar: 'تم' }) : t({ en: 'Skip', ar: 'تخطٍّ' })}
              </button>
            )}
          </div>
        )}

        {PREP_KINDS.includes(s.kind) && <VisitPrep step={s} basis={basis} bring={bring} />}

        {mode === 'script' && service && (
          <div className="space-y-2 rounded-lg bg-canvas px-4 py-3">
            <p className="text-xs font-medium text-muted">{t(SERVICE_LABEL[service])}</p>
            <p className="text-[15px] text-ink">“{t(bookingScript(service, sex))}”</p>
            <p className="text-sm text-muted">{t(IF_ASKED)}</p>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => void copy()}>
              <Copy className="h-4 w-4" aria-hidden />
              {copied ? t({ en: 'Copied', ar: 'تم النسخ' }) : t({ en: 'Copy to send by message', ar: 'انسخ لإرسالها برسالة' })}
            </button>
          </div>
        )}

        {mode === 'book' && (
          <BookingForm
            step={s}
            today={today}
            city={city}
            onSave={(b) => {
              onChange((l) => updateStep(l, s.id, { status: 'booked', booking: b }, now()))
              setMode('none')
            }}
          />
        )}
      </div>
    </article>
  )
}

function BookingForm({ step, onSave, today, city }: { step: JourneyStep; onSave: (b: Booking) => void; today: string; city?: City }) {
  const { t, lang } = useI18n()
  const [date, setDate] = useState(addDays(today, 3))
  const [time, setTime] = useState('10:00')
  const [mode, setMode] = useState<VisitMode>('in_person')
  const options = step.services.length ? findCare({ services: step.services, area: city }).slice(0, 8) : []
  const [provider, setProvider] = useState('')
  const picked = options.find((o) => o.provider.id === provider)?.provider
  return (
    <div className="grid gap-3 rounded-lg border border-line bg-white p-4 sm:grid-cols-2">
      <label className="grid gap-1.5">
        <span className="text-sm font-medium text-ink">{t({ en: 'Date', ar: 'التاريخ' })}</span>
        <input type="date" className="input" value={date} min={addDays(today, -60)} onChange={(e) => setDate(e.target.value)} />
      </label>
      <label className="grid gap-1.5">
        <span className="text-sm font-medium text-ink">{t({ en: 'Time', ar: 'الوقت' })}</span>
        <input type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} />
      </label>
      <label className="grid gap-1.5">
        <span className="text-sm font-medium text-ink">{t({ en: 'How', ar: 'الطريقة' })}</span>
        <select className="input" value={mode} onChange={(e) => setMode(e.target.value as VisitMode)}>
          {(['in_person', 'video', 'phone'] as const).map((m) => (
            <option key={m} value={m}>
              {t(MODE_LABEL[m])}
            </option>
          ))}
        </select>
      </label>
      {options.length > 0 && (
        <label className="grid gap-1.5">
          <span className="text-sm font-medium text-ink">{t({ en: 'Where (optional)', ar: 'المكان (اختياري)' })}</span>
          <select className="input" value={provider} onChange={(e) => setProvider(e.target.value)}>
            <option value="">{t({ en: 'Somewhere else', ar: 'مكان آخر' })}</option>
            {options.map((o) => (
              <option key={o.provider.id} value={o.provider.id}>
                {t(o.provider.name)}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="flex items-center gap-2 sm:col-span-2">
        <button type="button" className="btn btn-primary btn-sm" disabled={!date || !time} onClick={() => onSave({ at: `${date}T${time}`, mode, providerId: picked?.id, providerName: picked?.name })}>
          <Stethoscope className="h-4 w-4" aria-hidden />
          {t({ en: 'Save booking', ar: 'احفظ الحجز' })}
        </button>
        <span className="text-xs text-muted">
          {date && time ? fmtDateTime(`${date}T${time}`, lang) : ''}
        </span>
      </div>
      <Callout tone="info">{t({ en: 'Saved on this phone only. In a pilot, bookings made through the clinic would appear here by themselves.', ar: 'يُحفظ على هذا الهاتف فقط. وفي المرحلة التجريبية تظهر هنا الحجوزات التي تتم عبر العيادة تلقائياً.' })}</Callout>
    </div>
  )
}
