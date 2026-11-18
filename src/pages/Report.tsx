import { ArrowRight, LockKeyhole, RotateCcw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ReportReader } from '../components/ReportReader'
import { Callout, LayerLabel, Sources } from '../components/ui'
import { assess, WHO2021 } from '../lib/engine'
import { useI18n } from '../lib/i18n'
import { QUESTION_BY_ID } from '../lib/questions'
import { READ_FIELDS } from '../lib/report'
import type { ReadField } from '../lib/report'
import { load, save } from '../lib/storage'
import type { Answers } from '../lib/types'

const FIELDS = QUESTION_BY_ID.semen.fields ?? []

/** Stand-alone report reader: photograph a semen analysis, check the numbers, see them against the WHO limits. */
export default function Report() {
  const { t } = useI18n()
  const nav = useNavigate()
  const [values, setValues] = useState<Partial<Record<ReadField, number>> | null>(null)

  // The same fixed rules as the full check, run on these numbers alone. The age only makes the rules applicable;
  // it is not shown and nothing is saved until the person chooses to add the numbers to their check.
  const semen = useMemo(() => {
    if (!values) return null
    const as = assess({ age: 30, semen_done: 'yes', ...values })
    return { flag: as.flags.find((f) => f.id === 'AN_SEMEN'), issues: as.dataIssues.filter((d) => d.id.startsWith('DQ_SEMEN')) }
  }, [values])

  const addToCheck = () => {
    if (!values) return
    const answers: Answers = { ...load<Answers>('answers', {}), semen_done: 'yes' }
    for (const f of READ_FIELDS) {
      if (values[f] === undefined) delete answers[f]
      else answers[f] = values[f]
    }
    save('answers', answers)
    save('step', 'age')
    // family_hx is the last question: if it is answered, the check is complete and the result can be shown.
    nav(answers.family_hx !== undefined ? '/result' : '/check')
  }

  return (
    <div className="container-flow space-y-6 py-8 sm:py-10">
      <div className="space-y-2">
        <p className="eyebrow">{t({ en: 'Lab report reader', ar: 'قارئ تقرير المختبر' })}</p>
        <h1 className="title">{t({ en: 'Understand your semen analysis', ar: 'افهم تحليل السائل المنوي' })}</h1>
        <p className="text-muted">
          {t({
            en: 'Reports are full of numbers and long words. Photograph yours to see each value next to the World Health Organization limit, in plain language.',
            ar: 'التقارير مليئة بالأرقام والمصطلحات. صوّر تقريرك لترى كل قيمة بجانب حدّ منظمة الصحة العالمية، بلغة بسيطة.',
          })}
        </p>
      </div>

      {!values && <ReportReader onUse={setValues} />}

      {values && semen && (
        <>
          <section className="surface overflow-hidden">
            <div className="space-y-1 px-5 py-4 sm:px-6">
              <LayerLabel layer="rules">{t({ en: 'Compared by fixed rules, not by AI', ar: 'قارنتها قواعد ثابتة، لا الذكاء الاصطناعي' })}</LayerLabel>
              <h2 className="heading">{t({ en: 'Your numbers and the WHO 2021 lower limits', ar: 'أرقامك والحدود الدنيا لمنظمة الصحة العالمية (2021)' })}</h2>
            </div>
            <ul className="divide-y divide-line border-t border-line">
              {FIELDS.map((f) => {
                const id = f.id as ReadField
                const v = values[id]
                const low = v !== undefined && v < WHO2021[id]
                return (
                  <li key={id} className="flex items-center justify-between gap-4 px-5 py-3.5 sm:px-6">
                    <div className="min-w-0">
                      <p className="text-[15px] font-medium text-ink">{t(f.label)}</p>
                      <p className="text-sm text-muted">
                        <span className="font-semibold text-ink tabular-nums">{v === undefined ? t({ en: 'Not given', ar: 'غير مذكور' }) : `${v} ${t(f.unit)}`}</span>
                        {' · '}
                        {t({ en: 'lower limit', ar: 'الحد الأدنى' })}{' '}
                        <span className="tabular-nums">
                          {WHO2021[id]} {t(f.unit)}
                        </span>
                      </p>
                    </div>
                    {v !== undefined && (
                      <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${low ? 'bg-amber-50 text-amber-800 ring-amber-600/25' : 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${low ? 'bg-amber-500' : 'bg-emerald-500'}`} aria-hidden />
                        {low ? t({ en: 'Below the limit', ar: 'أقل من الحد' }) : t({ en: 'At or above', ar: 'يساوي أو يتجاوز' })}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
            <div className="space-y-3 border-t border-line px-5 py-5 sm:px-6">
              {semen.flag ? (
                <>
                  <h3 className="text-[15px] font-semibold text-ink">{t(semen.flag.title)}</h3>
                  <ul className="list-disc space-y-0.5 ps-5 text-sm text-body">
                    {semen.flag.because.map((b, i) => (
                      <li key={i}>{t(b)}</li>
                    ))}
                  </ul>
                  <p className="text-sm text-body">{t(semen.flag.why)}</p>
                  <p className="rounded-lg bg-brand-25 px-3 py-2 text-sm font-medium text-brand-900 ring-1 ring-inset ring-brand-100">{t(semen.flag.action)}</p>
                  <Sources ids={semen.flag.sources} />
                </>
              ) : (
                <>
                  <h3 className="text-[15px] font-semibold text-ink">{t({ en: 'Nothing here is below the WHO lower limits', ar: 'لا شيء هنا أقل من الحدود الدنيا لمنظمة الصحة العالمية' })}</h3>
                  <p className="text-sm text-body">
                    {t({
                      en: 'That is reassuring, but a semen analysis is only one part of the picture. Health, habits and how long you have been trying matter too.',
                      ar: 'هذا مطمئن، لكن تحليل السائل المنوي جزء واحد فقط من الصورة. فالصحة والعادات ومدة المحاولة مهمة أيضاً.',
                    })}
                  </p>
                  <Sources ids={['WHO2021']} />
                </>
              )}
            </div>
          </section>

          {semen.issues.length > 0 && (
            <Callout tone="warn" title={t({ en: 'Please check these numbers', ar: 'يُرجى التحقق من هذه الأرقام' })}>
              <ul className="list-disc space-y-0.5 ps-5">
                {semen.issues.map((d) => (
                  <li key={d.id}>{t(d.message)}</li>
                ))}
              </ul>
            </Callout>
          )}

          <section className="surface surface-pad space-y-4">
            <div className="space-y-1">
              <h2 className="heading">{t({ en: 'See the whole picture', ar: 'شاهد الصورة كاملة' })}</h2>
              <p className="text-sm text-muted">
                {t({
                  en: 'The five-minute check adds your health, habits and family plans, and tells you exactly where to go next. These numbers are carried over.',
                  ar: 'يضيف الفحص الذي يستغرق خمس دقائق صحتك وعاداتك وخططك الأسرية، ويخبرك إلى أين تتجه بعد ذلك بالضبط. تُنقل هذه الأرقام معك.',
                })}
              </p>
            </div>
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <button type="button" className="btn btn-primary" onClick={addToCheck}>
                {t({ en: 'Add these to my health check', ar: 'أضِف هذه الأرقام إلى فحصي الصحي' })}
                <ArrowRight className="icon-dir h-4 w-4" aria-hidden />
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setValues(null)}>
                <RotateCcw className="h-4 w-4" aria-hidden />
                {t({ en: 'Read another report', ar: 'اقرأ تقريراً آخر' })}
              </button>
            </div>
          </section>
        </>
      )}

      <p className="text-center text-xs text-muted">
        <LockKeyhole className="me-1 inline-block h-3.5 w-3.5 align-[-2px]" aria-hidden />
        {t({ en: 'We do not keep the picture. The numbers stay on this device.', ar: 'لا نحتفظ بالصورة، وتبقى الأرقام على هذا الجهاز.' })}{' '}
        <Link to="/privacy" className="link">
          {t({ en: 'Privacy', ar: 'الخصوصية' })}
        </Link>
      </p>
    </div>
  )
}
