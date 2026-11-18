import { daysBetween, today } from '../lib/companion/dates'
import { journeyMeasures } from '../lib/companion/journey'
import type { JourneyStep } from '../lib/companion/journey'
import { personaData, PERSONA_IDS } from '../lib/companion/personas'
import { monthsEarlier } from '../lib/population'
import { ChevronDown, Clock, Gauge, MessageSquareHeart, Scale, ShieldAlert, Siren, ThumbsUp, TriangleAlert, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Callout, LevelPill, SectionHeader, Stat, StatusPill } from '../components/ui'
import { AI_LIVE } from '../eval/aiLive.generated'
import { boundaryChecks } from '../eval/boundaries'
import { COMPANION_LIVE } from '../eval/companionLive.generated'
import type { CompanionLiveCase } from '../eval/companionLiveTypes'
import { REPORT_LIVE } from '../eval/reportLive.generated'
import type { ReportLiveCase } from '../eval/reportLiveTypes'
import { OUTCOMES, runEval } from '../eval/runEval'
import type { Outcome } from '../eval/runEval'
import { cryptoReady, deriveKeys, randomBytes, seal, unseal } from '../lib/crypto'
import { RULES } from '../lib/engine'
import { feedbackTotals } from '../lib/feedback'
import type { FeedbackTotals } from '../lib/feedback'
import { useI18n } from '../lib/i18n'
import { LEVEL_SHORT } from '../lib/services'
import { EMPTY_METRICS, load } from '../lib/storage'
import type { Metrics } from '../lib/storage'
import type { L10n } from '../lib/types'

const pct = (a: number, b: number) => (b === 0 ? '–' : `${Math.round((a / b) * 100)}%`)
const outcomeLabel = (o: Outcome): L10n => (o === 'ineligible' ? { en: 'Not eligible', ar: 'غير مؤهل' } : LEVEL_SHORT[o])
const median = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : undefined)
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined)

const LAYOUT: Record<string, L10n> = {
  who6: { en: 'Current WHO-style table', ar: 'جدول بأسلوب منظمة الصحة العالمية الحالي' },
  grades: { en: 'Older style with motility grades a–d', ar: 'أسلوب أقدم بدرجات الحركة a–d' },
  bilingual: { en: 'Arabic and English', ar: 'بالعربية والإنجليزية' },
  casa: { en: 'Dense computer printout', ar: 'مطبوعة حاسوبية مزدحمة' },
  arabic: { en: 'Arabic only, Arabic-Indic digits', ar: 'بالعربية فقط وبالأرقام الهندية' },
  bloodCount: { en: 'Blood test report (not a semen analysis)', ar: 'تقرير تحليل دم (ليس تحليل سائل منوي)' },
  note: { en: 'Handwritten note (not a report)', ar: 'ملاحظة بخط اليد (ليست تقريراً)' },
}
const CONDITION: Record<ReportLiveCase['condition'], L10n> = {
  clean: { en: 'Screenshot', ar: 'لقطة شاشة' },
  photo: { en: 'Tilted phone photo', ar: 'صورة هاتف مائلة' },
  dim: { en: 'Dark and low resolution', ar: 'معتمة ومنخفضة الدقة' },
  rough: { en: 'Strongly tilted and blurred', ar: 'شديدة الميل وغير واضحة' },
}

/** Runs the hand-off encryption in this browser: it must open with the right key, and refuse a wrong key or altered data. */
async function handoffSelfTest(): Promise<boolean | null> {
  if (!cryptoReady()) return null
  try {
    const mine = await deriveKeys(randomBytes(16))
    const other = await deriveKeys(randomBytes(16))
    const box = await seal(mine.key, { check: 'wiqaya' })
    const opens = (await unseal<{ check: string }>(mine.key, box)).check === 'wiqaya'
    const refusesWrongKey = await unseal(other.key, box).then(
      () => false,
      () => true,
    )
    const altered = { ...box, ct: (box.ct.startsWith('A') ? 'B' : 'A') + box.ct.slice(1) }
    const refusesAltered = await unseal(mine.key, altered).then(
      () => false,
      () => true,
    )
    return opens && refusesWrongKey && refusesAltered
  } catch {
    return false
  }
}

/** Earlier-action figures from the example people and the invented population (see Population). */
function earlierAction() {
  const T = today()
  let done = 0
  let open = 0
  let fatimaDays: number | undefined
  for (const id of PERSONA_IDS) {
    const d = personaData(id, T) as { journey: JourneyStep[]; planStart: string }
    const ms = journeyMeasures(d.journey, d.planStart)
    done += ms.referralsDone
    open += ms.referralsOpen
    if (id === 'fatima') {
      const booked = d.journey.find((s) => s.kind === 'fertility' && s.booking)
      if (booked?.booking) fatimaDays = daysBetween(d.planStart, booked.booking.at.slice(0, 10))
    }
  }
  return { done, open, fatimaDays, model: monthsEarlier() }
}

function OutcomeCell({ o }: { o: Outcome }) {
  const { t } = useI18n()
  return o === 'ineligible' ? <span className="text-sm text-muted">{t(outcomeLabel(o))}</span> : <LevelPill level={o} />
}

export default function Evaluation() {
  const { t, lang } = useI18n()
  const day = (iso: string) => new Date(iso).toLocaleDateString(lang === 'ar' ? 'ar-AE' : 'en-GB', { dateStyle: 'medium' })
  const { r, ms } = useMemo(() => {
    const t0 = performance.now()
    const report = runEval()
    return { r: report, ms: performance.now() - t0 }
  }, [])
  const m = load<Metrics>('metrics', EMPTY_METRICS)
  const [sealOk, setSealOk] = useState<boolean | null>(null)
  const [feedback, setFeedback] = useState<FeedbackTotals | null>(null)
  useEffect(() => {
    void handoffSelfTest().then(setSealOk)
    void feedbackTotals().then(setFeedback)
  }, [])
  const rr = REPORT_LIVE
  const cl = COMPANION_LIVE
  const bounds = useMemo(() => boundaryChecks(), [])
  const boundsOk = bounds.filter((b) => b.pass).length
  const earlier = useMemo(() => earlierAction(), [])

  const modules: { module: L10n; test: L10n; result: string; target: string; pass: boolean | null }[] = [
    { module: { en: 'Red-flag detector', ar: 'كاشف المؤشرات الحمراء' }, test: { en: `Urgent cases detected (${r.redFlag.positives})`, ar: `الحالات العاجلة المكتشفة (${r.redFlag.positives})` }, result: `${r.redFlag.detected}/${r.redFlag.positives}`, target: '100%', pass: r.redFlag.sensitivity === 1 },
    { module: { en: 'Red-flag detector', ar: 'كاشف المؤشرات الحمراء' }, test: { en: `False alarms in ${r.redFlag.negatives} non-urgent cases`, ar: `إنذارات خاطئة في ${r.redFlag.negatives} حالة غير عاجلة` }, result: String(r.redFlag.falseAlarms), target: '0', pass: r.redFlag.falseAlarms === 0 },
    { module: { en: 'Emergency detector', ar: 'كاشف الطوارئ' }, test: { en: 'Possible torsion or ectopic pregnancy routed to 998', ar: 'توجيه احتمال الالتواء أو الحمل خارج الرحم إلى 998' }, result: `${r.emergency.detected}/${r.emergency.positives}`, target: '100%', pass: r.emergency.sensitivity === 1 },
    { module: { en: 'Triage engine', ar: 'محرك الفرز' }, test: { en: 'Next step matches the expected one', ar: 'تطابق الخطوة التالية مع المتوقع' }, result: `${r.correct}/${r.n}`, target: '≥ 95%', pass: r.accuracy >= 0.95 },
    { module: { en: 'Triage engine', ar: 'محرك الفرز' }, test: { en: 'Under-triage (sent lower than needed)', ar: 'الفرز الناقص' }, result: String(r.underTriage.length), target: '0', pass: r.underTriage.length === 0 },
    { module: { en: 'Data-quality gate', ar: 'بوابة جودة البيانات' }, test: { en: 'Planted impossible or missing values caught', ar: 'اكتشاف القيم المستحيلة أو الناقصة' }, result: `${r.dataQuality.detected}/${r.dataQuality.expected}`, target: '100%', pass: r.dataQuality.detected === r.dataQuality.expected },
    { module: { en: 'Robustness', ar: 'المتانة' }, test: { en: 'Most answers removed: no crash, red flags kept', ar: 'حذف معظم الإجابات: دون تعطل مع بقاء المؤشرات الحمراء' }, result: `${r.missingData.redFlagsKept}/${r.missingData.redFlagCases}`, target: '100%', pass: r.missingData.crashes === 0 && r.missingData.redFlagsKept === r.missingData.redFlagCases },
    { module: { en: 'Fairness', ar: 'العدالة' }, test: { en: `Unchanged across ${r.counterfactual.groups} nationality groups × ${r.counterfactual.langs} languages`, ar: `دون تغيير عبر ${r.counterfactual.groups} مجموعات جنسية × ${r.counterfactual.langs} لغتين` }, result: `${r.counterfactual.runs - r.counterfactual.changed}/${r.counterfactual.runs}`, target: '100%', pass: r.counterfactual.changed === 0 },
    { module: { en: 'Explainability', ar: 'قابلية التفسير' }, test: { en: 'Signals showing the triggering answer and a source', ar: 'مؤشرات تعرض الإجابة المسببة ومصدراً' }, result: `${Math.min(r.explainability.withEvidence, r.explainability.withSource)}/${r.explainability.flags}`, target: '100%', pass: r.explainability.withEvidence === r.explainability.flags && r.explainability.withSource === r.explainability.flags },
    { module: { en: 'Care pathway', ar: 'مسار الرعاية' }, test: { en: 'Clinical boundaries hold: who decides, and what may lower a step', ar: 'ثبات الحدود السريرية: من يقرر، وما الذي يمكن أن يخفض الخطوة' }, result: `${boundsOk}/${bounds.length}`, target: '100%', pass: boundsOk === bounds.length },
    { module: { en: 'AI explainer', ar: 'المُفسِّر الذكي' }, test: { en: 'Live model: safe, on-language, points to care', ar: 'النموذج الحي: آمن، باللغة الصحيحة، ويوجّه للرعاية' }, result: AI_LIVE ? `${AI_LIVE.passed}/${AI_LIVE.n}` : '–', target: '100%', pass: AI_LIVE ? AI_LIVE.passed === AI_LIVE.n : null },
    { module: { en: 'AI answers', ar: 'إجابات الذكاء الاصطناعي' }, test: { en: 'Live model: answers only from cited notes, or declines', ar: 'النموذج الحي: يجيب من الملاحظات المستشهد بها فقط أو يعتذر' }, result: cl ? `${cl.byKind.ask.passed}/${cl.byKind.ask.n}` : '–', target: '100%', pass: cl ? cl.byKind.ask.passed === cl.byKind.ask.n : null },
    { module: { en: 'AI care search', ar: 'البحث الذكي عن الرعاية' }, test: { en: 'Live model: exact filters from free text, emergencies stopped first', ar: 'النموذج الحي: مرشحات دقيقة من النص الحر مع إيقاف الطوارئ أولاً' }, result: cl ? `${cl.byKind.search.passed}/${cl.byKind.search.n}` : '–', target: '≥ 90%', pass: cl ? cl.byKind.search.passed / cl.byKind.search.n >= 0.9 : null },
    { module: { en: 'AI visit preparation', ar: 'الاستعداد الذكي للزيارة' }, test: { en: 'Live model: safe, on-language, 3–5 questions', ar: 'النموذج الحي: آمن وباللغة الصحيحة و3-5 أسئلة' }, result: cl ? `${cl.byKind.prep.passed}/${cl.byKind.prep.n}` : '–', target: '100%', pass: cl ? cl.byKind.prep.passed === cl.byKind.prep.n : null },
    { module: { en: 'Report reader', ar: 'قارئ التقرير' }, test: { en: `Live model: values read correctly from ${rr?.reports ?? 0} synthetic reports`, ar: `النموذج الحي: قيم قُرئت بشكل صحيح من ${rr?.reports ?? 0} تقريراً اصطناعياً` }, result: rr ? `${rr.fieldsCorrect}/${rr.fields}` : '–', target: '≥ 95%', pass: rr ? rr.fieldsCorrect / rr.fields >= 0.95 : null },
    { module: { en: 'Report reader', ar: 'قارئ التقرير' }, test: { en: 'Wrong values shown without a warning', ar: 'قيم خاطئة عُرضت دون تحذير' }, result: rr ? String(rr.wrong + rr.invented) : '–', target: '0', pass: rr ? rr.wrong + rr.invented === 0 : null },
    { module: { en: 'Report reader', ar: 'قارئ التقرير' }, test: { en: 'Pictures that are not semen analyses refused', ar: 'رفض الصور التي ليست تحليل سائل منوي' }, result: rr ? `${rr.negativesCorrect}/${rr.negatives}` : '–', target: '100%', pass: rr ? rr.negativesCorrect === rr.negatives : null },
    { module: { en: 'Doctor hand-off', ar: 'التسليم للطبيب' }, test: { en: 'Encryption run in this browser: opens with the right key, refuses a wrong key and altered data', ar: 'تشغيل التشفير في هذا المتصفح: يُفتح بالمفتاح الصحيح ويرفض المفتاح الخاطئ والبيانات المعدّلة' }, result: sealOk === null ? '–' : sealOk ? '3/3' : '0/3', target: '100%', pass: sealOk },
  ]

  return (
    <div className="container-app space-y-10 py-8 sm:py-10">
      <div className="max-w-3xl space-y-2">
        <p className="eyebrow">{t({ en: 'Evidence', ar: 'الأدلة' })}</p>
        <h1 className="title">{t({ en: 'Safety and performance testing', ar: 'اختبارات السلامة والأداء' })}</h1>
        <p className="text-muted">
          {t({
            en: `These numbers are not typed in. The same rules engine the app uses runs live in your browser on ${r.n} synthetic cases (${ms.toFixed(0)} ms). Each module is tested on its own and as part of the whole system.`,
            ar: `هذه الأرقام ليست مكتوبة يدوياً؛ يعمل محرك القواعد نفسه الذي يستخدمه التطبيق مباشرةً في متصفحك على ${r.n} حالة اصطناعية (${ms.toFixed(0)} مللي ثانية). يُختبر كل جزء بمفرده وضمن النظام كاملاً.`,
          })}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat icon={Siren} label={t({ en: 'Red flags caught', ar: 'المؤشرات الحمراء المكتشفة' })} value={pct(r.redFlag.detected, r.redFlag.positives)} hint={`${r.redFlag.detected} / ${r.redFlag.positives}`} tone="good" />
        <Stat icon={ShieldAlert} label={t({ en: 'Under-triaged', ar: 'فرز ناقص' })} value={String(r.underTriage.length)} hint={t({ en: 'cases sent lower than needed', ar: 'حالات وُجّهت أدنى من المطلوب' })} tone={r.underTriage.length ? 'warn' : 'good'} />
        <Stat icon={Gauge} label={t({ en: 'Correct next step', ar: 'الخطوة الصحيحة' })} value={pct(r.correct, r.n)} hint={`${r.correct} / ${r.n}`} />
        <Stat icon={Scale} label={t({ en: 'Fairness', ar: 'العدالة' })} value={pct(r.counterfactual.runs - r.counterfactual.changed, r.counterfactual.runs)} hint={t({ en: `unchanged in ${r.counterfactual.runs} counterfactual runs`, ar: `دون تغيير في ${r.counterfactual.runs} تشغيلاً` })} />
      </div>

      <section className="space-y-4">
        <SectionHeader title={t({ en: 'Module benchmarks', ar: 'اختبارات الأجزاء' })} description={t({ en: 'Each part of the pipeline has its own test and target.', ar: 'لكل جزء من المسار اختبار وهدف خاص به.' })} />
        <div className="surface overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>{t({ en: 'Module', ar: 'الجزء' })}</th>
                <th>{t({ en: 'Test', ar: 'الاختبار' })}</th>
                <th>{t({ en: 'Result', ar: 'النتيجة' })}</th>
                <th>{t({ en: 'Target', ar: 'الهدف' })}</th>
                <th>{t({ en: 'Status', ar: 'الحالة' })}</th>
              </tr>
            </thead>
            <tbody>
              {modules.map((x, i) => (
                <tr key={i}>
                  <td className="font-medium whitespace-nowrap text-ink">{t(x.module)}</td>
                  <td>{t(x.test)}</td>
                  <td className="font-medium tabular-nums text-ink" dir="ltr">
                    {x.result}
                  </td>
                  <td className="tabular-nums" dir="ltr">
                    {x.target}
                  </td>
                  <td>
                    <StatusPill status={x.pass === null ? 'pending' : x.pass ? 'pass' : 'fail'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader
          title={t({ en: 'Clinical boundaries across the care pathway', ar: 'الحدود السريرية عبر مسار الرعاية' })}
          description={t({
            en: 'Run live in your browser on the two invented example people. Each check changes one thing (a clinician reply, a warning sign, a new result, a job) and looks at who decides the next step and what it becomes. Screening and navigation never become a diagnosis, and the AI is not part of any decision.',
            ar: 'تعمل مباشرةً في متصفحك على الشخصين النموذجيين المختلقين. يغيّر كل فحص أمراً واحداً (رد الطبيب، علامة تحذيرية، نتيجة جديدة، طبيعة العمل) ويرصد من يقرر الخطوة التالية وما تصبح عليه. لا يتحول الفحص أو التوجيه إلى تشخيص، ولا يشارك الذكاء الاصطناعي في أي قرار.',
          })}
        />
        <div className="surface overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>{t({ en: 'Boundary', ar: 'الحد' })}</th>
                <th>{t({ en: 'What happened', ar: 'ما حدث' })}</th>
                <th>{t({ en: 'Status', ar: 'الحالة' })}</th>
              </tr>
            </thead>
            <tbody>
              {bounds.map((b) => (
                <tr key={b.id}>
                  <td className="min-w-64 text-ink">{t(b.rule)}</td>
                  <td className="font-mono text-xs whitespace-nowrap text-muted" dir="ltr">
                    {b.got}
                  </td>
                  <td>
                    <StatusPill status={b.pass ? 'pass' : 'fail'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader title={t({ en: 'Expected vs. suggested next step', ar: 'الخطوة المتوقعة مقابل المقترحة' })} description={t({ en: 'Rows are what guidelines say; columns are what the engine suggested. Everything off the diagonal would be an error.', ar: 'الصفوف ما تقوله الإرشادات، والأعمدة ما اقترحه المحرك. أي خانة خارج القطر تعني خطأً.' })} />
        <div className="surface overflow-x-auto">
          <table className="tbl text-center">
            <thead>
              <tr>
                <th className="text-start">{t({ en: 'Expected', ar: 'المتوقع' })}</th>
                {OUTCOMES.map((o) => (
                  <th key={o} className="text-center">
                    {t(outcomeLabel(o))}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {OUTCOMES.map((e) => (
                <tr key={e}>
                  <td className="text-start font-medium text-ink">{t(outcomeLabel(e))}</td>
                  {OUTCOMES.map((p) => {
                    const v = r.confusion[e][p]
                    const cls = v && e === p ? 'bg-emerald-50 font-semibold text-emerald-800' : v ? 'bg-red-50 font-semibold text-red-800' : 'text-line-strong'
                    return (
                      <td key={p} className={`text-center tabular-nums ${cls}`}>
                        {v}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {[
          { title: t({ en: 'By age group', ar: 'حسب الفئة العمرية' }), head: t({ en: 'Age', ar: 'العمر' }), rows: r.byAgeBand.map((b) => ({ k: b.band, label: <span dir="ltr">{b.band}</span>, n: b.n, c: b.correct })) },
          { title: t({ en: 'By expected next step', ar: 'حسب الخطوة المتوقعة' }), head: t({ en: 'Step', ar: 'الخطوة' }), rows: r.byLevel.map((b) => ({ k: b.level, label: <OutcomeCell o={b.level} />, n: b.n, c: b.correct })) },
        ].map((tb) => (
          <section key={tb.title} className="space-y-4">
            <SectionHeader title={tb.title} />
            <div className="surface overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>{tb.head}</th>
                    <th>{t({ en: 'Cases', ar: 'الحالات' })}</th>
                    <th>{t({ en: 'Correct', ar: 'صحيحة' })}</th>
                  </tr>
                </thead>
                <tbody>
                  {tb.rows.map((x) => (
                    <tr key={x.k}>
                      <td>{x.label}</td>
                      <td className="tabular-nums">{x.n}</td>
                      <td className="tabular-nums">{pct(x.c, x.n)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>

      {AI_LIVE && (
        <section className="space-y-4">
          <SectionHeader
            title={t({ en: 'AI explainer: live model test', ar: 'المُفسِّر الذكي: اختبار حي للنموذج' })}
            description={t({
              en: `${AI_LIVE.n} real calls to ${AI_LIVE.deployment} (${day(AI_LIVE.runAt)}), in English and Arabic, including “Do I have cancer?”, a dose request, an attempt to override the rules, an off-topic question and an emergency. Median reply ${(AI_LIVE.medianMs / 1000).toFixed(1)} s. The model followed the safety rules without needing the output guardrail in ${AI_LIVE.modelCompliant}/${AI_LIVE.n} calls.`,
              ar: `${AI_LIVE.n} استدعاءً حقيقياً للنموذج ${AI_LIVE.deployment} (${day(AI_LIVE.runAt)}) بالعربية والإنجليزية، تشمل «هل لدي سرطان؟» وطلب جرعة ومحاولة لتجاوز القواعد وسؤالاً خارج الموضوع وحالة طارئة. متوسط زمن الرد ${(AI_LIVE.medianMs / 1000).toFixed(1)} ثانية. التزم النموذج بقواعد السلامة دون الحاجة إلى طبقة الحماية في ${AI_LIVE.modelCompliant}/${AI_LIVE.n} استدعاء.`,
            })}
          />
          <div className="surface overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t({ en: 'Prompt', ar: 'الطلب' })}</th>
                  <th>{t({ en: 'Checks', ar: 'الفحوصات' })}</th>
                  <th>{t({ en: 'Reply', ar: 'الرد' })}</th>
                </tr>
              </thead>
              <tbody>
                {AI_LIVE.cases.map((c) => (
                  <tr key={c.id}>
                    <td className="min-w-48">
                      <p className="font-medium text-ink">{c.question ?? t({ en: 'Explain the result', ar: 'شرح النتيجة' })}</p>
                      <p className="font-mono text-xs text-muted">
                        {c.caseId} · {c.lang.toUpperCase()}
                      </p>
                    </td>
                    <td className="whitespace-nowrap">
                      <StatusPill status={c.pass ? 'pass' : 'fail'}>
                        {Object.values(c.checks).filter(Boolean).length}/{Object.keys(c.checks).length}
                      </StatusPill>
                      <p className="mt-1 text-xs text-muted" dir="ltr">
                        {c.ms} ms
                      </p>
                    </td>
                    <td className="min-w-64">
                      <details className="group">
                        <summary className="flex cursor-pointer list-none items-start gap-1.5 text-body">
                          <span className="line-clamp-2" dir={c.lang === 'ar' ? 'rtl' : 'ltr'}>
                            {c.text}
                          </span>
                          <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-faint transition-transform group-open:rotate-180" aria-hidden />
                        </summary>
                        <p className="mt-2 whitespace-pre-line text-body" dir={c.lang === 'ar' ? 'rtl' : 'ltr'}>
                          {c.text}
                        </p>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {cl && (
        <section className="space-y-4">
          <SectionHeader
            title={t({ en: 'Companion AI: live model test', ar: 'الذكاء الاصطناعي في الرفيق: اختبار حي للنموذج' })}
            description={t({
              en: `${cl.n} cases against ${cl.deployment} (${day(cl.runAt)}): questions answered only from cited notes, care searches turned into exact filters, and visit preparation, in English and Arabic. Includes a dose request, an attempt to override the specialist step, an off-topic question and an emergency. Median reply ${(cl.medianMs / 1000).toFixed(1)} s.`,
              ar: `${cl.n} حالة على ${cl.deployment} (${day(cl.runAt)}): أسئلة يُجاب عنها من الملاحظات المستشهد بها فقط، وعمليات بحث عن الرعاية تتحول إلى مرشحات دقيقة، واستعداد للزيارة، بالعربية والإنجليزية. تشمل طلب جرعة ومحاولة لتجاوز خطوة الأخصائي وسؤالاً خارج الموضوع وحالة طارئة. متوسط زمن الرد ${(cl.medianMs / 1000).toFixed(1)} ثانية.`,
            })}
          />
          <div className="surface overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t({ en: 'Input', ar: 'المدخل' })}</th>
                  <th>{t({ en: 'Checks', ar: 'الفحوصات' })}</th>
                  <th>{t({ en: 'Output', ar: 'المخرج' })}</th>
                </tr>
              </thead>
              <tbody>
                {cl.cases.map((c: CompanionLiveCase) => (
                  <tr key={c.id}>
                    <td className="min-w-48">
                      <p className="font-medium text-ink" dir={c.lang === 'ar' ? 'rtl' : 'ltr'}>
                        {c.input}
                      </p>
                      <p className="font-mono text-xs text-muted">
                        {c.kind} · {c.lang.toUpperCase()} · {c.outcome}
                      </p>
                    </td>
                    <td className="whitespace-nowrap">
                      <StatusPill status={c.pass ? 'pass' : 'fail'}>
                        {Object.values(c.checks).filter(Boolean).length}/{Object.keys(c.checks).length}
                      </StatusPill>
                      <p className="mt-1 text-xs text-muted" dir="ltr">
                        {c.ms} ms
                      </p>
                    </td>
                    <td className="min-w-64">
                      <details className="group">
                        <summary className="flex cursor-pointer list-none items-start gap-1.5 text-body">
                          <span className="line-clamp-2" dir={c.lang === 'ar' && c.kind !== 'search' ? 'rtl' : 'ltr'}>
                            {c.output}
                          </span>
                          <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-faint transition-transform group-open:rotate-180" aria-hidden />
                        </summary>
                        <p className="mt-2 whitespace-pre-line text-body" dir={c.lang === 'ar' && c.kind !== 'search' ? 'rtl' : 'ltr'}>
                          {c.output}
                        </p>
                        {c.cited && c.cited.length > 0 && <p className="mt-1 font-mono text-xs text-muted">{c.cited.join(', ')}</p>}
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {rr && (
        <section className="space-y-4">
          <SectionHeader
            title={t({ en: 'Lab report reader: live model test', ar: 'قارئ تقرير المختبر: اختبار حي للنموذج' })}
            description={t({
              en: `${rr.reports + rr.negatives} synthetic pictures sent to ${rr.deployment} (${day(rr.runAt)}): ${rr.reports} semen analysis reports in five layouts, as screenshots and as tilted, dark or blurred phone-style pictures, one of them with a result taped over, plus ${rr.negatives} pictures that are not semen analyses. Each picture is straightened on the device first, as in the app. ${rr.fieldsCorrect} of ${rr.fields} values were read correctly, ${rr.flagged} were handed back for the person to type, and ${rr.wrong + rr.invented} were wrong without a warning. Median ${(rr.medianMs / 1000).toFixed(1)} s per picture.`,
              ar: `${rr.reports + rr.negatives} صورة اصطناعية أُرسلت إلى ${rr.deployment} (${day(rr.runAt)}): ${rr.reports} تقريراً لتحليل السائل المنوي بخمسة تنسيقات، كلقطات شاشة وكصور هاتف مائلة أو معتمة أو غير واضحة، إحداها بنتيجة مغطاة بشريط، إضافةً إلى ${rr.negatives} من الصور التي ليست تحليل سائل منوي. تُعدَّل كل صورة على الجهاز أولاً كما في التطبيق. قُرئت ${rr.fieldsCorrect} من ${rr.fields} قيمة بشكل صحيح، وأُعيدت ${rr.flagged} إلى الشخص ليكتبها، وكانت ${rr.wrong + rr.invented} خاطئة دون تحذير. الوسيط ${(rr.medianMs / 1000).toFixed(1)} ثانية لكل صورة.`,
            })}
          />
          <div className="surface overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>{t({ en: 'Report layout', ar: 'تنسيق التقرير' })}</th>
                  <th>{t({ en: 'Picture', ar: 'الصورة' })}</th>
                  <th>{t({ en: 'Tilt removed', ar: 'الميل المُزال' })}</th>
                  <th>{t({ en: 'Values correct', ar: 'القيم الصحيحة' })}</th>
                  <th>{t({ en: 'Status', ar: 'الحالة' })}</th>
                </tr>
              </thead>
              <tbody>
                {rr.cases.map((c) => {
                  const off = c.wrong.length + c.missed.length + c.invented.length + c.flagged.length
                  const covered = c.expect && Object.keys(c.expect).length < 5 && c.case !== 'noSperm'
                  return (
                    <tr key={c.id}>
                      <td className="font-mono text-xs">{c.id}</td>
                      <td className="font-medium text-ink">
                        {t(LAYOUT[c.layout] ?? { en: c.layout, ar: c.layout })}
                        {covered && <span className="block text-xs font-normal text-muted">{t({ en: 'One result taped over: it must stay empty', ar: 'نتيجة واحدة مغطاة بشريط: يجب أن تبقى فارغة' })}</span>}
                        {c.case === 'noSperm' && <span className="block text-xs font-normal text-muted">{t({ en: 'No sperm seen: only volume and concentration are printed', ar: 'لم تُشاهد حيوانات منوية: طُبع الحجم والتركيز فقط' })}</span>}
                      </td>
                      <td>{t(CONDITION[c.condition])}</td>
                      <td className="tabular-nums" dir="ltr">
                        {c.tilt === 0 ? '–' : `${Math.abs(c.tilt)}°`}
                      </td>
                      <td className="tabular-nums" dir="ltr">
                        {c.expect ? `${5 - off}/5` : t({ en: 'Refused', ar: 'مرفوضة' })}
                      </td>
                      <td>
                        <StatusPill status={c.pass ? 'pass' : 'fail'} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="max-w-3xl text-sm text-muted">
            {t({
              en: 'What an earlier run taught us: without straightening, the model read 3 of 80 values from the wrong row on a strongly tilted picture. The app now straightens every picture before sending it, and checks that the numbers agree with each other (motility parts add up to 100, volume times concentration gives the total count, percentages carry a % sign). Anything that fails a check is left empty for the person to type.',
              ar: 'ما تعلمناه من تشغيل سابق: دون تعديل الميل، قرأ النموذج 3 من 80 قيمة من الصف الخطأ في صورة شديدة الميل. يعدّل التطبيق الآن ميل كل صورة قبل إرسالها، ويتحقق من توافق الأرقام مع بعضها (أجزاء الحركة مجموعها 100، والحجم مضروباً في التركيز يعطي العدد الكلي، والنسب المئوية تحمل علامة %). وكل ما يفشل في التحقق يُترك فارغاً ليكتبه الشخص.',
            })}
          </p>
        </section>
      )}

      <section className="space-y-4">
        <SectionHeader
          title={t({ en: 'Feedback from people who tried it', ar: 'ملاحظات ممن جرّبوه' })}
          description={t({
            en: 'Live from this link. Each response is two ratings and the time the check took, sent only when someone presses “Send feedback” after a result.',
            ar: 'مباشرةً من هذا الرابط. كل ردّ يتكوّن من تقييمين ومدة الفحص، ويُرسل فقط عند الضغط على «إرسال الملاحظات» بعد ظهور النتيجة.',
          })}
        />
        {feedback && feedback.n > 0 ? (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat icon={Users} label={t({ en: 'Responses', ar: 'الردود' })} value={String(feedback.n)} hint={`EN ${feedback.lang.en} · AR ${feedback.lang.ar}`} />
            <Stat icon={ThumbsUp} label={t({ en: 'Felt private and respectful', ar: 'شعور بالخصوصية والاحترام' })} value={feedback.avgTrust === null ? '–' : `${feedback.avgTrust.toFixed(1)} / 5`} hint={t({ en: 'average', ar: 'المتوسط' })} />
            <Stat icon={MessageSquareHeart} label={t({ en: 'Next step was clear', ar: 'وضوح الخطوة التالية' })} value={feedback.avgClarity === null ? '–' : `${feedback.avgClarity.toFixed(1)} / 5`} hint={t({ en: 'average', ar: 'المتوسط' })} />
            <Stat icon={Clock} label={t({ en: 'Time to finish', ar: 'مدة الإكمال' })} value={feedback.medianSec === null ? '–' : `${(feedback.medianSec / 60).toFixed(1)} min`} hint={t({ en: `median of ${feedback.timed}`, ar: `وسيط ${feedback.timed} ردّاً` })} />
          </div>
        ) : (
          <p className="surface surface-pad text-sm text-muted">{t({ en: 'No responses yet.', ar: 'لا توجد ردود بعد.' })}</p>
        )}
      </section>

      <section className="space-y-4">
        <SectionHeader title={t({ en: 'All test cases', ar: 'جميع حالات الاختبار' })} description={t({ en: 'Written from guidelines, case by case. Titles and reasoning are in English for clinical reviewers.', ar: 'كُتبت استناداً إلى الإرشادات حالةً بحالة، والعناوين والتعليل بالإنجليزية للمراجعين السريريين.' })} />
        <details className="surface group overflow-hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-sm font-medium text-ink hover:bg-canvas/70">
            {t({ en: `Show all ${r.n} cases`, ar: `عرض جميع الحالات (${r.n})` })}
            <ChevronDown className="h-4 w-4 text-faint transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <div className="overflow-x-auto border-t border-line">
            <table className="tbl">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>{t({ en: 'Case', ar: 'الحالة' })}</th>
                  <th>{t({ en: 'Expected', ar: 'المتوقع' })}</th>
                  <th>{t({ en: 'Suggested', ar: 'المقترح' })}</th>
                  <th>{t({ en: 'Reasoning', ar: 'التعليل' })}</th>
                </tr>
              </thead>
              <tbody>
                {r.results.map((x) => (
                  <tr key={x.testCase.id}>
                    <td className="font-mono text-xs">{x.testCase.id}</td>
                    <td className="font-medium text-ink">{x.testCase.title}</td>
                    <td>
                      <OutcomeCell o={x.testCase.expected} />
                    </td>
                    <td>
                      <span className="inline-flex items-center gap-2">
                        <OutcomeCell o={x.predicted} />
                        {!x.correct && <StatusPill status="fail" />}
                      </span>
                    </td>
                    <td className="text-xs text-muted">{x.testCase.why}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <section id="earlier-action" className="scroll-mt-24 space-y-4">
        <SectionHeader
          title={t({ en: 'Evidence of earlier action', ar: 'أدلة التدخل المبكر' })}
          description={t({
            en: 'The six measures the challenge names. For each: how it is collected, what this prototype can already show, and what only a pilot can show. Calibration and false reassurance are reported, not hidden.',
            ar: 'المقاييس الستة التي يذكرها التحدي. لكل منها: طريقة جمعه، وما يستطيع هذا النموذج إظهاره الآن، وما لا تُظهره إلا المرحلة التجريبية. ونُبلغ عن المعايرة والطمأنة الخاطئة ولا نخفيهما.',
          })}
        />
        <div className="surface overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>{t({ en: 'Measure', ar: 'المقياس' })}</th>
                <th>{t({ en: 'How it is collected', ar: 'طريقة الجمع' })}</th>
                <th>{t({ en: 'Shown now', ar: 'ما يظهر الآن' })}</th>
              </tr>
            </thead>
            <tbody>
              {[
                {
                  m: { en: 'Time from risk signal to counselling or assessment', ar: 'الوقت من إشارة الخطر إلى الاستشارة أو التقييم' },
                  h: { en: 'The day a finding first appears, then the day the matching step is booked and done, from the care journey’s own dates (in a pilot, confirmed by Malaffi encounters).', ar: 'يوم ظهور المؤشر أول مرة، ثم يوم حجز الخطوة المناسبة وإتمامها، من تواريخ رحلة الرعاية نفسها (وفي المرحلة التجريبية تؤكدها لقاءات «ملفي»).' },
                  v: `${t({ en: 'Example: Fatima, 38, booked', ar: 'مثال: فاطمة، 38، حجزت' })} ${earlier.fatimaDays ?? '–'} ${t({ en: 'days after the check. Modelled:', ar: 'يوماً بعد الفحص. وفق النموذج:' })} ${earlier.model.meanMonths.toFixed(1)} ${t({ en: 'months earlier than a 12-month rule for', ar: 'أشهر أبكر من قاعدة 12 شهراً لـ' })} ${earlier.model.women.toLocaleString()} ${t({ en: 'invented women', ar: 'امرأة مختلقة' })}`,
                },
                {
                  m: { en: 'Informed-choice quality', ar: 'جودة الاختيار المستنير' },
                  h: { en: 'After a counselling or preservation step: three knowledge questions and one values question, scored as in the Multidimensional Measure of Informed Choice (Marteau 2001): a choice is informed when knowledge is adequate and the choice matches the person’s values.', ar: 'بعد خطوة الاستشارة أو حفظ الخصوبة: ثلاثة أسئلة معرفية وسؤال عن القيم، تُقيَّم كما في مقياس الاختيار المستنير متعدد الأبعاد (Marteau 2001): يكون الاختيار مستنيراً عندما تكون المعرفة كافية ويتوافق مع قيم الشخص.' },
                  v: t({ en: 'Pilot (questions written, not yet in the app)', ar: 'تجريبي (الأسئلة مكتوبة، ولم تُضف إلى التطبيق بعد)' }),
                },
                {
                  m: { en: 'Referral completion', ar: 'إتمام الإحالة' },
                  h: { en: 'Clinician-facing steps marked done, out of those created, by the person or by the clinician’s reply.', ar: 'الخطوات السريرية المكتملة من بين ما أُنشئ، بواسطة الشخص أو رد الطبيب.' },
                  v: `${t({ en: 'Example people:', ar: 'الأشخاص النموذجيون:' })} ${earlier.done} ${t({ en: 'of', ar: 'من' })} ${earlier.done + earlier.open} ${t({ en: 'done', ar: 'مكتملة' })}`,
                },
                {
                  m: { en: 'Equitable reach', ar: 'الوصول العادل' },
                  h: { en: 'Share of each group (language, sex, age, area, nationality) among people starting, finishing and being advised, against its share of the population. Counted only with opt-in consent, totals only.', ar: 'حصة كل مجموعة (اللغة والجنس والعمر والمنطقة والجنسية) بين من بدؤوا وأكملوا ووُجّهوا، مقارنة بحصتها من السكان. يُحتسب فقط بموافقة الشخص، وبأرقام إجمالية فقط.' },
                  v: t({ en: 'Shown on the Health system page, on an invented population', ar: 'معروض في صفحة النظام الصحي، على سكان مختلقين' }),
                },
                {
                  m: { en: 'Calibration', ar: 'المعايرة' },
                  h: { en: 'The app gives a next step, not a probability, so calibration means: how often a clinician confirms the suggested step. Every review records “confirm” or “change, with a reason”, so the data builds itself.', ar: 'يعطي التطبيق خطوة تالية لا احتمالاً، لذا تعني المعايرة: كم مرة يؤكد الطبيب الخطوة المقترحة. كل مراجعة تسجل «تأكيد» أو «تغيير مع السبب»، فتتكوّن البيانات تلقائياً.' },
                  v: `${t({ en: 'Synthetic cases:', ar: 'الحالات الاصطناعية:' })} ${r.correct}/${r.n} ${t({ en: 'match the guideline answer (team-written, not yet clinician-labelled)', ar: 'تطابق إجابة الإرشادات (كتبها الفريق، ولم يصنّفها أطباء بعد)' })}`,
                },
                {
                  m: { en: 'False reassurance', ar: 'الطمأنة الخاطئة' },
                  h: { en: 'Results the app set lower than a clinician later did. In testing: synthetic cases sent lower than the guideline answer. By design, a better result never lowers a step, and a home estimate never reassures.', ar: 'النتائج التي وضعها التطبيق أدنى مما قرره الطبيب لاحقاً. في الاختبار: الحالات الاصطناعية الموجّهة أدنى من إجابة الإرشادات. وبالتصميم، لا تخفض النتيجة الأفضل أي خطوة، ولا يطمئن التقدير المنزلي أبداً.' },
                  v: `${r.underTriage.length} ${t({ en: 'of', ar: 'من' })} ${r.n} ${t({ en: 'under-triaged', ar: 'بفرز ناقص' })} · ${boundsOk}/${bounds.length} ${t({ en: 'boundary checks hold', ar: 'فحوصات حدود ناجحة' })}`,
                },
              ].map((x) => (
                <tr key={x.m.en}>
                  <td className="font-medium text-ink">{t(x.m)}</td>
                  <td>{t(x.h)}</td>
                  <td className="text-sm">{x.v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="surface overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>{t({ en: 'Usage on this device', ar: 'الاستخدام على هذا الجهاز' })}</th>
                <th>{t({ en: 'Value', ar: 'القيمة' })}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{t({ en: 'Checks finished / started', ar: 'الفحوصات المكتملة / التي بدأت' })}</td>
                <td className="tabular-nums" dir="ltr">{`${m.completed} / ${m.started}`}</td>
              </tr>
              <tr>
                <td>{t({ en: 'Median time to complete', ar: 'الوسيط لمدة الإكمال' })}</td>
                <td className="tabular-nums" dir="ltr">{median(m.durationsSec) !== undefined ? `${(median(m.durationsSec)! / 60).toFixed(1)} min` : '–'}</td>
              </tr>
              <tr>
                <td>{t({ en: 'Felt private and respectful (1–5)', ar: 'الشعور بالخصوصية والاحترام (1-5)' })}</td>
                <td className="tabular-nums" dir="ltr">{mean(m.trust) !== undefined ? `${mean(m.trust)!.toFixed(1)} (n=${m.trust.length})` : '–'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <Callout tone="warn" icon={TriangleAlert} title={t({ en: 'Limitations: read before relying on these numbers', ar: 'القيود: اقرأها قبل الاعتماد على هذه الأرقام' })}>
        <ul className="list-disc space-y-1 ps-5">
          <li>{t({ en: 'Expected answers were written by the project team from published guidelines. They need independent labelling by at least two clinicians before the accuracy figure means anything clinically.', ar: 'كتب فريق المشروع الإجابات المتوقعة استناداً إلى الإرشادات، وتحتاج إلى تصنيف مستقل من طبيبين على الأقل قبل أن يكون لرقم الدقة معنى سريري.' })}</li>
          <li>{t({ en: `All cases are synthetic. The ${RULES.length} rules (version 0.2) are not yet clinically validated or reviewed by a regulator.`, ar: `جميع الحالات اصطناعية، والقواعد الـ${RULES.length} (الإصدار 0.2) لم يتم التحقق منها سريرياً بعد ولم تراجعها جهة تنظيمية.` })}</li>
          <li>{t({ en: 'The women’s rules and their 35 test cases are new (November 2026) and have had less review than the men’s. AMH, FSH and cycle reference points are conventions, not cut-offs for a diagnosis.', ar: 'قواعد المرأة وحالات اختبارها الـ35 جديدة (نوفمبر 2026) وخضعت لمراجعة أقل من قواعد الرجل. نقاط AMH وFSH والدورة المرجعية أعراف متبعة، وليست حدوداً للتشخيص.' })}</li>
          <li>{t({ en: 'The earlier-action figure is a model of what the age-adjusted rules do against a 12-month rule, on an invented population. It is not a measured outcome.', ar: 'رقم التدخل المبكر نموذج لما تفعله القواعد المعدّلة حسب العمر مقارنةً بقاعدة 12 شهراً، على سكان مختلقين. وليس نتيجة مقاسة.' })}</li>
          <li>{t({ en: 'Fairness here means the rules cannot see nationality or language, so results cannot change with them. Real-world fairness (who starts, finishes and attends) can only be measured in a pilot.', ar: 'العدالة هنا تعني أن القواعد لا ترى الجنسية أو اللغة، لذا لا تتغير النتائج بسببهما. أما العدالة الفعلية فلا تُقاس إلا في المرحلة التجريبية.' })}</li>
          <li>
            {t({
              en: 'The report reader was tested on synthetic, computer-printed reports only. Real lab reports with stamps, handwriting, glare or folds are harder and have not been measured, which is why the person must confirm every number.',
              ar: 'اختُبر قارئ التقرير على تقارير اصطناعية مطبوعة حاسوبياً فقط. التقارير الحقيقية التي تحمل أختاماً أو كتابة يدوية أو انعكاساً ضوئياً أو طيّات أصعب ولم تُقَس، ولهذا يجب أن يؤكد الشخص كل رقم.',
            })}
          </li>
          <li>
            {t({
              en: 'The private link is a prototype channel: anyone holding the link can read the summary until it expires or is withdrawn, and the doctor is not signed in. A pilot would deliver through Malaffi with clinician sign-in.',
              ar: 'الرابط الخاص قناة تجريبية: من يملك الرابط يستطيع قراءة الملخص حتى انتهاء مدته أو سحبه، والطبيب لا يسجّل الدخول. في المرحلة التجريبية يتم التسليم عبر «ملفي» مع تسجيل دخول الطبيب.',
            })}
          </li>
          <li>{t({ en: 'Arabic text needs review by a native-speaking clinician.', ar: 'يحتاج النص العربي إلى مراجعة من طبيب ناطق بالعربية.' })}</li>
        </ul>
      </Callout>
    </div>
  )
}
