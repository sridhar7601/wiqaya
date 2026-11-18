import { Plus, ScanLine, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { CHART, TrendChart } from '../../components/charts'
import type { Series, Threshold } from '../../components/charts'
import { ReportReader } from '../../components/ReportReader'
import { Callout, Finding, Sources } from '../../components/ui'
import { fmtDay, isDay } from '../../lib/companion/dates'
import { LAB_KINDS, newEntry, ngdlToNmol, ofKind, SOURCE_LABEL, sortLabs, validEntry } from '../../lib/companion/labs'
import type { LabEntry, LabKind } from '../../lib/companion/labs'
import { cycleLengths, weights } from '../../lib/companion/trends'
import { useCompanion } from '../../lib/companion/useCompanion'
import { num } from '../../lib/engine'
import { useI18n } from '../../lib/i18n'
import type { FiredFlag, Lang } from '../../lib/types'
import { sexOf } from '../../lib/types'
import { CompanionShell } from './Shell'

const KINDS_M: LabKind[] = ['semen', 'bp', 'weight', 'hba1c', 'testosterone']
const KINDS_F: LabKind[] = ['ovarian', 'bp', 'weight', 'hba1c']
const FLAG_PREFIX: Record<LabKind, string[]> = {
  semen: ['LT_SEMEN', 'LT_LENS', 'AN_SEMEN'],
  lens: ['LT_LENS'],
  ovarian: ['LT_AMH', 'LT_FSH', 'LT_TSH', 'GY_AMH', 'GY_FSH', 'GY_TSH', 'GY_POI'],
  bp: ['LT_BP'],
  weight: ['LT_WEIGHT'],
  hba1c: ['LT_HBA1C'],
  testosterone: ['LT_TESTOSTERONE'],
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

export default function Results() {
  const { t, lang } = useI18n()
  const c = useCompanion()
  const [params, setParams] = useSearchParams()
  const female = sexOf(c.answers) === 'female'
  const KINDS = female ? KINDS_F : KINDS_M
  const first = KINDS[0]
  const addKind = params.get('add')
  const adding = addKind === '1' ? first : (KINDS.find((k) => k === addKind) ?? null)
  const cycles = female ? cycleLengths(c.checkins) : []
  const openAdd = (k: LabKind | null) => setParams(k ? { add: k } : {}, { replace: true })
  const remove = (id: string) => {
    if (window.confirm(t({ en: 'Delete this result from your phone?', ar: 'هل تريد حذف هذه النتيجة من هاتفك؟' }))) c.setLabs((l) => l.filter((x) => x.id !== id))
  }
  const height = num(c.answers, 'height_cm')

  return (
    <CompanionShell
      title={t({ en: 'Results over time', ar: 'النتائج مع الوقت' })}
      intro={t({ en: 'Each value shows where it came from. Fixed rules compare them with published limits; a single result is never a diagnosis.', ar: 'تُظهر كل قيمة مصدرها. تقارنها قواعد ثابتة بالحدود المنشورة، ولا تعني نتيجة واحدة تشخيصاً أبداً.' })}
      action={
        !adding && (
          <button type="button" className="btn btn-primary" onClick={() => openAdd(first)}>
            <Plus className="h-4 w-4" aria-hidden />
            {t({ en: 'Add a result', ar: 'أضف نتيجة' })}
          </button>
        )
      }
    >
      {adding && (
        <AddResult
          kinds={KINDS}
          kind={adding}
          onKind={(k) => openAdd(k)}
          today={c.today}
          onSave={(e) => {
            c.setLabs((l) => sortLabs([...l, e]))
            openAdd(null)
          }}
          onCancel={() => openAdd(null)}
        />
      )}

      {KINDS.map((kind) => {
        const entries = kind === 'semen' ? [...ofKind(c.labs, 'semen'), ...ofKind(c.labs, 'lens')] : ofKind(c.labs, kind)
        const weightSeries = kind === 'weight' ? weights(c) : []
        if (!entries.length && !weightSeries.length) return null
        const flags = c.view.flags.filter((f) => FLAG_PREFIX[kind].some((p) => f.id.startsWith(p)))
        return <KindSection key={kind} kind={kind} entries={sortLabs(entries)} weightSeries={weightSeries} flags={flags} lang={lang} heightCm={height} onDelete={remove} onAdd={() => openAdd(kind)} />
      })}

      {female && <CycleSection cycles={cycles} flags={c.view.flags.filter((f) => f.id.startsWith('LT_CYCLE'))} lang={lang} />}

      {c.labs.length === 0 && !adding && (
        <section className="surface surface-pad space-y-3 text-center">
          <p className="text-body">{t({ en: 'No results yet. Add one by photo or by typing it in.', ar: 'لا توجد نتائج بعد. أضف نتيجة بالتصوير أو بالكتابة.' })}</p>
          <button type="button" className="btn btn-primary mx-auto" onClick={() => openAdd(first)}>
            <Plus className="h-4 w-4" aria-hidden />
            {t({ en: 'Add a result', ar: 'أضف نتيجة' })}
          </button>
        </section>
      )}
    </CompanionShell>
  )
}

function KindSection({ kind, entries, weightSeries, flags, lang, heightCm, onDelete, onAdd }: { kind: LabKind; entries: LabEntry[]; weightSeries: { date: string; kg: number }[]; flags: FiredFlag[]; lang: Lang; heightCm?: number; onDelete: (id: string) => void; onAdd: () => void }) {
  const { t } = useI18n()
  const info = LAB_KINDS[kind]
  const charts: { key: string; title: string; unit: string; series: Series[]; threshold?: Threshold | Threshold[] }[] = []
  const note = (e: LabEntry) => t(SOURCE_LABEL[e.source])

  if (kind === 'ovarian') {
    for (const f of info.fields) {
      const pts = entries.filter((e) => e.values[f.id] !== undefined)
      if (!pts.length) continue
      const threshold: Threshold | undefined =
        f.low !== undefined
          ? { value: f.low, side: 'below', label: `${t({ en: 'Reference point', ar: 'نقطة مرجعية' })} ${f.low}` }
          : f.high !== undefined
            ? { value: f.high, side: 'above', label: String(f.high) }
            : undefined
      charts.push({ key: f.id, title: t(f.label), unit: t(f.unit), series: [{ id: f.id, label: t(f.label), color: CHART.s1, points: pts.map((e) => ({ date: e.date, value: e.values[f.id], note: note(e) })) }], threshold })
    }
  } else if (kind === 'semen') {
    for (const f of info.fields) {
      const lab = entries.filter((e) => e.kind === 'semen' && e.values[f.id] !== undefined)
      const home = entries.filter((e) => e.kind === 'lens' && e.values[f.id] !== undefined)
      if (!lab.length && !home.length) continue
      const series: Series[] = [{ id: 'lab', label: t({ en: 'Lab test', ar: 'تحليل مخبري' }), color: CHART.s1, points: lab.map((e) => ({ date: e.date, value: e.values[f.id], note: note(e) })) }]
      if (home.length) series.push({ id: 'home', label: t({ en: 'Home estimate (Lens)', ar: 'تقدير منزلي (العدسة)' }), color: CHART.s2, hollow: true, points: home.map((e) => ({ date: e.date, value: e.values[f.id], note: note(e) })) })
      charts.push({ key: f.id, title: t(f.label), unit: t(f.unit), series: series.filter((s) => s.points.length), threshold: f.low !== undefined ? { value: f.low, side: 'below', label: `${t({ en: 'WHO lower limit', ar: 'الحد الأدنى للمنظمة' })} ${f.low}` } : undefined })
    }
  } else if (kind === 'bp') {
    charts.push({
      key: 'bp',
      title: t(info.label),
      unit: 'mmHg',
      series: [
        { id: 'sys', label: t({ en: 'Top number (systolic)', ar: 'الرقم الأعلى (الانقباضي)' }), color: CHART.s1, points: entries.map((e) => ({ date: e.date, value: e.values.sys, note: note(e) })) },
        { id: 'dia', label: t({ en: 'Bottom number (diastolic)', ar: 'الرقم الأدنى (الانبساطي)' }), color: CHART.s3, points: entries.map((e) => ({ date: e.date, value: e.values.dia, note: note(e) })) },
      ],
      threshold: [
        { value: 140, side: 'above', label: '140' },
        { value: 90, side: 'above', label: '90' },
      ],
    })
  } else if (kind === 'weight') {
    const bmi = (kg: number) => (heightCm ? `BMI ${(kg / (heightCm / 100) ** 2).toFixed(1)}` : undefined)
    charts.push({ key: 'w', title: t(info.label), unit: 'kg', series: [{ id: 'w', label: t(info.label), color: CHART.s1, points: weightSeries.map((w) => ({ date: w.date, value: w.kg, note: bmi(w.kg) })) }] })
  } else {
    const f = info.fields[0]
    charts.push({
      key: f.id,
      title: t(info.label),
      unit: t(f.unit),
      series: [{ id: f.id, label: t(info.label), color: CHART.s1, points: entries.map((e) => ({ date: e.date, value: e.values[f.id], note: note(e) })) }],
      threshold:
        kind === 'hba1c'
          ? [
              { value: 5.7, side: 'above', label: '5.7%' },
              { value: 6.5, side: 'above', label: '6.5%' },
            ]
          : f.low !== undefined
            ? { value: f.low, side: 'below', label: `${f.low} ${t(f.unit)}` }
            : undefined,
    })
  }

  return (
    <section className="surface overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0 space-y-1">
          <h2 className="text-base font-semibold text-ink">{t(info.label)}</h2>
          <p className="max-w-2xl text-sm text-muted">{t(info.refNote)}</p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onAdd}>
          <Plus className="h-4 w-4" aria-hidden />
          {t({ en: 'Add', ar: 'أضف' })}
        </button>
      </div>
      <div className={`grid gap-x-6 gap-y-5 px-5 py-5 ${charts.length > 1 ? 'sm:grid-cols-2' : ''}`}>
        {charts.map((ch) => (
          <figure key={ch.key} className="min-w-0 space-y-1">
            <figcaption className="text-sm font-medium text-ink">
              {ch.title} <span className="font-normal text-muted">({ch.unit})</span>
            </figcaption>
            <TrendChart series={ch.series} threshold={ch.threshold} unit={ch.unit} lang={lang} title={ch.title} height={charts.length > 1 ? 170 : 200} />
          </figure>
        ))}
      </div>
      {flags.length > 0 && (
        <div className="divide-y divide-line border-t border-line">
          {flags.map((f) => (
            <Finding key={f.id} flag={f} />
          ))}
        </div>
      )}
      {kind !== 'weight' && entries.length > 0 && (
        <details className="group border-t border-line">
          <summary className="cursor-pointer list-none px-5 py-3 text-sm font-medium text-muted hover:bg-canvas/70">
            {t({ en: `All values (${entries.length})`, ar: `كل القيم (${entries.length})` })}
          </summary>
          <ul className="divide-y divide-line border-t border-line">
            {[...entries].reverse().map((e) => (
              <li key={e.id} className="flex items-start justify-between gap-3 px-5 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-ink">
                    {fmtDay(e.date, lang)} · <span className="text-muted">{t(SOURCE_LABEL[e.source])}</span>
                  </p>
                  <p className="text-body tabular-nums">
                    {LAB_KINDS[e.kind].fields
                      .filter((f) => e.values[f.id] !== undefined)
                      .map((f) => `${t(f.label)} ${fmt(e.values[f.id])} ${t(f.unit)}`)
                      .join(' · ')}
                  </p>
                </div>
                <button type="button" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-faint hover:bg-red-50 hover:text-red-600" onClick={() => onDelete(e.id)}>
                  <Trash2 className="h-4 w-4" aria-hidden />
                  <span className="sr-only">{t({ en: 'Delete', ar: 'حذف' })}</span>
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
      <div className="border-t border-line px-5 py-3">
        <Sources ids={info.sources} />
      </div>
    </section>
  )
}

/** Cycle length over time, from the period starts in weekly check-ins. The usual range is shaded by its two lines. */
function CycleSection({ cycles, flags, lang }: { cycles: { start: string; days: number }[]; flags: FiredFlag[]; lang: Lang }) {
  const { t } = useI18n()
  return (
    <section className="surface overflow-hidden">
      <div className="space-y-1 border-b border-line px-5 py-4">
        <h2 className="text-base font-semibold text-ink">{t({ en: 'Cycle length', ar: 'طول الدورة' })}</h2>
        <p className="max-w-2xl text-sm text-muted">
          {t({
            en: 'From the period starts in your weekly check-ins. Most cycles are 21–35 days, and a change in your own pattern matters more than any single month.',
            ar: 'من بدايات الدورة في تسجيلاتك الأسبوعية. معظم الدورات بين 21 و35 يوماً، والتغيّر في نمطك أنتِ أهم من أي شهر منفرد.',
          })}
        </p>
      </div>
      <div className="px-5 py-5">
        {cycles.length >= 2 ? (
          <TrendChart
            series={[{ id: 'cycle', label: t({ en: 'Cycle length', ar: 'طول الدورة' }), color: CHART.s1, points: cycles.map((x) => ({ date: x.start, value: x.days })) }]}
            threshold={[
              { value: 35, side: 'above', label: '35' },
              { value: 21, side: 'below', label: '21' },
            ]}
            unit={t({ en: 'days', ar: 'يوماً' })}
            lang={lang}
            title={t({ en: 'Cycle length', ar: 'طول الدورة' })}
            height={190}
          />
        ) : (
          <p className="text-sm text-body">
            {t({
              en: 'Tick “a period started this week” in your weekly check-in. After three periods, your cycle lengths appear here.',
              ar: 'اختاري «بدأت الدورة هذا الأسبوع» في تسجيلك الأسبوعي. بعد ثلاث دورات، تظهر أطوال دوراتك هنا.',
            })}
          </p>
        )}
      </div>
      {flags.length > 0 && (
        <div className="divide-y divide-line border-t border-line">
          {flags.map((f) => (
            <Finding key={f.id} flag={f} />
          ))}
        </div>
      )}
      <div className="border-t border-line px-5 py-3">
        <Sources ids={['PCOS2023', 'FIGO2018']} />
      </div>
    </section>
  )
}

function AddResult({ kinds, kind, onKind, today, onSave, onCancel }: { kinds: LabKind[]; kind: LabKind; onKind: (k: LabKind) => void; today: string; onSave: (e: LabEntry) => void; onCancel: () => void }) {
  const { t } = useI18n()
  const [date, setDate] = useState(today)
  const [vals, setVals] = useState<Record<string, string>>({})
  const [ngdl, setNgdl] = useState(false)
  const [photo, setPhoto] = useState(false)
  const [error, setError] = useState(false)
  const info = LAB_KINDS[kind]

  const save = (values: Record<string, number>, source: LabEntry['source']) => {
    const e = newEntry(kind, isDay(date) ? date : today, values, source)
    if (!validEntry(e)) {
      setError(true)
      return
    }
    onSave(e)
  }
  const typed = () => {
    const values: Record<string, number> = {}
    for (const f of info.fields) {
      const raw = (vals[f.id] ?? '').trim().replace(',', '.')
      if (!raw) continue
      let n = Number(raw)
      if (kind === 'testosterone' && ngdl) n = ngdlToNmol(n)
      values[f.id] = n
    }
    save(values, 'typed')
  }

  return (
    <section className="surface surface-pad space-y-5 border-brand-200">
      <div className="flex flex-wrap items-center gap-2">
        {kinds.map((k) => (
          <button key={k} type="button" aria-pressed={k === kind} onClick={() => { onKind(k); setVals({}); setPhoto(false); setError(false) }} className={`inline-flex h-9 items-center rounded-full border px-3.5 text-sm font-medium ${k === kind ? 'border-brand-700 bg-brand-800 text-white' : 'border-line-strong bg-white text-body hover:bg-canvas'}`}>
            {t(LAB_KINDS[k].label)}
          </button>
        ))}
      </div>

      {kind === 'semen' && photo ? (
        <ReportReader onUse={(v) => save(v as Record<string, number>, 'photo')} onCancel={() => setPhoto(false)} />
      ) : (
        <>
          {kind === 'semen' && (
            <button type="button" className="flex w-full items-center gap-3 rounded-lg border border-ai-200 bg-ai-50 px-4 py-3 text-start hover:bg-ai-100" onClick={() => setPhoto(true)}>
              <ScanLine className="h-5 w-5 shrink-0 text-ai-600" aria-hidden />
              <span className="text-sm">
                <span className="block font-semibold text-ink">{t({ en: 'Read it from a photo of the report', ar: 'اقرأها من صورة التقرير' })}</span>
                <span className="block text-muted">{t({ en: 'Or type the numbers below.', ar: 'أو اكتب الأرقام أدناه.' })}</span>
              </span>
            </button>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-ink">{t({ en: 'Date of the test', ar: 'تاريخ التحليل' })}</span>
              <input type="date" className="input" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
            </label>
            {kind === 'testosterone' && (
              <label className="grid gap-1.5">
                <span className="text-sm font-medium text-ink">{t({ en: 'Unit on the report', ar: 'الوحدة في التقرير' })}</span>
                <select className="input" value={ngdl ? 'ngdl' : 'nmol'} onChange={(e) => setNgdl(e.target.value === 'ngdl')}>
                  <option value="nmol">nmol/L</option>
                  <option value="ngdl">ng/dL</option>
                </select>
              </label>
            )}
            {info.fields.map((f) => (
              <label key={f.id} className="grid gap-1.5">
                <span className="text-sm font-medium text-ink">{t(f.label)}</span>
                <span className="relative">
                  <input className="input pe-24 tabular-nums" inputMode="decimal" value={vals[f.id] ?? ''} onChange={(e) => setVals((v) => ({ ...v, [f.id]: e.target.value }))} />
                  <span className="pointer-events-none absolute inset-y-0 end-3.5 flex items-center text-sm text-muted">{kind === 'testosterone' && ngdl ? 'ng/dL' : t(f.unit)}</span>
                </span>
              </label>
            ))}
          </div>
          {error && <Callout tone="warn">{t({ en: 'Please check the numbers: at least one is missing or outside the possible range.', ar: 'يُرجى التحقق من الأرقام: أحدها على الأقل ناقص أو خارج النطاق الممكن.' })}</Callout>}
          <div className="flex gap-2">
            <button type="button" className="btn btn-primary" onClick={typed}>
              {t({ en: 'Save result', ar: 'احفظ النتيجة' })}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onCancel}>
              {t({ en: 'Cancel', ar: 'إلغاء' })}
            </button>
          </div>
        </>
      )}
    </section>
  )
}
