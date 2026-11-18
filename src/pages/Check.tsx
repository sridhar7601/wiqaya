import { ArrowLeft, ArrowRight, Ban, Check as CheckIcon, CircleCheck, Info, LockKeyhole, MessageSquare, Phone, ScanLine, Send, ShieldCheck, Stethoscope, TriangleAlert, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ReportReader } from '../components/ReportReader'
import { Checkbox } from '../components/ui'
import { arr, num } from '../lib/engine'
import { useI18n } from '../lib/i18n'
import { SECTIONS, visibleQuestions } from '../lib/questions'
import type { Question } from '../lib/questions'
import { READ_FIELDS } from '../lib/report'
import type { ReadField } from '../lib/report'
import { bumpMetrics, CONSENT_VERSION, useStored } from '../lib/storage'
import type { Consent } from '../lib/storage'
import type { AnswerValue, Answers } from '../lib/types'
import { sexOf } from '../lib/types'

function isAnswered(q: Question, a: Answers): boolean {
  if (q.type === 'single') return typeof a[q.id] === 'string'
  if (q.type === 'multi') return arr(a, q.id).length > 0
  if (q.type === 'number') return num(a, q.fields![0].id) !== undefined
  return true // 'numbers' groups are optional
}

export default function Check() {
  const { t } = useI18n()
  const nav = useNavigate()
  const [consent, setConsent] = useStored<Consent | null>('consent', null)
  const [answers, setAnswers] = useStored<Answers>('answers', {})
  const [currentId, setCurrentId] = useStored<string>('step', 'sex')
  const [showHelp, setShowHelp] = useState(false)
  const [redGate, setRedGate] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanned, setScanned] = useState(false)

  const list = useMemo(() => visibleQuestions(answers), [answers])
  const pos = Math.max(0, list.findIndex((x) => x.id === currentId))
  const q = list[pos]

  if (!consent) {
    return (
      <ConsentScreen
        onAccept={(aiOptIn) => {
          setConsent({ version: CONSENT_VERSION, at: new Date().toISOString(), aiOptIn })
          bumpMetrics((m) => ({ ...m, started: m.started + 1 }))
          try {
            sessionStorage.setItem('wiqaya.start', String(Date.now()))
          } catch {
            /* ignore */
          }
        }}
      />
    )
  }

  const finish = () => {
    let start = Date.now()
    try {
      start = Number(sessionStorage.getItem('wiqaya.start')) || start
    } catch {
      /* ignore */
    }
    bumpMetrics((m) => ({ ...m, completed: m.completed + 1, durationsSec: [...m.durationsSec, Math.round((Date.now() - start) / 1000)].slice(-200) }))
    setCurrentId('sex')
    nav('/result')
  }

  const goNext = (a: Answers) => {
    if (q.id === 'age') {
      const age = num(a, 'age')
      if (age !== undefined && age < 18) {
        nav('/result')
        return
      }
    }
    if (q.id === 'urgent_symptoms' && !redGate && arr(a, 'urgent_symptoms').some((v) => v !== 'none')) {
      setRedGate(true)
      return
    }
    setRedGate(false)
    setShowHelp(false)
    const fresh = visibleQuestions(a)
    const i = fresh.findIndex((x) => x.id === q.id)
    if (i >= fresh.length - 1) finish()
    else setCurrentId(fresh[i + 1].id)
  }

  const goBack = () => {
    setRedGate(false)
    setShowHelp(false)
    if (scanning) {
      setScanning(false)
      return
    }
    if (pos === 0) nav('/')
    else setCurrentId(list[pos - 1].id)
  }

  const setValue = (id: string, v: AnswerValue | undefined) => {
    const next = { ...answers }
    if (v === undefined || (Array.isArray(v) && v.length === 0)) delete next[id]
    else next[id] = v
    setAnswers(next)
    return next
  }

  const pickSingle = (value: string) => {
    const next = setValue(q.id, value)
    window.setTimeout(() => goNext(next), 180)
  }

  const toggleMulti = (value: string) => {
    const opt = q.options!.find((o) => o.value === value)!
    const cur = arr(answers, q.id)
    let v: string[]
    if (opt.exclusive) v = cur.includes(value) ? [] : [value]
    else {
      const exclusives = new Set(q.options!.filter((o) => o.exclusive).map((o) => o.value))
      const base = cur.filter((x) => !exclusives.has(x))
      v = base.includes(value) ? base.filter((x) => x !== value) : [...base, value]
    }
    setValue(q.id, v)
  }

  const setNumber = (id: string, raw: string) => {
    const n = raw.trim() === '' ? undefined : Number(raw)
    setValue(id, n !== undefined && Number.isFinite(n) ? n : undefined)
  }

  /** The numbers the person confirmed on the report reader replace whatever was typed before. */
  const applyReport = (values: Partial<Record<ReadField, number>>) => {
    const next = { ...answers }
    for (const f of READ_FIELDS) {
      if (values[f] === undefined) delete next[f]
      else next[f] = values[f]
    }
    setAnswers(next)
    setScanning(false)
    setScanned(true)
  }

  const pct = Math.round(((pos + 1) / list.length) * 100)

  if (redGate) {
    const female = sexOf(answers) === 'female'
    const emergency = arr(answers, 'urgent_symptoms').some((v) => v === 'sudden_pain' || v === 'ectopic_signs')
    return (
      <div className="container-flow py-10">
        <div className="surface overflow-hidden border-red-200">
          <div className="space-y-5 p-6 sm:p-8">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600 ring-8 ring-red-50/60">
              <TriangleAlert className="h-6 w-6" strokeWidth={1.75} aria-hidden />
            </span>
            <div className="space-y-2">
              <h1 className="title text-red-950">
                {emergency
                  ? t({ en: 'This could be an emergency. Please get help now.', ar: 'قد تكون هذه حالة طارئة. يُرجى طلب المساعدة الآن.' })
                  : t({ en: 'Please see a doctor about this soon.', ar: 'يُرجى مراجعة طبيب قريباً بشأن ذلك.' })}
              </h1>
              <p className="text-body">
                {emergency && female
                  ? t({
                      en: 'Severe pain low in the belly with a late period or fainting can be an ectopic pregnancy, which can bleed internally. Go to the nearest emergency department or call 998.',
                      ar: 'قد يدل الألم الشديد أسفل البطن مع تأخر الدورة أو الإغماء على حمل خارج الرحم قد يسبب نزيفاً داخلياً. توجّهي إلى أقرب قسم طوارئ أو اتصلي بالرقم 998.',
                    })
                  : female
                  ? t({
                      en: 'What you described should be checked today, at urgent care or an emergency department. Call 998 if you feel faint or dizzy.',
                      ar: 'يجب فحص ما وصفتِه اليوم، في الرعاية العاجلة أو قسم الطوارئ. اتصلي بالرقم 998 إذا شعرتِ بدوار أو إغماء.',
                    })
                  : emergency
                  ? t({
                      en: 'Sudden, severe testicular pain can be torsion, which needs treatment within hours. Go to the nearest emergency department or call 998.',
                      ar: 'قد يكون الألم المفاجئ الشديد في الخصية التواءً يحتاج إلى علاج خلال ساعات. توجّه إلى أقرب قسم طوارئ أو اتصل بالرقم 998.',
                    })
                  : t({
                      en: 'What you described should be checked quickly: the same day for painful swelling with fever, and within a few days for a new lump.',
                      ar: 'يجب فحص ما وصفته بسرعة: في اليوم نفسه في حال التورم المؤلم مع الحرارة، وخلال أيام قليلة في حال وجود كتلة جديدة.',
                    })}
              </p>
            </div>
            {emergency && (
              <a href="tel:998" className="btn btn-danger btn-lg w-full">
                <Phone className="h-5 w-5" aria-hidden />
                {t({ en: 'Call 998 (ambulance)', ar: 'اتصل بالرقم 998 (الإسعاف)' })}
              </a>
            )}
          </div>
          <div className="flex flex-col gap-2 border-t border-line bg-canvas px-6 py-4 sm:flex-row sm:px-8">
            <button type="button" className="btn btn-secondary flex-1" onClick={finish}>
              {t({ en: 'See my result now', ar: 'اعرض نتيجتي الآن' })}
            </button>
            <button type="button" className="btn btn-ghost flex-1" onClick={() => goNext(answers)}>
              {t({ en: 'Continue the check', ar: 'تابع الفحص' })}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container-flow py-6 sm:py-10">
      {/* Progress */}
      <div className="mb-6 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-brand-700">{t(SECTIONS[q.section])}</p>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted tabular-nums">
              {t({ en: 'Question', ar: 'السؤال' })} {pos + 1} {t({ en: 'of', ar: 'من' })} {list.length}
            </span>
            <Link to="/" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-white hover:text-ink" title={t({ en: 'Save and exit', ar: 'حفظ وخروج' })}>
              <X className="h-4 w-4" aria-hidden />
              <span className="sr-only">{t({ en: 'Save and exit', ar: 'حفظ وخروج' })}</span>
            </Link>
          </div>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-brand-600 transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {q.id === 'semen' && scanning && <ReportReader onUse={applyReport} onCancel={() => setScanning(false)} />}

      {/* Question */}
      <div className={`surface surface-pad space-y-6 ${q.id === 'semen' && scanning ? 'hidden' : ''}`}>
        <div className="space-y-3">
          <h1 className="text-[22px] leading-snug font-semibold tracking-tight text-ink sm:text-2xl">{t(q.text)}</h1>
          {q.sensitive && (
            <p className="inline-flex items-center gap-1.5 text-sm text-muted">
              <LockKeyhole className="h-4 w-4 text-brand-600" aria-hidden />
              {t({ en: 'Private question. “Prefer not to say” is always fine.', ar: 'سؤال خاص، و«أفضّل عدم الإجابة» مقبول دائماً.' })}
            </p>
          )}
          {q.help && (
            <div>
              <button type="button" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-900" onClick={() => setShowHelp(!showHelp)} aria-expanded={showHelp}>
                <Info className="h-4 w-4" aria-hidden />
                {t({ en: 'Why we ask', ar: 'لماذا نسأل' })}
              </button>
              {showHelp && <p className="mt-2 rounded-lg bg-canvas px-3.5 py-2.5 text-sm text-body">{t(q.help)}</p>}
            </div>
          )}
        </div>

        {q.type === 'single' && (
          <div className="grid gap-2.5" role="radiogroup" aria-label={t(q.text)}>
            {q.options!.map((o) => {
              const on = answers[q.id] === o.value
              return (
                <button key={o.value} type="button" role="radio" className="option" aria-checked={on} onClick={() => pickSingle(o.value)}>
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${on ? 'border-brand-700' : 'border-line-strong'}`} aria-hidden>
                    {on && <span className="h-2.5 w-2.5 rounded-full bg-brand-700" />}
                  </span>
                  {t(o.label)}
                </button>
              )
            })}
          </div>
        )}

        {q.type === 'multi' && (
          <div className="grid gap-2.5">
            <p className="small">{t({ en: 'Select all that apply.', ar: 'اختر كل ما ينطبق.' })}</p>
            {q.options!.map((o) => {
              const on = arr(answers, q.id).includes(o.value)
              return (
                <button key={o.value} type="button" className="option" aria-pressed={on} onClick={() => toggleMulti(o.value)}>
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${on ? 'border-brand-700 bg-brand-700 text-white' : 'border-line-strong bg-white'}`} aria-hidden>
                    {on && <CheckIcon className="h-3.5 w-3.5" strokeWidth={3} />}
                  </span>
                  {t(o.label)}
                </button>
              )
            })}
          </div>
        )}

        {q.id === 'semen' && (
          <div className="space-y-3">
            <button type="button" className="flex w-full items-center gap-3 rounded-lg border border-ai-200 bg-ai-50 px-4 py-3.5 text-start transition-colors hover:bg-ai-100 focus-visible:ring-4 focus-visible:ring-ai-100 focus-visible:outline-none" onClick={() => setScanning(true)}>
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-ai-600 ring-1 ring-inset ring-ai-100">
                <ScanLine className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold text-ink">{t({ en: 'Read the numbers from a photo', ar: 'اقرأ الأرقام من صورة' })}</span>
                <span className="block text-sm text-muted">{t({ en: 'The AI reads your report, and you check every number.', ar: 'يقرأ الذكاء الاصطناعي تقريرك، وتتحقق أنت من كل رقم.' })}</span>
              </span>
              <ArrowRight className="icon-dir ms-auto h-4 w-4 shrink-0 text-ai-600" aria-hidden />
            </button>
            {scanned ? (
              <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                <CircleCheck className="h-4 w-4" aria-hidden />
                {t({ en: 'Filled in from your photo. You can still change any number.', ar: 'تمت التعبئة من صورتك، وما زال بإمكانك تغيير أي رقم.' })}
              </p>
            ) : (
              <p className="text-sm text-muted">{t({ en: 'Or type them here:', ar: 'أو اكتبها هنا:' })}</p>
            )}
          </div>
        )}

        {(q.type === 'number' || q.type === 'numbers') && (
          <div className={`grid gap-4 ${q.fields!.length > 1 ? 'sm:grid-cols-2' : 'max-w-xs'}`}>
            {q.fields!.map((f) => (
              <label key={f.id} className="grid gap-1.5">
                <span className="text-sm font-medium text-ink">{t(f.label)}</span>
                <div className="relative">
                  <input
                    className="input pe-24"
                    type="number"
                    inputMode="decimal"
                    min={f.min}
                    max={f.max}
                    step={f.step ?? 1}
                    value={typeof answers[f.id] === 'number' ? String(answers[f.id]) : ''}
                    onChange={(e) => setNumber(f.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && isAnswered(q, answers)) goNext(answers)
                    }}
                    autoFocus={q.type === 'number'}
                  />
                  <span className="pointer-events-none absolute inset-y-0 end-3.5 flex items-center text-sm text-muted">{t(f.unit)}</span>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="sticky bottom-0 -mx-4 mt-6 flex items-center gap-3 border-t border-line bg-white/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
        <button type="button" className="btn btn-secondary" onClick={goBack}>
          <ArrowLeft className="icon-dir h-4 w-4" aria-hidden />
          {t({ en: 'Back', ar: 'رجوع' })}
        </button>
        {q.type !== 'single' && !(q.id === 'semen' && scanning) && (
          <button type="button" className="btn btn-primary flex-1 sm:flex-none sm:px-8" disabled={!isAnswered(q, answers)} onClick={() => goNext(answers)}>
            {pos === list.length - 1 ? t({ en: 'See my result', ar: 'اعرض نتيجتي' }) : t({ en: 'Continue', ar: 'متابعة' })}
            <ArrowRight className="icon-dir h-4 w-4" aria-hidden />
          </button>
        )}
      </div>
      <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-muted">
        <LockKeyhole className="h-3.5 w-3.5" aria-hidden />
        {t({ en: 'Saved only on this device.', ar: 'محفوظة على هذا الجهاز فقط.' })}{' '}
        <Link to="/privacy" className="link">
          {t({ en: 'Privacy', ar: 'الخصوصية' })}
        </Link>
      </p>
    </div>
  )
}

function ConsentScreen({ onAccept }: { onAccept: (aiOptIn: boolean) => void }) {
  const { t } = useI18n()
  const [agree, setAgree] = useState(false)
  const [ai, setAi] = useState(false)

  const points = [
    {
      icon: MessageSquare,
      title: { en: 'What we ask', ar: 'ما نسأل عنه' },
      body: {
        en: 'About 20 short questions on your health, daily life and private health. Sensitive questions always have “Prefer not to say”.',
        ar: 'نحو 20 سؤالاً قصيراً عن صحتك ونمط حياتك وصحتك الخاصة. تتضمن الأسئلة الحساسة دائماً «أفضّل عدم الإجابة».',
      },
    },
    {
      icon: LockKeyhole,
      title: { en: 'Your answers stay on this device', ar: 'تبقى إجاباتك على هذا الجهاز' },
      body: { en: 'No account, no name, no phone number, no ID number.', ar: 'لا حساب ولا اسم ولا رقم هاتف ولا رقم هوية.' },
    },
    {
      icon: Send,
      title: { en: 'Sharing is your choice', ar: 'المشاركة باختيارك' },
      body: { en: 'You can send a summary to a doctor. You choose what goes in it, and nothing is sent until you press Send.', ar: 'يمكنك إرسال ملخص إلى طبيب. أنت من يحدد ما يتضمنه، ولا يُرسل شيء حتى تضغط «إرسال».' },
    },
    {
      icon: Ban,
      title: { en: 'What we never do', ar: 'ما لا نفعله أبداً' },
      body: { en: 'Sell your data, share it with an employer or insurer, or use it for advertising.', ar: 'بيع بياناتك، أو مشاركتها مع صاحب العمل أو شركة التأمين، أو استخدامها للإعلانات.' },
    },
    {
      icon: Stethoscope,
      title: { en: 'Screening, not diagnosis', ar: 'فحص أولي، لا تشخيص' },
      body: { en: 'This check points out signals and the right place to go. Only a clinician can diagnose.', ar: 'يبيّن هذا الفحص المؤشرات والمكان المناسب للتوجّه إليه، والتشخيص للطبيب فقط.' },
    },
  ]

  return (
    <div className="container-flow py-10">
      <div className="surface overflow-hidden">
        <div className="space-y-6 p-6 sm:p-8">
          <div className="space-y-3">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <ShieldCheck className="h-6 w-6" strokeWidth={1.75} aria-hidden />
            </span>
            <h1 className="title">{t({ en: 'Before we start', ar: 'قبل أن نبدأ' })}</h1>
            <p className="text-muted">{t({ en: 'A one-minute read on how your information is handled.', ar: 'قراءة سريعة لدقيقة واحدة حول كيفية التعامل مع معلوماتك.' })}</p>
          </div>
          <ul className="space-y-4">
            {points.map((p) => (
              <li key={p.title.en} className="flex gap-3.5">
                <p.icon className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" strokeWidth={1.75} aria-hidden />
                <div>
                  <p className="text-[15px] font-semibold text-ink">{t(p.title)}</p>
                  <p className="text-sm text-muted">{t(p.body)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-4 border-t border-line bg-canvas p-6 sm:p-8">
          <Checkbox checked={agree} onChange={setAgree}>
            {t({ en: 'I am 18 or older, I understand this is screening and not a diagnosis, and I agree to start.', ar: 'عمري 18 عاماً أو أكثر، وأفهم أن هذا فحص أولي وليس تشخيصاً، وأوافق على البدء.' })}
          </Checkbox>
          <Checkbox checked={ai} onChange={setAi}>
            <span className="font-medium text-ink">{t({ en: 'Optional: ', ar: 'اختياري: ' })}</span>
            {t({
              en: 'let the AI helper explain my result in plain words. Only a summary of the result is sent, never my answers or identity.',
              ar: 'اسمح للمساعد الذكي بشرح نتيجتي بكلمات بسيطة. يُرسل ملخص النتيجة فقط، ولا تُرسل إجاباتي أو هويتي أبداً.',
            })}
          </Checkbox>
          <div className="flex flex-col-reverse items-stretch gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <Link to="/privacy" className="link text-center text-sm">
              {t({ en: 'Read the full privacy notice', ar: 'اقرأ إشعار الخصوصية كاملاً' })}
            </Link>
            <button type="button" className="btn btn-primary btn-lg" disabled={!agree} onClick={() => onAccept(ai)}>
              {t({ en: 'Start the check', ar: 'ابدأ الفحص' })}
              <ArrowRight className="icon-dir h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
