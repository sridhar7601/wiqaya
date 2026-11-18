import { Check, FileUp, LockKeyhole, Minus, Smartphone, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { CHART, TrendChart } from '../../components/charts'
import { Callout, Finding, Switch } from '../../components/ui'
import { byWeek, HABIT_LABEL, habitKeys, habitsOf } from '../../lib/companion/checkins'
import type { Habits as HabitSet } from '../../lib/companion/checkins'
import { useConsents } from '../../lib/companion/consents'
import { fmtDay, weekStart } from '../../lib/companion/dates'
import { CITIES, EXTRA_EXPOSURES, exposureFlags, OCCUPATIONS } from '../../lib/companion/exposures'
import type { City, Exposure, Occupation, WorkProfile } from '../../lib/companion/exposures'
import { useCompanion } from '../../lib/companion/useCompanion'
import { useI18n } from '../../lib/i18n'
import { importAppleHealth } from '../../lib/signals/appleHealth'
import type { AppleHealthError } from '../../lib/signals/appleHealth'
import { sexOf } from '../../lib/types'
import type { Sex } from '../../lib/types'
import { CompanionShell } from './Shell'

export default function Habits() {
  const { t, lang } = useI18n()
  const c = useCompanion()
  const weeks = byWeek(c.checkins).slice(0, 12)
  const female = sexOf(c.answers) === 'female'
  const keys: (keyof HabitSet)[] = habitKeys(female)
  // Weekly averages: daily phone data is noisy, and a week is the rhythm of the check-ins.
  const series = (k: 'steps' | 'sleepH' | 'restingHr') => {
    const byWeekStart = new Map<string, number[]>()
    for (const s of c.signals) if (s[k] !== undefined) byWeekStart.set(weekStart(s.date), [...(byWeekStart.get(weekStart(s.date)) ?? []), s[k] as number])
    return [...byWeekStart.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, value: Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 }))
  }

  return (
    <CompanionShell title={t({ en: 'Habits & work', ar: 'العادات والعمل' })} intro={female ? t({ en: 'What you do every week, and what your work exposes you to. Both shape your cycles and your health before a pregnancy.', ar: 'ما تفعلينه كل أسبوع، وما يعرّضك له عملك؛ وكلاهما يؤثر على دورتك وصحتك قبل الحمل.' }) : t({ en: 'What you do every week, and what your work exposes you to. Both shape the sperm of the next three months.', ar: 'ما تفعله كل أسبوع، وما يعرّضك له عملك؛ وكلاهما يؤثر على الحيوانات المنوية في الأشهر الثلاثة القادمة.' })}>
      {/* ---------- Weekly habits ---------- */}
      <section className="surface overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 className="text-base font-semibold text-ink">{t({ en: 'Weekly check-ins', ar: 'التسجيلات الأسبوعية' })}</h2>
          <Link to="/me/check-in" className="btn btn-primary btn-sm">
            {t({ en: 'This week’s check-in', ar: 'تسجيل هذا الأسبوع' })}
          </Link>
        </div>
        {weeks.length === 0 ? (
          <p className="px-5 py-5 text-sm text-muted">{t({ en: 'No check-ins yet.', ar: 'لا توجد تسجيلات بعد.' })}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t({ en: 'Week of', ar: 'أسبوع' })}</th>
                  {keys.map((k) => (
                    <th key={k} className="text-center">
                      {t(HABIT_LABEL[k])}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weeks.map((w) => {
                  const h = habitsOf(w)
                  return (
                    <tr key={w.week}>
                      <td className="whitespace-nowrap">{fmtDay(w.week, lang, false)}</td>
                      {keys.map((k) => (
                        <td key={k} className="text-center">
                          {h[k] ? <Check className="mx-auto h-4 w-4 text-emerald-600" aria-label={t({ en: 'yes', ar: 'نعم' })} /> : <Minus className="mx-auto h-4 w-4 text-faint" aria-label={t({ en: 'no', ar: 'لا' })} />}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ---------- From the phone ---------- */}
      <section className="surface overflow-hidden">
        <div className="flex items-start gap-3 border-b border-line px-5 py-4">
          <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden />
          <div className="min-w-0 space-y-1">
            <h2 className="text-base font-semibold text-ink">{t({ en: 'Steps, sleep and heart rate from your phone', ar: 'الخطوات والنوم ونبض القلب من هاتفك' })}</h2>
            <p className="text-sm text-muted">
              {t({
                en: 'Import your Apple Health export. It is read on this phone; only daily totals are kept, and nothing is uploaded.',
                ar: 'استورد ملف التصدير من تطبيق «صحتي» من Apple. يُقرأ على هذا الهاتف، ولا يُحفظ إلا المجموع اليومي، ولا يُرفع شيء.',
              })}
            </p>
          </div>
        </div>
        {c.signals.length > 0 ? (
          <div className="space-y-5 px-5 py-5">
            <p className="text-sm text-muted">
              {t({ en: `${c.signals.length} days`, ar: `${c.signals.length} يوماً` })} · {fmtDay(c.signals[0].date, lang)} – {fmtDay(c.signals[c.signals.length - 1].date, lang)}
              {c.signalsSource ? ` · ${t({ en: 'imported', ar: 'استُورد' })} ${fmtDay(c.signalsSource.importedAt.slice(0, 10), lang)}` : ''}
            </p>
            <div className="grid gap-5 sm:grid-cols-3">
              {(
                [
                  ['steps', { en: 'Steps a day (weekly average)', ar: 'خطوات يومياً (متوسط أسبوعي)' }, ''],
                  ['sleepH', { en: 'Sleep, hours (weekly average)', ar: 'النوم بالساعات (متوسط أسبوعي)' }, 'h'],
                  ['restingHr', { en: 'Resting heart rate (weekly average)', ar: 'نبض الراحة (متوسط أسبوعي)' }, 'bpm'],
                ] as const
              ).map(([k, label, unit]) =>
                series(k).length > 1 ? (
                  <figure key={k} className="min-w-0 space-y-1">
                    <figcaption className="text-sm font-medium text-ink">{t(label)}</figcaption>
                    <TrendChart series={[{ id: k, label: t(label), color: CHART.s1, points: series(k) }]} unit={unit} lang={lang} title={t(label)} height={150} />
                  </figure>
                ) : null,
              )}
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-red-600 hover:text-red-700"
              onClick={() => {
                if (!window.confirm(t({ en: 'Remove the imported phone data from this device?', ar: 'هل تريد إزالة بيانات الهاتف المستوردة من هذا الجهاز؟' }))) return
                c.setSignals([])
                c.setSignalsSource(null)
              }}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              {t({ en: 'Remove imported data', ar: 'أزل البيانات المستوردة' })}
            </button>
          </div>
        ) : (
          <PhoneImport
            onDone={(days) => {
              c.setSignals(days)
              c.setSignalsSource({ kind: 'apple-health', importedAt: new Date().toISOString() })
            }}
          />
        )}
      </section>

      {/* ---------- Work ---------- */}
      <WorkSection work={c.work} setWork={c.setWork} sex={sexOf(c.answers)} />
    </CompanionShell>
  )
}

function PhoneImport({ onDone }: { onDone: (days: Awaited<ReturnType<typeof importAppleHealth>>['days']) => void }) {
  const { t } = useI18n()
  const input = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [problem, setProblem] = useState<AppleHealthError | 'other' | null>(null)
  const ctl = useRef<AbortController | null>(null)

  const run = async (file: Blob) => {
    setProblem(null)
    setProgress(0)
    ctl.current = new AbortController()
    try {
      const r = await importAppleHealth(file, { sinceDays: 180, onProgress: setProgress, signal: ctl.current.signal })
      setProgress(null)
      if (!r.days.length) setProblem('not_apple_health')
      else onDone(r.days)
    } catch (e) {
      setProgress(null)
      const code = e instanceof Error ? e.message : ''
      setProblem(code === 'not_apple_health' || code === 'no_export_xml' || code === 'bad_zip' || code === 'aborted' ? code : 'other')
    }
  }
  const sample = async () => {
    const res = await fetch(`${import.meta.env.BASE_URL}samples/apple-health-sample.zip`)
    if (res.ok) await run(await res.blob())
  }

  return (
    <div className="space-y-4 px-5 py-5">
      <ol className="list-decimal space-y-1 ps-5 text-sm text-body">
        <li>{t({ en: 'On your iPhone, open Health, tap your picture, then “Export All Health Data”.', ar: 'على iPhone افتح تطبيق «صحتي»، واضغط على صورتك، ثم «تصدير جميع البيانات الصحية».' })}</li>
        <li>{t({ en: 'Save the file, then choose it here.', ar: 'احفظ الملف، ثم اختره هنا.' })}</li>
      </ol>
      {progress !== null ? (
        <div className="space-y-2" role="status" aria-live="polite">
          <div className="h-2 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-brand-600 transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <p className="flex items-center justify-between text-sm text-muted">
            <span>{t({ en: 'Reading on this phone…', ar: 'جارٍ القراءة على هذا الهاتف…' })} {Math.round(progress * 100)}%</span>
            <button type="button" className="font-medium text-ink hover:underline" onClick={() => ctl.current?.abort()}>
              {t({ en: 'Cancel', ar: 'إلغاء' })}
            </button>
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => input.current?.click()}>
            <FileUp className="h-4 w-4" aria-hidden />
            {t({ en: 'Choose the export file', ar: 'اختر ملف التصدير' })}
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void sample()}>
            {t({ en: 'Try a sample export', ar: 'جرّب ملف تصدير نموذجياً' })}
          </button>
        </div>
      )}
      <input
        ref={input}
        type="file"
        accept=".zip,.xml,application/zip,text/xml"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void run(f)
          e.target.value = ''
        }}
      />
      {problem && problem !== 'aborted' && (
        <Callout tone="warn">
          {problem === 'not_apple_health'
            ? t({ en: 'This does not look like an Apple Health export.', ar: 'لا يبدو هذا ملف تصدير من «صحتي».' })
            : problem === 'no_export_xml'
              ? t({ en: 'The zip has no export.xml inside. Please export again from the Health app.', ar: 'لا يحتوي الملف المضغوط على export.xml. يُرجى التصدير مجدداً من تطبيق «صحتي».' })
              : t({ en: 'The file could not be read. It may be damaged or incomplete.', ar: 'تعذّرت قراءة الملف، فقد يكون تالفاً أو غير مكتمل.' })}
        </Callout>
      )}
      <p className="flex items-center gap-1.5 text-xs text-muted">
        <LockKeyhole className="h-3.5 w-3.5" aria-hidden />
        {t({ en: 'Android phones (Health Connect) need the app version, planned for the pilot.', ar: 'هواتف Android (Health Connect) تحتاج إلى نسخة التطبيق، المخطط لها في المرحلة التجريبية.' })}
      </p>
    </div>
  )
}

function WorkSection({ work, setWork, sex }: { work: WorkProfile | null; setWork: (w: WorkProfile | null) => void; sex: Sex }) {
  const { t } = useI18n()
  const consents = useConsents()
  const w: WorkProfile = work ?? { occupation: 'other', nightShifts: false, extra: [], heatAlerts: false, updatedAt: '' }
  const update = (patch: Partial<WorkProfile>) => setWork({ ...w, ...patch, updatedAt: new Date().toISOString() })
  const flags = exposureFlags(work, sex)
  const occ = OCCUPATIONS.find((o) => o.value === w.occupation)

  return (
    <section className="surface overflow-hidden">
      <div className="space-y-1 border-b border-line px-5 py-4">
        <h2 className="text-base font-semibold text-ink">{t({ en: 'Your work and environment', ar: 'عملك وبيئتك' })}</h2>
        <p className="text-sm text-muted">{t({ en: 'Never shared unless you tick it in a summary for your doctor.', ar: 'لا يُشارك إلا إذا اخترته في ملخص لطبيبك.' })}</p>
      </div>
      <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
        <label className="grid gap-1.5 sm:col-span-2">
          <span className="text-sm font-medium text-ink">{t({ en: 'What kind of work do you do?', ar: 'ما نوع عملك؟' })}</span>
          <select className="input" value={w.occupation} onChange={(e) => update({ occupation: e.target.value as Occupation })}>
            {OCCUPATIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {t(o.label)}
              </option>
            ))}
          </select>
        </label>
        <div className="sm:col-span-2">
          <Switch checked={w.nightShifts} onChange={(v) => update({ nightShifts: v })} label={t({ en: 'I work night or rotating shifts', ar: 'أعمل بمناوبات ليلية أو متغيرة' })} />
        </div>
        <fieldset className="space-y-2 sm:col-span-2">
          <legend className="text-sm font-medium text-ink">{t({ en: 'Anything else at work or home?', ar: 'أي شيء آخر في العمل أو المنزل؟' })}</legend>
          <div className="flex flex-wrap gap-2">
            {EXTRA_EXPOSURES.filter((x) => !occ?.exposures.includes(x.value)).map((x) => {
              const on = w.extra.includes(x.value)
              return (
                <button key={x.value} type="button" aria-pressed={on} onClick={() => update({ extra: on ? w.extra.filter((e) => e !== x.value) : [...w.extra, x.value as Exposure] })} className={`inline-flex min-h-9 items-center rounded-full border px-3.5 py-1.5 text-sm font-medium ${on ? 'border-brand-700 bg-brand-50 text-brand-800' : 'border-line-strong bg-white text-body hover:bg-canvas'}`}>
                  {t(x.label)}
                </button>
              )
            })}
          </div>
        </fieldset>
        <label className="grid gap-1.5">
          <span className="text-sm font-medium text-ink">{t({ en: 'City, for heat alerts', ar: 'المدينة، لتنبيهات الحرارة' })}</span>
          <select className="input" value={w.city ?? ''} onChange={(e) => update({ city: (e.target.value || undefined) as City | undefined })}>
            <option value="">{t({ en: 'Not set', ar: 'غير محددة' })}</option>
            {CITIES.map((x) => (
              <option key={x.value} value={x.value}>
                {t(x.label)}
              </option>
            ))}
          </select>
        </label>
        <div className="self-end pb-1">
          <Switch
            checked={w.heatAlerts && consents.is('weather') === true}
            disabled={!w.city}
            onChange={(v) => {
              consents.set('weather', v, 'settings')
              update({ heatAlerts: v })
            }}
            label={t({ en: 'Show heat alerts', ar: 'أظهر تنبيهات الحرارة' })}
            description={t({ en: 'Sends only the city to Open-Meteo, a public weather service.', ar: 'تُرسل المدينة فقط إلى Open-Meteo، وهي خدمة طقس عامة.' })}
          />
        </div>
      </div>
      {flags.length > 0 && (
        <div className="divide-y divide-line border-t border-line">
          {flags.map((f) => (
            <Finding key={f.id} flag={f} />
          ))}
        </div>
      )}
      <p className="border-t border-line px-5 py-3 text-xs text-muted">
        {t({ en: 'UAE midday work break: no work in direct sun or open places from 12:30 to 3:00 pm, 15 June to 15 September (Ministry of Human Resources and Emiratisation).', ar: 'استراحة منتصف النهار في الإمارات: لا عمل تحت أشعة الشمس المباشرة أو في الأماكن المكشوفة من 12:30 إلى 3:00 عصراً، من 15 يونيو إلى 15 سبتمبر (وزارة الموارد البشرية والتوطين).' })}
      </p>
    </section>
  )
}
