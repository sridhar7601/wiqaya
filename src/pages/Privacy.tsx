import { Ban, Database, EyeOff, Fingerprint, Hospital, Send, SlidersHorizontal, Trash2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { AI_PROVIDER } from '../lib/ai'
import { withdrawAll } from '../lib/handoff'
import { useI18n } from '../lib/i18n'
import { wipeAll } from '../lib/storage'
import type { L10n } from '../lib/types'

const BLOCKS: { icon: LucideIcon; title: L10n; items: L10n[] }[] = [
  {
    icon: Database,
    title: { en: 'What we collect', ar: 'ما نجمعه' },
    items: [
      { en: 'Your answers to the check: age, health, daily life and private health questions.', ar: 'إجاباتك عن أسئلة الفحص: العمر والصحة ونمط الحياة والأسئلة الخاصة.' },
      { en: 'Optional height, weight and semen analysis values, only if you enter them.', ar: 'الطول والوزن وقيم تحليل السائل المنوي، اختيارياً وفقط إذا أدخلتها.' },
      { en: 'Anonymous counters kept on this device: checks started and finished, time taken, two feedback scores.', ar: 'عدّادات مجهولة الهوية تُحفظ على هذا الجهاز: الفحوصات التي بدأت وانتهت، والمدة، ودرجتا تقييم.' },
    ],
  },
  {
    icon: Fingerprint,
    title: { en: 'What we do not collect', ar: 'ما لا نجمعه' },
    items: [
      { en: 'No account and no name (unless you add a first name to a summary). No phone number, Emirates ID, date of birth or location.', ar: 'لا حساب ولا اسم (إلا إذا أضفت اسمك الأول إلى ملخص)، ولا رقم هاتف أو هوية إماراتية أو تاريخ ميلاد أو موقع.' },
      { en: 'No tracking or analytics scripts, no advertising, no third-party fonts.', ar: 'لا برامج تتبع أو تحليلات، ولا إعلانات، ولا خطوط من جهات خارجية.' },
    ],
  },
  {
    icon: Send,
    title: { en: 'When anything leaves your device', ar: 'متى يغادر أي شيء جهازك' },
    items: [
      {
        en: 'Only when you create a private link for a doctor. Exactly the parts you ticked are encrypted on your phone first. Our server keeps the scrambled copy and cannot read it: the key exists only in your link and QR code. The copy is deleted when you withdraw it, or after the time you chose (24 hours or 7 days).',
        ar: 'فقط عند إنشاء رابط خاص لطبيب. تُشفَّر الأجزاء التي اخترتها فقط على هاتفك أولاً. يحتفظ خادمنا بالنسخة المشفّرة ولا يستطيع قراءتها، فالمفتاح موجود فقط في رابطك ورمز QR. تُحذف النسخة عند سحبها، أو بعد المدة التي اخترتها (24 ساعة أو 7 أيام).',
      },
      {
        en: `Only when you ask the AI helper. The titles of your result and the suggested step, whether this is a woman’s or a man’s check, and your question go to our AI service (${AI_PROVIDER}). Your other answers and identity are never sent.`,
        ar: `فقط عند سؤال المساعد الذكي، فتُرسل عناوين نتيجتك والخطوة المقترحة، وهل الفحص لامرأة أم لرجل، مع سؤالك إلى خدمة الذكاء الاصطناعي لدينا (${AI_PROVIDER}). لا تُرسل إجاباتك الأخرى أو هويتك أبداً.`,
      },
      {
        en: 'Only when you use the lab report reader. The part of the picture inside the frame goes to the same AI service, which sends back numbers. We do not keep the picture. Leave your name outside the frame.',
        ar: 'فقط عند استخدام قارئ تقرير المختبر. يُرسل جزء الصورة الموجود داخل الإطار إلى خدمة الذكاء الاصطناعي نفسها، فتعيد أرقاماً. لا نحتفظ بالصورة. أبقِ اسمك خارج الإطار.',
      },
      {
        en: 'Only when you press “Send feedback”: your two ratings, how long the check took, and the language. Nothing else.',
        ar: 'فقط عند الضغط على «إرسال الملاحظات»: تقييماك ومدة الفحص واللغة، ولا شيء غير ذلك.',
      },
      {
        en: 'To stop misuse, the server counts requests from each network address. It keeps a scrambled form of the address, never the address itself, for at most two hours.',
        ar: 'لمنع إساءة الاستخدام، يعدّ الخادم الطلبات الواردة من كل عنوان شبكة، ويحتفظ بصيغة مشفّرة من العنوان، لا العنوان نفسه، لمدة ساعتين على الأكثر.',
      },
    ],
  },
  {
    icon: Ban,
    title: { en: 'How your reproductive data will never be used', ar: 'كيف لن تُستخدم بياناتك الإنجابية أبداً' },
    items: [
      { en: 'Never sold. Never shared with an employer, insurer, sponsor or family member.', ar: 'لن تُباع أبداً، ولن تُشارك مع صاحب عمل أو شركة تأمين أو كفيل أو أحد أفراد العائلة.' },
      { en: 'Never used for advertising, and never used to train AI models.', ar: 'لن تُستخدم للإعلانات أبداً، ولن تُستخدم لتدريب نماذج الذكاء الاصطناعي.' },
    ],
  },
  {
    icon: SlidersHorizontal,
    title: { en: 'Your controls', ar: 'خياراتك' },
    items: [
      { en: '“Prefer not to say” on every sensitive question.', ar: '«أفضّل عدم الإجابة» في كل سؤال حساس.' },
      { en: 'Discreet mode shows a neutral name in the browser tab and header.', ar: 'يعرض الوضع المتحفظ اسماً محايداً في تبويب المتصفح والعنوان.' },
      { en: 'Withdraw a shared summary at any time: the stored copy is deleted at once and the link stops working. See when your link was opened.', ar: 'اسحب أي ملخص شاركته في أي وقت: تُحذف النسخة المحفوظة فوراً ويتوقف الرابط عن العمل. واعرف متى فُتح رابطك.' },
      { en: '“Delete everything” clears this device and also withdraws every link you created.', ar: '«احذف كل شيء» يمسح هذا الجهاز ويسحب أيضاً كل رابط أنشأته.' },
    ],
  },
  {
    icon: Hospital,
    title: { en: 'In a pilot', ar: 'في المرحلة التجريبية' },
    items: [
      { en: 'Hosting in UAE data centres, and compliance with the UAE health data law (Federal Law No. 2 of 2019) and Department of Health – Abu Dhabi standards.', ar: 'الاستضافة في مراكز بيانات داخل الدولة، والالتزام بقانون البيانات الصحية الاتحادي (القانون الاتحادي رقم 2 لسنة 2019) ومعايير دائرة الصحة – أبوظبي.' },
      { en: 'Role-based access and audit logs for clinicians, a consent record with every shared summary, and a published retention period.', ar: 'صلاحيات وصول حسب الدور وسجلات تدقيق للأطباء، وسجل موافقة مع كل ملخص مُشارك، ومدة احتفاظ معلنة.' },
    ],
  },
]

export default function Privacy() {
  const { t } = useI18n()
  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-8 sm:px-6 sm:py-12">
      <div className="space-y-2">
        <p className="eyebrow">{t({ en: 'Privacy', ar: 'الخصوصية' })}</p>
        <h1 className="title">{t({ en: 'Privacy, in plain words', ar: 'الخصوصية بكلمات بسيطة' })}</h1>
        <p className="lead">{t({ en: 'Your answers stay on your device. The result is worked out on your phone, not on a server. Anything you choose to share is locked before it leaves.', ar: 'تبقى إجاباتك على جهازك، وتُحسب النتيجة على هاتفك وليس على خادم. وكل ما تختار مشاركته يُقفل قبل أن يغادر.' })}</p>
      </div>

      <div className="surface divide-y divide-line">
        {BLOCKS.map((b) => (
          <section key={b.title.en} className="flex gap-4 px-5 py-5 sm:px-6">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <b.icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            </span>
            <div className="space-y-2">
              <h2 className="text-base font-semibold text-ink">{t(b.title)}</h2>
              <ul className="space-y-1.5 text-sm leading-relaxed text-body">
                {b.items.map((i, k) => (
                  <li key={k}>{t(i)}</li>
                ))}
              </ul>
            </div>
          </section>
        ))}
      </div>

      <div className="surface flex flex-col items-start justify-between gap-4 border-red-200 p-5 sm:flex-row sm:items-center sm:p-6">
        <div className="flex gap-3">
          <EyeOff className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden />
          <div>
            <p className="font-semibold text-ink">{t({ en: 'Delete everything', ar: 'احذف كل شيء' })}</p>
            <p className="text-sm text-muted">{t({ en: 'Removes your answers, results and settings from this device, and withdraws any summary you shared.', ar: 'يحذف إجاباتك ونتائجك وإعداداتك من هذا الجهاز، ويسحب أي ملخص شاركته.' })}</p>
          </div>
        </div>
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => {
            if (!window.confirm(t({ en: 'Delete everything this app stored on this device, and withdraw any summary you shared?', ar: 'هل تريد حذف كل ما خزّنه التطبيق على هذا الجهاز، وسحب أي ملخص شاركته؟' }))) return
            void withdrawAll().finally(() => {
              wipeAll()
              window.location.hash = '#/'
              window.location.reload()
            })
          }}
        >
          <Trash2 className="h-4 w-4" aria-hidden />
          {t({ en: 'Delete my data', ar: 'احذف بياناتي' })}
        </button>
      </div>
    </div>
  )
}
