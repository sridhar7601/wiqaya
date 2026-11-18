import { BadgeCheck, ChevronDown, Clock, Languages, MapPin, Phone, Search, Send, Sparkles, Stethoscope, TriangleAlert, UserRound, Video } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Callout } from '../../components/ui'
import { useConsents } from '../../lib/companion/consents'
import { fmtDay } from '../../lib/companion/dates'
import { AREA_LABEL, findCare, LANGUAGE_LABEL, parsePreferences, SERVICE_LABEL, toHealthcareService } from '../../lib/companion/directory'
import type { Area, CareFilter, Insurance, Language, Match, ServiceKind } from '../../lib/companion/directory'
import { bookingScript } from '../../lib/companion/scripts'
import { useCompanion } from '../../lib/companion/useCompanion'
import { aiSearch, looksUrgent } from '../../lib/ai'
import { useI18n } from '../../lib/i18n'
import type { L10n, Sex } from '../../lib/types'
import { sexOf } from '../../lib/types'
import { CompanionShell } from './Shell'

const PREF_LABEL: Record<string, L10n> = {
  area: { en: 'Area', ar: 'المنطقة' },
  language: { en: 'Language', ar: 'اللغة' },
  male: { en: 'Male clinician', ar: 'طبيب رجل' },
  female: { en: 'Female clinician', ar: 'طبيبة' },
  telehealth: { en: 'Video', ar: 'فيديو' },
  evenings: { en: 'Evenings', ar: 'مساءً' },
  weekends: { en: 'Weekends', ar: 'نهاية الأسبوع' },
  insurance: { en: 'Insurance', ar: 'التأمين' },
}
const INSURANCE_LABEL: Record<Insurance, L10n> = {
  thiqa: { en: 'Thiqa', ar: 'ثقة' },
  basic: { en: 'Basic plan', ar: 'الخطة الأساسية' },
  enhanced: { en: 'Enhanced plan', ar: 'الخطة المعززة' },
  self_pay: { en: 'Self-pay', ar: 'دفع ذاتي' },
}
const SERVICES_M: ServiceKind[] = ['primary', 'telehealth', 'screening', 'andrology', 'fertility', 'lab', 'urgent', 'occupational']
const SERVICES_F: ServiceKind[] = ['primary', 'telehealth', 'screening', 'womens', 'fertility', 'lab', 'urgent', 'occupational']

export default function Care() {
  const { t, lang } = useI18n()
  const c = useCompanion()
  const sex = sexOf(c.answers)
  const SERVICES = sex === 'female' ? SERVICES_F : SERVICES_M
  const consents = useConsents()
  const [params] = useSearchParams()
  const step = c.journey.find((s) => s.id === params.get('step'))
  const [services, setServices] = useState<ServiceKind[]>(step?.services.length ? step.services : ['primary'])
  const [filter, setFilter] = useState<CareFilter>(() => ({ area: c.work?.city }))
  const [text, setText] = useState('')
  const [searching, setSearching] = useState(false)
  const [understood, setUnderstood] = useState<{ by: 'ai' | 'rules'; filter: CareFilter } | null>(null)
  const matches = useMemo(() => findCare({ ...filter, services }), [filter, services])

  const [alert, setAlert] = useState<'emergency' | 'symptom' | null>(null)

  const search = async () => {
    if (!text.trim()) return
    setSearching(true)
    setAlert(null)
    // Words that describe an emergency win over any search, with or without the AI.
    let emergency = looksUrgent(text)
    let f: CareFilter | null = null
    let by: 'ai' | 'rules' = 'rules'
    if (!emergency && consents.is('ai_search') === true) {
      const r = await aiSearch(text)
      if (r && 'filter' in r) {
        f = r.filter
        by = 'ai'
        if (r.symptom) setAlert('symptom')
      } else if (r?.emergency) emergency = true
    }
    if (emergency) {
      setAlert('emergency')
      setUnderstood(null)
      setSearching(false)
      return
    }
    if (!f) f = parsePreferences(text)
    setFilter((x) => ({ ...x, ...f }))
    setUnderstood({ by, filter: f })
    setSearching(false)
  }
  const toggle = (k: 'maleClinician' | 'femaleClinician' | 'telehealth' | 'evenings' | 'weekends') => setFilter((f) => ({ ...f, [k]: f[k] ? undefined : true }))
  const toggleLang = (l: Language) => setFilter((f) => ({ ...f, languages: f.languages?.includes(l) ? f.languages.filter((x) => x !== l) : [...(f.languages ?? []), l] }))

  return (
    <CompanionShell
      title={t({ en: 'Find care', ar: 'ابحث عن رعاية' })}
      intro={step ? <span>{t({ en: 'For:', ar: 'لـ:' })} <span className="font-medium text-ink">{t(step.title)}</span></span> : t({ en: 'Services that fit your next step, sorted by what matters to you.', ar: 'خدمات تناسب خطوتك التالية، مرتبة حسب ما يهمك.' })}
    >
      <Callout tone="warn" title={t({ en: 'Example directory', ar: 'دليل نموذجي' })}>
        {t({
          en: 'Names, slots and licence numbers below are invented. In a pilot, only providers in the DoH Abu Dhabi licensing register appear, re-checked every day. The order is by fit and the earliest slot, and placement is never paid for.',
          ar: 'الأسماء والمواعيد وأرقام التراخيص أدناه مختلقة. في المرحلة التجريبية لا يظهر إلا مقدمو الخدمة المسجلون في سجل التراخيص لدى دائرة الصحة – أبوظبي، مع تحقق يومي. يكون الترتيب حسب الملاءمة وأقرب موعد، ولا يُدفع أبداً مقابل الظهور.',
        })}
      </Callout>

      <section className="surface surface-pad space-y-4">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void search()
          }}
        >
          <label className="relative flex-1">
            <span className="sr-only">{t({ en: 'Describe what you would like', ar: 'صف ما تريده' })}</span>
            <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-faint" aria-hidden />
            <input className="input ps-9" value={text} onChange={(e) => setText(e.target.value)} placeholder={sex === 'female' ? t({ en: 'e.g. female doctor in Al Ain, evenings, speaks Arabic', ar: 'مثال: طبيبة في العين، مساءً، تتحدث العربية' }) : t({ en: 'e.g. male doctor in Al Ain, evenings, speaks Arabic', ar: 'مثال: طبيب رجل في العين، مساءً، يتحدث العربية' })} />
          </label>
          <button type="submit" className="btn btn-primary" disabled={searching || !text.trim()}>
            {searching ? t({ en: 'Reading…', ar: 'جارٍ القراءة…' }) : t({ en: 'Search', ar: 'ابحث' })}
          </button>
        </form>
        {alert === 'emergency' && (
          <Callout tone="danger" icon={TriangleAlert}>
            <span className="block">
              {t({ en: 'If you have sudden, severe pain or feel very unwell, don’t look for a clinic: call 998 or go to the nearest emergency department now.', ar: 'إذا كنت تشعر بألم مفاجئ وشديد أو بتوعك شديد، فلا تبحث عن عيادة: اتصل بالرقم 998 أو توجّه إلى أقرب قسم طوارئ الآن.' })}
            </span>
            <a href="tel:998" className="btn btn-danger btn-sm mt-3">
              <Phone className="h-4 w-4" aria-hidden />
              {t({ en: 'Call 998', ar: 'اتصل بالرقم 998' })}
            </a>
          </Callout>
        )}
        {alert === 'symptom' && (
          <Callout tone="info" icon={Stethoscope}>
            {t({ en: 'You mentioned a symptom. This search only finds places; it can’t tell how urgent something is. A one-minute check-in decides that with the same clinical rules as your first check.', ar: 'ذكرتَ عرَضاً. هذا البحث يجد الأماكن فقط ولا يستطيع تقدير مدى الاستعجال. يحدد ذلك تسجيل لدقيقة واحدة بالقواعد السريرية نفسها التي استُخدمت في فحصك الأول.' })}{' '}
            <Link to="/me/check-in" className="font-semibold underline-offset-4 hover:underline">
              {t({ en: 'Do a check-in', ar: 'سجّل الآن' })}
            </Link>
          </Callout>
        )}
        {understood && (
          <p className="flex items-start gap-2 text-sm text-muted">
            {understood.by === 'ai' && <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-ai-600" aria-hidden />}
            <span>
              {understood.by === 'ai' ? t({ en: 'The AI turned your words into these filters. It cannot pick your care level.', ar: 'حوّل الذكاء الاصطناعي كلماتك إلى هذه المرشحات، ولا يستطيع اختيار مستوى رعايتك.' }) : t({ en: 'Understood as these filters.', ar: 'فُهمت كهذه المرشحات.' })}{' '}
              {Object.keys(understood.filter).length === 0 && t({ en: 'Nothing recognised; try words like “male doctor”, “Al Ain” or “video”.', ar: 'لم يُفهم شيء؛ جرّب كلمات مثل «طبيب رجل» أو «العين» أو «فيديو».' })}
            </span>
          </p>
        )}
        {consents.is('ai_search') !== true && (
          <p className="text-xs text-faint">
            {t({ en: 'Search runs on your phone with fixed word lists. You can allow the AI to read your search words in', ar: 'يعمل البحث على هاتفك بقوائم كلمات ثابتة. ويمكنك السماح للذكاء الاصطناعي بقراءة كلمات بحثك من' })}{' '}
            <Link to="/me/privacy" className="link">
              {t({ en: 'Privacy', ar: 'الخصوصية' })}
            </Link>
            .
          </p>
        )}

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted">{t({ en: 'Service', ar: 'الخدمة' })}</p>
          <div className="flex flex-wrap gap-2">
            {SERVICES.map((s) => (
              <Chip key={s} on={services.includes(s)} onClick={() => setServices((x) => (x.includes(s) ? (x.length > 1 ? x.filter((y) => y !== s) : x) : [...x, s]))}>
                {t(SERVICE_LABEL[s])}
              </Chip>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted">{t({ en: 'What matters to you', ar: 'ما يهمك' })}</p>
          <div className="flex flex-wrap gap-2">
            <select className="input h-9 w-auto py-0 text-sm" value={filter.area ?? ''} onChange={(e) => setFilter((f) => ({ ...f, area: (e.target.value || undefined) as Area | undefined }))}>
              <option value="">{t({ en: 'Any area', ar: 'أي منطقة' })}</option>
              {(['abu_dhabi', 'al_ain', 'al_dhafra'] as const).map((a) => (
                <option key={a} value={a}>
                  {t(AREA_LABEL[a])}
                </option>
              ))}
            </select>
            <Chip on={!!filter.femaleClinician} onClick={() => toggle('femaleClinician')}>
              {t(PREF_LABEL.female)}
            </Chip>
            <Chip on={!!filter.maleClinician} onClick={() => toggle('maleClinician')}>
              {t(PREF_LABEL.male)}
            </Chip>
            <Chip on={!!filter.telehealth} onClick={() => toggle('telehealth')}>
              {t(PREF_LABEL.telehealth)}
            </Chip>
            <Chip on={!!filter.evenings} onClick={() => toggle('evenings')}>
              {t(PREF_LABEL.evenings)}
            </Chip>
            <Chip on={!!filter.weekends} onClick={() => toggle('weekends')}>
              {t(PREF_LABEL.weekends)}
            </Chip>
            {(['ar', 'en', 'hi', 'ur'] as Language[]).map((l) => (
              <Chip key={l} on={!!filter.languages?.includes(l)} onClick={() => toggleLang(l)}>
                {t(LANGUAGE_LABEL[l])}
              </Chip>
            ))}
            <select className="input h-9 w-auto py-0 text-sm" value={filter.insurance ?? ''} onChange={(e) => setFilter((f) => ({ ...f, insurance: (e.target.value || undefined) as Insurance | undefined }))}>
              <option value="">{t({ en: 'Any insurance', ar: 'أي تأمين' })}</option>
              {(Object.keys(INSURANCE_LABEL) as Insurance[]).map((i) => (
                <option key={i} value={i}>
                  {t(INSURANCE_LABEL[i])}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <p className="text-sm text-muted">{t({ en: `${matches.length} services`, ar: `${matches.length} خدمة` })}</p>
      <ul className="space-y-3">
        {matches.map((m) => (
          <li key={m.provider.id}>
            <ProviderCard m={m} services={services} lang={lang} sex={sex} />
          </li>
        ))}
      </ul>
    </CompanionShell>
  )
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={`inline-flex h-9 items-center rounded-full border px-3.5 text-sm font-medium transition-colors ${on ? 'border-brand-700 bg-brand-50 text-brand-800' : 'border-line-strong bg-white text-body hover:bg-canvas'}`}>
      {children}
    </button>
  )
}

function ProviderCard({ m, services, lang, sex }: { m: Match; services: ServiceKind[]; lang: 'en' | 'ar'; sex: Sex }) {
  const { t } = useI18n()
  const p = m.provider
  const [script, setScript] = useState(false)
  const svc = p.services.find((s) => services.includes(s)) ?? p.services[0]
  const purpose = p.telehealth && (svc === 'telehealth' || p.area === 'online') ? 'teleconsult' : 'review'
  return (
    <article className="surface overflow-hidden">
      <div className="space-y-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-[16px] leading-snug font-semibold text-ink">{t(p.name)}</h3>
            <p className="text-sm text-muted">{p.services.map((s) => t(SERVICE_LABEL[s])).join(' · ')}</p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
            <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
            {t({ en: 'Licence on file (example)', ar: 'ترخيص مسجّل (مثال)' })}
          </span>
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-body">
          <li className="inline-flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-faint" aria-hidden />
            {t(p.district)}, {t(AREA_LABEL[p.area])}
          </li>
          <li className="inline-flex items-center gap-1.5">
            <Languages className="h-4 w-4 text-faint" aria-hidden />
            {p.languages.map((l) => t(LANGUAGE_LABEL[l])).join(', ')}
          </li>
          {p.femaleClinician && (
            <li className="inline-flex items-center gap-1.5">
              <UserRound className="h-4 w-4 text-faint" aria-hidden />
              {t({ en: 'Female clinician available', ar: 'تتوفر طبيبة' })}
            </li>
          )}
          {p.maleClinician && (
            <li className="inline-flex items-center gap-1.5">
              <UserRound className="h-4 w-4 text-faint" aria-hidden />
              {t({ en: 'Male clinician available', ar: 'يتوفر طبيب رجل' })}
            </li>
          )}
          {p.telehealth && (
            <li className="inline-flex items-center gap-1.5">
              <Video className="h-4 w-4 text-faint" aria-hidden />
              {t({ en: 'Video visits', ar: 'زيارات بالفيديو' })}
            </li>
          )}
          <li className="inline-flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-faint" aria-hidden />
            {p.nextSlotDays === 0 ? t({ en: 'Today', ar: 'اليوم' }) : t({ en: `Next slot in ${p.nextSlotDays} days`, ar: `أقرب موعد بعد ${p.nextSlotDays} أيام` })}
            {p.evenings ? ` · ${t({ en: 'evenings', ar: 'مساءً' })}` : ''}
            {p.weekends ? ` · ${t({ en: 'weekends', ar: 'نهاية الأسبوع' })}` : ''}
          </li>
        </ul>
        {(m.meets.length > 0 || m.misses.length > 0) && (
          <p className="text-xs text-muted">
            {m.meets.length > 0 && (
              <>
                {t({ en: 'Matches:', ar: 'يطابق:' })} {m.meets.map((k) => t(PREF_LABEL[k])).join(', ')}
              </>
            )}
            {m.misses.length > 0 && (
              <>
                {m.meets.length > 0 ? ' · ' : ''}
                {t({ en: 'Does not match:', ar: 'لا يطابق:' })} {m.misses.map((k) => t(PREF_LABEL[k])).join(', ')}
              </>
            )}
          </p>
        )}
        {p.referralNeeded && <p className="text-xs text-amber-800">{t({ en: 'Usually needs a referral from your family doctor first.', ar: 'يتطلب عادةً تحويلاً من طبيب الأسرة أولاً.' })}</p>}
        <div className="flex flex-wrap gap-2">
          <Link to={`/share?provider=${p.id}&purpose=${purpose}`} className="btn btn-primary btn-sm">
            <Send className="h-4 w-4 rtl:-scale-x-100" aria-hidden />
            {purpose === 'teleconsult' ? t({ en: 'Request a video visit', ar: 'اطلب زيارة بالفيديو' }) : t({ en: 'Request an appointment', ar: 'اطلب موعداً' })}
          </Link>
          <button type="button" className={`btn btn-sm ${script ? 'btn-ghost' : 'btn-secondary'}`} onClick={() => setScript(!script)}>
            {t({ en: 'What to say', ar: 'ماذا أقول' })}
          </button>
        </div>
        {script && <p className="rounded-lg bg-canvas px-3.5 py-2.5 text-sm text-ink">“{t(bookingScript(svc, sex))}”</p>}
      </div>
      <details className="group border-t border-line">
        <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-2.5 text-xs font-medium text-muted hover:bg-canvas/70">
          {t({ en: 'Licence', ar: 'الترخيص' })} {p.licence.id} · {t({ en: 'checked', ar: 'تم التحقق' })} {fmtDay(p.licence.checked, lang)} · {t({ en: 'HL7 FHIR record', ar: 'سجل HL7 FHIR' })}
          <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <pre className="max-h-64 overflow-auto bg-ink px-5 py-3 text-[11px] leading-relaxed text-slate-200" dir="ltr">
          {JSON.stringify(toHealthcareService(p), null, 2)}
        </pre>
      </details>
    </article>
  )
}
