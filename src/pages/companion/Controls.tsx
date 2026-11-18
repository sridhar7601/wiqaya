import { Download, KeyRound, Lock, LockOpen, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Callout, Switch } from '../../components/ui'
import { consentsToFhir, SCOPES, useConsents } from '../../lib/companion/consents'
import { fmtDateTime } from '../../lib/companion/dates'
import { withdrawAll } from '../../lib/handoff'
import { useI18n } from '../../lib/i18n'
import { activeExample, closeExample, disableVault, enableVault, load, lockVault, PIN_RE, save, storedKeys, useVaultState, wipeAll } from '../../lib/storage'
import type { L10n } from '../../lib/types'
import { CompanionShell } from './Shell'

/** Groups of stored keys, as the person thinks of them. */
const DATA_GROUPS: { keys: string[]; label: L10n; count?: (v: unknown) => number }[] = [
  { keys: ['answers', 'step', 'consent'], label: { en: 'Your check answers', ar: 'إجابات الفحص' } },
  { keys: ['labs'], label: { en: 'Results over time', ar: 'النتائج مع الوقت' }, count: (v) => (Array.isArray(v) ? v.length : 0) },
  { keys: ['checkins'], label: { en: 'Weekly check-ins', ar: 'التسجيلات الأسبوعية' }, count: (v) => (Array.isArray(v) ? v.length : 0) },
  { keys: ['signals', 'signalsSource'], label: { en: 'Phone data (daily totals)', ar: 'بيانات الهاتف (مجاميع يومية)' }, count: (v) => (Array.isArray(v) ? v.length : 0) },
  { keys: ['work'], label: { en: 'Work and environment', ar: 'العمل والبيئة' } },
  { keys: ['journey', 'planStart', 'replies'], label: { en: 'Care journey and doctor replies', ar: 'رحلة الرعاية وردود الطبيب' }, count: (v) => (Array.isArray(v) ? v.length : 0) },
  { keys: ['shares', 'referrals', 'inbox', 'reviews'], label: { en: 'Doctor links and inbox', ar: 'روابط الطبيب والصندوق' }, count: (v) => (Array.isArray(v) ? v.length : 0) },
  { keys: ['consents'], label: { en: 'Consent log', ar: 'سجل الموافقات' }, count: (v) => (Array.isArray(v) ? v.length : 0) },
]

function download(name: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export default function Controls() {
  const { t, lang } = useI18n()
  const consents = useConsents()
  const example = activeExample()
  const keys = new Set(storedKeys())
  const [, refresh] = useState(0)

  return (
    <CompanionShell title={t({ en: 'Privacy and consent', ar: 'الخصوصية والموافقة' })} intro={t({ en: 'Everything here is on this phone. Each feature that sends anything asks first, and you can turn it off at any time.', ar: 'كل ما هنا على هذا الهاتف. كل ميزة ترسل أي شيء تطلب الإذن أولاً، ويمكنك إيقافها في أي وقت.' })}>
      {/* ---------- Consent ---------- */}
      <section className="surface overflow-hidden">
        <h2 className="border-b border-line px-5 py-4 text-base font-semibold text-ink">{t({ en: 'What may leave this phone', ar: 'ما الذي يمكن أن يغادر هذا الهاتف' })}</h2>
        <ul className="divide-y divide-line">
          {SCOPES.map((s) => {
            const d = consents.is(s.scope)
            return (
              <li key={s.scope} className="space-y-1 px-5 py-4">
                <Switch checked={d === true} onChange={(v) => consents.set(s.scope, v, 'settings')} label={t(s.title)} description={`${t({ en: 'Sends:', ar: 'يُرسل:' })} ${t(s.sends)} ${t({ en: 'To:', ar: 'إلى:' })} ${t(s.to)}.`} />
                <p className="text-xs text-faint">{d === undefined ? t({ en: 'Not asked yet: it asks the first time you use it.', ar: 'لم يُطلب بعد: يُطلب عند أول استخدام.' }) : d ? t({ en: 'Allowed', ar: 'مسموح' }) : t({ en: 'Not allowed', ar: 'غير مسموح' })}</p>
              </li>
            )
          })}
        </ul>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-canvas px-5 py-3">
          <p className="text-sm text-muted">{t({ en: `${consents.log.length} decisions recorded`, ar: `${consents.log.length} قرارات مسجلة` })}</p>
          <button type="button" className="btn btn-secondary btn-sm" disabled={!consents.log.length} onClick={() => download('wiqaya-consent-receipts.json', consentsToFhir(consents.log))}>
            <Download className="h-4 w-4" aria-hidden />
            {t({ en: 'Download consent receipts (HL7 FHIR)', ar: 'نزّل إيصالات الموافقة (HL7 FHIR)' })}
          </button>
        </div>
        {consents.log.length > 0 && (
          <details className="group border-t border-line">
            <summary className="cursor-pointer list-none px-5 py-3 text-sm font-medium text-muted hover:bg-canvas/70">{t({ en: 'Show the log', ar: 'اعرض السجل' })}</summary>
            <ul className="divide-y divide-line border-t border-line text-sm">
              {[...consents.log].reverse().map((e, i) => (
                <li key={i} className="flex flex-wrap justify-between gap-2 px-5 py-2.5">
                  <span className="text-ink">
                    {t(SCOPES.find((s) => s.scope === e.scope)?.title ?? { en: e.scope, ar: e.scope })}: <span className={e.granted ? 'text-emerald-700' : 'text-red-700'}>{e.granted ? t({ en: 'allowed', ar: 'مسموح' }) : t({ en: 'not allowed', ar: 'غير مسموح' })}</span>
                  </span>
                  <span className="text-muted">
                    {fmtDateTime(e.at, lang)} · {e.via === 'prompt' ? t({ en: 'when first used', ar: 'عند أول استخدام' }) : t({ en: 'in settings', ar: 'من الإعدادات' })}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {/* ---------- Lock ---------- */}
      {example ? (
        <Callout tone="info" icon={Lock}>
          {t({ en: 'The PIN lock protects your own data. It is not available inside an example.', ar: 'يحمي قفل الرمز بياناتك الخاصة، وهو غير متاح داخل المثال.' })}
        </Callout>
      ) : (
        <LockSection />
      )}

      {/* ---------- Data ---------- */}
      <section className="surface overflow-hidden">
        <h2 className="border-b border-line px-5 py-4 text-base font-semibold text-ink">{t({ en: 'Your data on this phone', ar: 'بياناتك على هذا الهاتف' })}</h2>
        <ul className="divide-y divide-line">
          {DATA_GROUPS.map((g) => {
            const present = g.keys.filter((k) => keys.has(k))
            const n = g.count ? g.keys.reduce((a, k) => a + g.count!(load<unknown>(k, null)), 0) : present.length
            return (
              <li key={g.label.en} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <span className="text-ink">
                  {t(g.label)} <span className="text-muted">· {present.length === 0 ? t({ en: 'nothing stored', ar: 'لا شيء محفوظ' }) : g.count ? `${n}` : t({ en: 'stored', ar: 'محفوظ' })}</span>
                </span>
                <button
                  type="button"
                  className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
                  disabled={present.length === 0}
                  onClick={() => {
                    if (!window.confirm(t({ en: `Delete “${g.label.en}” from this phone?`, ar: `هل تريد حذف «${g.label.ar}» من هذا الهاتف؟` }))) return
                    for (const k of g.keys) save(k, null)
                    refresh((x) => x + 1)
                  }}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                  {t({ en: 'Delete', ar: 'حذف' })}
                </button>
              </li>
            )
          })}
        </ul>
        <div className="flex flex-col gap-2 border-t border-line bg-canvas px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => download('wiqaya-my-data.json', Object.fromEntries([...keys].map((k) => [k, load<unknown>(k, null)])))}>
            <Download className="h-4 w-4" aria-hidden />
            {t({ en: 'Download all my data', ar: 'نزّل كل بياناتي' })}
          </button>
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={() => {
              if (example) {
                closeExample()
                window.location.hash = '#/'
                window.location.reload()
                return
              }
              if (!window.confirm(t({ en: 'Delete everything on this phone and withdraw every link you shared?', ar: 'هل تريد حذف كل شيء على هذا الهاتف وسحب كل رابط شاركته؟' }))) return
              void withdrawAll().finally(() => {
                wipeAll()
                window.location.hash = '#/'
                window.location.reload()
              })
            }}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            {example ? t({ en: 'Leave and delete this example', ar: 'اخرج واحذف هذا المثال' }) : t({ en: 'Delete everything', ar: 'احذف كل شيء' })}
          </button>
        </div>
      </section>
    </CompanionShell>
  )
}

function LockSection() {
  const { t } = useI18n()
  const vault = useVaultState()
  const [pin, setPin] = useState('')
  const [again, setAgain] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const turnOn = async () => {
    if (!PIN_RE.test(pin)) return setError(t({ en: 'Use 4 to 8 digits.', ar: 'استخدم من 4 إلى 8 أرقام.' }))
    if (pin !== again) return setError(t({ en: 'The two PINs are different.', ar: 'الرمزان مختلفان.' }))
    setBusy(true)
    setError('')
    try {
      await enableVault(pin)
      setPin('')
      setAgain('')
    } catch {
      setError(t({ en: 'The lock could not be turned on in this browser.', ar: 'تعذّر تشغيل القفل في هذا المتصفح.' }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="surface overflow-hidden">
      <div className="flex items-start gap-3 border-b border-line px-5 py-4">
        <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden />
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-ink">{t({ en: 'PIN lock for a shared phone', ar: 'قفل برمز لهاتف مشترك' })}</h2>
          <p className="text-sm text-muted">
            {t({
              en: 'With a PIN, everything Wiqaya keeps is encrypted on this phone (AES-256, key made from your PIN) and opens only with it. There is no recovery: a forgotten PIN means starting again.',
              ar: 'مع الرمز، يُشفَّر كل ما تحفظه «وقاية» على هذا الهاتف (AES-256 بمفتاح من رمزك) ولا يُفتح إلا به. لا يوجد استرجاع: نسيان الرمز يعني البدء من جديد.',
            })}
          </p>
        </div>
      </div>
      <div className="px-5 py-5">
        {vault.enabled ? (
          <div className="flex flex-wrap items-center gap-2">
            <p className="me-auto flex items-center gap-1.5 text-sm font-medium text-emerald-700">
              <Lock className="h-4 w-4" aria-hidden />
              {t({ en: 'On. It locks when you reload, and after 5 minutes away.', ar: 'مفعّل. يُقفل عند إعادة التحميل وبعد 5 دقائق من الغياب.' })}
            </p>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => void lockVault()}>
              <Lock className="h-4 w-4" aria-hidden />
              {t({ en: 'Lock now', ar: 'اقفل الآن' })}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                if (window.confirm(t({ en: 'Turn the PIN off? Your data stays on this phone without encryption.', ar: 'هل تريد إيقاف الرمز؟ ستبقى بياناتك على هذا الهاتف دون تشفير.' }))) void disableVault()
              }}
            >
              <LockOpen className="h-4 w-4" aria-hidden />
              {t({ en: 'Turn off', ar: 'إيقاف' })}
            </button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-ink">{t({ en: 'New PIN (4–8 digits)', ar: 'رمز جديد (4-8 أرقام)' })}</span>
              <input className="input tracking-[0.3em]" type="password" inputMode="numeric" autoComplete="new-password" maxLength={8} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-ink">{t({ en: 'Repeat it', ar: 'أعد إدخاله' })}</span>
              <input className="input tracking-[0.3em]" type="password" inputMode="numeric" autoComplete="new-password" maxLength={8} value={again} onChange={(e) => setAgain(e.target.value.replace(/\D/g, ''))} />
            </label>
            <button type="button" className="btn btn-primary" disabled={busy || pin.length < 4} onClick={() => void turnOn()}>
              <Lock className="h-4 w-4" aria-hidden />
              {busy ? t({ en: 'Encrypting…', ar: 'جارٍ التشفير…' }) : t({ en: 'Turn on', ar: 'تشغيل' })}
            </button>
            {error && <p className="text-sm text-red-700 sm:col-span-3">{error}</p>}
          </div>
        )}
      </div>
    </section>
  )
}
