import { ArrowRight, BookOpen, Check, Compass, HeartHandshake, Languages, LockKeyhole, MessageCircleHeart, Route, ScanLine, ShieldCheck, Smartphone, Sparkles, Stethoscope, TrendingUp } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router'
import { CountUp, Reveal } from '../components/motion'
import { startTour, Tour } from '../components/Tour'
import type { TourStep } from '../components/Tour'
import { LayerLabel, LevelIcon, LevelPill } from '../components/ui'
import { CASES } from '../eval/cases'
import { PERSONAS } from '../lib/companion/personas'
import { assess, RULES } from '../lib/engine'
import { useI18n } from '../lib/i18n'
import { LEVEL_LABEL } from '../lib/services'
import { SOURCES } from '../lib/sources'
import { load } from '../lib/storage'
import type { Answers, L10n, Level } from '../lib/types'
import { EXAMPLES } from './Example'

const delay = (s: number) => ({ '--d': `${s}s` }) as CSSProperties

const HOME_TOUR: TourStep[] = [
  { target: 'start', title: { en: 'Start here', ar: 'البداية من هنا' }, body: { en: 'A private 5-minute check. No account and no name.', ar: 'فحص خاص في خمس دقائق، دون حساب ودون اسم.' } },
  { target: 'preview', title: { en: 'What you get', ar: 'النتيجة' }, body: { en: 'One next step, with the reason behind it. No score. Switch between a woman’s and a man’s result.', ar: 'خطوة تالية واحدة مع سببها، بلا درجات. يمكن التبديل بين نتيجة امرأة ونتيجة رجل.' } },
  { target: 'people', title: { en: 'Just looking?', ar: 'للاستكشاف فقط؟' }, body: { en: 'Open an invented person’s plan to see months of history. Your own data is never touched.', ar: 'خطة شخص مختلق فيها أشهر من السجل، ولا تُمسّ بياناتك.' } },
  { target: 'lang', title: { en: 'عربي or English', ar: 'عربي أو English' }, body: { en: 'Switch language at any time.', ar: 'يمكن تغيير اللغة في أي وقت.' } },
]

export default function Home() {
  const { t } = useI18n()
  const hasAnswers = Object.keys(load<Answers>('answers', {})).length > 0

  return (
    <>
      {/* ---------- Hero ---------- */}
      <section className="hero-glow overflow-hidden border-b border-line">
        <div className="container-app grid items-center gap-12 py-12 sm:py-16 lg:grid-cols-[1.05fr_1fr] lg:py-24">
          <div className="stagger space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[13px] font-semibold text-brand-800 shadow-sm ring-1 ring-brand-100">
              <span className="pulse-ring h-2 w-2 rounded-full bg-brand-500" aria-hidden />
              {t({ en: 'For women and men · Abu Dhabi', ar: 'للمرأة والرجل · أبوظبي' })}
            </span>
            <h1 className="display">
              {t({ en: 'See how your fertility is changing.', ar: 'اعرف كيف تتغير خصوبتك.' })}{' '}
              <span className="text-brand-600">{t({ en: 'Early enough to choose.', ar: 'في وقت يسمح لك بالاختيار.' })}</span>
            </h1>
            <p className="lead max-w-lg">
              {t({ en: 'A private 5-minute check, then a simple plan that follows you over time. No score. No judgement.', ar: 'فحص خاص في خمس دقائق، ثم خطة بسيطة ترافقك مع الوقت. بلا درجات وبلا أحكام.' })}
            </p>
            <div data-tour="start" className="flex flex-col gap-3 sm:flex-row">
              <Link to="/check" className="btn btn-primary btn-lg">
                {t({ en: 'Start the check', ar: 'ابدأ الفحص' })}
                <ArrowRight className="icon-dir h-4 w-4" aria-hidden />
              </Link>
              <Link to={hasAnswers ? '/result' : `/example/${EXAMPLES[0].id}`} className="btn btn-secondary btn-lg">
                {hasAnswers ? t({ en: 'See my last result', ar: 'عرض نتيجتي الأخيرة' }) : t({ en: 'See an example', ar: 'شاهد مثالاً' })}
              </Link>
            </div>
            <ul className="flex flex-wrap gap-2">
              {[
                { icon: LockKeyhole, label: { en: 'Stays on your phone', ar: 'يبقى على هاتفك' } },
                { icon: Languages, label: { en: 'عربي + English', ar: 'عربي + English' } },
                { icon: Stethoscope, label: { en: 'Your doctor decides', ar: 'القرار لطبيبك' } },
              ].map((x) => (
                <li key={x.label.en} className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1.5 text-[13px] font-medium text-body ring-1 ring-line">
                  <x.icon className="h-3.5 w-3.5 text-brand-600" aria-hidden />
                  {t(x.label)}
                </li>
              ))}
            </ul>
            <button type="button" onClick={startTour} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 underline-offset-4 hover:underline">
              <Compass className="h-4 w-4" aria-hidden />
              {t({ en: 'New here? Take the 20-second tour', ar: 'زيارة أولى؟ جولة في 20 ثانية' })}
            </button>
          </div>
          <Preview />
        </div>
      </section>

      {/* ---------- How it works: a three-step navigator ---------- */}
      <section className="container-app py-16 sm:py-24">
        <Reveal className="max-w-2xl space-y-3">
          <p className="eyebrow">{t({ en: 'How it works', ar: 'كيف يعمل' })}</p>
          <h2 className="title">{t({ en: 'Three steps. Most of it takes seconds.', ar: 'ثلاث خطوات، ومعظمها يستغرق ثوانيَ.' })}</h2>
        </Reveal>
        <Reveal delay={0.1}>
          <Steps />
        </Reveal>
      </section>

      {/* ---------- Why trust it: a grid of tiles ---------- */}
      <section className="border-y border-line bg-white">
        <div className="container-app py-16 sm:py-24">
          <Reveal className="max-w-2xl space-y-3">
            <p className="eyebrow">{t({ en: 'Built for safety', ar: 'مبني للسلامة' })}</p>
            <h2 className="title">{t({ en: 'Rules decide. AI explains. Your doctor confirms.', ar: 'القواعد تقرر، والذكاء الاصطناعي يشرح، وطبيبك يؤكد.' })}</h2>
          </Reveal>
          <div className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-6">
            <Reveal className="col-span-2 md:col-span-4 md:row-span-2">
              <Link to="/evaluation" className="group relative flex h-full flex-col justify-between gap-10 overflow-hidden rounded-3xl bg-brand-900 p-7 text-white transition-transform duration-300 hover:-translate-y-1 sm:p-9">
                <div className="pointer-events-none absolute -end-16 -top-16 h-64 w-64 rounded-full bg-brand-500/30 blur-3xl" aria-hidden />
                <div className="relative space-y-3">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
                    <BookOpen className="h-5 w-5" aria-hidden />
                  </span>
                  <h3 className="text-3xl leading-tight font-bold tracking-tight sm:text-4xl">{t({ en: 'Fixed clinical rules choose your next step.', ar: 'قواعد سريرية ثابتة تختار خطوتك التالية.' })}</h3>
                  <p className="max-w-md text-brand-100">{t({ en: 'Same answers, same result, every time. Each one shows its source.', ar: 'الإجابات نفسها تعطي النتيجة نفسها دائماً، ولكل قاعدة مصدرها.' })}</p>
                </div>
                <dl className="relative grid grid-cols-3 gap-4">
                  {[
                    { n: RULES.length, label: { en: 'rules', ar: 'قاعدة' } },
                    { n: CASES.length, label: { en: 'test cases', ar: 'حالة اختبار' } },
                    { n: Object.keys(SOURCES).length, label: { en: 'sources', ar: 'مصدراً' } },
                  ].map((x) => (
                    <div key={x.label.en}>
                      <dd className="text-4xl font-bold tracking-tight sm:text-5xl">
                        <CountUp to={x.n} />
                      </dd>
                      <dt className="mt-1 text-sm text-brand-200">{t(x.label)}</dt>
                    </div>
                  ))}
                </dl>
                <span className="relative inline-flex items-center gap-1.5 text-sm font-semibold text-white">
                  {t({ en: 'See the live test results', ar: 'شاهد نتائج الاختبارات الحية' })}
                  <ArrowRight className="icon-dir h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
                </span>
              </Link>
            </Reveal>
            <Tile className="md:col-span-2" delay={0.05} tone="ai" icon={Sparkles} title={{ en: 'AI only explains', ar: 'الذكاء الاصطناعي يشرح فقط' }} body={{ en: 'Optional. It never sees your answers and cannot change the step.', ar: 'اختياري. لا يرى إجاباتك ولا يستطيع تغيير الخطوة.' }} />
            <Tile className="md:col-span-2" delay={0.1} tone="gold" icon={Stethoscope} title={{ en: 'Your doctor confirms', ar: 'طبيبك يؤكد' }} body={{ en: 'Their reply comes back to your phone and stands for 90 days.', ar: 'يعود ردّه إلى هاتفك ويبقى سارياً 90 يوماً.' }} />
            <Tile className="md:col-span-2" delay={0.05} tone="brand" icon={LockKeyhole} title={{ en: 'Locked on your phone', ar: 'مقفل على هاتفك' }} body={{ en: 'A shared summary is encrypted. Even our server cannot read it.', ar: 'الملخص المشترك مشفّر، ولا يستطيع حتى خادمنا قراءته.' }} to={`/share?example=${EXAMPLES[0].id}`} />
            <Tile className="md:col-span-2" delay={0.1} tone="ai" icon={ScanLine} title={{ en: 'Reads a lab report photo', ar: 'يقرأ صورة تقرير المختبر' }} body={{ en: 'It copies the numbers. You check every one.', ar: 'ينسخ الأرقام، وأنت تتحقق من كل رقم.' }} to="/report" />
            <Reveal className="col-span-2 md:col-span-2" delay={0.15}>
              <div className="flex h-full flex-col gap-3 rounded-3xl bg-canvas p-6 ring-1 ring-line">
                <h3 className="text-lg font-bold text-ink">{t({ en: 'Fits Abu Dhabi care', ar: 'يتكامل مع الرعاية في أبوظبي' })}</h3>
                <ul className="flex flex-wrap gap-2">
                  {[
                    { en: 'Sahatna', ar: '«صحتنا»' },
                    { en: 'Malaffi · FHIR', ar: '«ملفي» · FHIR' },
                    { en: 'IFHAS', ar: '«إفحص»' },
                    { en: 'Family physician', ar: 'طبيب الأسرة' },
                  ].map((x) => (
                    <li key={x.en} className="rounded-full bg-white px-3 py-1 text-[13px] font-semibold text-body ring-1 ring-line">
                      {t(x)}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ---------- Example people: a shelf ---------- */}
      <section data-tour="people" className="container-app pt-16 sm:pt-24">
        <Reveal className="max-w-2xl space-y-3">
          <p className="eyebrow">{t({ en: 'Change over time', ar: 'التغيّر مع الوقت' })}</p>
          <h2 className="title">{t({ en: 'Open someone’s plan.', ar: 'افتح خطة أحدهم.' })}</h2>
          <p className="text-muted">{t({ en: 'Four invented people with months of history. Your own data is never touched.', ar: 'أربعة أشخاص مختلقين لديهم أشهر من السجل، ولا تُمسّ بياناتك أبداً.' })}</p>
        </Reveal>
        <Shelf className="lg:grid-cols-4">
          {PERSONAS.map((p, i) => {
            const look = PEOPLE[p.id] ?? PEOPLE.omar
            return (
              <Reveal key={p.id} delay={i * 0.06} className="w-[78%] shrink-0 snap-start sm:w-[46%] lg:w-auto">
                <Link to={`/try/${p.id}`} className="surface surface-link group flex h-full flex-col gap-5 p-5">
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-bold ${look.tint}`} aria-hidden>
                      {t(p.name).trim().charAt(0)}
                    </span>
                    <h3 className="text-lg font-bold text-ink">{t(p.name)}</h3>
                  </div>
                  <ul className="flex flex-wrap gap-1.5">
                    {look.tags.map((tag) => (
                      <li key={tag.en} className="rounded-full bg-canvas px-2.5 py-1 text-xs font-semibold text-body ring-1 ring-line">
                        {t(tag)}
                      </li>
                    ))}
                  </ul>
                  <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700">
                    {t({ en: 'Open plan', ar: 'افتح الخطة' })}
                    <ArrowRight className="icon-dir h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
                  </span>
                </Link>
              </Reveal>
            )
          })}
        </Shelf>
      </section>

      {/* ---------- Example results: a shelf ---------- */}
      <section className="container-app py-16 sm:py-24">
        <Reveal className="max-w-2xl space-y-3">
          <p className="eyebrow">{t({ en: 'No answers needed', ar: 'دون إجابات' })}</p>
          <h2 className="title">{t({ en: 'Or jump straight to a result.', ar: 'أو انتقل مباشرة إلى نتيجة.' })}</h2>
        </Reveal>
        <Shelf className="lg:grid-cols-3">
          {EXAMPLES.map((e, i) => {
            const as = assess(CASES.find((c) => c.id === e.id)!.answers)
            return (
              <Reveal key={e.id} delay={i * 0.05} className="w-[78%] shrink-0 snap-start sm:w-[46%] lg:w-auto">
                <Link to={`/example/${e.id}`} className="surface surface-link group flex h-full items-center gap-4 p-5">
                  <LevelIcon level={as.level} size="lg" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <h3 className="text-[15px] leading-snug font-bold text-ink">{t(e.label)}</h3>
                    <LevelPill level={as.level} label={t(as.emergency ? { en: 'Emergency', ar: 'طارئ' } : LEVEL_LABEL[as.level])} />
                  </div>
                  <ArrowRight className="icon-dir h-4 w-4 shrink-0 text-faint transition-transform group-hover:translate-x-1" aria-hidden />
                </Link>
              </Reveal>
            )
          })}
        </Shelf>
      </section>

      {/* ---------- Closing ---------- */}
      <section className="container-app pb-16 sm:pb-24">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2rem] bg-brand-900 px-6 py-12 text-center text-white sm:px-10 sm:py-16">
            <div className="pointer-events-none absolute -start-20 -bottom-24 h-72 w-72 rounded-full bg-brand-500/30 blur-3xl" aria-hidden />
            <div className="pointer-events-none absolute -end-16 -top-20 h-64 w-64 rounded-full bg-ai-600/25 blur-3xl" aria-hidden />
            <div className="relative mx-auto max-w-xl space-y-5">
              <h2 className="text-3xl leading-tight font-bold tracking-tight sm:text-5xl">{t({ en: 'Five minutes now can save months later.', ar: 'خمس دقائق الآن قد توفّر أشهراً لاحقاً.' })}</h2>
              <p className="text-lg text-brand-100">{t({ en: 'Timing is a choice only while there is time.', ar: 'التوقيت خيار ما دام هناك وقت.' })}</p>
              <Link to="/check" className="btn btn-lg bg-white text-brand-900 shadow-lg hover:-translate-y-px hover:bg-brand-50">
                {t({ en: 'Start the check', ar: 'ابدأ الفحص' })}
                <ArrowRight className="icon-dir h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
      <Tour id="home" steps={HOME_TOUR} />
    </>
  )
}

/** A row that swipes sideways on a phone and becomes a grid on a wide screen. */
function Shelf({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`-mx-4 mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:overflow-visible lg:px-0 lg:pb-0 [&::-webkit-scrollbar]:hidden ${className}`}>{children}</div>
}

const TONES = {
  brand: 'bg-brand-50 text-brand-700 ring-brand-100',
  ai: 'bg-ai-50 text-ai-600 ring-ai-100',
  gold: 'bg-gold-50 text-gold-700 ring-gold-100',
}

function Tile({ icon: Icon, title, body, tone, to, className = '', delay: d = 0 }: { icon: LucideIcon; title: L10n; body: L10n; tone: keyof typeof TONES; to?: string; className?: string; delay?: number }) {
  const { t } = useI18n()
  const inner = (
    <>
      <span className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl ring-1 ring-inset ${TONES[tone]}`}>
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="space-y-1">
        <h3 className="text-base leading-snug font-bold text-ink sm:text-lg">{t(title)}</h3>
        <p className="hidden text-sm leading-relaxed text-muted sm:block">{t(body)}</p>
      </div>
      {to && <ArrowRight className="icon-dir absolute end-5 top-6 h-4 w-4 text-faint transition-transform group-hover:translate-x-1" aria-hidden />}
    </>
  )
  const box = 'group relative flex h-full flex-col gap-3 rounded-3xl bg-white p-4 ring-1 ring-line sm:gap-4 sm:p-6'
  return (
    <Reveal className={className} delay={d}>
      {to ? (
        <Link to={to} className={`${box} surface-link`}>
          {inner}
        </Link>
      ) : (
        <div className={box}>{inner}</div>
      )}
    </Reveal>
  )
}

const PEOPLE: Record<string, { tint: string; tags: L10n[] }> = {
  omar: { tint: 'bg-brand-50 text-brand-800', tags: [{ en: 'Trying 1+ year', ar: 'يحاول منذ أكثر من عام' }, { en: 'Works outdoors', ar: 'يعمل في الخارج' }, { en: '5 months tracked', ar: '5 أشهر من المتابعة' }] },
  yousef: { tint: 'bg-gold-50 text-gold-700', tags: [{ en: 'Not planning yet', ar: 'لا يخطط بعد' }, { en: 'Blood pressure', ar: 'ضغط الدم' }, { en: 'Family doctor', ar: 'طبيب الأسرة' }] },
  mariam: { tint: 'bg-ai-50 text-ai-700', tags: [{ en: 'Irregular cycles', ar: 'دورة غير منتظمة' }, { en: 'Children in 3–5 years', ar: 'الإنجاب خلال 3-5 سنوات' }, { en: '8 months tracked', ar: '8 أشهر من المتابعة' }] },
  fatima: { tint: 'bg-rose-50 text-rose-700', tags: [{ en: 'Trying 7 months', ar: 'تحاول منذ 7 أشهر' }, { en: 'Assessment booked', ar: 'تقييم محجوز' }, { en: 'Husband invited', ar: 'دعوة للزوج' }] },
}

/* ---------- Hero preview: switch between a woman's and a man's result ---------- */
const PREVIEW = {
  female: {
    level: 'primary' as Level,
    step: { en: 'See your family doctor or a women’s health clinic', ar: 'راجعي طبيب الأسرة أو عيادة صحة المرأة' },
    finding: { en: 'Your cycles have been irregular', ar: 'دورتك غير منتظمة مؤخراً' },
    unit: { en: 'days', ar: 'يوماً' },
    values: [51, 36, 41, 34],
    band: [21, 35] as [number, number],
    bandLabel: { en: 'Typical: 21–35 days', ar: 'المعتاد: 21-35 يوماً' },
    options: [{ en: 'Simple tests', ar: 'تحاليل بسيطة' }, { en: 'Counselling', ar: 'استشارة' }, { en: 'Preservation talk', ar: 'نقاش حفظ الخصوبة' }],
    ai: { en: 'Irregular cycles are common and often have a simple cause. Talking about timing is a choice, not a warning.', ar: 'عدم انتظام الدورة شائع وغالباً سببه بسيط. الحديث عن التوقيت خيار وليس تحذيراً.' },
  },
  male: {
    level: 'specialist' as Level,
    step: { en: 'See a men’s health specialist', ar: 'راجع أخصائي صحة الرجل' },
    finding: { en: 'Two semen results below the range', ar: 'نتيجتان للسائل المنوي دون المعدل' },
    unit: { en: 'million/mL', ar: 'مليون/مل' },
    values: [9, 12, 14],
    band: [16, 40] as [number, number],
    bandLabel: { en: 'Reference: 16 or more', ar: 'المرجع: 16 أو أكثر' },
    options: [{ en: 'Repeat the test', ar: 'إعادة التحليل' }, { en: 'Cooler work habits', ar: 'عادات عمل أبرد' }, { en: 'Specialist visit', ar: 'زيارة الأخصائي' }],
    ai: { en: 'One low result does not decide anything, and yours are moving the right way. A specialist can look for a cause.', ar: 'نتيجة منخفضة واحدة لا تحسم شيئاً، ونتائجك تتحسن. يستطيع الأخصائي البحث عن السبب.' },
  },
}

function Preview() {
  const { t } = useI18n()
  const [who, setWho] = useState<'female' | 'male'>('female')
  const p = PREVIEW[who]
  const max = Math.max(...p.values, p.band[1]) * 1.08
  return (
    <div data-tour="preview" className="anim-pop relative mx-auto w-full max-w-md lg:max-w-none" style={delay(0.2)}>
      <div className="mb-4 flex justify-center">
        <div className="inline-flex rounded-full bg-white p-1 shadow-sm ring-1 ring-line" role="group" aria-label={t({ en: 'Example to preview', ar: 'المثال المعروض' })}>
          {(['female', 'male'] as const).map((w) => (
            <button key={w} type="button" onClick={() => setWho(w)} aria-pressed={who === w} className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-all duration-200 ${who === w ? 'bg-brand-800 text-white shadow-sm' : 'text-muted hover:text-ink'}`}>
              {w === 'female' ? t({ en: 'A woman’s result', ar: 'نتيجة امرأة' }) : t({ en: 'A man’s result', ar: 'نتيجة رجل' })}
            </button>
          ))}
        </div>
      </div>
      <div className="anim-float" aria-hidden>
        <div key={who} className="stagger space-y-3 rounded-3xl border border-line bg-white p-5 shadow-xl sm:p-6">
          <div className="flex items-start gap-3">
            <LevelIcon level={p.level} size="lg" />
            <div className="min-w-0 space-y-0.5">
              <p className="text-xs font-semibold text-muted">{t({ en: 'Your next step', ar: 'خطوتك التالية' })}</p>
              <p className="text-lg leading-snug font-bold text-ink">{t(p.step)}</p>
            </div>
          </div>
          <div className="rounded-2xl bg-canvas p-4 ring-1 ring-line">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-bold text-ink">{t(p.finding)}</p>
              <p className="shrink-0 text-xs text-muted">{t(p.unit)}</p>
            </div>
            <div className="relative mt-3 flex h-24 items-end gap-3">
              <div className="absolute inset-x-0 rounded-md bg-brand-100/70" style={{ bottom: `${(p.band[0] / max) * 100}%`, height: `${((Math.min(p.band[1], max) - p.band[0]) / max) * 100}%` }} />
              {p.values.map((v, i) => {
                const out = v < p.band[0] || v > p.band[1]
                return (
                  <div key={i} className="relative flex flex-1 flex-col items-center justify-end gap-1" style={{ height: '100%' }}>
                    <span className="text-xs font-bold text-ink tabular-nums">{v}</span>
                    <span className={`w-full origin-bottom rounded-t-md ${out ? 'bg-amber-400' : 'bg-brand-600'}`} style={{ height: `${(v / max) * 78}%`, animation: `grow-y 0.7s cubic-bezier(0.22,1,0.36,1) ${0.25 + i * 0.08}s both` }} />
                  </div>
                )
              })}
            </div>
            <p className="mt-2 text-xs text-muted">{t(p.bandLabel)}</p>
          </div>
          <ul className="flex flex-wrap gap-1.5">
            {p.options.map((o) => (
              <li key={o.en} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-800 ring-1 ring-brand-100">
                <Check className="h-3 w-3" aria-hidden />
                {t(o)}
              </li>
            ))}
          </ul>
          <div className="rounded-2xl bg-ai-50 p-3.5 ring-1 ring-inset ring-ai-100">
            <LayerLabel layer="ai" />
            <p className="mt-1 text-sm leading-relaxed text-body">{t(p.ai)}</p>
          </div>
          <div className="flex items-center justify-between gap-2">
            <LayerLabel layer="rules" />
            <span className="text-xs text-faint">{t({ en: 'No score', ar: 'بلا درجات' })}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------- How it works: pick a step, see it ---------- */
const STEPS: { icon: LucideIcon; time: L10n; title: L10n; body: L10n }[] = [
  { icon: Smartphone, time: { en: '5 minutes', ar: '5 دقائق' }, title: { en: 'Answer privately', ar: 'أجب بخصوصية' }, body: { en: 'About 20 taps. “Prefer not to say” is always there.', ar: 'نحو 20 نقرة، و«أفضّل عدم الإجابة» متاحة دائماً.' } },
  { icon: TrendingUp, time: { en: '20 seconds a week', ar: '20 ثانية أسبوعياً' }, title: { en: 'Watch the direction', ar: 'راقب الاتجاه' }, body: { en: 'Cycles, results and habits, charted over months.', ar: 'الدورة والنتائج والعادات في رسوم على مدى أشهر.' } },
  { icon: Route, time: { en: 'When you are ready', ar: 'عندما تكون جاهزاً' }, title: { en: 'Take the right door', ar: 'اختر الباب المناسب' }, body: { en: 'From habits to a specialist. Your doctor confirms.', ar: 'من العادات إلى الأخصائي، وطبيبك يؤكد.' } },
]
const STEP_MS = 5200

function Steps() {
  const { t } = useI18n()
  const [i, setI] = useState(0)
  const [auto, setAuto] = useState(() => !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    if (!auto) return
    const id = window.setTimeout(() => setI((n) => (n + 1) % STEPS.length), STEP_MS)
    return () => window.clearTimeout(id)
  }, [i, auto])
  const pick = (n: number) => {
    setAuto(false)
    setI(n)
  }
  return (
    <div className="mt-10 grid gap-5 lg:grid-cols-[1fr_1.15fr] lg:gap-8">
      <ol className="grid grid-cols-3 gap-2 lg:grid-cols-1 lg:gap-3">
        {STEPS.map((s, n) => {
          const on = n === i
          return (
            <li key={s.title.en}>
              <button
                type="button"
                onClick={() => pick(n)}
                aria-pressed={on}
                className={`relative h-full w-full overflow-hidden rounded-2xl p-3 text-start transition-all duration-300 lg:p-5 ${on ? 'bg-white shadow-lg ring-1 ring-brand-200' : 'bg-transparent ring-1 ring-line hover:bg-white'}`}
              >
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-4">
                  <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors duration-300 lg:h-12 lg:w-12 ${on ? 'bg-brand-800 text-white' : 'bg-brand-50 text-brand-700'}`}>
                    <s.icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold tracking-wider text-brand-600 uppercase">{t(s.time)}</p>
                    <p className="text-sm leading-snug font-bold text-ink lg:text-xl">{t(s.title)}</p>
                    <p className="mt-1 hidden text-sm text-muted lg:block">{t(s.body)}</p>
                  </div>
                </div>
                {on && auto && <span key={i} className="absolute inset-x-0 bottom-0 h-1 origin-left bg-brand-500 rtl:origin-right" style={{ animation: `grow-x ${STEP_MS}ms linear both` }} aria-hidden />}
              </button>
            </li>
          )
        })}
      </ol>
      <div className="relative min-h-[21rem] overflow-hidden rounded-3xl bg-brand-900 p-5 sm:p-8">
        <div className="pointer-events-none absolute -end-20 -top-20 h-64 w-64 rounded-full bg-brand-500/30 blur-3xl" aria-hidden />
        <p className="relative mb-4 text-sm font-medium text-brand-100 lg:hidden">{t(STEPS[i].body)}</p>
        <div key={i} className="anim-next relative" aria-hidden>
          {i === 0 && <StepAnswer />}
          {i === 1 && <StepTrack />}
          {i === 2 && <StepAct />}
        </div>
      </div>
    </div>
  )
}

function StepAnswer() {
  const { t } = useI18n()
  return (
    <div className="mx-auto max-w-sm space-y-4 rounded-2xl bg-white p-5 shadow-xl">
      <div className="h-1.5 overflow-hidden rounded-full bg-brand-50">
        <div className="anim-grow-x h-full w-2/5 rounded-full bg-brand-600" />
      </div>
      <p className="text-lg font-bold text-ink">{t({ en: 'Would you like children?', ar: 'هل ترغبين في الإنجاب؟' })}</p>
      <div className="stagger space-y-2">
        {[
          { label: { en: 'Trying now', ar: 'أحاول الآن' } },
          { label: { en: 'In a few years', ar: 'خلال بضع سنوات' }, on: true },
          { label: { en: 'Prefer not to say', ar: 'أفضّل عدم الإجابة' } },
        ].map((o) => (
          <div key={o.label.en} className={`flex items-center justify-between rounded-xl px-4 py-3 text-[15px] font-semibold ring-1 ${o.on ? 'bg-brand-25 text-brand-900 ring-2 ring-brand-600' : 'text-ink ring-line'}`}>
            {t(o.label)}
            {o.on && (
              <span className="anim-pop inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-white" style={delay(0.5)}>
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function StepTrack() {
  const { t } = useI18n()
  // Eight months of cycle length, drifting back toward the typical band.
  const pts = [52, 47, 49, 43, 44, 39, 37, 35]
  const x = (n: number) => 16 + (n * 288) / (pts.length - 1)
  const y = (v: number) => 132 - ((v - 18) / 40) * 116
  const d = pts.map((v, n) => `${n ? 'L' : 'M'}${x(n).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
  return (
    <div className="mx-auto max-w-sm space-y-3 rounded-2xl bg-white p-5 shadow-xl">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-ink">{t({ en: 'Cycle length', ar: 'طول الدورة' })}</p>
        <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-800">
          <TrendingUp className="h-3 w-3" />
          {t({ en: 'Settling', ar: 'يستقر' })}
        </span>
      </div>
      <svg viewBox="0 0 320 150" className="w-full" role="img">
        <rect x="8" y={y(35)} width="304" height={y(21) - y(35)} rx="6" className="fill-brand-50" />
        <path d={d} fill="none" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="anim-draw stroke-brand-600" style={{ '--len': 420 } as CSSProperties} />
        {pts.map((v, n) => (
          <circle key={n} cx={x(n)} cy={y(v)} r="4.5" className="anim-pop fill-white stroke-brand-700" strokeWidth="2.5" style={{ ...delay(0.25 + n * 0.12), transformOrigin: `${x(n)}px ${y(v)}px` }} />
        ))}
      </svg>
      <div className="flex items-center justify-between text-xs font-medium text-muted">
        <span>{t({ en: 'March', ar: 'مارس' })}</span>
        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-brand-800">{t({ en: 'Typical: 21–35 days', ar: 'المعتاد: 21-35 يوماً' })}</span>
        <span>{t({ en: 'October', ar: 'أكتوبر' })}</span>
      </div>
    </div>
  )
}

function StepAct() {
  const { t } = useI18n()
  return (
    <div className="mx-auto max-w-sm space-y-3">
      <ul className="stagger grid grid-cols-2 gap-2">
        {[
          { icon: HeartHandshake, label: { en: 'Healthy habits', ar: 'عادات صحية' } },
          { icon: ScanLine, label: { en: 'Tests', ar: 'تحاليل' } },
          { icon: MessageCircleHeart, label: { en: 'Counselling', ar: 'استشارة' } },
          { icon: ShieldCheck, label: { en: 'Preservation talk', ar: 'نقاش حفظ الخصوبة' } },
        ].map((o) => (
          <li key={o.label.en} className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2.5 text-sm font-semibold text-white ring-1 ring-white/20">
            <o.icon className="h-4 w-4 shrink-0 text-brand-200" />
            {t(o.label)}
          </li>
        ))}
      </ul>
      <div className="anim-rise space-y-2 rounded-2xl bg-white p-4 shadow-xl" style={delay(0.45)}>
        <div className="flex items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gold-50 text-gold-700 ring-1 ring-gold-100">
            <Stethoscope className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-bold text-ink">{t({ en: 'Your doctor replied', ar: 'ردّ طبيبك' })}</p>
            <p className="text-xs text-muted">{t({ en: 'Encrypted · only you can read it', ar: 'مشفّر · تقرؤه أنت فقط' })}</p>
          </div>
        </div>
        <p className="rounded-xl bg-canvas px-3 py-2 text-sm text-body">{t({ en: '“Agreed. Let’s do simple tests first, then talk about timing.”', ar: '«موافق. لنبدأ بتحاليل بسيطة، ثم نتحدث عن التوقيت.»' })}</p>
      </div>
    </div>
  )
}
