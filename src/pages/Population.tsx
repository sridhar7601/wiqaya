import { ArrowRight, EyeOff, LockKeyhole, Scale, Timer, Users } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { Callout } from '../components/ui'
import { useI18n } from '../lib/i18n'
import { byGroup, COHORT_SIZE, cohort, insights, MIN_CELL, monthsEarlier, reach } from '../lib/population'
import type { Cell } from '../lib/population'
import type { L10n } from '../lib/types'

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : '–')

function Count({ c, of }: { c: Cell; of?: number }) {
  const { t } = useI18n()
  if (c.hidden) return <span className="text-faint" title={t({ en: `Fewer than ${MIN_CELL}: hidden to protect privacy`, ar: `أقل من ${MIN_CELL}: مخفي لحماية الخصوصية` })}>{`<${MIN_CELL}`}</span>
  return (
    <span className="tabular-nums">
      {c.n.toLocaleString()}
      {of !== undefined && <span className="text-muted"> · {pct(c.n, of)}</span>}
    </span>
  )
}

/** One row of the reach chart: two thin bars on one 0–100% scale, so the comparison needs no second axis. */
function ReachBar({ label, pop, adv }: { label: string; pop: number; adv: number }) {
  const { t } = useI18n()
  const gap = Math.round((adv - pop) * 100)
  return (
    <li className="grid grid-cols-[8.5rem_1fr_3.5rem] items-center gap-3 text-sm">
      <span className="truncate text-body">{label}</span>
      <span className="space-y-1" title={`${t({ en: 'Population', ar: 'السكان' })} ${Math.round(pop * 100)}% · ${t({ en: 'Advised', ar: 'من وُجّهوا' })} ${Math.round(adv * 100)}%`}>
        <span className="block h-2 rounded-e-sm bg-[#98a2b3]" style={{ width: `${pop * 100}%` }} />
        <span className="block h-2 rounded-e-sm bg-[#0d9488]" style={{ width: `${adv * 100}%` }} />
      </span>
      <span className={`text-end tabular-nums ${Math.abs(gap) >= 5 ? 'font-semibold text-ink' : 'text-muted'}`}>
        {gap > 0 ? '+' : ''}
        {gap}
      </span>
    </li>
  )
}

export default function Population() {
  const { t } = useI18n()
  const data = useMemo(() => {
    const people = cohort()
    return { people, ins: insights(people), groups: byGroup(people), reach: reach(people), earlier: monthsEarlier(people) }
  }, [])

  const band = (b: string): L10n => ({ en: b, ar: b })
  const sexLabel = (s: string): L10n => (s === 'female' ? { en: 'Women', ar: 'النساء' } : { en: 'Men', ar: 'الرجال' })

  return (
    <div className="container-app space-y-10 py-10">
      <header className="max-w-3xl space-y-3">
        <p className="eyebrow">{t({ en: 'For the health system', ar: 'للنظام الصحي' })}</p>
        <h1 className="title">{t({ en: 'Who could benefit from earlier advice', ar: 'من قد يستفيد من نصيحة مبكرة' })}</h1>
        <p className="lead">
          {t({
            en: 'Totals only, from people who chose to be counted. It shows where earlier counselling or assessment would help most. It never shows a person, and it never decides anything about one.',
            ar: 'أرقام إجمالية فقط، من أشخاص اختاروا أن يُحتسبوا. تُظهر أين تفيد الاستشارة أو التقييم المبكر أكثر. لا تُظهر أي شخص أبداً، ولا تقرر شيئاً بشأن أحد.',
          })}
        </p>
      </header>

      <Callout tone="warn" title={t({ en: 'Invented population', ar: 'سكان مختلقون' })}>
        {t({
          en: `${COHORT_SIZE.toLocaleString()} invented adults aged 18–45, generated from rough planning assumptions (not Abu Dhabi data), each run through the same fixed rules as a real check. The numbers show how the view works, not how common anything is.`,
          ar: `${COHORT_SIZE.toLocaleString()} بالغ مختلق بين 18 و45 عاماً، أُنشئوا من افتراضات تخطيطية تقريبية (وليست بيانات أبوظبي)، ومرّ كل منهم بالقواعد الثابتة نفسها للفحص الحقيقي. توضح الأرقام طريقة عمل العرض، لا مدى شيوع أي شيء.`,
        })}
      </Callout>

      {/* ---------- How the counts are made ---------- */}
      <section className="grid gap-4 md:grid-cols-3">
        {[
          { icon: LockKeyhole, title: { en: 'Opt-in, totals only', ar: 'باختيار الشخص، وأرقام إجمالية فقط' }, body: { en: 'A separate yes in Privacy controls. The phone adds one to a few counters; no answer, result or identifier is sent.', ar: 'موافقة منفصلة في إعدادات الخصوصية. يضيف الهاتف واحداً إلى بعض العدادات، دون إرسال أي إجابة أو نتيجة أو مُعرّف.' } },
          { icon: EyeOff, title: { en: `Groups under ${MIN_CELL} are hidden`, ar: `تُخفى المجموعات الأقل من ${MIN_CELL}` }, body: { en: 'Small groups could point to a person, so they show as hidden everywhere, including in exports.', ar: 'قد تدل المجموعات الصغيرة على شخص بعينه، لذلك تظهر مخفية في كل مكان، بما في ذلك عند التصدير.' } },
          { icon: Scale, title: { en: 'Never for employment or insurance', ar: 'لا يُستخدم أبداً للتوظيف أو التأمين' }, body: { en: 'Purpose-bound to planning services and outreach. Use for hiring, insurance pricing or any decision about a person is excluded by the data agreement.', ar: 'مقصور على تخطيط الخدمات والتوعية. ويستبعد اتفاق البيانات استخدامه في التوظيف أو تسعير التأمين أو أي قرار بشأن شخص.' } },
        ].map((x) => (
          <div key={x.title.en} className="surface surface-pad space-y-2">
            <x.icon className="h-5 w-5 text-brand-600" strokeWidth={1.75} aria-hidden />
            <h2 className="text-[15px] font-semibold text-ink">{t(x.title)}</h2>
            <p className="text-sm leading-relaxed text-muted">{t(x.body)}</p>
          </div>
        ))}
      </section>

      {/* ---------- Groups ---------- */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-brand-600" aria-hidden />
          <h2 className="heading">{t({ en: 'Groups who may benefit from earlier advice', ar: 'مجموعات قد تستفيد من نصيحة مبكرة' })}</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data.ins.map((g) => (
            <article key={g.id} className="surface surface-pad space-y-3">
              <h3 className="text-[15px] font-semibold text-ink">{t(g.title)}</h3>
              <p className="text-3xl font-semibold tracking-tight text-ink">
                <Count c={g.count} />
              </p>
              <p className="text-sm text-muted">
                {g.count.hidden ? t({ en: 'Hidden: too few to show.', ar: 'مخفي: عدد قليل جداً.' }) : `${pct(g.count.n, g.base)} ${t({ en: 'of', ar: 'من' })} ${g.base.toLocaleString()} ${t(g.of)}`}
              </p>
              <p className="border-t border-line pt-3 text-sm leading-relaxed text-body">{t(g.offer)}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ---------- Table ---------- */}
      <section className="space-y-3">
        <h2 className="heading">{t({ en: 'Next steps and options by group', ar: 'الخطوات التالية والخيارات حسب المجموعة' })}</h2>
        <p className="text-sm text-muted">{t({ en: 'Each cell is a count and its share of the row. Options are offered alongside the step, never instead of it.', ar: 'كل خانة عدد ونسبته من الصف. تُعرض الخيارات إلى جانب الخطوة، لا بدلاً منها.' })}</p>
        <div className="surface overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-canvas text-start text-xs text-muted">
              <tr>
                {[
                  { en: 'Group', ar: 'المجموعة' },
                  { en: 'People', ar: 'الأشخاص' },
                  { en: 'Self-care', ar: 'عناية ذاتية' },
                  { en: 'Family doctor', ar: 'طبيب الأسرة' },
                  { en: 'Fertility', ar: 'خصوبة' },
                  { en: 'Specialist', ar: 'أخصائي' },
                  { en: 'Counselling offered', ar: 'عُرضت استشارة' },
                  { en: 'Preservation talk offered', ar: 'عُرضت مناقشة حفظ الخصوبة' },
                ].map((h) => (
                  <th key={h.en} className="px-4 py-2.5 text-start font-medium">
                    {t(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.groups.map((g) => (
                <tr key={`${g.sex}-${g.band}`}>
                  <td className="px-4 py-2.5 font-medium text-ink">
                    {t(sexLabel(g.sex))} {t(band(g.band))}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">{g.n.toLocaleString()}</td>
                  <td className="px-4 py-2.5"><Count c={g.levels.selfcare} of={g.n} /></td>
                  <td className="px-4 py-2.5"><Count c={g.levels.primary} of={g.n} /></td>
                  <td className="px-4 py-2.5"><Count c={g.levels.fertility} of={g.n} /></td>
                  <td className="px-4 py-2.5"><Count c={g.levels.specialist} of={g.n} /></td>
                  <td className="px-4 py-2.5"><Count c={g.options.counselling} of={g.n} /></td>
                  <td className="px-4 py-2.5"><Count c={g.options.preservation} of={g.n} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ---------- Reach ---------- */}
      <section className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-3">
          <h2 className="heading">{t({ en: 'Is advice reaching everyone fairly?', ar: 'هل تصل النصيحة إلى الجميع بإنصاف؟' })}</h2>
          <p className="text-sm text-muted">
            {t({
              en: 'Each group’s share of the population, against its share of people given a next step or an option. A big gap is a prompt to look closer, for example at outreach in one language or area.',
              ar: 'حصة كل مجموعة من السكان، مقابل حصتها ممن أُعطوا خطوة تالية أو خياراً. الفجوة الكبيرة دعوة للتمعّن، مثل التوعية بلغة معينة أو في منطقة معينة.',
            })}
          </p>
          <p className="text-sm text-muted">
            {t({
              en: 'The rules themselves never see language, nationality or area: changing them changes no result (tested on every case).',
              ar: 'القواعد نفسها لا ترى اللغة أو الجنسية أو المنطقة: تغييرها لا يغيّر أي نتيجة (مُختبر على كل حالة).',
            })}
          </p>
        </div>
        <div className="surface surface-pad space-y-4">
          <div className="flex flex-wrap gap-4 text-xs text-muted">
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-4 rounded-sm bg-[#98a2b3]" />{t({ en: 'Share of population', ar: 'الحصة من السكان' })}</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-4 rounded-sm bg-[#0d9488]" />{t({ en: 'Share of people advised', ar: 'الحصة ممن وُجّهوا' })}</span>
            <span className="ms-auto">{t({ en: 'Gap, points', ar: 'الفجوة، نقاط' })}</span>
          </div>
          <ul className="space-y-3">
            {data.reach.map((r) => (
              <ReachBar key={r.key} label={t(r.label)} pop={r.shareOfPopulation} adv={r.shareOfAdvised} />
            ))}
          </ul>
          <p className="text-xs text-faint">{t({ en: 'Women are advised more often here because more of the women’s rules offer counselling. That is by design, and worth watching.', ar: 'تُوجَّه النساء أكثر هنا لأن عدداً أكبر من قواعد المرأة يعرض استشارة. هذا مقصود، ويستحق المتابعة.' })}</p>
        </div>
      </section>

      {/* ---------- Earlier action ---------- */}
      <section className="surface overflow-hidden">
        <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Timer className="h-5 w-5 text-brand-600" aria-hidden />
              <h2 className="heading">{t({ en: 'Earlier action, modelled', ar: 'التدخل المبكر، وفق نموذج' })}</h2>
            </div>
            <p className="text-body">
              {t({
                en: 'Compared with “try for 12 months, then seek help”, the age-adjusted rules bring a couple assessment forward for women aged 35 and over, and for anyone with a known cause.',
                ar: 'مقارنةً بقاعدة «حاولا 12 شهراً ثم اطلبا المساعدة»، تقدّم القواعد المعدّلة حسب العمر تقييم الزوجين للنساء من سن 35، ولكل من لديها سبب معروف.',
              })}
            </p>
            <p className="text-sm text-muted">
              {t({
                en: 'A model of what the rules do, not a measured outcome: months already tried are taken as the middle of each answer band. A pilot measures the real time from signal to appointment, from the journey’s own dates.',
                ar: 'نموذج لما تفعله القواعد، وليس نتيجة مقاسة: تُحتسب الأشهر التي مضت على المحاولة بمنتصف كل فئة إجابة. وتقيس المرحلة التجريبية الوقت الفعلي من الإشارة إلى الموعد من تواريخ الرحلة نفسها.',
              })}
            </p>
            <Link to="/evaluation#earlier-action" className="link inline-flex items-center gap-1.5 text-sm">
              {t({ en: 'How earlier action will be measured', ar: 'كيف سيُقاس التدخل المبكر' })}
              <ArrowRight className="icon-dir h-4 w-4" aria-hidden />
            </Link>
          </div>
          <dl className="grid grid-cols-2 gap-4 self-start">
            <div className="rounded-xl bg-canvas p-4">
              <dt className="text-xs text-muted">{t({ en: 'Women assessed earlier', ar: 'نساء قُيّمن مبكراً' })}</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums text-ink">{data.earlier.women.toLocaleString()}</dd>
            </div>
            <div className="rounded-xl bg-canvas p-4">
              <dt className="text-xs text-muted">{t({ en: 'Months earlier, on average', ar: 'أشهر أبكر في المتوسط' })}</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums text-ink">{data.earlier.meanMonths.toFixed(1)}</dd>
            </div>
          </dl>
        </div>
      </section>
    </div>
  )
}
