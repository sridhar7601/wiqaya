import { BookmarkPlus, Check, MessageCircleQuestion, Sparkles, X } from 'lucide-react'
import { useState } from 'react'
import { askGrounded, explainAi } from '../lib/ai'
import type { AiBasis, AiProblem, AiResult } from '../lib/ai'
import { useConsents } from '../lib/companion/consents'
import type { ConsentScope } from '../lib/companion/consents'
import { useI18n } from '../lib/i18n'
import type { Sex } from '../lib/types'
import { suggestNotes } from '../lib/notes'
import { useStored } from '../lib/storage'
import { AiConsent, AiProblemNote, AiText } from './AiAnswer'

/** Questions the person wants to ask at a visit. Kept on the phone; used by the visit preparation. */
export const VISIT_QUESTIONS_KEY = 'visitQuestions'
export const useVisitQuestions = () => useStored<string[]>(VISIT_QUESTIONS_KEY, [])

type Pending = { scope: ConsentScope; run: () => void }

/**
 * "Ask about your plan": a plain-words explanation of the 90-day plan, and questions answered only from
 * the team's notes, with the sources shown. The AI sees titles only and cannot change the next step.
 */
export function CompanionAi({ basis, flagIds, sex = 'male' }: { basis: AiBasis; flagIds: string[]; sex?: Sex }) {
  const { t, lang } = useI18n()
  const consents = useConsents()
  const [pending, setPending] = useState<Pending | null>(null)
  const [busy, setBusy] = useState<'explain' | 'ask' | null>(null)
  const [answer, setAnswer] = useState<Extract<AiResult, { ok: true }> | null>(null)
  const [problem, setProblem] = useState<AiProblem | null>(null)
  const [question, setQuestion] = useState('')
  const [asked, setAsked] = useState('')
  const [saved, setSaved] = useVisitQuestions()
  const suggestions = suggestNotes(flagIds, 3, sex)

  const withConsent = (scope: ConsentScope, run: () => void) => {
    if (consents.is(scope) === true) run()
    else setPending({ scope, run })
  }

  const handle = (r: AiResult) => {
    if (r.ok) {
      setAnswer(r)
      setProblem(null)
    } else {
      setAnswer(null)
      setProblem(r.reason)
    }
  }

  const explain = () =>
    withConsent('ai_explain', async () => {
      setBusy('explain')
      setAsked('')
      handle(await explainAi(basis, lang))
      setBusy(null)
    })

  const ask = (q: string) =>
    withConsent('ai_ask', async () => {
      setBusy('ask')
      setAsked(q)
      handle(await askGrounded(basis, lang, q, sex))
      setBusy(null)
    })

  const canSave = !!asked && !saved.includes(asked)

  return (
    <section className="surface overflow-hidden">
      <div className="flex items-start gap-3 border-b border-ai-100 bg-ai-50 px-5 py-4 sm:px-6">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-ai-600 ring-1 ring-ai-100 ring-inset">
          <Sparkles className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
        </span>
        <div className="space-y-0.5">
          <h2 className="text-base font-semibold text-ink">{t({ en: 'Ask about your plan', ar: 'اسأل عن خطتك' })}</h2>
          <p className="text-sm text-muted">
            {t({
              en: 'Optional. Answers come only from our notes, with their sources. The AI sees titles, never your answers, and cannot change your next step.',
              ar: 'اختياري. تأتي الإجابات من ملاحظاتنا فقط مع مصادرها. يرى الذكاء الاصطناعي العناوين فقط، لا إجاباتك، ولا يستطيع تغيير خطوتك التالية.',
            })}
          </p>
        </div>
      </div>

      <div className="space-y-4 p-5 sm:p-6">
        {pending && (
          <AiConsent
            scope={pending.scope}
            onAllow={() => {
              consents.set(pending.scope, true, 'prompt')
              const run = pending.run
              setPending(null)
              run()
            }}
            onDecline={() => setPending(null)}
          />
        )}

        {asked && (answer || problem) && (
          <p className="flex items-start gap-2 text-sm font-medium text-ink">
            <MessageCircleQuestion className="mt-0.5 h-4 w-4 shrink-0 text-ai-600" aria-hidden />
            {asked}
          </p>
        )}
        {answer && <AiText text={answer.text} notes={answer.notes} cited={answer.cited} />}
        {problem && <AiProblemNote problem={problem} canSave={problem === 'no_note' && canSave} />}
        {asked && (answer || problem === 'no_note') && (
          <button type="button" className="btn btn-ghost btn-sm" disabled={!canSave} onClick={() => setSaved((l) => [...l, asked].slice(-6))}>
            {canSave ? <BookmarkPlus className="h-4 w-4" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />}
            {canSave ? t({ en: 'Save to ask at my visit', ar: 'احفظه لأسأله في زيارتي' }) : t({ en: 'Saved for your visit', ar: 'محفوظ لزيارتك' })}
          </button>
        )}

        <div className="space-y-3">
          <button type="button" className="btn btn-ai w-full sm:w-auto" disabled={!!busy} onClick={explain}>
            <Sparkles className="h-4 w-4" aria-hidden />
            {busy === 'explain' ? t({ en: 'Writing…', ar: 'جارٍ الكتابة…' }) : t({ en: 'Explain my plan in plain words', ar: 'اشرح خطتي بكلمات بسيطة' })}
          </button>

          <div className="flex flex-wrap gap-2" aria-label={t({ en: 'Suggested questions', ar: 'أسئلة مقترحة' })}>
            {suggestions.map((n) => (
              <button key={n.id} type="button" className="rounded-full bg-white px-3 py-1.5 text-start text-sm text-ai-700 ring-1 ring-ai-100 ring-inset hover:bg-ai-50 disabled:opacity-60" disabled={!!busy} onClick={() => ask(t(n.q))}>
                {t(n.q)}
              </button>
            ))}
          </div>

          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              const q = question.trim()
              if (q.length >= 3) ask(q)
            }}
          >
            <input className="input" maxLength={300} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={t({ en: 'Or type your own question…', ar: 'أو اكتب سؤالك…' })} />
            <button type="submit" className="btn btn-secondary" disabled={!!busy || question.trim().length < 3}>
              {busy === 'ask' ? t({ en: 'Asking…', ar: 'جارٍ السؤال…' }) : t({ en: 'Ask', ar: 'اسأل' })}
            </button>
          </form>
          <p className="text-xs text-muted">{t({ en: 'Please don’t type your name or other personal details.', ar: 'يُرجى عدم كتابة اسمك أو أي بيانات شخصية أخرى.' })}</p>
        </div>

        {saved.length > 0 && (
          <div className="space-y-2 border-t border-line pt-4">
            <p className="text-sm font-medium text-ink">{t({ en: 'Saved for your visit', ar: 'محفوظ لزيارتك' })}</p>
            <ul className="space-y-1.5">
              {saved.map((q) => (
                <li key={q} className="flex items-start justify-between gap-2 rounded-md bg-canvas px-3 py-2 text-sm text-body">
                  <span>{q}</span>
                  <button type="button" className="text-faint hover:text-ink" aria-label={t({ en: 'Remove', ar: 'إزالة' })} onClick={() => setSaved((l) => l.filter((x) => x !== q))}>
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted">{t({ en: 'They appear in “Prepare for this visit” on your care journey.', ar: 'تظهر في «الاستعداد لهذه الزيارة» ضمن رحلة الرعاية.' })}</p>
          </div>
        )}
      </div>
    </section>
  )
}
