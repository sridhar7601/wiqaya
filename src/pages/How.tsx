import { ArrowRight, Building2, Hospital, Stethoscope, UserRound } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router'
import { LayerLabel } from '../components/ui'
import type { Layer } from '../components/ui'
import { ENGINE_VERSION, RULES } from '../lib/engine'
import { useI18n } from '../lib/i18n'
import { QUESTIONS } from '../lib/questions'
import { SOURCES } from '../lib/sources'
import type { L10n } from '../lib/types'

const STAGES: { layer: Layer; title: L10n; body: L10n }[] = [
  { layer: 'you', title: { en: 'Consent gate', ar: 'بوابة الموافقة' }, body: { en: 'Nothing starts without consent. The AI helper has its own, separate, optional consent.', ar: 'لا يبدأ شيء دون موافقة، وللمساعد الذكي موافقة منفصلة واختيارية.' } },
  { layer: 'rules', title: { en: 'Safety-first intake', ar: 'أسئلة تبدأ بالسلامة' }, body: { en: 'Red-flag symptoms are asked right after age. Any red flag stops the flow and shows emergency or urgent advice straight away.', ar: 'تُطرح أعراض الخطر بعد العمر مباشرة، وأي مؤشر أحمر يوقف التسلسل ويعرض نصيحة الطوارئ أو الرعاية العاجلة فوراً.' } },
  {
    layer: 'ai',
    title: { en: 'Lab report reader (optional)', ar: 'قارئ تقرير المختبر (اختياري)' },
    body: {
      en: 'The AI copies the numbers from a photo of a semen analysis report, and nothing more. The app straightens the picture first, checks that the numbers agree with each other, and asks the person to confirm every one. The fixed rules then compare them with the WHO limits.',
      ar: 'ينسخ الذكاء الاصطناعي الأرقام من صورة تقرير تحليل السائل المنوي، ولا شيء غير ذلك. يعدّل التطبيق ميل الصورة أولاً، ويتحقق من توافق الأرقام مع بعضها، ويطلب من الشخص تأكيد كل رقم. ثم تقارنها القواعد الثابتة بحدود منظمة الصحة العالمية.',
    },
  },
  { layer: 'rules', title: { en: 'Data-quality gate', ar: 'بوابة جودة البيانات' }, body: { en: 'Catches missing, impossible and inconsistent answers. Bad values are ignored and the person is asked to check them; the flow never stops.', ar: 'تكتشف الإجابات الناقصة والمستحيلة وغير المتسقة، فتتجاهل القيم الخاطئة وتطلب التحقق منها دون إيقاف التسلسل.' } },
  { layer: 'rules', title: { en: 'Risk-signal rules', ar: 'قواعد مؤشرات الخطر' }, body: { en: `${RULES.length} fixed rules across history, lifestyle, metabolic, infectious, anatomical and test inputs. Each shows the answer that triggered it and cites a guideline.`, ar: `${RULES.length} قاعدة ثابتة تغطي التاريخ المرضي ونمط الحياة والأيض والعدوى والتشريح ونتائج التحاليل، تعرض كل منها الإجابة التي أطلقتها وتستشهد بإرشاد طبي.` } },
  { layer: 'rules', title: { en: 'Triage and navigation', ar: 'الفرز والتوجيه' }, body: { en: 'One of five next steps: self-care, family doctor, fertility services, andrology/urology, or urgent. The highest wins. Lower-friction options are offered: teleconsultation, a male doctor, home tests as a first step.', ar: 'واحدة من خمس خطوات: عناية ذاتية، أو طبيب الأسرة، أو خدمات الخصوبة، أو أخصائي الذكورة/المسالك، أو رعاية عاجلة. تُعتمد الأعلى، مع خيارات أسهل: استشارة عن بُعد، طبيب رجل، اختبار منزلي كخطوة أولى.' } },
  { layer: 'ai', title: { en: 'Plain-language explainer (optional)', ar: 'شرح بلغة بسيطة (اختياري)' }, body: { en: 'Azure OpenAI rewrites the result simply in Arabic or English. It receives only the result summary, cannot change the step, and its output is checked for diagnosis claims, doses and missed emergencies.', ar: 'يعيد Azure OpenAI صياغة النتيجة ببساطة بالعربية أو الإنجليزية. لا يستقبل سوى ملخص النتيجة، ولا يستطيع تغيير الخطوة، ويُفحص رده بحثاً عن ادعاءات التشخيص والجرعات وإغفال الطوارئ.' } },
  {
    layer: 'you',
    title: { en: 'User-controlled hand-off', ar: 'تسليم يتحكم به المستخدم' },
    body: {
      en: 'The person chooses exactly what to share. The summary, an HL7 FHIR R4 bundle that carries its own consent record, is encrypted on the phone and stored as scrambled bytes. It opens only with the person’s link or QR code, deletes itself after 1 or 7 days, and can be withdrawn at once. In a pilot the same bundle would travel through Malaffi.',
      ar: 'يختار الشخص بالضبط ما يشاركه. يُشفَّر الملخص، وهو حزمة HL7 FHIR R4 تحمل سجل الموافقة الخاص بها، على الهاتف ويُحفظ كبيانات مشفّرة. لا يُفتح إلا برابط الشخص أو رمز QR، ويُحذف تلقائياً بعد يوم أو 7 أيام، ويمكن سحبه فوراً. في المرحلة التجريبية تنتقل الحزمة نفسها عبر «ملفي».',
    },
  },
  {
    layer: 'human',
    title: { en: 'Clinician review', ar: 'مراجعة الطبيب' },
    body: {
      en: 'A clinician confirms or changes the suggested step, with a reason, and the decision is recorded and sent back, encrypted, to the person’s phone. The tool supports decisions; it never makes them.',
      ar: 'يؤكد الطبيب الخطوة المقترحة أو يغيّرها مع ذكر السبب، ويُسجَّل القرار ويُرسل مشفّراً إلى هاتف الشخص. الأداة تدعم القرار ولا تتخذه أبداً.',
    },
  },
]

const PERSONAS: { icon: LucideIcon; title: L10n; body: L10n }[] = [
  { icon: UserRound, title: { en: 'Men 18+', ar: 'الرجال من 18 عاماً' }, body: { en: 'Any nationality, Arabic or English, planning a family or not.', ar: 'من أي جنسية، بالعربية أو الإنجليزية، سواء كانوا يخططون لتكوين أسرة أم لا.' } },
  { icon: Stethoscope, title: { en: 'Family doctors', ar: 'أطباء الأسرة' }, body: { en: 'Receive a structured, consented summary instead of a cold start.', ar: 'يستلمون ملخصاً منظماً وبموافقة بدلاً من البدء من الصفر.' } },
  { icon: Hospital, title: { en: 'Specialist & fertility services', ar: 'الأخصائيون وخدمات الخصوبة' }, body: { en: 'See men earlier, with the key facts ready.', ar: 'يرون الرجال مبكراً مع المعلومات الأساسية جاهزة.' } },
  { icon: Building2, title: { en: 'Public health teams', ar: 'فرق الصحة العامة' }, body: { en: 'Anonymous, aggregate insight into male risk and screening uptake.', ar: 'رؤى إجمالية مجهولة الهوية عن مخاطر الرجال والإقبال على الفحص.' } },
]

export default function How() {
  const { t } = useI18n()
  return (
    <div className="container-app space-y-16 py-8 sm:py-12">
      <div className="max-w-3xl space-y-3">
        <p className="eyebrow">{t({ en: 'How it works', ar: 'كيف يعمل' })}</p>
        <h1 className="title">{t({ en: 'A trusted, low-friction front door for men', ar: 'بوابة موثوقة وسهلة للرجل' })}</h1>
        <p className="lead">{t({ en: 'Earlier, explainable risk identification and safe triage to the right care, designed for Abu Dhabi.', ar: 'تحديد مبكر وقابل للتفسير للمخاطر، وفرز آمن نحو الرعاية المناسبة، مصمم لأبوظبي.' })}</p>
      </div>

      <section className="space-y-6">
        <h2 className="heading">{t({ en: 'Who it is for', ar: 'لمن صُمم' })}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PERSONAS.map((p) => (
            <div key={p.title.en} className="surface p-5">
              <p.icon className="h-5 w-5 text-brand-600" strokeWidth={1.75} aria-hidden />
              <h3 className="mt-3 text-[15px] font-semibold text-ink">{t(p.title)}</h3>
              <p className="mt-1 text-sm text-muted">{t(p.body)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-10 lg:grid-cols-[1fr_1.6fr]">
        <div className="space-y-3 lg:sticky lg:top-24 lg:self-start">
          <h2 className="heading">{t({ en: 'A gated pipeline with clear jobs', ar: 'مسار متدرج بمهام واضحة' })}</h2>
          <p className="text-sm text-muted">
            {t({
              en: 'Every screen keeps the layers apart, so it is always clear what you told us, what the fixed rules found, what the AI wrote, and what a clinician decided.',
              ar: 'تفصل كل شاشة بين الطبقات، فيتضح دائماً ما أخبرتنا به، وما وجدته القواعد الثابتة، وما كتبه الذكاء الاصطناعي، وما قرره الطبيب.',
            })}
          </p>
          <div className="flex flex-col gap-2 pt-1">
            {(['you', 'rules', 'ai', 'human'] as const).map((l) => (
              <LayerLabel key={l} layer={l} />
            ))}
          </div>
        </div>
        <ol className="relative space-y-3">
          {STAGES.map((s, i) => (
            <li key={s.title.en} className="surface flex gap-4 p-5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-800 tabular-nums">{i + 1}</span>
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-[15px] font-semibold text-ink">{t(s.title)}</h3>
                  <LayerLabel layer={s.layer} />
                </div>
                <p className="text-sm leading-relaxed text-muted">{t(s.body)}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="surface surface-pad space-y-3">
          <h2 className="heading">{t({ en: 'Fits into what Abu Dhabi already has', ar: 'يتكامل مع ما لدى أبوظبي بالفعل' })}</h2>
          <ul className="space-y-3 text-sm text-body">
            {[
              { en: 'Sahatna: the check is a lightweight web module that can run inside the patient app.', ar: '«صحتنا»: الفحص وحدة ويب خفيفة يمكن تشغيلها داخل تطبيق المريض.' },
              { en: 'Malaffi: consented HL7 FHIR R4 summaries go to the family physician.', ar: '«ملفي»: ملخصات HL7 FHIR R4 بموافقة المريض إلى طبيب الأسرة.' },
              { en: 'IFHAS periodic adult screening: men who come for reproductive health are steered into the heart and diabetes checks they usually skip.', ar: 'الفحص الدوري للبالغين «إفحص»: يُوجَّه الرجال القادمون من أجل الصحة الإنجابية إلى فحوصات القلب والسكري التي يتجاهلونها عادة.' },
              { en: 'The family physician programme: every referral starts with the person’s own doctor.', ar: 'برنامج طبيب الأسرة: تبدأ كل إحالة من طبيب الشخص نفسه.' },
            ].map((x) => (
              <li key={x.en} className="flex gap-2.5">
                <ArrowRight className="icon-dir mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
                {t(x)}
              </li>
            ))}
          </ul>
        </div>
        <div className="surface surface-pad space-y-3">
          <h2 className="heading">{t({ en: 'Built with', ar: 'التقنيات المستخدمة' })}</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-sm">
            {[
              [{ en: 'App', ar: 'التطبيق' }, 'React · TypeScript · Tailwind CSS'],
              [{ en: 'Rules engine', ar: 'محرك القواعد' }, `${ENGINE_VERSION} · ${QUESTIONS.length} questions · ${RULES.length} rules · runs on the device`],
              [{ en: 'AI', ar: 'الذكاء الاصطناعي' }, 'Azure OpenAI (GPT-4.1) behind guarded serverless functions: explainer and report reader'],
              [{ en: 'Data', ar: 'البيانات' }, 'Nothing readable on the server: shared summaries are end-to-end encrypted (AES-256-GCM) and expire'],
              [{ en: 'Interoperability', ar: 'التوافق' }, 'HL7 FHIR R4 (Patient, Consent, RiskAssessment, ServiceRequest)'],
              [{ en: 'Quality', ar: 'الجودة' }, 'Safety tests run on every build'],
            ].map(([k, v]) => (
              <div key={(k as L10n).en} className="contents">
                <dt className="font-medium text-muted">{t(k as L10n)}</dt>
                <dd className="text-ink" dir="ltr">
                  {v as string}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="heading">{t({ en: 'Evidence base', ar: 'المراجع' })}</h2>
        <ol className="surface divide-y divide-line text-sm">
          {Object.values(SOURCES).map((s, i) => (
            <li key={s.id} className="flex gap-3 px-5 py-3">
              <span className="w-5 shrink-0 text-faint tabular-nums">{i + 1}</span>
              {s.url ? (
                <a href={s.url} target="_blank" rel="noreferrer noopener" className="text-body hover:text-brand-700 hover:underline" dir="ltr">
                  {s.full}
                </a>
              ) : (
                <span className="text-body" dir="ltr">
                  {s.full}
                </span>
              )}
            </li>
          ))}
        </ol>
        <Link to="/evaluation" className="link inline-flex items-center gap-1.5 text-sm">
          {t({ en: 'See the safety test results', ar: 'اطّلع على نتائج اختبارات السلامة' })}
          <ArrowRight className="icon-dir h-4 w-4" aria-hidden />
        </Link>
      </section>
    </div>
  )
}
