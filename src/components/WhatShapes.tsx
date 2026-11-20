import { CircleHelp, Lock, Sprout, Library } from 'lucide-react'
import { useState } from 'react'
import { useI18n } from '../lib/i18n'
import type { Answers, Assessment, FiredFlag, L10n } from '../lib/types'
import { Sources } from './ui'

/**
 * "What shapes this picture": the plain-language interpretation the challenge asks for. It sorts the same
 * findings the rules produced into what the person can change and what they cannot, lists the evidence, and,
 * just as prominently, what the picture does not know. Nothing here is computed by AI and nothing is a score.
 */
export interface ShapesInput {
  as: Assessment
  answers: Answers
  /** Findings to sort; on the companion these include trends and work. Defaults to the first check's. */
  flags?: FiredFlag[]
  /** Results kept over time, if known (companion only). */
  results?: { semen: number; ovarian: number; cycles: number }
}

const has = (a: Answers, id: string) => a[id] !== undefined && a[id] !== ''

/** What limits the picture: missing data first, then what no data can tell. Pure, so it is tested. */
export function limits({ as, answers, results }: ShapesInput): L10n[] {
  const out: L10n[] = []
  const female = as.sex === 'female'
  if (!has(answers, 'height_cm') || !has(answers, 'weight_kg')) out.push({ en: 'No height and weight, so weight could not be taken into account.', ar: 'لا يوجد طول ووزن، لذلك لم يُؤخذ الوزن في الحسبان.' })
  if (as.declined.length) out.push({ en: `You chose not to answer ${as.declined.length} question${as.declined.length > 1 ? 's' : ''}. That is fine; the picture is less complete.`, ar: `اخترت عدم الإجابة عن ${as.declined.length} من الأسئلة. لا بأس بذلك، لكن الصورة أقل اكتمالاً.` })
  if (as.dataIssues.length) out.push({ en: `${as.dataIssues.length} value${as.dataIssues.length > 1 ? 's' : ''} looked wrong and ${as.dataIssues.length > 1 ? 'were' : 'was'} left out.`, ar: `بدت ${as.dataIssues.length} من القيم غير صحيحة فاستُبعدت.` })
  if (female) {
    const hormones = (results?.ovarian ?? 0) > 0 || answers.hormone_done === 'yes'
    if (!hormones) out.push({ en: 'No hormone or egg-reserve (AMH) results yet. They are not needed for most people; a doctor decides whether they are useful.', ar: 'لا توجد نتائج للهرمونات أو لمخزون البويضات (AMH) بعد. لا يحتاجها معظم الناس، والطبيب يقرر إن كانت مفيدة.' })
    if ((results?.cycles ?? 0) < 3) out.push({ en: 'Your cycle pattern comes from one answer, not from tracking. Three months of check-ins would show the real pattern.', ar: 'نمط دورتك مأخوذ من إجابة واحدة لا من التتبع. ثلاثة أشهر من التسجيلات تُظهر النمط الحقيقي.' })
    if (answers.ttc === 'yes') out.push({ en: 'Half of the picture is your partner’s. His own check and a semen analysis complete it.', ar: 'نصف الصورة لدى شريكك. يكتمل بفحصه الخاص وتحليل السائل المنوي.' })
    out.push({ en: 'No test can say when, or whether, you will get pregnant. AMH shows roughly how many eggs remain, not their quality, and it does not predict natural pregnancy.', ar: 'لا يوجد تحليل يحدد متى أو هل ستحملين. يُظهر AMH تقريباً عدد البويضات المتبقية لا جودتها، ولا يتنبأ بالحمل الطبيعي.' })
  } else {
    const semen = (results?.semen ?? 0) > 0 || answers.semen_done === 'yes'
    if (!semen) out.push({ en: 'No semen analysis yet: it is the only way to know the numbers.', ar: 'لا يوجد تحليل للسائل المنوي بعد، وهو الطريقة الوحيدة لمعرفة الأرقام.' })
    else if ((results?.semen ?? 1) < 2) out.push({ en: 'One semen analysis varies a lot from the next; doctors look at two.', ar: 'تتفاوت نتيجة تحليل السائل المنوي كثيراً من مرة لأخرى، ولذلك ينظر الأطباء إلى تحليلين.' })
    if (answers.ttc === 'yes') out.push({ en: 'Half of the picture is your partner’s. Fertility services assess you together.', ar: 'نصف الصورة لدى شريكتك، وتقيّمكما خدمات الخصوبة معاً.' })
  }
  out.push({ en: 'This is screening, not a diagnosis. It points to the right conversation; a clinician makes the decisions.', ar: 'هذا فحص أولي وليس تشخيصاً. يوجّهك إلى المحادثة المناسبة، والقرار للطبيب.' })
  return out
}

type Tab = 'can' | 'cannot' | 'unknown' | 'evidence'

/** Four short tabs instead of four columns of text: one thing to read at a time. */
export function WhatShapes(p: ShapesInput) {
  const { t } = useI18n()
  const flags = (p.flags ?? p.as.flags).filter((f) => !f.emergency)
  const can = flags.filter((f) => f.changeable)
  const cannot = flags.filter((f) => !f.changeable)
  const age = typeof p.answers.age === 'number' ? p.answers.age : undefined
  const sources = [...new Set(flags.flatMap((f) => f.sources))]
  const unknown = limits(p)
  const [tab, setTab] = useState<Tab>(can.length ? 'can' : 'unknown')

  const ALL_TABS: { id: Tab; icon: typeof Lock; label: L10n; n: number }[] = [
    { id: 'can', icon: Sprout, label: { en: 'Can change', ar: 'يمكن تغييره' }, n: can.length },
    { id: 'cannot', icon: Lock, label: { en: 'Cannot change', ar: 'لا يمكن تغييره' }, n: cannot.length + (age !== undefined ? 1 : 0) },
    { id: 'unknown', icon: CircleHelp, label: { en: 'Not known yet', ar: 'غير معروف بعد' }, n: unknown.length },
    { id: 'evidence', icon: Library, label: { en: 'Evidence', ar: 'الأدلة' }, n: sources.length },
  ]
  // An empty tab is one more thing to click for nothing.
  const TABS = ALL_TABS.filter((x) => x.n > 0)
  const rows = (items: string[], empty: L10n) =>
    items.length ? (
      <ul className="stagger space-y-2">
        {items.map((x) => (
          <li key={x} className="flex gap-3 rounded-xl bg-canvas px-4 py-3 text-[15px] leading-snug text-body ring-1 ring-line">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" aria-hidden />
            {x}
          </li>
        ))}
      </ul>
    ) : (
      <p className="rounded-xl bg-canvas px-4 py-3 text-[15px] text-muted ring-1 ring-line">{t(empty)}</p>
    )

  return (
    <section className="surface overflow-hidden">
      <div className="space-y-1 px-5 pt-5 sm:px-6 sm:pt-6">
        <h2 className="heading">{t({ en: 'What shapes this picture', ar: 'ما الذي يشكّل هذه الصورة' })}</h2>
        <p className="text-sm text-muted">{t({ en: 'No fertility score, on purpose.', ar: 'بلا درجة للخصوبة، عن قصد.' })}</p>
      </div>
      <div className="-mx-px mt-4 flex gap-1.5 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:px-6 [&::-webkit-scrollbar]:hidden" role="tablist" aria-label={t({ en: 'What shapes this picture', ar: 'ما الذي يشكّل هذه الصورة' })}>
        {TABS.map((x) => {
          const on = tab === x.id
          return (
            <button
              key={x.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setTab(x.id)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition-all duration-200 ${on ? 'bg-brand-800 text-white shadow-sm' : 'bg-canvas text-body ring-1 ring-line hover:bg-brand-25'}`}
            >
              <x.icon className="h-4 w-4" aria-hidden />
              {t(x.label)}
              <span className={`rounded-full px-1.5 text-xs tabular-nums ${on ? 'bg-white/20' : 'bg-white text-muted ring-1 ring-line'}`}>{x.n}</span>
            </button>
          )
        })}
      </div>
      <div key={tab} className="anim-next space-y-3 p-5 sm:p-6" role="tabpanel">
        {tab === 'can' && rows(can.map((f) => t(f.title)), { en: 'Nothing here needs changing now.', ar: 'لا شيء هنا يحتاج إلى تغيير الآن.' })}
        {tab === 'cannot' &&
          rows(
            [...(age !== undefined ? [t({ en: `Your age (${age}). Fertility changes with age for everyone, at different speeds.`, ar: `عمرك (${age}). تتغير الخصوبة مع العمر لدى الجميع، وبسرعات مختلفة.` })] : []), ...cannot.map((f) => t(f.title))],
            { en: 'No fixed factors found.', ar: 'لم نجد عوامل ثابتة.' },
          )}
        {tab === 'cannot' && <p className="text-xs text-faint">{t({ en: 'You cannot change these, but you can plan around them.', ar: 'لا يمكنك تغيير هذه الأمور، لكن يمكنك التخطيط حولها.' })}</p>}
        {tab === 'unknown' && rows(unknown.map((l) => t(l)), { en: 'Nothing listed.', ar: 'لا شيء.' })}
        {tab === 'evidence' && (
          <>
            {sources.length ? <Sources ids={sources} /> : <p className="text-sm text-muted">{t({ en: 'No findings, so no sources to show.', ar: 'لا توجد مؤشرات، لذا لا مصادر لعرضها.' })}</p>}
            <p className="text-xs text-faint">{t({ en: 'Published guidelines and studies. Fixed rules apply them; the AI does not.', ar: 'إرشادات ودراسات منشورة. تطبّقها قواعد ثابتة، لا الذكاء الاصطناعي.' })}</p>
          </>
        )}
      </div>
    </section>
  )
}
