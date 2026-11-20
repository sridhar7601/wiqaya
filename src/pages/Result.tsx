import { ArrowRight, Check, ChevronDown, CircleCheck, CircleHelp, FlaskConical, HeartPulse, Info, Layers, ListChecks, LockKeyhole, Pencil, Phone, RotateCcw, Route, Sparkles, Trash2, TriangleAlert } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Callout, Finding, LayerLabel, LevelIcon, LevelPill } from '../components/ui'
import { AI_PROVIDER, askAi } from '../lib/ai'
import type { AiProblem, AiResult } from '../lib/ai'
import { AiProblemNote, AiText } from '../components/AiAnswer'
import { PageNav } from '../components/PageNav'
import { Tour } from '../components/Tour'
import type { TourStep } from '../components/Tour'
import type { PageNavItem } from '../components/PageNav'
import { WhatShapes } from '../components/WhatShapes'
import { assess, num } from '../lib/engine'
import { sendFeedback } from '../lib/feedback'
import { addReply } from '../lib/companion/useCompanion'
import type { StoredReply } from '../lib/companion/useCompanion'
import { ownShares, shareStatus, withdrawAll } from '../lib/handoff'
import type { DoctorReply, OwnShare } from '../lib/handoff'
import { useI18n } from '../lib/i18n'
import { KB, SEMEN_PREP } from '../lib/kb'
import { NOTES } from '../lib/notes'
import { LEVEL_LABEL, nextSteps, safetyNet } from '../lib/services'
import { bumpMetrics, EMPTY_METRICS, load, save, useStored, wipeAll } from '../lib/storage'
import type { Consent, Metrics } from '../lib/storage'
import type { Answers, Assessment, FiredFlag } from '../lib/types'
import { exampleAnswers } from './Example'

const RESULT_TOUR: TourStep[] = [
  { target: 'step', title: { en: 'This is your next step', ar: 'هذه خطوتك التالية' }, body: { en: 'One clear action, chosen by fixed clinical rules. It is screening, not a diagnosis.', ar: 'إجراء واحد واضح تختاره قواعد سريرية ثابتة. هذا فحص أولي وليس تشخيصاً.' } },
  { target: 'found', title: { en: 'Why this step', ar: 'سبب هذه الخطوة' }, body: { en: 'Open any finding to see your answer, the rule behind it and its source.', ar: 'في كل نتيجة: إجابتك، والقاعدة، ومصدرها.' } },
  { target: 'ai', title: { en: 'Want it in plain words?', ar: 'شرح بكلمات بسيطة' }, body: { en: 'The AI helper is optional. It only explains, and it cannot change your step.', ar: 'المساعد الذكي اختياري. يشرح فقط، ولا يستطيع تغيير خطوتك.' } },
  { target: 'share', title: { en: 'Send it to your doctor', ar: 'للمشاركة مع الطبيب' }, body: { en: 'A private link or QR code. You choose what goes in, and you can withdraw it.', ar: 'رابط خاص أو رمز QR. المحتوى باختيارك، ويمكن سحبه في أي وقت.' } },
  { target: 'plan', title: { en: 'Keep going', ar: 'للمتابعة' }, body: { en: 'Turn this result into a plan that follows your cycles, results and habits over time.', ar: 'خطة تتابع الدورة والنتائج والعادات مع الوقت.' } },
]

const RESULT_NAV: PageNavItem[] = [
  { id: 'step', label: { en: 'Your next step', ar: 'خطوتك التالية' }, icon: Route },
  { id: 'found', label: { en: 'What we found', ar: 'ما وجدناه' }, icon: ListChecks },
  { id: 'picture', label: { en: 'What shapes it', ar: 'ما يشكّل الصورة' }, icon: Layers },
  { id: 'questions', label: { en: 'Common questions', ar: 'أسئلة شائعة' }, icon: CircleHelp },
]

export default function Result() {
  const { t } = useI18n()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const exampleId = params.get('example')
  const example = useMemo(() => exampleAnswers(exampleId), [exampleId])
  const [saved] = useState<Answers>(() => load('answers', {}))
  const answers = example ?? saved
  const as = useMemo(() => assess(answers), [answers])

  const edit = () => {
    save('step', 'age')
    nav('/check')
  }
  const ownCheck = () => nav('/check')
  const startAgain = () => {
    save('answers', null)
    save('step', 'age')
    nav('/check')
  }
  const deleteAll = () => {
    if (!window.confirm(t({ en: 'Delete all your answers, results and settings from this device, and withdraw any summary you shared?', ar: 'هل تريد حذف جميع إجاباتك ونتائجك وإعداداتك من هذا الجهاز، وسحب أي ملخص شاركته؟' }))) return
    // Deleting everything includes the encrypted copies stored for a doctor: withdraw them first.
    void withdrawAll().finally(() => {
      wipeAll()
      window.location.hash = '#/'
      window.location.reload()
    })
  }

  if (Object.keys(answers).length === 0) {
    return (
      <div className="container-flow py-16">
        <div className="surface surface-pad space-y-4 text-center">
          <h1 className="title">{t({ en: 'No result yet', ar: 'لا توجد نتيجة بعد' })}</h1>
          <p className="text-muted">{t({ en: 'Take the 5-minute check to see your result.', ar: 'أجرِ الفحص الذي يستغرق 5 دقائق لترى نتيجتك.' })}</p>
          <Link to="/check" className="btn btn-primary">
            {t({ en: 'Start the check', ar: 'ابدأ الفحص' })}
          </Link>
        </div>
      </div>
    )
  }

  if (!as.eligible) {
    const minor = (num(answers, 'age') ?? 99) < 18
    return (
      <div className="container-flow py-16">
        <div className="surface surface-pad space-y-4">
          <h1 className="title">{minor ? t({ en: 'This check is for adults', ar: 'هذا الفحص مخصص للبالغين' }) : t({ en: 'A little more information is needed', ar: 'نحتاج إلى معلومات إضافية قليلة' })}</h1>
          <p className="text-body">
            {minor
              ? t({
                  en: 'If you have a worry about your body, talk to a parent, your school nurse or a doctor. If you have sudden, severe pain in a testicle, call 998 or go to the emergency department now.',
                  ar: 'إذا كان لديك قلق بشأن جسمك، فتحدّث مع أحد والديك أو ممرضة المدرسة أو طبيب. إذا شعرت بألم مفاجئ وشديد في الخصية، فاتصل بالرقم 998 أو توجّه إلى الطوارئ فوراً.',
                })
              : t({ en: 'Please add your age so we can give you the right advice.', ar: 'يُرجى إضافة عمرك لنتمكن من تقديم النصيحة المناسبة.' })}
          </p>
          <button type="button" className="btn btn-secondary" onClick={edit}>
            {t({ en: 'Back to the check', ar: 'العودة إلى الفحص' })}
          </button>
        </div>
      </div>
    )
  }

  const { main, also } = nextSteps(as)
  const groups: { key: string; title: string; flags: FiredFlag[] }[] = [
    { key: 'doctor', title: t({ en: 'Worth discussing with a doctor', ar: 'يستحق النقاش مع طبيب' }), flags: as.flags.filter((f) => f.level !== 'info' && f.level !== 'selfcare') },
    { key: 'habits', title: t({ en: 'Habits you can change', ar: 'عادات يمكنك تغييرها' }), flags: as.flags.filter((f) => f.level === 'selfcare') },
    { key: 'info', title: t({ en: 'Good to know', ar: 'من المفيد معرفته' }), flags: as.flags.filter((f) => f.level === 'info') },
  ].filter((g) => g.flags.length > 0)
  const heartBridge = as.screeningDue || as.flags.some((f) => f.category === 'metabolic' || f.id === 'PC_ED_LIBIDO' || f.id === 'SC_TOBACCO')
  const showPrep = as.sex === 'male' && (as.level === 'specialist' || as.level === 'fertility' || as.flags.some((f) => f.id === 'AN_SEMEN'))

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-10 lg:grid lg:max-w-6xl lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-8 lg:px-8">
      <div id="step" className="stagger min-w-0 scroll-mt-24 space-y-8">
      {/* ---------- Summary ---------- */}
      {as.emergency ? (
        <section className="surface overflow-hidden border-red-300">
          <div className="space-y-5 bg-red-50/60 p-6 sm:p-8">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
              <TriangleAlert className="h-6 w-6" strokeWidth={1.75} aria-hidden />
            </span>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-red-700">{t({ en: 'Emergency', ar: 'حالة طارئة' })}</p>
              <h1 className="title text-red-950">{t(main.title)}</h1>
              <p className="text-red-950/80">{t(main.how)}</p>
            </div>
            <a href="tel:998" className="btn btn-danger btn-lg w-full">
              <Phone className="h-5 w-5" aria-hidden />
              {t({ en: 'Call 998 (ambulance)', ar: 'اتصل بالرقم 998 (الإسعاف)' })}
            </a>
            <ul className="space-y-1.5 text-sm text-red-950/80">
              {main.options.map((o, i) => (
                <li key={i} className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden />
                  {t(o)}
                </li>
              ))}
            </ul>
          </div>
          <SummaryFooter version={as.engineVersion} />
        </section>
      ) : (
        <section data-tour="step" className="surface overflow-hidden">
          <div className="space-y-5 p-6 sm:p-8">
            <div className="flex items-start gap-4">
              <LevelIcon level={as.level} size="lg" />
              <div className="min-w-0 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-muted">{t({ en: 'Your next step', ar: 'خطوتك التالية' })}</p>
                  <LevelPill level={as.level} />
                </div>
                <h1 className="title">{t(main.title)}</h1>
              </div>
            </div>
            <p className="text-body">{t(main.how)}</p>
            <ul className="grid gap-2">
              {main.options.map((o, i) => (
                <li key={i} className="flex gap-2.5 rounded-xl bg-brand-25 px-3.5 py-2.5 text-[15px] text-body ring-1 ring-brand-100">
                  <CircleCheck className="mt-0.5 h-[18px] w-[18px] shrink-0 text-brand-600" strokeWidth={1.75} aria-hidden />
                  {t(o)}
                </li>
              ))}
            </ul>
          </div>
          <SummaryFooter version={as.engineVersion} />
        </section>
      )}

      {!example && <SharedSummary />}

      {!example && !as.emergency && (
        <section data-tour="plan" className="surface flex flex-col gap-4 overflow-hidden border-brand-200 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="space-y-1">
            <p className="eyebrow">{t({ en: 'What happens next', ar: 'ماذا بعد' })}</p>
            <h2 className="text-lg font-semibold text-ink">{t({ en: 'Turn this result into a 90-day plan', ar: 'حوّل هذه النتيجة إلى خطة لتسعين يوماً' })}</h2>
            <p className="text-sm text-muted">{t({ en: 'A care journey with booking help, a 20-second weekly check-in, and your results over time. All on this phone.', ar: 'رحلة رعاية مع مساعدة في الحجز، وتسجيل أسبوعي في 20 ثانية، ونتائجك مع الوقت. وكل ذلك على هذا الهاتف.' })}</p>
          </div>
          <Link to="/me" className="btn btn-primary shrink-0">
            {t({ en: 'Start my plan', ar: 'ابدأ خطتي' })}
            <ArrowRight className="icon-dir h-4 w-4" aria-hidden />
          </Link>
        </section>
      )}

      {example && (
        <Callout tone="info" icon={Info} title={t({ en: 'Example result', ar: 'نتيجة نموذجية' })}>
          {t({ en: 'This is a synthetic person, for demonstration. Your own answers are not affected.', ar: 'هذا شخص اصطناعي للعرض فقط، ولا تتأثر إجاباتك.' })}{' '}
          <button type="button" className="font-semibold underline-offset-4 hover:underline" onClick={ownCheck}>
            {t({ en: 'Take your own check', ar: 'أجرِ فحصك الخاص' })}
          </button>
        </Callout>
      )}

      {/* ---------- Plan ---------- */}
      {also.length > 0 && (
        <section className="space-y-3">
          <h2 className="heading">{t({ en: 'Your plan', ar: 'خطتك' })}</h2>
          <ol className="surface divide-y divide-line">
            {[main, ...also].map((s, i) => (
              <li key={s.key} className="flex gap-4 px-5 py-4">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums ${i === 0 ? 'bg-brand-800 text-white' : 'bg-canvas text-muted ring-1 ring-inset ring-line'}`}
                >
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-ink">{t(s.title)}</p>
                  {i > 0 && <p className="mt-0.5 text-sm text-muted">{t(s.how)}</p>}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {heartBridge && (
        <Callout tone="heart" icon={HeartPulse} title={t({ en: 'Your fertility and your heart share the same risks', ar: 'خصوبتك وقلبك يتشاركان المخاطر نفسها' })}>
          {t({
            en: "Weight, blood sugar, blood pressure, sleep and smoking affect both sperm and your heart. A routine health check with your family doctor covers these in one visit (for Thiqa cardholders, through IFHAS). Booking it protects both.",
            ar: 'يؤثر الوزن وسكر الدم وضغط الدم والنوم والتدخين على الحيوانات المنوية وعلى قلبك. يغطي الفحص الصحي الدوري لدى طبيب الأسرة ذلك في زيارة واحدة (عبر برنامج «إفحص» لحاملي بطاقة «ثقة»)، وحجزه يحمي الاثنين معاً.',
          })}
        </Callout>
      )}

      {as.dataIssues.length > 0 && (
        <Callout tone="warn" icon={Info} title={t({ en: 'Please check these answers', ar: 'يُرجى التحقق من هذه الإجابات' })}>
          <ul className="list-disc space-y-0.5 ps-5">
            {as.dataIssues.map((d) => (
              <li key={d.id}>{t(d.message)}</li>
            ))}
          </ul>
          <button type="button" className="mt-2 inline-flex items-center gap-1.5 font-semibold underline-offset-4 hover:underline" onClick={edit}>
            <Pencil className="h-3.5 w-3.5" aria-hidden />
            {t({ en: 'Edit my answers', ar: 'تعديل إجاباتي' })}
          </button>
        </Callout>
      )}

      {/* ---------- Findings ---------- */}
      <section id="found" data-tour="found" className="scroll-mt-24 space-y-3">
        <div className="flex items-end justify-between gap-3">
          <h2 className="heading">{t({ en: 'What we found', ar: 'ما وجدناه' })}</h2>
          <span className="text-sm text-muted tabular-nums">
            {as.flags.length} {t({ en: as.flags.length === 1 ? 'signal' : 'signals', ar: 'مؤشر' })}
          </span>
        </div>
        {groups.length === 0 ? (
          <div className="surface surface-pad">
            <p className="font-semibold text-ink">{t({ en: 'No risk signals found', ar: 'لم نجد مؤشرات خطر' })}</p>
            <p className="mt-1 text-sm text-muted">
              {t({ en: 'Nothing in your answers needs action now. Keep up routine checks, and come back if anything changes.', ar: 'لا شيء في إجاباتك يحتاج إلى إجراء الآن. حافظ على الفحوصات الدورية، وعُد إذا تغيّر أي شيء.' })}
            </p>
          </div>
        ) : (
          groups.map((g, gi) => (
            <div key={g.key} className="surface overflow-hidden">
              <div className="flex items-center justify-between border-b border-line bg-canvas px-5 py-2.5">
                <p className="text-sm font-semibold text-ink">{g.title}</p>
                <span className="text-xs text-muted tabular-nums">{g.flags.length}</span>
              </div>
              <div className="divide-y divide-line">
                {g.flags.map((f, i) => (
                  <Finding key={f.id} flag={f} defaultOpen={gi === 0 && i === 0} />
                ))}
              </div>
            </div>
          ))
        )}
      </section>

      {as.eligible && (
        <div id="picture" className="scroll-mt-24">
          <WhatShapes as={as} answers={answers} />
        </div>
      )}

      {/* ---------- FAQ ---------- */}
      <section id="questions" className="scroll-mt-24 space-y-3">
        <h2 className="heading">{t({ en: 'Common questions', ar: 'أسئلة شائعة' })}</h2>
        <div className="surface divide-y divide-line">
          {(as.sex === 'female' ? NOTES.filter((n) => ['not_diagnosis', 'f_partner', 'f_age', 'f_amh', 'f_irregular', 'f_folic', 'who_sees'].includes(n.id)) : KB.filter((k) => !showPrep || k.id !== SEMEN_PREP.id)).map((k) => (
            <details key={k.id} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-[15px] font-medium text-ink hover:bg-canvas/70">
                {t(k.q)}
                <ChevronDown className="h-4 w-4 shrink-0 text-faint transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <p className="px-5 pb-4 text-sm leading-relaxed text-muted">{t(k.a)}</p>
            </details>
          ))}
        </div>
      </section>

      </div>

      {/* ---------- Side column on wide screens; continues below on a phone ---------- */}
      <aside className="mt-8 flex flex-col gap-6 lg:mt-0">
      <div data-tour="ai">
        <AiPanel as={as} />
      </div>

      {/* ---------- Share ---------- */}
      <section data-tour="share" className="surface surface-pad space-y-4">
        <div className="space-y-1">
          <h2 className="heading">{t({ en: 'Share it, or keep it private', ar: 'شاركها أو احتفظ بها لنفسك' })}</h2>
          <p className="text-sm text-muted">
            {t({
              en: 'Send your doctor a private link or QR code. You choose exactly what goes in it, it is locked on your phone, and you can withdraw it.',
              ar: 'أرسل إلى طبيبك رابطاً خاصاً أو رمز QR. أنت من يحدد ما يتضمنه بالضبط، ويُقفل على هاتفك، ويمكنك سحبه.',
            })}
          </p>
        </div>
        <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap lg:flex-col">
          <Link to={exampleId ? `/share?example=${exampleId}` : '/share'} className="btn btn-primary">
            {t({ en: 'Prepare a summary', ar: 'جهّز ملخصاً' })}
            <ArrowRight className="icon-dir h-4 w-4" aria-hidden />
          </Link>
          {example ? (
            <button type="button" className="btn btn-secondary" onClick={ownCheck}>
              {t({ en: 'Take your own check', ar: 'أجرِ فحصك الخاص' })}
            </button>
          ) : (
            <>
              <button type="button" className="btn btn-secondary" onClick={edit}>
                <Pencil className="h-4 w-4" aria-hidden />
                {t({ en: 'Edit answers', ar: 'تعديل الإجابات' })}
              </button>
              <button type="button" className="btn btn-secondary" onClick={startAgain}>
                <RotateCcw className="h-4 w-4" aria-hidden />
                {t({ en: 'Start again', ar: 'البدء من جديد' })}
              </button>
            </>
          )}
        </div>
      </section>

      {showPrep && (
        <Callout tone="info" icon={FlaskConical} title={t(SEMEN_PREP.q)}>
          {t(SEMEN_PREP.a)}
        </Callout>
      )}

      <Callout tone="danger" icon={TriangleAlert} title={t({ en: 'Get help quickly if…', ar: 'اطلب المساعدة بسرعة إذا…' })}>
        <ul className="space-y-1">
          {safetyNet(as.sex).map((s, i) => (
            <li key={i}>{t(s)}</li>
          ))}
        </ul>
      </Callout>

      {!example && <TrustSurvey />}

      <div className="flex flex-col items-center gap-1 pt-2">
        <button type="button" className="inline-flex items-center gap-1.5 text-sm font-medium text-red-600 hover:text-red-700" onClick={deleteAll}>
          <Trash2 className="h-4 w-4" aria-hidden />
          {t({ en: 'Delete all my data from this device', ar: 'احذف جميع بياناتي من هذا الجهاز' })}
        </button>
      </div>
      <PageNav className="sticky top-24 hidden lg:block" items={RESULT_NAV} />
      <Tour id="result" steps={RESULT_TOUR} />
      </aside>
    </div>
  )
}

function SummaryFooter({ version }: { version: string }) {
  const { t } = useI18n()
  return (
    <div className="flex flex-col gap-1.5 border-t border-line bg-canvas px-6 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
      <LayerLabel layer="rules">{t({ en: 'Decided by fixed clinical rules, not by AI', ar: 'حددته قواعد سريرية ثابتة، لا الذكاء الاصطناعي' })}</LayerLabel>
      <span className="text-xs text-faint">
        {t({ en: 'Screening, not a diagnosis', ar: 'فحص أولي، لا تشخيص' })} · {version}
      </span>
    </div>
  )
}

function AiPanel({ as }: { as: Assessment }) {
  const { t, lang } = useI18n()
  const [consent, setConsent] = useStored<Consent | null>('consent', null)
  const [busy, setBusy] = useState(false)
  const [answer, setAnswer] = useState<Extract<AiResult, { ok: true }> | null>(null)
  const [problem, setProblem] = useState<AiProblem | null>(null)
  const [question, setQuestion] = useState('')
  const [asking, setAsking] = useState<'explain' | 'ask' | null>(null)

  const run = async (mode: 'explain' | 'ask', allowed = consent?.aiOptIn) => {
    if (!allowed) {
      setAsking(mode)
      return
    }
    setBusy(true)
    setProblem(null)
    const r = await askAi(as, lang, mode, mode === 'ask' ? question : undefined)
    setBusy(false)
    if (r.ok) setAnswer(r)
    else {
      setAnswer(null)
      setProblem(r.reason)
    }
  }

  return (
    <section className="surface overflow-hidden">
      <div className="flex items-start gap-3 border-b border-ai-100 bg-ai-50 px-5 py-4 sm:px-6">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-ai-600 ring-1 ring-inset ring-ai-100">
          <Sparkles className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
        </span>
        <div className="space-y-0.5">
          <h2 className="text-base font-semibold text-ink">{t({ en: 'Explain it in plain words', ar: 'اشرحها بكلمات بسيطة' })}</h2>
          <p className="text-sm text-muted">
            {t({
              en: 'Optional. The AI helper sees a summary of your result, never your answers or who you are, and cannot change your next step.',
              ar: 'اختياري. يرى المساعد الذكي ملخص نتيجتك فقط، ولا يرى إجاباتك أو هويتك، ولا يستطيع تغيير خطوتك التالية.',
            })}
          </p>
        </div>
      </div>

      <div className="space-y-4 p-5 sm:p-6">
        {asking && !consent?.aiOptIn && (
          <div className="space-y-3 rounded-lg bg-canvas p-4 text-sm text-body ring-1 ring-inset ring-line">
            <p>
              {t({
                en: `Allow the AI helper? The titles of what was found, your suggested step, and whether this is a woman’s or a man’s check will be sent to our AI service (${AI_PROVIDER}). Your other answers, name and contact details are never sent.`,
                ar: `هل تسمح للمساعد الذكي؟ ستُرسل عناوين ما تم العثور عليه وخطوتك المقترحة، وهل الفحص لامرأة أم لرجل، إلى خدمة الذكاء الاصطناعي لدينا (${AI_PROVIDER}). لا تُرسل إجاباتك الأخرى أو اسمك أو بيانات التواصل أبداً.`,
              })}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn btn-ai btn-sm"
                onClick={() => {
                  setConsent({ ...(consent ?? { version: 'consent-0.1', at: new Date().toISOString() }), aiOptIn: true })
                  setAsking(null)
                  void run(asking, true)
                }}
              >
                {t({ en: 'Allow', ar: 'السماح' })}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAsking(null)}>
                {t({ en: 'Not now', ar: 'ليس الآن' })}
              </button>
            </div>
          </div>
        )}

        {answer && <AiText text={answer.text} notes={answer.notes} cited={answer.cited} />}
        {problem && <AiProblemNote problem={problem} />}

        <div className="space-y-3">
          <button type="button" className="btn btn-ai w-full sm:w-auto" disabled={busy} onClick={() => void run('explain')}>
            <Sparkles className="h-4 w-4" aria-hidden />
            {busy ? t({ en: 'Writing…', ar: 'جارٍ الكتابة…' }) : t({ en: 'Explain my result', ar: 'اشرح نتيجتي' })}
          </button>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (question.trim().length >= 3) void run('ask')
            }}
          >
            <input className="input" maxLength={300} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={t({ en: 'Or ask a question…', ar: 'أو اطرح سؤالاً…' })} />
            <button type="submit" className="btn btn-secondary" disabled={busy || question.trim().length < 3}>
              {t({ en: 'Ask', ar: 'اسأل' })}
            </button>
          </form>
          <p className="text-xs text-muted">{t({ en: 'Please don’t type your name or other personal details.', ar: 'يُرجى عدم كتابة اسمك أو أي بيانات شخصية أخرى.' })}</p>
        </div>
      </div>
    </section>
  )
}

/** If the person shared a summary, show where it stands, and the doctor's reply when there is one. */
function SharedSummary() {
  const { t } = useI18n()
  const [share] = useState<OwnShare | undefined>(() => ownShares().find((s) => !s.synthetic))
  const [reply, setReply] = useState<DoctorReply | null>(null)
  const [, setReplies] = useStored<StoredReply[]>('replies', [])
  const [opened, setOpened] = useState(false)

  useEffect(() => {
    if (!share) return
    void shareStatus(share).then((s) => {
      if (!s.ok) return
      setReply(s.status.reply)
      setOpened(s.status.opens > 0)
      const r = s.status.reply
      if (r) setReplies((list) => addReply(list, r, share.id))
    })
  }, [share, setReplies])

  if (!share) return null
  return (
    <section className={`surface space-y-2 px-5 py-4 sm:px-6 ${reply ? 'border-gold-300 bg-gold-50' : ''}`}>
      {reply ? (
        <>
          <LayerLabel layer="human">{t({ en: 'Your doctor’s reply', ar: 'ردّ طبيبك' })}</LayerLabel>
          <p className="text-[15px] text-ink">
            <span className="font-semibold">{reply.decision === 'agree' ? t({ en: 'Confirmed:', ar: 'تم التأكيد:' }) : t({ en: 'Changed to:', ar: 'تم التعديل إلى:' })}</span> {t(LEVEL_LABEL[reply.level])}
          </p>
          {reply.reason && <p className="text-sm text-body">“{reply.reason}”</p>}
          <p className="text-xs text-muted">{reply.reviewer}</p>
        </>
      ) : (
        <p className="flex items-center gap-2 text-sm text-body">
          <LockKeyhole className="h-4 w-4 shrink-0 text-brand-600" aria-hidden />
          {opened ? t({ en: 'Your doctor has opened the summary you shared. No reply yet.', ar: 'فتح طبيبك الملخص الذي شاركته، ولم يردّ بعد.' }) : t({ en: 'You shared a summary by private link. It has not been opened yet.', ar: 'شاركتَ ملخصاً عبر رابط خاص، ولم يُفتح بعد.' })}
        </p>
      )}
      <Link to="/share" className="link inline-flex items-center gap-1.5 text-sm">
        {t({ en: 'View or withdraw the link', ar: 'عرض الرابط أو سحبه' })}
        <ArrowRight className="icon-dir h-4 w-4" aria-hidden />
      </Link>
    </section>
  )
}

function TrustSurvey() {
  const { t, lang } = useI18n()
  const [done, setDone] = useStored<boolean>('surveyDone', false)
  const [trust, setTrust] = useState<number | null>(null)
  const [clarity, setClarity] = useState<number | null>(null)

  if (done) {
    return (
      <p className="flex items-center justify-center gap-2 text-sm text-muted">
        <CircleCheck className="h-4 w-4 text-emerald-600" aria-hidden />
        {t({ en: 'Thank you for your feedback.', ar: 'شكراً على ملاحظاتك.' })}
      </p>
    )
  }

  const scale = (label: string, value: number | null, set: (n: number) => void) => (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-ink">{label}</legend>
      <div className="inline-flex overflow-hidden rounded-lg border border-line-strong shadow-xs" dir="ltr">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={value === n}
            onClick={() => set(n)}
            className={`h-10 w-12 border-line-strong text-sm font-semibold transition-colors not-first:border-l ${value === n ? 'bg-brand-800 text-white' : 'bg-white text-body hover:bg-canvas'}`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex w-60 justify-between text-xs text-faint" dir="ltr">
        <span>{t({ en: 'Not at all', ar: 'إطلاقاً' })}</span>
        <span>{t({ en: 'Completely', ar: 'تماماً' })}</span>
      </div>
    </fieldset>
  )

  return (
    <section className="surface surface-pad space-y-5">
      <div className="space-y-1">
        <h2 className="heading">{t({ en: 'Two quick questions', ar: 'سؤالان سريعان' })}</h2>
        <p className="text-sm text-muted">
          {t({
            en: 'Anonymous. Pressing Send shares only these two ratings, how long the check took and the language. Never your answers or your result.',
            ar: 'دون كشف الهوية. عند الضغط على «إرسال» يُرسل هذان التقييمان ومدة الفحص واللغة فقط، ولا تُرسل إجاباتك أو نتيجتك أبداً.',
          })}
        </p>
      </div>
      {scale(t({ en: 'Did this feel private and respectful?', ar: 'هل شعرت بالخصوصية والاحترام؟' }), trust, setTrust)}
      {scale(t({ en: 'Is your next step clear?', ar: 'هل خطوتك التالية واضحة؟' }), clarity, setClarity)}
      <button
        type="button"
        className="btn btn-secondary"
        disabled={trust === null || clarity === null}
        onClick={() => {
          bumpMetrics((m) => ({ ...m, trust: [...m.trust, trust!].slice(-500), clarity: [...m.clarity, clarity!].slice(-500) }))
          // Sent once, without waiting: the thank-you does not depend on the network.
          void sendFeedback({ trust: trust!, clarity: clarity!, durationSec: load<Metrics>('metrics', EMPTY_METRICS).durationsSec.at(-1), lang })
          setDone(true)
        }}
      >
        {t({ en: 'Send feedback', ar: 'إرسال الملاحظات' })}
      </button>
    </section>
  )
}
