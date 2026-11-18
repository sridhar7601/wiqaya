import { Check, ChevronDown, ClipboardList, Copy, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { prepVisit } from '../lib/ai'
import type { AiBasis, AiProblem } from '../lib/ai'
import { useConsents } from '../lib/companion/consents'
import { MODE_LABEL } from '../lib/companion/journey'
import type { JourneyStep, StepKind } from '../lib/companion/journey'
import { useI18n } from '../lib/i18n'
import type { L10n } from '../lib/types'
import { AiConsent, AiProblemNote } from './AiAnswer'
import { useVisitQuestions } from './CompanionAi'
import { LayerLabel } from './ui'

export const PREP_KINDS: StepKind[] = ['specialist', 'fertility', 'primary', 'screening', 'lab_test', 'retest', 'occupational', 'appointment', 'urgent']

/** Fixed questions per kind of visit. They work without AI; the AI can only rephrase and tailor them. */
const QUESTIONS: Partial<Record<StepKind, L10n[]>> = {
  specialist: [
    { en: 'What could explain my results, and which tests do I need?', ar: 'ما الذي قد يفسّر نتائجي، وما التحاليل التي أحتاجها؟' },
    { en: 'Should I repeat the semen analysis, and when?', ar: 'هل يجب أن أعيد تحليل السائل المنوي، ومتى؟' },
    { en: 'Is there anything in my work or habits I should change first?', ar: 'هل هناك ما يجب أن أغيّره أولاً في عملي أو عاداتي؟' },
  ],
  fertility: [
    { en: 'Can we be assessed together, and what does each of us need to do?', ar: 'هل يمكن تقييمنا معاً، وما المطلوب من كل منا؟' },
    { en: 'Which tests should I do before our next visit?', ar: 'ما التحاليل التي يجب أن أجريها قبل زيارتنا القادمة؟' },
    { en: 'How long does the assessment usually take?', ar: 'كم يستغرق التقييم عادةً؟' },
  ],
  primary: [
    { en: 'Which checks do you suggest for me now?', ar: 'ما الفحوصات التي تقترحها لي الآن؟' },
    { en: 'Do I need a referral, and to whom?', ar: 'هل أحتاج إلى تحويل، وإلى من؟' },
    { en: 'What should I change first: weight, sleep, smoking or heat?', ar: 'ما الذي يجب أن أغيّره أولاً: الوزن أو النوم أو التدخين أو الحرارة؟' },
  ],
  screening: [
    { en: 'Can the screening include the reproductive health check for my age group?', ar: 'هل يمكن أن يشمل الفحص فحص الصحة الإنجابية لفئتي العمرية؟' },
    { en: 'Which results should I follow up, and when?', ar: 'ما النتائج التي يجب أن أتابعها، ومتى؟' },
  ],
  lab_test: [
    { en: 'How should I prepare for the sample?', ar: 'كيف أستعد لأخذ العينة؟' },
    { en: 'When and how will I get the results, and who will explain them?', ar: 'متى وكيف سأحصل على النتائج، ومن سيشرحها لي؟' },
  ],
  retest: [
    { en: 'How should I prepare for the sample?', ar: 'كيف أستعد لأخذ العينة؟' },
    { en: 'Will a doctor compare this result with my last one?', ar: 'هل سيقارن الطبيب هذه النتيجة بنتيجتي السابقة؟' },
  ],
  occupational: [
    { en: 'Is my protection at work enough for what I handle?', ar: 'هل وسائل الحماية في عملي كافية لما أتعامل معه؟' },
    { en: 'Is any test worthwhile for my exposure?', ar: 'هل يفيد إجراء أي تحليل بسبب التعرّض في عملي؟' },
  ],
  urgent: [
    { en: 'What should I watch for after this visit?', ar: 'ما الذي يجب أن أنتبه له بعد هذه الزيارة؟' },
    { en: 'Do I need a follow-up appointment?', ar: 'هل أحتاج إلى موعد متابعة؟' },
  ],
  appointment: [
    { en: 'What is the plan after this visit?', ar: 'ما الخطة بعد هذه الزيارة؟' },
    { en: 'Which results should I bring next time?', ar: 'ما النتائج التي يجب أن أحضرها في المرة القادمة؟' },
  ],
}

export interface BringContext {
  semenReports: number
  bpReadings: number
  lensEstimates: number
  work: boolean
}

function bringList(kind: StepKind, b: BringContext): L10n[] {
  const out: L10n[] = []
  if (b.semenReports) out.push({ en: `Your semen analysis report${b.semenReports > 1 ? `s (${b.semenReports})` : ''}`, ar: b.semenReports > 1 ? `تقارير تحليل السائل المنوي (${b.semenReports})` : 'تقرير تحليل السائل المنوي' })
  if (b.bpReadings) out.push({ en: 'Your home blood pressure readings', ar: 'قراءات ضغط الدم المنزلية' })
  if (b.lensEstimates) out.push({ en: 'Your home estimate, marked as a home estimate, not a lab test', ar: 'تقديرك المنزلي، مع توضيح أنه تقدير منزلي وليس تحليلاً مخبرياً' })
  out.push({ en: 'A list of any medicines, supplements or gym products you use', ar: 'قائمة بأي أدوية أو مكملات أو منتجات رياضية تستخدمها' })
  if (kind === 'fertility') out.push({ en: 'Your partner’s test results, if you have them', ar: 'نتائج فحوصات شريكتك إن وُجدت' })
  if (kind === 'occupational' || b.work) out.push({ en: 'What you work with: product names or safety sheets', ar: 'ما تتعامل معه في عملك: أسماء المنتجات أو نشرات السلامة' })
  out.push({ en: 'Your Wiqaya summary link or QR code, if you want to share it', ar: 'رابط ملخص «وقاية» أو رمز QR إن أردت مشاركته' })
  return out
}

/** "Prepare for this visit": what to say first, what to ask, what to bring. Fixed by default; AI can tailor it. */
export function VisitPrep({ step, basis, bring }: { step: JourneyStep; basis: AiBasis; bring: BringContext }) {
  const { t, lang } = useI18n()
  const consents = useConsents()
  const [open, setOpen] = useState(false)
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [ai, setAi] = useState<{ opening: string; questions: string[] } | null>(null)
  const [problem, setProblem] = useState<AiProblem | null>(null)
  const [copied, setCopied] = useState(false)
  const [saved] = useVisitQuestions()

  const booking = step.booking ?? step.offer
  const visit = `${t(step.title)}${booking ? ` · ${t(MODE_LABEL[booking.mode])}` : ''}`
  const findings = basis.flags.filter((f) => !f.info).slice(0, 3)
  const fixedOpening = findings.length
    ? t({
        en: `I used a private health check that suggested this visit. It found: ${findings.map((f) => f.title.toLowerCase()).join('; ')}.`,
        ar: `أجريت فحصاً صحياً خاصاً اقترح هذه الزيارة. ووجد: ${findings.map((f) => f.title).join('؛ ')}.`,
      })
    : t({ en: 'I used a private health check that suggested this visit, and I would like your advice.', ar: 'أجريت فحصاً صحياً خاصاً اقترح هذه الزيارة، وأودّ أن أسمع نصيحتك.' })
  const opening = ai?.opening || fixedOpening
  const questions = ai ? [...saved.filter((q) => !ai.questions.includes(q)), ...ai.questions] : [...saved, ...(QUESTIONS[step.kind] ?? []).map(t)]
  const things = bringList(step.kind, bring).map(t)

  const run = async () => {
    setBusy(true)
    setProblem(null)
    const r = await prepVisit(basis, lang, visit, saved)
    setBusy(false)
    if (r.ok) setAi({ opening: r.opening, questions: r.questions })
    else setProblem(r.reason)
  }
  const tailor = () => {
    if (consents.is('ai_ask') === true) void run()
    else setAsking(true)
  }
  const copy = async () => {
    const text = [
      visit,
      '',
      t({ en: 'Say this first:', ar: 'قل هذا أولاً:' }),
      opening,
      '',
      t({ en: 'Questions to ask:', ar: 'أسئلة لتطرحها:' }),
      ...questions.map((q) => `- ${q}`),
      '',
      t({ en: 'Bring with you:', ar: 'أحضر معك:' }),
      ...things.map((x) => `- ${x}`),
    ].join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <div className="rounded-lg border border-line">
      <button type="button" className="flex w-full items-center justify-between gap-2 px-4 py-3 text-start text-sm font-medium text-ink hover:bg-canvas/70" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-brand-600" aria-hidden />
          {t({ en: 'Prepare for this visit', ar: 'الاستعداد لهذه الزيارة' })}
        </span>
        <ChevronDown className={`h-4 w-4 text-faint transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && (
        <div className="space-y-4 border-t border-line px-4 py-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">{ai ? <LayerLabel layer="ai">{t({ en: 'Tailored by AI from your findings', ar: 'خصّصه الذكاء الاصطناعي من نتائجك' })}</LayerLabel> : <LayerLabel layer="rules">{t({ en: 'Standard preparation', ar: 'استعداد قياسي' })}</LayerLabel>}</div>
          <div className="space-y-1">
            <p className="font-medium text-ink">{t({ en: 'Say this first', ar: 'قل هذا أولاً' })}</p>
            <p className="rounded-md bg-canvas px-3 py-2 text-body">“{opening}”</p>
          </div>
          <div className="space-y-1">
            <p className="font-medium text-ink">{t({ en: 'Questions to ask', ar: 'أسئلة لتطرحها' })}</p>
            <ul className="list-disc space-y-1 ps-5 text-body">
              {questions.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          </div>
          <div className="space-y-1">
            <p className="font-medium text-ink">{t({ en: 'Bring with you', ar: 'أحضر معك' })}</p>
            <ul className="list-disc space-y-1 ps-5 text-body">
              {things.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
          {asking && (
            <AiConsent
              scope="ai_ask"
              onAllow={() => {
                consents.set('ai_ask', true, 'prompt')
                setAsking(false)
                void run()
              }}
              onDecline={() => setAsking(false)}
            />
          )}
          {problem && <AiProblemNote problem={problem} />}
          <div className="flex flex-wrap gap-2">
            {!ai && (
              <button type="button" className="btn btn-ai btn-sm" disabled={busy} onClick={tailor}>
                <Sparkles className="h-4 w-4" aria-hidden />
                {busy ? t({ en: 'Writing…', ar: 'جارٍ الكتابة…' }) : t({ en: 'Tailor it with AI', ar: 'خصّصه بالذكاء الاصطناعي' })}
              </button>
            )}
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => void copy()}>
              {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
              {copied ? t({ en: 'Copied', ar: 'تم النسخ' }) : t({ en: 'Copy to my notes', ar: 'انسخ إلى ملاحظاتي' })}
            </button>
          </div>
          {ai && <p className="text-xs text-muted">{t({ en: 'AI can make mistakes. It only rephrased your findings and questions; your step is unchanged.', ar: 'قد يخطئ الذكاء الاصطناعي. لقد أعاد صياغة نتائجك وأسئلتك فقط، وخطوتك لم تتغير.' })}</p>}
        </div>
      )}
    </div>
  )
}
