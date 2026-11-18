import { ArrowRight, BadgeCheck, BookOpen, ClipboardCheck, Languages, LockKeyhole, Route, ScanLine, ShieldCheck, Smartphone, Sparkles, Stethoscope, TrendingUp, UserRound } from 'lucide-react'
import { Link } from 'react-router'
import { LayerLabel, LevelIcon, LevelPill } from '../components/ui'
import { CASES } from '../eval/cases'
import { assess } from '../lib/engine'
import { useI18n } from '../lib/i18n'
import { LEVEL_LABEL } from '../lib/services'
import { PERSONAS } from '../lib/companion/personas'
import { load } from '../lib/storage'
import type { Answers } from '../lib/types'
import { EXAMPLES } from './Example'

export default function Home() {
  const { t } = useI18n()
  const hasAnswers = Object.keys(load<Answers>('answers', {})).length > 0

  return (
    <>
      {/* ---------- Hero ---------- */}
      <section className="border-b border-line bg-white">
        <div className="container-app grid items-center gap-12 py-12 sm:py-16 lg:grid-cols-[1.05fr_1fr] lg:py-20">
          <div className="space-y-7">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-25 px-3 py-1 text-[13px] font-medium text-brand-800">
              <ShieldCheck className="h-4 w-4" aria-hidden />
              {t({ en: 'Reproductive potential, for women and men', ar: 'القدرة الإنجابية، للمرأة والرجل' })}
            </span>
            <div className="space-y-4">
              <h1 className="display">
                {t({ en: 'See how your fertility is changing, early enough to choose.', ar: 'اعرف كيف تتغير خصوبتك، في وقت يسمح لك بالاختيار.' })}
              </h1>
              <p className="lead max-w-xl">
                {t({
                  en: 'Not a fertility score. A private check in five minutes, then a companion that follows your cycle, results and habits over time. It shows what you can change and what you cannot, how sure it is, and the options worth discussing now: tests, counselling, preservation or a specialist.',
                  ar: 'ليست درجة للخصوبة. فحص خاص في خمس دقائق، ثم رفيق يتابع دورتك ونتائجك وعاداتك مع الوقت. يُظهر ما يمكنك تغييره وما لا يمكنك، ومدى يقينه، والخيارات التي تستحق النقاش الآن: تحاليل أو استشارة أو حفظ الخصوبة أو أخصائي.',
                })}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link to="/check" className="btn btn-primary btn-lg">
                {t({ en: 'Start the check', ar: 'ابدأ الفحص' })}
                <ArrowRight className="icon-dir h-4 w-4" aria-hidden />
              </Link>
              {hasAnswers ? (
                <Link to="/result" className="btn btn-secondary btn-lg">
                  {t({ en: 'See my last result', ar: 'عرض نتيجتي الأخيرة' })}
                </Link>
              ) : (
                <Link to={`/example/${EXAMPLES[0].id}`} className="btn btn-secondary btn-lg">
                  {t({ en: 'See an example result', ar: 'عرض نتيجة نموذجية' })}
                </Link>
              )}
            </div>
            <Link to="/try/mariam" className="inline-flex items-center gap-2 text-[15px] font-semibold text-ai-700 hover:underline">
              <TrendingUp className="h-4 w-4" aria-hidden />
              {t({ en: 'See eight months of one woman’s plan (example)', ar: 'شاهد ثمانية أشهر من خطة امرأة (مثال)' })}
              <ArrowRight className="icon-dir h-4 w-4" aria-hidden />
            </Link>
            <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
              {[
                { icon: LockKeyhole, label: { en: 'Answers stay on your phone', ar: 'تبقى الإجابات على هاتفك' } },
                { icon: Languages, label: { en: 'Arabic and English', ar: 'العربية والإنجليزية' } },
                { icon: Stethoscope, label: { en: 'Clinicians stay in charge', ar: 'القرار للطبيب' } },
              ].map((x) => (
                <li key={x.label.en} className="inline-flex items-center gap-2">
                  <x.icon className="h-4 w-4 text-brand-600" aria-hidden />
                  {t(x.label)}
                </li>
              ))}
            </ul>
          </div>
          <ProductPreview />
        </div>
      </section>

      {/* ---------- Fits Abu Dhabi ---------- */}
      <section className="border-b border-line bg-canvas">
        <div className="container-app flex flex-col gap-3 py-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-muted">{t({ en: 'Designed to fit Abu Dhabi’s care pathways', ar: 'مصمم ليتكامل مع مسارات الرعاية في أبوظبي' })}</p>
          <ul className="flex flex-wrap gap-2">
            {[
              { en: 'Sahatna patient app', ar: 'تطبيق «صحتنا»' },
              { en: 'Malaffi (HL7 FHIR)', ar: '«ملفي» (HL7 FHIR)' },
              { en: 'IFHAS periodic screening', ar: 'الفحص الدوري «إفحص»' },
              { en: 'Family physician programme', ar: 'برنامج طبيب الأسرة' },
            ].map((x) => (
              <li key={x.en} className="rounded-md border border-line bg-white px-2.5 py-1 text-xs font-medium text-body">
                {t(x)}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------- How it works ---------- */}
      <section className="container-app py-16">
        <div className="max-w-2xl space-y-2">
          <p className="eyebrow">{t({ en: 'How it works', ar: 'كيف يعمل' })}</p>
          <h2 className="title">{t({ en: 'From a private question to the right care', ar: 'من سؤال خاص إلى الرعاية المناسبة' })}</h2>
        </div>
        <ol className="mt-10 grid gap-6 md:grid-cols-3">
          {[
            {
              icon: Smartphone,
              title: { en: 'Answer privately, then keep going', ar: 'أجب بخصوصية، ثم واصل' },
              body: { en: 'About 20 short questions for a woman or a man; sensitive ones always have “Prefer not to say”. Then a 20-second weekly check-in builds the picture over time.', ar: 'نحو 20 سؤالاً قصيراً للمرأة أو للرجل، والأسئلة الحساسة تتضمن دائماً «أفضّل عدم الإجابة». ثم يبني تسجيل أسبوعي مدته 20 ثانية الصورة مع الوقت.' },
            },
            {
              icon: BookOpen,
              title: { en: 'See what matters, and why', ar: 'اعرف ما يهم ولماذا' },
              body: { en: 'Every signal shows the answer or result behind it, the guideline it rests on, whether you can change it, and what is still unknown. No black box and no score.', ar: 'تعرض كل إشارة الإجابة أو النتيجة التي وراءها، والإرشاد الذي تستند إليه، وما إذا كان بإمكانك تغييرها، وما لا يزال مجهولاً. دون غموض ودون درجات.' },
            },
            {
              icon: Route,
              title: { en: 'Go to the right place', ar: 'توجّه إلى المكان المناسب' },
              body: { en: 'Healthy habits, tests, preconception counselling, a fertility-preservation discussion, a specialist, or urgent care. Send a summary to a doctor only if you choose.', ar: 'عادات صحية، أو تحاليل، أو استشارة ما قبل الحمل، أو مناقشة حفظ الخصوبة، أو أخصائي، أو رعاية عاجلة. وأرسل ملخصاً إلى طبيب فقط إن أردت.' },
            },
          ].map((s, i) => (
            <li key={s.title.en} className="surface surface-pad space-y-3">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                  <s.icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                </span>
                <span className="text-sm font-semibold text-faint tabular-nums">0{i + 1}</span>
              </div>
              <h3 className="text-base font-semibold text-ink">{t(s.title)}</h3>
              <p className="text-sm leading-relaxed text-muted">{t(s.body)}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------- More than a questionnaire ---------- */}
      <section className="container-app pb-16">
        <div className="max-w-2xl space-y-2">
          <p className="eyebrow">{t({ en: 'More than a questionnaire', ar: 'أكثر من مجرد استبيان' })}</p>
          <h2 className="title">{t({ en: 'It reads your report, and it reaches your doctor', ar: 'يقرأ تقريرك، ويصل إلى طبيبك' })}</h2>
        </div>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="surface surface-pad flex flex-col gap-4">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-ai-50 text-ai-600 ring-1 ring-inset ring-ai-100">
              <ScanLine className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            </span>
            <div className="space-y-1.5">
              <h3 className="text-base font-semibold text-ink">{t({ en: 'Understand the report you already have', ar: 'افهم التقرير الذي بين يديك' })}</h3>
              <p className="text-sm leading-relaxed text-muted">
                {t({
                  en: 'Photograph a semen analysis, or add hormone and egg-reserve results. You check the numbers, and fixed rules compare them with published reference points over time, never as a one-off verdict.',
                  ar: 'صوّر تحليل السائل المنوي، أو أضف نتائج الهرمونات ومخزون البويضات. تتحقق أنت من الأرقام، ثم تقارنها قواعد ثابتة بنقاط مرجعية منشورة مع الوقت، وليس كحكم لمرة واحدة.',
                })}
              </p>
            </div>
            <Link to="/report" className="link mt-auto inline-flex items-center gap-1.5 text-sm">
              {t({ en: 'Read a report', ar: 'اقرأ تقريراً' })}
              <ArrowRight className="icon-dir h-4 w-4" aria-hidden />
            </Link>
          </div>
          <div className="surface surface-pad flex flex-col gap-4">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <LockKeyhole className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            </span>
            <div className="space-y-1.5">
              <h3 className="text-base font-semibold text-ink">{t({ en: 'Hand it to your doctor, and stay in control', ar: 'سلّمه لطبيبك وابقَ متحكماً' })}</h3>
              <p className="text-sm leading-relaxed text-muted">
                {t({
                  en: 'Create a private link or QR code. The summary is locked on your phone, so even our server cannot read it. See when it is opened, read your doctor’s reply, and withdraw it whenever you like.',
                  ar: 'أنشئ رابطاً خاصاً أو رمز QR. يُقفل الملخص على هاتفك، فلا يستطيع حتى خادمنا قراءته. اعرف متى فُتح، واقرأ ردّ طبيبك، واسحبه متى شئت.',
                })}
              </p>
            </div>
            <Link to={`/share?example=${EXAMPLES[0].id}`} className="link mt-auto inline-flex items-center gap-1.5 text-sm">
              {t({ en: 'Try it with an example', ar: 'جرّبه بمثال' })}
              <ArrowRight className="icon-dir h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      {/* ---------- Safety ---------- */}
      <section className="border-y border-line bg-white">
        <div className="container-app grid gap-10 py-16 lg:grid-cols-[1fr_1.4fr]">
          <div className="space-y-3">
            <p className="eyebrow">{t({ en: 'Built for safety', ar: 'مبني للسلامة' })}</p>
            <h2 className="title">{t({ en: 'Rules decide. AI reads and explains. Clinicians confirm.', ar: 'القواعد تقرر، والذكاء الاصطناعي يقرأ ويشرح، والطبيب يؤكد.' })}</h2>
            <p className="text-muted">
              {t({
                en: 'Each part has one clear job, and each is tested on its own. You can always see which part said what.',
                ar: 'لكل جزء مهمة واحدة واضحة، ويُختبر كل منها بمفرده. ويمكنك دائماً معرفة أي جزء قال ماذا.',
              })}
            </p>
            <Link to="/evaluation" className="link inline-flex items-center gap-1.5 text-sm">
              {t({ en: 'See the test results', ar: 'اطّلع على نتائج الاختبارات' })}
              <ArrowRight className="icon-dir h-4 w-4" aria-hidden />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { icon: BookOpen, title: { en: 'Fixed clinical rules', ar: 'قواعد سريرية ثابتة' }, body: { en: 'The next step comes from published guidelines. Same answers, same result, every time.', ar: 'تأتي الخطوة التالية من إرشادات منشورة: الإجابات نفسها تعطي النتيجة نفسها دائماً.' } },
              { icon: Sparkles, title: { en: 'AI reads and explains, never decides', ar: 'الذكاء الاصطناعي يقرأ ويشرح ولا يقرر' }, body: { en: 'Optional. It reads the numbers on a report and puts the result in plain words. It never sees your answers or who you are, and cannot change the step.', ar: 'اختياري. يقرأ أرقام التقرير ويشرح النتيجة بكلمات بسيطة. لا يرى إجاباتك أو هويتك أبداً، ولا يستطيع تغيير الخطوة.' } },
              { icon: ClipboardCheck, title: { en: 'A clinician confirms', ar: 'الطبيب يؤكد' }, body: { en: 'A shared summary reaches a doctor, who confirms or changes the suggestion with a reason. The reply comes back to your phone.', ar: 'يصل الملخص المشترك إلى طبيب يؤكد الاقتراح أو يغيّره مع ذكر السبب، ويعود ردّه إلى هاتفك.' } },
              { icon: BadgeCheck, title: { en: 'Tested before you see it', ar: 'مُختبر قبل أن تراه' }, body: { en: 'Every build runs the safety tests: every red flag must be caught, no case under-triaged.', ar: 'تُشغَّل اختبارات السلامة مع كل إصدار: يجب اكتشاف كل مؤشر خطر، ودون أي فرز ناقص.' } },
            ].map((x) => (
              <div key={x.title.en} className="rounded-xl border border-line p-5">
                <x.icon className="h-5 w-5 text-brand-600" strokeWidth={1.75} aria-hidden />
                <h3 className="mt-3 text-[15px] font-semibold text-ink">{t(x.title)}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{t(x.body)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Example people over time ---------- */}
      <section className="container-app pt-16">
        <div className="max-w-2xl space-y-2">
          <p className="eyebrow">{t({ en: 'Change over time', ar: 'التغيّر مع الوقت' })}</p>
          <h2 className="title">{t({ en: 'Open an example person’s plan', ar: 'افتح خطة شخص نموذجي' })}</h2>
          <p className="text-muted">{t({ en: 'Invented people with months of check-ins, results and doctor replies. Opening one never touches your own data.', ar: 'أشخاص مختلقون لديهم أشهر من التسجيلات والنتائج وردود الأطباء. فتح أحدهم لا يمس بياناتك أبداً.' })}</p>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PERSONAS.map((p) => (
            <Link key={p.id} to={`/try/${p.id}`} className="surface group flex flex-col gap-2 p-5 transition-shadow hover:shadow-lg">
              <div className="flex items-center justify-between">
                <h3 className="text-[15px] font-semibold text-ink">{t(p.name)}</h3>
                <ArrowRight className="icon-dir h-4 w-4 text-faint transition-transform group-hover:translate-x-0.5" aria-hidden />
              </div>
              <p className="text-sm leading-relaxed text-muted">{t(p.summary)}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* ---------- Examples ---------- */}
      <section className="container-app py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl space-y-2">
            <p className="eyebrow">{t({ en: 'Try it without answering', ar: 'جرّبه دون إجابة' })}</p>
            <h2 className="title">{t({ en: 'Example results', ar: 'نتائج نموذجية' })}</h2>
            <p className="text-muted">{t({ en: 'Synthetic people, for demonstration. Each opens a full result.', ar: 'أشخاص اصطناعيون للعرض، وتفتح كل حالة نتيجة كاملة.' })}</p>
          </div>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {EXAMPLES.map((e) => {
            const as = assess(CASES.find((c) => c.id === e.id)!.answers)
            return (
              <Link key={e.id} to={`/example/${e.id}`} className="surface group flex flex-col gap-4 p-5 transition-shadow hover:shadow-lg">
                <div className="flex items-center justify-between">
                  <LevelIcon level={as.level} />
                  <ArrowRight className="icon-dir h-4 w-4 text-faint transition-transform group-hover:translate-x-0.5" aria-hidden />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-[15px] font-semibold text-ink">{t(e.label)}</h3>
                  <LevelPill level={as.level} label={t(as.emergency ? { en: 'Emergency', ar: 'طارئ' } : LEVEL_LABEL[as.level])} />
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      {/* ---------- Closing ---------- */}
      <section className="container-app pb-16">
        <div className="flex flex-col items-start justify-between gap-6 rounded-2xl bg-brand-900 px-6 py-10 text-white sm:px-10 md:flex-row md:items-center">
          <div className="max-w-xl space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight">{t({ en: 'Five minutes now can save months later.', ar: 'خمس دقائق الآن قد توفّر أشهراً لاحقاً.' })}</h2>
            <p className="text-brand-100">
              {t({
                en: 'Most people learn about their fertility only when they are already trying. Many causes, like irregular cycles, weight, infections, steroids or a varicocele, are easier to act on when found early, and timing is a choice only while there is time.',
                ar: 'يعرف معظم الناس عن خصوبتهم فقط عندما يبدؤون المحاولة. كثير من الأسباب، مثل عدم انتظام الدورة والوزن والالتهابات والستيرويدات ودوالي الخصية، أسهل في التعامل معها عند اكتشافها مبكراً، والتوقيت خيار ما دام هناك وقت.',
              })}
            </p>
          </div>
          <Link to="/check" className="btn btn-lg bg-white text-brand-900 hover:bg-brand-50">
            {t({ en: 'Start the check', ar: 'ابدأ الفحص' })}
            <ArrowRight className="icon-dir h-4 w-4" aria-hidden />
          </Link>
        </div>
      </section>
    </>
  )
}

/** A faithful, static preview of the real result screen. */
function ProductPreview() {
  const { t } = useI18n()
  return (
    <div className="relative mx-auto w-full max-w-md lg:max-w-none" aria-hidden>
      <div className="absolute -inset-4 rounded-[28px] bg-brand-50 sm:-inset-6" />
      <div className="relative space-y-3 rounded-2xl border border-line bg-white p-5 shadow-xl sm:p-6">
        <div className="flex items-start gap-3">
          <LevelIcon level="primary" size="lg" />
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-medium text-muted">{t({ en: 'Your next step', ar: 'خطوتك التالية' })}</p>
            <p className="text-lg leading-snug font-semibold text-ink">{t({ en: 'See your family doctor or a women’s health clinic', ar: 'راجعي طبيب الأسرة أو عيادة صحة المرأة' })}</p>
          </div>
        </div>
        <div className="divide-y divide-line rounded-xl border border-line">
          {[
            { title: { en: 'Your cycles have been irregular lately', ar: 'كانت دوراتك غير منتظمة مؤخراً' }, level: 'primary' as const, why: { en: 'Your last 4 cycles: 51, 36, 41, 34 days', ar: 'آخر 4 دورات: 51، 36، 41، 34 يوماً' } },
            { title: { en: 'Thinking ahead about age and timing', ar: 'التفكير مبكراً في العمر والتوقيت' }, level: 'selfcare' as const, label: { en: 'Option offered', ar: 'خيار متاح' }, why: { en: 'You are 31 · early menopause in your family · children in 3–5 years', ar: 'عمرك 31 · انقطاع طمث مبكر في العائلة · الإنجاب خلال 3-5 سنوات' } },
          ].map((f) => (
            <div key={f.title.en} className="space-y-1 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-ink">{t(f.title)}</span>
                <LevelPill level={f.level} label={'label' in f && f.label ? t(f.label) : undefined} />
              </div>
              <p className="text-xs text-muted">{t(f.why)}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between gap-2 pt-1">
          <LayerLabel layer="rules" />
          <span className="text-xs text-faint">rules-0.2.0</span>
        </div>
        <div className="rounded-xl bg-ai-50 p-3.5 ring-1 ring-inset ring-ai-100">
          <LayerLabel layer="ai" />
          <p className="mt-1.5 text-sm leading-relaxed text-body">
            {t({
              en: 'Irregular cycles are common and often have a simple cause such as PCOS. Talking about timing now is a choice you can make, not a warning.',
              ar: 'عدم انتظام الدورة شائع، وغالباً سببه بسيط مثل تكيّس المبايض. الحديث عن التوقيت الآن خيار يمكنك اتخاذه، وليس تحذيراً.',
            })}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-canvas px-3 py-2 text-xs text-muted">
          <UserRound className="h-3.5 w-3.5" aria-hidden />
          {t({ en: 'Summary ready to share with your doctor, only if you choose', ar: 'ملخص جاهز لمشاركته مع طبيبك، فقط إن أردت' })}
        </div>
      </div>
    </div>
  )
}
