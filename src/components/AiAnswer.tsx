import { BookOpenCheck, ExternalLink, ShieldCheck, TriangleAlert } from 'lucide-react'
import { AI_PROVIDER } from '../lib/ai'
import type { AiProblem } from '../lib/ai'
import { SCOPES } from '../lib/companion/consents'
import type { ConsentScope } from '../lib/companion/consents'
import { useI18n } from '../lib/i18n'
import type { Note } from '../lib/notes'
import { SOURCES } from '../lib/sources'
import { Callout, LayerLabel } from './ui'

/** Asks for one AI permission at the moment it is needed, saying exactly what is sent and to whom. */
export function AiConsent({ scope, onAllow, onDecline }: { scope: ConsentScope; onAllow: () => void; onDecline: () => void }) {
  const { t } = useI18n()
  const s = SCOPES.find((x) => x.scope === scope)
  if (!s) return null
  return (
    <div className="space-y-3 rounded-lg bg-canvas p-4 text-sm text-body ring-1 ring-inset ring-line">
      <p className="font-medium text-ink">
        {t({ en: 'Allow', ar: 'السماح بـ' })} “{t(s.title)}”?
      </p>
      <dl className="grid gap-1 sm:grid-cols-[auto_1fr] sm:gap-x-3">
        <dt className="text-muted">{t({ en: 'What is sent', ar: 'ما يُرسل' })}</dt>
        <dd>{t(s.sends)}</dd>
        <dt className="text-muted">{t({ en: 'To', ar: 'إلى' })}</dt>
        <dd>
          {t(s.to)} ({AI_PROVIDER})
        </dd>
      </dl>
      <p className="text-xs text-muted">{t({ en: 'You can turn this off at any time under Privacy.', ar: 'يمكنك إيقاف ذلك في أي وقت من قسم الخصوصية.' })}</p>
      <div className="flex gap-2">
        <button type="button" className="btn btn-ai btn-sm" onClick={onAllow}>
          {t({ en: 'Allow', ar: 'السماح' })}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onDecline}>
          {t({ en: 'Not now', ar: 'ليس الآن' })}
        </button>
      </div>
    </div>
  )
}

/** An AI answer. Citation marks like [1] link to the notes underneath, each with the sources it was written from. */
export function AiText({ text, notes = [], cited = [] }: { text: string; notes?: Note[]; cited?: string[] }) {
  const { t } = useI18n()
  const used = notes.filter((n) => cited.includes(n.id))
  const parts = text.split(/(\[\d{1,2}\])/g)
  return (
    <div className="space-y-3 rounded-lg border border-ai-100 bg-ai-50/50 p-4">
      <LayerLabel layer="ai" />
      <p className="text-[15px] leading-relaxed whitespace-pre-line text-body">
        {parts.map((p, i) => {
          const m = /^\[(\d{1,2})\]$/.exec(p)
          const note = m ? notes[Number(m[1]) - 1] : undefined
          if (!m) return <span key={i}>{p}</span>
          if (!note) return null
          return (
            <a key={i} href={`#note-${note.id}`} className="mx-0.5 inline-flex h-[18px] min-w-[18px] -translate-y-0.5 items-center justify-center rounded bg-white px-1 align-middle text-[11px] font-semibold text-ai-700 ring-1 ring-ai-100 ring-inset">
              {m[1]}
            </a>
          )
        })}
      </p>
      {used.length > 0 && (
        <div className="space-y-2 border-t border-ai-100 pt-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
            <BookOpenCheck className="h-3.5 w-3.5" aria-hidden />
            {t({ en: 'Answered from these notes only', ar: 'أُجيب من هذه الملاحظات فقط' })}
          </p>
          <ol className="space-y-2">
            {used.map((n) => (
              <li key={n.id} id={`note-${n.id}`} className="rounded-md bg-white px-3 py-2 text-sm ring-1 ring-ai-100 ring-inset">
                <p className="font-medium text-ink">
                  <span className="me-1.5 text-ai-700">[{notes.indexOf(n) + 1}]</span>
                  {t(n.q)}
                </p>
                <p className="mt-0.5 text-muted">{t(n.a)}</p>
                {n.sources.length > 0 && (
                  <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                    {n.sources.map((id) => {
                      const s = SOURCES[id]
                      if (!s) return null
                      return s.url ? (
                        <a key={id} href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand-700 underline-offset-4 hover:underline">
                          {s.short}
                          <ExternalLink className="h-3 w-3" aria-hidden />
                        </a>
                      ) : (
                        <span key={id} className="text-muted">
                          {s.short}
                        </span>
                      )
                    })}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
      <p className="text-xs text-muted">{t({ en: 'AI can make mistakes. Your next step comes from the clinical rules or your doctor, not from this text.', ar: 'قد يخطئ الذكاء الاصطناعي. خطوتك التالية مصدرها القواعد السريرية أو طبيبك، وليس هذا النص.' })}</p>
    </div>
  )
}

/** Problems from any AI call, shown the same way everywhere. */
export function AiProblemNote({ problem, canSave }: { problem: AiProblem; canSave?: boolean }) {
  const { t } = useI18n()
  if (problem === 'emergency')
    return (
      <Callout tone="danger" icon={TriangleAlert}>
        {t({
          en: 'If you have sudden, severe pain or feel very unwell, don’t wait for an answer here. Call 998 or go to the nearest emergency department now.',
          ar: 'إذا كنت تشعر بألم مفاجئ وشديد أو بتوعك شديد، فلا تنتظر إجابة هنا. اتصل بالرقم 998 أو توجّه إلى أقرب قسم طوارئ الآن.',
        })}
      </Callout>
    )
  if (problem === 'no_note')
    return (
      <Callout tone="ai" icon={ShieldCheck}>
        <span className="block text-ink">
          {t({
            en: 'Our notes don’t cover that question yet, so the AI won’t guess. Your family doctor can help with it.',
            ar: 'لا تغطي ملاحظاتنا هذا السؤال بعد، لذا لن يخمّن الذكاء الاصطناعي. يستطيع طبيب الأسرة مساعدتك فيه.',
          })}
        </span>
        {canSave && <span className="mt-1 block text-sm text-muted">{t({ en: 'You can save it to ask at your visit.', ar: 'يمكنك حفظه لتسأله في زيارتك.' })}</span>}
      </Callout>
    )
  if (problem === 'unavailable')
    return <Callout tone="warn">{t({ en: 'The AI helper isn’t available right now. Everything else on this page comes from the clinical rules and works without it.', ar: 'المساعد الذكي غير متاح الآن. كل ما عدا ذلك في هذه الصفحة مصدره القواعد السريرية ويعمل بدونه.' })}</Callout>
  return <Callout tone="warn">{t({ en: 'Something went wrong. Please try again.', ar: 'حدث خطأ ما، يُرجى المحاولة مرة أخرى.' })}</Callout>
}
