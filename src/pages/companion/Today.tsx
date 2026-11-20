import { ArrowRight, BellPlus, CalendarClock, ClipboardCheck, Flame, HeartHandshake, Phone, ScanLine, Share2, Smartphone, ThermometerSun } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router'
import { CycleRing, Sparkline } from '../../components/charts'
import { CompanionAi } from '../../components/CompanionAi'
import { Callout, Finding, LayerLabel, LevelIcon, LevelPill } from '../../components/ui'
import { byWeek, dueThisWeek, habitCount, habitKeys, habitsOf, HABIT_LABEL, streak } from '../../lib/companion/checkins'
import { cycleLengths } from '../../lib/companion/trends'
import type { Habits } from '../../lib/companion/checkins'
import { useConsents } from '../../lib/companion/consents'
import { addDays, fmtDateTime, fmtDay } from '../../lib/companion/dates'
import { CITIES } from '../../lib/companion/exposures'
import { downloadIcs } from '../../lib/companion/ics'
import { isOpen, MODE_LABEL, sortSteps } from '../../lib/companion/journey'
import { PERSONAS } from '../../lib/companion/personas'
import { useCompanion } from '../../lib/companion/useCompanion'
import { heatLevel, useHeat } from '../../lib/companion/weather'
import { planPayload } from '../../lib/ai'
import { useI18n } from '../../lib/i18n'
import { stepFor } from '../../lib/services'
import type { L10n } from '../../lib/types'
import { LEVEL_RANK } from '../../lib/types'
import { Tour } from '../../components/Tour'
import type { TourStep } from '../../components/Tour'
import { CompanionShell } from './Shell'

const TODAY_TOUR: TourStep[] = [
  { target: 'next', title: { en: 'Your next step', ar: 'خطوتك التالية' }, body: { en: 'What to do now, and any appointment waiting for a reply.', ar: 'ما يجب فعله الآن، وأي موعد ينتظر رداً.' } },
  { target: 'trends', title: { en: 'Change over time', ar: 'التغيّر مع الوقت' }, body: { en: 'What the rules notice across months of cycles, results and habits.', ar: 'ما تلاحظه القواعد عبر أشهر من الدورة والنتائج والعادات.' } },
  { target: 'week', title: { en: '20 seconds a week', ar: '20 ثانية أسبوعياً' }, body: { en: 'A short check-in keeps the picture current.', ar: 'تسجيل قصير يُبقي الصورة محدّثة.' } },
  { target: 'tabs', title: { en: 'Everything else', ar: 'بقية الأقسام' }, body: { en: 'Journey for appointments, Results for tests, Habits for daily life, Privacy for your data.', ar: '«الرحلة» للمواعيد، و«النتائج» للتحاليل، و«العادات» للحياة اليومية، و«الخصوصية» لبياناتك.' } },
]

export default function Today() {
  const { t, lang } = useI18n()
  const c = useCompanion()
  const consents = useConsents()

  if (!c.active) return <Onboarding />

  const v = c.view
  const step = stepFor(v.emergency ? 'emergency' : v.level, v.base.sex)
  const open = sortSteps(c.journey).filter(isOpen).slice(0, 2)
  const weeks = byWeek(c.checkins)
  const thisWeekDue = dueThisWeek(c.checkins, c.today)
  const latest = weeks[0]
  const inWindow = weeks.filter((w) => w.week >= addDays(v.cycle.start, -6))
  const female = v.base.sex === 'female'
  const cycles = female ? cycleLengths(c.checkins) : []
  const lastPeriod = female ? weeks.map((w) => w.periodStart).filter((d): d is string => !!d).sort().at(-1) : undefined
  const avgCycle = cycles.length >= 2 ? Math.round(cycles.slice(-6).reduce((a, x) => a + x.days, 0) / Math.min(6, cycles.length)) : undefined
  const newer = v.flags.filter((f) => f.id.startsWith('LT_') || f.id.startsWith('EX_')).sort((a, b) => rank(b) - rank(a))

  return (
    <CompanionShell
      wide
      title={t({ en: 'Today', ar: 'اليوم' })}
      intro={<span>{fmtDay(c.today, lang)}</span>}
    >
      <Tour id="today" steps={TODAY_TOUR} />
      {/* Phone: one column in reading order. Wide screens: the plan on the left, this week's numbers on the right. */}
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:items-start">
        <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-6">
          <div data-tour="next" className="order-1 empty:hidden">
      {/* ---------- Next step ---------- */}
      {v.emergency ? (
        <section className="surface overflow-hidden border-red-300">
          <div className="space-y-4 bg-red-50/70 p-5 sm:p-6">
            <p className="text-sm font-semibold text-red-700">{t({ en: 'Emergency', ar: 'حالة طارئة' })}</p>
            <h2 className="title text-red-950">{t(step.title)}</h2>
            <p className="text-red-950/80">{t(step.how)}</p>
            <a href="tel:998" className="btn btn-danger btn-lg w-full">
              <Phone className="h-5 w-5" aria-hidden />
              {t({ en: 'Call 998 (ambulance)', ar: 'اتصل بالرقم 998 (الإسعاف)' })}
            </a>
          </div>
        </section>
      ) : (
        <section className="surface overflow-hidden">
          <div className="space-y-4 p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <LevelIcon level={v.level} size="lg" />
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-muted">{t({ en: 'Your next step', ar: 'خطوتك التالية' })}</p>
                  <LevelPill level={v.level} />
                </div>
                <h2 className="text-xl leading-snug font-semibold text-ink">{t(step.title)}</h2>
              </div>
            </div>
            <div>
              {v.decidedBy === 'clinician' && v.review ? (
                <LayerLabel layer="human">
                  {t({ en: 'Decided by', ar: 'قرّره' })} {v.review.reviewer} · {fmtDay(v.review.at.slice(0, 10), lang)}
                </LayerLabel>
              ) : v.decidedBy === 'red_flag' ? (
                <LayerLabel layer="rules">{t({ en: 'A symptom you reported needs a doctor quickly', ar: 'عرَض ذكرته يحتاج إلى طبيب بسرعة' })}</LayerLabel>
              ) : (
                <LayerLabel layer="rules">{t({ en: 'Suggested by fixed clinical rules, not by AI', ar: 'اقترحته قواعد سريرية ثابتة، لا الذكاء الاصطناعي' })}</LayerLabel>
              )}
            </div>
            {v.decidedBy === 'clinician' && v.newSinceReview > 0 && (
              <Callout tone="info" icon={Share2}>
                {t({ en: `${v.newSinceReview} new results and check-ins since your doctor’s review.`, ar: `${v.newSinceReview} من النتائج والتسجيلات الجديدة منذ مراجعة طبيبك.` })}{' '}
                <Link to="/share" className="font-semibold underline-offset-4 hover:underline">
                  {t({ en: 'Share the latest', ar: 'شارك الأحدث' })}
                </Link>
              </Callout>
            )}
            {open.length > 0 && (
              <ul className="divide-y divide-line rounded-lg border border-line">
                {open.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                    <CalendarClock className="h-4 w-4 shrink-0 text-brand-600" aria-hidden />
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="font-medium text-ink">{t(s.title)}</p>
                      <p className="text-muted">
                        {s.offer
                          ? t({ en: 'Offered for', ar: 'مقترح في' }) + ` ${fmtDateTime(s.offer.at, lang)} · ${t(MODE_LABEL[s.offer.mode])}`
                          : s.booking
                            ? `${fmtDateTime(s.booking.at, lang)} · ${t(MODE_LABEL[s.booking.mode])}${s.booking.providerName ? ` · ${t(s.booking.providerName)}` : ''}`
                            : s.dueBy
                              ? `${t({ en: 'Due by', ar: 'موعده قبل' })} ${fmtDay(s.dueBy, lang)}`
                              : t({ en: 'Not booked yet', ar: 'لم يُحجز بعد' })}
                      </p>
                    </div>
                    {s.offer && <span className="rounded-full bg-gold-100 px-2 py-0.5 text-xs font-semibold text-gold-700">{t({ en: 'Reply needed', ar: 'بانتظار ردك' })}</span>}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link to="/me/journey" className="btn btn-primary">
                {t({ en: 'Open my care journey', ar: 'افتح رحلة الرعاية' })}
                <ArrowRight className="icon-dir h-4 w-4" aria-hidden />
              </Link>
              <Link to="/me/care" className="btn btn-secondary">
                {t({ en: 'Find care', ar: 'ابحث عن رعاية' })}
              </Link>
            </div>
          </div>
        </section>
      )}

          </div>
          <div data-tour="trends" className="order-5 empty:hidden">
      {/* ---------- Findings over time ---------- */}
      {newer.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <h2 className="heading">{t({ en: 'What the rules see over time', ar: 'ما تراه القواعد مع مرور الوقت' })}</h2>
            <Link to="/me/results" className="text-sm font-semibold text-brand-700 hover:underline">
              {t({ en: 'All results', ar: 'كل النتائج' })}
            </Link>
          </div>
          <div className="surface divide-y divide-line overflow-hidden">
            {newer.slice(0, 4).map((f, i) => (
              <Finding key={f.id} flag={f} defaultOpen={i === 0} />
            ))}
          </div>
        </section>
      )}

          </div>
          <div className="order-6 empty:hidden">
      {/* ---------- Do more ---------- */}
      {!v.emergency && <CompanionAi basis={planPayload(v, lang)} flagIds={v.flags.map((f) => f.id)} sex={v.base.sex} />}

          </div>
        </div>
        <aside className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-6">
          <div className="order-2">
      {/* ---------- 90-day window ---------- */}
      <section className="surface surface-pad space-y-4">
        <div className="flex items-center gap-5">
          <CycleRing day={v.cycle.day} total={90} label={t({ en: `Day ${v.cycle.day} of 90`, ar: `اليوم ${v.cycle.day} من 90` })} />
          <div className="min-w-0 space-y-1.5">
            <p className="eyebrow">{t({ en: 'Your 90-day window', ar: 'نافذتك ذات التسعين يوماً' })}</p>
            <h2 className="text-lg leading-snug font-semibold text-ink">
              {v.cycle.day > 90
                ? t({ en: 'This window is complete', ar: 'اكتملت هذه النافذة' })
                : t({ en: `Day ${v.cycle.day} of 90`, ar: `اليوم ${v.cycle.day} من 90` })}
            </h2>
            <p className="text-sm text-muted">
              {v.cycle.startReason === 'lab_test'
                ? t({ en: 'Counted from your last lab test on', ar: 'محسوبة من آخر تحليل مخبري في' })
                : t({ en: 'Counted from the start of your plan on', ar: 'محسوبة من بداية خطتك في' })}{' '}
              {fmtDay(v.cycle.start, lang)}
            </p>
          </div>
        </div>
        {female ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <p className="rounded-lg bg-canvas px-3.5 py-3 text-sm text-body">
              {lastPeriod ? (
                <>
                  {t({ en: 'Last period recorded:', ar: 'آخر دورة مسجلة:' })} <span className="font-semibold text-ink">{fmtDay(lastPeriod, lang)}</span>
                  {avgCycle !== undefined && (
                    <>
                      {' · '}
                      {t({ en: `average cycle ${avgCycle} days over ${Math.min(6, cycles.length)} cycles`, ar: `متوسط الدورة ${avgCycle} يوماً على مدى ${Math.min(6, cycles.length)} دورات` })}
                    </>
                  )}
                  .
                </>
              ) : (
                t({ en: 'Record the first day of each period in your weekly check-in to see your own pattern.', ar: 'سجّلي أول يوم من كل دورة في تسجيلك الأسبوعي لتري نمطك الخاص.' })
              )}
            </p>
            <p className="rounded-lg bg-canvas px-3.5 py-3 text-sm text-body">
              {t({ en: 'About three months of steady habits is a fair time to judge a change in your cycles, weight or blood results.', ar: 'نحو ثلاثة أشهر من العادات الثابتة مدة مناسبة للحكم على أي تغيّر في دورتك أو وزنك أو نتائج تحاليلك.' })}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <p className="rounded-lg bg-canvas px-3.5 py-3 text-sm text-body">
              {t({ en: 'Sperm in a sample today began forming around', ar: 'الحيوانات المنوية في عينة اليوم بدأت تتكوّن نحو' })} <span className="font-semibold text-ink">{fmtDay(v.cycle.formingSince, lang)}</span>.
            </p>
            <p className="rounded-lg bg-canvas px-3.5 py-3 text-sm text-body">
              {t({ en: 'Habits you keep from today show in a test from about', ar: 'العادات التي تلتزم بها من اليوم تظهر في تحليل بدءاً من نحو' })} <span className="font-semibold text-ink">{fmtDay(v.cycle.showsFrom, lang)}</span>.
            </p>
          </div>
        )}
        {inWindow.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-ink">{t({ en: 'Your habits in this window', ar: 'عاداتك في هذه النافذة' })}</p>
            <ul className={`grid grid-cols-2 gap-2 ${female ? 'sm:grid-cols-3' : 'sm:grid-cols-4'}`}>
              {habitKeys(female).map((h: keyof Habits) => {
                const yes = inWindow.filter((w) => habitsOf(w)[h]).length
                return (
                  <li key={h} className="rounded-lg border border-line px-3 py-2.5">
                    <p className="text-lg font-semibold text-ink">
                      {yes}
                      <span className="text-sm font-normal text-muted">/{inWindow.length}</span>
                    </p>
                    <p className="text-xs text-muted">
                      {t(HABIT_LABEL[h])} · {t({ en: 'weeks', ar: 'أسابيع' })}
                    </p>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
        {v.cycle.retestDue && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand-100 bg-brand-25 px-4 py-3">
            <p className="text-sm text-brand-950">
              <span className="font-semibold">
                {v.cycle.retestReason === 'clinician' ? t({ en: 'Your doctor asked for a repeat test by', ar: 'طلب طبيبك إعادة التحليل قبل' }) : t({ en: 'A repeat lab test makes sense from', ar: 'تكون إعادة التحليل المخبري مناسبة من' })}{' '}
                {fmtDay(v.cycle.retestDue, lang)}
              </span>
            </p>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => downloadIcs('reminder', [{ id: `retest-${v.cycle.retestDue}`, title: t({ en: 'Reminder', ar: 'تذكير' }), start: v.cycle.retestDue as string }])}>
              <BellPlus className="h-4 w-4" aria-hidden />
              {t({ en: 'Add a discreet reminder', ar: 'أضف تذكيراً متحفظاً' })}
            </button>
          </div>
        )}
      </section>

          </div>
          <div data-tour="week" className="order-3">
      {/* ---------- This week ---------- */}
      <section className="surface surface-pad flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between lg:flex-col lg:items-stretch">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <ClipboardCheck className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          </span>
          <div className="space-y-0.5">
            <h2 className="text-base font-semibold text-ink">{thisWeekDue ? t({ en: 'This week’s check-in', ar: 'تسجيل هذا الأسبوع' }) : t({ en: 'This week is done', ar: 'اكتمل هذا الأسبوع' })}</h2>
            <p className="text-sm text-muted">
              {thisWeekDue
                ? t({ en: 'Four taps, about 20 seconds. It starts with a quick safety question.', ar: 'أربع نقرات، نحو 20 ثانية، وتبدأ بسؤال سريع عن السلامة.' })
                : latest
                  ? `${habitCount(latest, female)} ${female ? t({ en: 'of 3 helpful habits', ar: 'من 3 عادات مفيدة' }) : t({ en: 'of 4 helpful habits', ar: 'من 4 عادات مفيدة' })} · ${t({ en: 'streak', ar: 'متتالية' })} ${streak(c.checkins, c.today)} ${t({ en: 'weeks', ar: 'أسابيع' })}`
                  : ''}
            </p>
          </div>
        </div>
        <Link to="/me/check-in" className={`btn ${thisWeekDue ? 'btn-primary' : 'btn-secondary'} shrink-0`}>
          {thisWeekDue ? t({ en: 'Start check-in', ar: 'ابدأ التسجيل' }) : t({ en: 'Update', ar: 'تحديث' })}
        </Link>
      </section>

          </div>
          <div className="order-4 flex flex-col gap-6 empty:hidden">
      <HeatCard city={c.work?.city} allowed={!!c.work?.heatAlerts && consents.is('weather') === true} outdoor={!!c.work && ['outdoor', 'oil_gas', 'agri_pest', 'metal_weld', 'driver', 'security', 'kitchen_laundry'].includes(c.work.occupation)} />

      {c.signals.length >= 14 && <PhoneTile signals={c.signals} />}

          </div>
          <div className="order-7">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
        {(
          [
            ...(female
              ? [{ to: '/me/results?add=1', icon: ClipboardCheck, title: { en: 'Add a result', ar: 'أضيفي نتيجة' }, body: { en: 'AMH and hormones, blood pressure, weight or HbA1c.', ar: 'AMH والهرمونات، أو ضغط الدم، أو الوزن، أو السكر التراكمي.' } }]
              : [
                  { to: '/me/results?add=1', icon: ClipboardCheck, title: { en: 'Add a result', ar: 'أضف نتيجة' }, body: { en: 'Blood pressure, weight, HbA1c, testosterone or a semen analysis.', ar: 'ضغط الدم أو الوزن أو السكر التراكمي أو التستوستيرون أو تحليل السائل المنوي.' } },
                  { to: '/report', icon: ScanLine, title: { en: 'Read a lab report photo', ar: 'اقرأ صورة تقرير مختبر' }, body: { en: 'The AI copies the numbers, you check them.', ar: 'ينسخ الذكاء الاصطناعي الأرقام وتتحقق أنت منها.' } },
                ]),
            { to: '/invite', icon: HeartHandshake, title: { en: 'Invite your partner or a friend', ar: 'ادعُ شريكتك أو صديقاً' }, body: { en: 'A private link; nobody sees whether it is used.', ar: 'رابط خاص، ولا يعرف أحد إن استُخدم.' } },
          ] satisfies { to: string; icon: LucideIcon; title: L10n; body: L10n }[]
        ).map((x) => (
          <Link key={x.to} to={x.to} className="surface group flex items-start gap-3 p-4 transition-shadow hover:shadow-lg">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-canvas text-brand-700 ring-1 ring-inset ring-line">
              <x.icon className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-[15px] font-semibold text-ink">{t(x.title)}</span>
              <span className="block text-sm text-muted">{t(x.body)}</span>
            </span>
          </Link>
        ))}
      </section>
          </div>
        </aside>
      </div>
    </CompanionShell>
  )
}

const rank = (f: { level: string }) => (f.level === 'info' ? -1 : LEVEL_RANK[f.level as keyof typeof LEVEL_RANK])

function HeatCard({ city, allowed, outdoor }: { city?: (typeof CITIES)[number]['value']; allowed: boolean; outdoor: boolean }) {
  const { t } = useI18n()
  const heat = useHeat(city, allowed)
  if (!city || !allowed) return null
  const place = CITIES.find((x) => x.value === city)
  const lvl = heat && heat !== 'loading' ? heatLevel(heat) : 'none'
  return (
    <section className={`surface surface-pad flex items-start gap-3 ${lvl !== 'none' ? 'border-amber-200 bg-amber-50/60' : ''}`}>
      <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${lvl !== 'none' ? 'bg-amber-100 text-amber-700' : 'bg-canvas text-muted ring-1 ring-inset ring-line'}`}>
        {lvl !== 'none' ? <Flame className="h-5 w-5" aria-hidden /> : <ThermometerSun className="h-5 w-5" aria-hidden />}
      </span>
      <div className="min-w-0 space-y-1 text-sm">
        <p className="font-semibold text-ink">
          {place ? t(place.label) : ''} {t({ en: 'today', ar: 'اليوم' })}
          {heat === 'loading' && <span className="font-normal text-muted"> · {t({ en: 'checking…', ar: 'جارٍ التحقق…' })}</span>}
          {heat && heat !== 'loading' && (
            <span className="font-normal text-muted">
              {' '}
              · {Math.round(heat.maxC)}°C, {t({ en: 'feels like', ar: 'كأنها' })} {Math.round(heat.feelsC)}°C
            </span>
          )}
        </p>
        {heat === null && <p className="text-muted">{t({ en: 'The weather service did not answer. Try again later.', ar: 'لم تستجب خدمة الطقس. حاول لاحقاً.' })}</p>}
        {heat && heat !== 'loading' && (
          <p className="text-body">
            {lvl === 'none'
              ? t({ en: 'No heat warning today.', ar: 'لا يوجد تحذير من الحرارة اليوم.' })
              : outdoor
                ? t({ en: 'Strong heat for outdoor work: take shaded, cool breaks, drink water often, and keep to the midday break.', ar: 'حرارة شديدة للعمل في الخارج: خذ فترات راحة باردة في الظل، واشرب الماء كثيراً، والتزم باستراحة منتصف النهار.' })
                : t({ en: 'Strong heat today: stay cool and drink water.', ar: 'حرارة شديدة اليوم: ابقَ في مكان بارد واشرب الماء.' })}
          </p>
        )}
        <p className="text-xs text-faint">
          <a href="https://open-meteo.com/" target="_blank" rel="noreferrer noopener" className="underline-offset-2 hover:underline">
            Weather data by Open-Meteo.com
          </a>{' '}
          · {t({ en: 'Only your city was sent.', ar: 'أُرسلت مدينتك فقط.' })}
        </p>
      </div>
    </section>
  )
}

function weekly(values: { date: string; v?: number }[]): number[] {
  const out: number[] = []
  const sorted = values.filter((x) => x.v !== undefined).sort((a, b) => a.date.localeCompare(b.date))
  for (let i = 0; i < sorted.length; i += 7) {
    const chunk = sorted.slice(i, i + 7)
    out.push(chunk.reduce((a, x) => a + (x.v as number), 0) / chunk.length)
  }
  return out
}

function PhoneTile({ signals }: { signals: { date: string; steps?: number; sleepH?: number; restingHr?: number }[] }) {
  const { t } = useI18n()
  const tiles = [
    { key: 'steps', label: { en: 'Steps a day', ar: 'خطوات يومياً' }, values: weekly(signals.map((s) => ({ date: s.date, v: s.steps }))), fmt: (n: number) => Math.round(n).toLocaleString() },
    { key: 'sleep', label: { en: 'Sleep a night', ar: 'نوم في الليلة' }, values: weekly(signals.map((s) => ({ date: s.date, v: s.sleepH }))), fmt: (n: number) => `${n.toFixed(1)} h` },
    { key: 'hr', label: { en: 'Resting heart rate', ar: 'نبض القلب أثناء الراحة' }, values: weekly(signals.map((s) => ({ date: s.date, v: s.restingHr }))), fmt: (n: number) => `${Math.round(n)} bpm` },
  ].filter((x) => x.values.length >= 2)
  if (!tiles.length) return null
  return (
    <section className="surface surface-pad space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
          <Smartphone className="h-4 w-4 text-brand-600" aria-hidden />
          {t({ en: 'From your phone', ar: 'من هاتفك' })}
        </h2>
        <Link to="/me/habits" className="text-sm font-semibold text-brand-700 hover:underline">
          {t({ en: 'Details', ar: 'التفاصيل' })}
        </Link>
      </div>
      <ul className="grid gap-3 sm:grid-cols-3">
        {tiles.map((x) => (
          <li key={x.key} className="rounded-lg border border-line px-3.5 py-3">
            <p className="text-xs font-medium text-muted">{t(x.label)}</p>
            <div className="mt-1 flex items-end justify-between gap-2">
              <p className="text-xl font-semibold text-ink">{x.fmt(x.values[x.values.length - 1])}</p>
              <Sparkline values={x.values} width={92} height={28} label={`${t(x.label)}: ${x.values.map(x.fmt).join(', ')}`} />
            </div>
            <p className="mt-0.5 text-xs text-faint">
              {t({ en: 'was', ar: 'كان' })} {x.fmt(x.values[0])} · {t({ en: 'weekly averages', ar: 'متوسطات أسبوعية' })}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Onboarding() {
  const { t } = useI18n()
  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-10 sm:px-6">
      <div className="space-y-3">
        <p className="eyebrow">{t({ en: 'Your private companion', ar: 'رفيقك الخاص' })}</p>
        <h1 className="title">{t({ en: 'Turn one check into a 90-day plan', ar: 'حوّل فحصاً واحداً إلى خطة لتسعين يوماً' })}</h1>
        <p className="lead">
          {t({
            en: 'Reproductive health changes over months, not days. The companion follows that rhythm: a 20-second weekly check-in, your cycle and results over time, your work, and a care journey that ends in a booked appointment. All of it stays on this phone.',
            ar: 'تتغير الصحة الإنجابية على مدى أشهر لا أيام، ويتبع الرفيق هذا الإيقاع: تسجيل أسبوعي في 20 ثانية، ودورتك ونتائجك مع الوقت، وعملك، ورحلة رعاية تنتهي بموعد محجوز. ويبقى كل ذلك على هذا الهاتف.',
          })}
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link to="/check" className="btn btn-primary btn-lg">
          {t({ en: 'Start with the 5-minute check', ar: 'ابدأ بالفحص ذي الخمس دقائق' })}
          <ArrowRight className="icon-dir h-4 w-4" aria-hidden />
        </Link>
      </div>
      <section className="space-y-3">
        <h2 className="heading">{t({ en: 'Or explore an example person', ar: 'أو استكشف شخصاً نموذجياً' })}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {PERSONAS.map((p) => (
            <Link key={p.id} to={`/try/${p.id}`} className="surface group flex flex-col gap-2 p-5 transition-shadow hover:shadow-lg">
              <span className="flex items-center justify-between">
                <span className="text-base font-semibold text-ink">{t(p.name)}</span>
                <ArrowRight className="icon-dir h-4 w-4 text-faint" aria-hidden />
              </span>
              <span className="text-sm text-muted">{t(p.summary)}</span>
              <span className="text-xs text-faint">{t({ en: 'Invented data. Your own data is not touched.', ar: 'بيانات مختلقة، ولا تُمسّ بياناتك.' })}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
