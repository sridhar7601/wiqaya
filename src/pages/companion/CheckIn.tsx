import { Check, Phone, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ACTIVE_CHOICES, HEAT_CHOICES, NICOTINE_CHOICES, RED_FLAG_CHOICES, RED_FLAG_CHOICES_F, SLEEP_CHOICES, upsertCheckIn } from '../../lib/companion/checkins'
import type { Active, CheckIn as CheckInT, Choice, HeatDays, Nicotine, RedFlag, Sleep } from '../../lib/companion/checkins'
import { addDays, weekStart } from '../../lib/companion/dates'
import type { Day } from '../../lib/companion/dates'
import { newEntry, sortLabs } from '../../lib/companion/labs'
import { useCompanion } from '../../lib/companion/useCompanion'
import { useI18n } from '../../lib/i18n'
import { rid } from '../../lib/storage'
import { sexOf } from '../../lib/types'
import { CompanionShell } from './Shell'

function Pick<T extends string>({ label, choices, value, onChange }: { label: string; choices: Choice<T>[]; value: T | undefined; onChange: (v: T) => void }) {
  const { t } = useI18n()
  return (
    <fieldset className="space-y-2">
      <legend className="text-[15px] font-semibold text-ink">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {choices.map((c) => (
          <button
            key={c.value}
            type="button"
            aria-pressed={value === c.value}
            onClick={() => onChange(c.value)}
            className={`inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors ${value === c.value ? 'border-brand-700 bg-brand-800 text-white' : 'border-line-strong bg-white text-ink hover:bg-canvas'}`}
          >
            {value === c.value && <Check className="h-4 w-4" aria-hidden />}
            {t(c.label)}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

/** The weekly 20-second check-in. */
export default function CheckIn() {
  const { t } = useI18n()
  const nav = useNavigate()
  const c = useCompanion()
  const week = weekStart(c.today)
  const prev = c.checkins.find((x) => x.week === week)
  const [red, setRed] = useState<RedFlag[] | null>(prev ? prev.redFlags : null)
  const female = sexOf(c.answers) === 'female'
  // Heat matters for sperm, not eggs, so a woman's check-in skips it.
  const [heat, setHeat] = useState<HeatDays | undefined>(prev?.heatDays ?? (female ? '0' : undefined))
  const [period, setPeriod] = useState<'no' | 'yes' | undefined>(prev ? (prev.periodStart ? 'yes' : 'no') : undefined)
  const [periodDay, setPeriodDay] = useState<Day>(prev?.periodStart ?? c.today)
  const [nic, setNic] = useState<Nicotine | undefined>(prev?.nicotine)
  const [sleep, setSleep] = useState<Sleep | undefined>(prev?.sleep)
  const [active, setActive] = useState<Active | undefined>(prev?.active)
  const [weight, setWeight] = useState(prev?.weightKg ? String(prev.weightKg) : '')
  const [sys, setSys] = useState(prev?.sys ? String(prev.sys) : '')
  const [dia, setDia] = useState(prev?.dia ? String(prev.dia) : '')

  const num = (s: string, min: number, max: number) => {
    const n = Number(s.replace(',', '.'))
    return s.trim() && Number.isFinite(n) && n >= min && n <= max ? n : undefined
  }
  const w = num(weight, 30, 350)
  const bs = num(sys, 60, 260)
  const bd = num(dia, 30, 160)
  const ready = red !== null && heat && nic && sleep && active && (!female || period)
  const emergency = red?.some((v) => v === 'sudden_pain' || v === 'ectopic_signs')
  const lastWeekDay = addDays(week, 6) < c.today ? addDays(week, 6) : c.today

  const save = () => {
    if (!ready) return
    const entry: CheckInT = { id: prev?.id ?? rid('ci-'), week, at: new Date().toISOString(), redFlags: red, heatDays: heat, nicotine: nic, sleep, active, weightKg: w, sys: bs, dia: bd, periodStart: female && period === 'yes' ? periodDay : undefined }
    c.setCheckins((list) => upsertCheckIn(list, entry))
    if (bs !== undefined && bd !== undefined) c.setLabs((l) => sortLabs([...l, newEntry('bp', c.today, { sys: bs, dia: bd }, 'checkin')]))
    nav('/me')
  }

  return (
    <CompanionShell title={t({ en: 'Weekly check-in', ar: 'التسجيل الأسبوعي' })} intro={t({ en: 'About this week. Your answers stay on this phone.', ar: 'عن هذا الأسبوع. تبقى إجاباتك على هذا الهاتف.' })}>
      <section className="surface surface-pad space-y-6">
        <fieldset className="space-y-2">
          <legend className="text-[15px] font-semibold text-ink">{t({ en: 'First, a quick safety check. Do you have any of these right now?', ar: female ? 'أولاً، فحص سريع للسلامة. هل تعانين الآن من أيٍّ مما يلي؟' : 'أولاً، فحص سريع للسلامة. هل تعاني الآن من أيٍّ مما يلي؟' })}</legend>
          <div className="grid gap-2">
            {(female ? RED_FLAG_CHOICES_F : RED_FLAG_CHOICES).map((r) => {
              const on = red?.includes(r.value) ?? false
              return (
                <button key={r.value} type="button" className="option" aria-pressed={on} onClick={() => setRed((x) => (x?.includes(r.value) ? x.filter((y) => y !== r.value) : [...(x ?? []), r.value]))}>
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${on ? 'border-red-600 bg-red-600 text-white' : 'border-line-strong bg-white'}`} aria-hidden>
                    {on && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                  </span>
                  {t(r.label)}
                </button>
              )
            })}
            <button type="button" className="option" aria-pressed={red !== null && red.length === 0} onClick={() => setRed([])}>
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${red !== null && red.length === 0 ? 'border-brand-700 bg-brand-700 text-white' : 'border-line-strong bg-white'}`} aria-hidden>
                {red !== null && red.length === 0 && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
              </span>
              {t({ en: 'None of these', ar: 'لا شيء مما سبق' })}
            </button>
          </div>
        </fieldset>

        {red && red.length > 0 && (
          <div className="space-y-3 rounded-xl border border-red-200 bg-red-50/70 p-4">
            <p className="flex items-start gap-2 font-semibold text-red-950">
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden />
              {emergency
                ? t({ en: 'This could be an emergency. Call 998 or go to the nearest emergency department now.', ar: 'قد تكون هذه حالة طارئة. اتصل بالرقم 998 أو توجّه إلى أقرب قسم طوارئ الآن.' })
                : female
                ? t({ en: 'Please get this checked today, at urgent care or an emergency department. Call 998 if you feel faint.', ar: 'يُرجى فحص ذلك اليوم، في الرعاية العاجلة أو قسم الطوارئ. اتصلي بالرقم 998 إذا شعرتِ بإغماء.' })
                : t({ en: 'Please see a doctor about this soon: the same day for painful swelling with fever, within days for a new lump.', ar: 'يُرجى مراجعة طبيب قريباً: في اليوم نفسه للتورم المؤلم مع الحرارة، وخلال أيام للكتلة الجديدة.' })}
            </p>
            {emergency && (
              <a href="tel:998" className="btn btn-danger w-full">
                <Phone className="h-4 w-4" aria-hidden />
                {t({ en: 'Call 998 (ambulance)', ar: 'اتصل بالرقم 998 (الإسعاف)' })}
              </a>
            )}
            <p className="text-sm text-red-950/80">{t({ en: 'Finish the check-in if you can: your care journey will show this at the top.', ar: 'أكمل التسجيل إن استطعت، وستظهر هذه الحالة في أعلى رحلة الرعاية.' })}</p>
          </div>
        )}

        {female ? (
          <div className="space-y-3">
            <Pick
              label={t({ en: 'Did a period start this week?', ar: 'هل بدأت دورتك الشهرية هذا الأسبوع؟' })}
              choices={[
                { value: 'no', label: { en: 'No', ar: 'لا' } },
                { value: 'yes', label: { en: 'Yes', ar: 'نعم' } },
              ]}
              value={period}
              onChange={setPeriod}
            />
            {period === 'yes' && (
              <label className="grid max-w-xs gap-1.5">
                <span className="text-sm font-medium text-ink">{t({ en: 'First day of bleeding', ar: 'أول يوم للنزيف' })}</span>
                <input type="date" className="input" min={week} max={lastWeekDay} value={periodDay} onChange={(e) => e.target.value && setPeriodDay(e.target.value as Day)} />
                <span className="text-xs text-muted">{t({ en: 'Over a few months this shows how long your cycles are, and whether that changes.', ar: 'على مدى بضعة أشهر يُظهر ذلك طول دوراتك، وما إذا كان يتغير.' })}</span>
              </label>
            )}
          </div>
        ) : (
          <Pick label={t({ en: 'Days in strong heat this week (outdoor work, ovens, sauna, long drives)', ar: 'أيام الحرارة الشديدة هذا الأسبوع (عمل في الخارج، أفران، سونا، قيادة طويلة)' })} choices={HEAT_CHOICES} value={heat} onChange={setHeat} />
        )}
        <Pick label={t({ en: 'Tobacco or nicotine (cigarettes, shisha, medwakh, vape)', ar: 'التبغ أو النيكوتين (سجائر، شيشة، مدواخ، سجائر إلكترونية)' })} choices={NICOTINE_CHOICES} value={nic} onChange={setNic} />
        <Pick label={t({ en: 'Sleep on most nights', ar: 'النوم في معظم الليالي' })} choices={SLEEP_CHOICES} value={sleep} onChange={setSleep} />
        <Pick label={t({ en: 'Days you were active for 30 minutes or more', ar: 'أيام النشاط لمدة 30 دقيقة أو أكثر' })} choices={ACTIVE_CHOICES} value={active} onChange={setActive} />

        <details className="group rounded-lg border border-line">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-ink">{t({ en: 'Optional: weight and a blood pressure reading', ar: 'اختياري: الوزن وقراءة ضغط الدم' })}</summary>
          <div className="grid gap-3 px-4 pb-4 sm:grid-cols-3">
            {(
              [
                [weight, setWeight, { en: 'Weight', ar: 'الوزن' }, { en: 'kg', ar: 'كغ' }],
                [sys, setSys, { en: 'Top number', ar: 'الرقم الأعلى' }, { en: 'mmHg', ar: 'ملم زئبق' }],
                [dia, setDia, { en: 'Bottom number', ar: 'الرقم الأدنى' }, { en: 'mmHg', ar: 'ملم زئبق' }],
              ] as const
            ).map(([val, set, label, unit]) => (
              <label key={label.en} className="grid gap-1.5">
                <span className="text-sm font-medium text-ink">{t(label)}</span>
                <span className="relative">
                  <input className="input pe-16 tabular-nums" inputMode="decimal" value={val} onChange={(e) => set(e.target.value)} />
                  <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-sm text-muted">{t(unit)}</span>
                </span>
              </label>
            ))}
          </div>
        </details>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" className="btn btn-primary btn-lg sm:flex-1" disabled={!ready} onClick={save}>
            {t({ en: 'Save this week', ar: 'احفظ هذا الأسبوع' })}
          </button>
          <Link to="/me" className="btn btn-secondary btn-lg">
            {t({ en: 'Cancel', ar: 'إلغاء' })}
          </Link>
        </div>
      </section>
    </CompanionShell>
  )
}
