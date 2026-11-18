import { CircleHelp, Lock, Sprout, Library } from 'lucide-react'
import type { ReactNode } from 'react'
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

function Column({ icon: Icon, title, children }: { icon: typeof Lock; title: string; children: ReactNode }) {
  return (
    <div className="space-y-2.5 p-5">
      <p className="flex items-center gap-2 text-sm font-semibold text-ink">
        <Icon className="h-4 w-4 text-brand-600" aria-hidden />
        {title}
      </p>
      {children}
    </div>
  )
}

export function WhatShapes(p: ShapesInput) {
  const { t } = useI18n()
  const flags = (p.flags ?? p.as.flags).filter((f) => !f.emergency)
  const can = flags.filter((f) => f.changeable)
  const cannot = flags.filter((f) => !f.changeable)
  const age = typeof p.answers.age === 'number' ? p.answers.age : undefined
  const sources = [...new Set(flags.flatMap((f) => f.sources))]
  const list = (fs: FiredFlag[], empty: L10n) =>
    fs.length ? (
      <ul className="space-y-1.5 text-sm text-body">
        {fs.map((f) => (
          <li key={f.id} className="leading-snug">
            {t(f.title)}
          </li>
        ))}
      </ul>
    ) : (
      <p className="text-sm text-muted">{t(empty)}</p>
    )

  return (
    <section className="surface overflow-hidden">
      <div className="space-y-1 border-b border-line px-5 py-4">
        <h2 className="heading">{t({ en: 'What shapes this picture', ar: 'ما الذي يشكّل هذه الصورة' })}</h2>
        <p className="text-sm text-muted">
          {t({
            en: 'There is no fertility score here on purpose. These are the things behind your next step, and what is still unknown.',
            ar: 'لا توجد هنا درجة للخصوبة عن قصد. هذه هي الأمور التي تقف وراء خطوتك التالية، وما لا يزال مجهولاً.',
          })}
        </p>
      </div>
      <div className="grid divide-y divide-line md:grid-cols-2 md:divide-x md:divide-y-0 rtl:md:divide-x-reverse">
        <Column icon={Sprout} title={t({ en: 'You can change or treat', ar: 'يمكنك تغييره أو علاجه' })}>
          {list(can, { en: 'Nothing here needs changing now.', ar: 'لا شيء هنا يحتاج إلى تغيير الآن.' })}
        </Column>
        <Column icon={Lock} title={t({ en: 'You cannot change, but can plan around', ar: 'لا يمكنك تغييره، لكن يمكنك التخطيط حوله' })}>
          {age !== undefined && <p className="text-sm text-body">{t({ en: `Your age (${age}). Fertility changes with age for everyone, at different speeds.`, ar: `عمرك (${age}). تتغير الخصوبة مع العمر لدى الجميع، وبسرعات مختلفة.` })}</p>}
          {list(cannot, { en: 'No fixed factors found.', ar: 'لم نجد عوامل ثابتة.' })}
        </Column>
      </div>
      <div className="grid divide-y divide-line border-t border-line md:grid-cols-2 md:divide-x md:divide-y-0 rtl:md:divide-x-reverse">
        <Column icon={CircleHelp} title={t({ en: 'What this picture does not know', ar: 'ما لا تعرفه هذه الصورة' })}>
          <ul className="list-disc space-y-1.5 ps-4 text-sm text-body">
            {limits(p).map((l) => (
              <li key={l.en}>{t(l)}</li>
            ))}
          </ul>
        </Column>
        <Column icon={Library} title={t({ en: 'The evidence behind it', ar: 'الأدلة التي يستند إليها' })}>
          {sources.length ? <Sources ids={sources} /> : <p className="text-sm text-muted">{t({ en: 'No findings, so no sources to show.', ar: 'لا توجد مؤشرات، لذا لا مصادر لعرضها.' })}</p>}
          <p className="text-xs text-faint">{t({ en: 'Published guidelines and studies. Fixed rules apply them; the AI does not.', ar: 'إرشادات ودراسات منشورة. تطبّقها قواعد ثابتة، لا الذكاء الاصطناعي.' })}</p>
        </Column>
      </div>
    </section>
  )
}
