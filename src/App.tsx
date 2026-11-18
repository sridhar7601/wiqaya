import { Eye, EyeOff } from 'lucide-react'
import { useEffect } from 'react'
import { Link, NavLink, Route, Routes, useLocation } from 'react-router'
import { VaultGate } from './components/LockScreen'
import { LogoMark } from './components/ui'
import { PERSONAS } from './lib/companion/personas'
import { APP_NAME, useI18n } from './lib/i18n'
import { activeExample, closeExample } from './lib/storage'
import Check from './pages/Check'
import CheckIn from './pages/companion/CheckIn'
import Care from './pages/companion/Care'
import Controls from './pages/companion/Controls'
import Habits from './pages/companion/Habits'
import Journey from './pages/companion/Journey'
import Results from './pages/companion/Results'
import Today from './pages/companion/Today'
import InviteLanding, { InviteMaker } from './pages/Invite'
import Try from './pages/Try'
import Clinician from './pages/Clinician'
import Doctor from './pages/Doctor'
import Evaluation from './pages/Evaluation'
import Example from './pages/Example'
import Home from './pages/Home'
import How from './pages/How'
import Population from './pages/Population'
import Privacy from './pages/Privacy'
import Report from './pages/Report'
import Result from './pages/Result'
import Share from './pages/Share'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    // Block body on purpose: newer Chrome returns a Promise from scrollTo, and an effect must not return one.
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

const NAV = [
  { to: '/me', label: { en: 'My plan', ar: 'خطتي' } },
  { to: '/how', label: { en: 'How it works', ar: 'كيف يعمل' } },
  { to: '/evaluation', label: { en: 'Evidence', ar: 'الأدلة' } },
  { to: '/privacy', label: { en: 'Privacy', ar: 'الخصوصية' } },
  { to: '/clinician', label: { en: 'For clinicians', ar: 'للأطباء' } },
  { to: '/population', label: { en: 'Health system', ar: 'النظام الصحي' } },
]

export default function App() {
  const { lang, setLang, t, discreet, setDiscreet } = useI18n()
  const { pathname } = useLocation()
  const inFlow = pathname.startsWith('/check')
  const inCompanion = pathname === '/me' || pathname.startsWith('/me/')
  const example = activeExample()
  const persona = PERSONAS.find((p) => p.id === example)

  return (
    <div className="flex min-h-dvh flex-col">
      <ScrollToTop />
      <header className="sticky top-0 z-20 border-b border-line bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/75">
        <div className="container-app flex h-16 items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2.5 text-brand-800" aria-label={t(APP_NAME)}>
            <LogoMark />
            <span className="text-[17px] font-semibold tracking-tight text-ink">{discreet ? t({ en: 'Health check', ar: 'فحص صحي' }) : t(APP_NAME)}</span>
          </Link>

          {!inFlow && (
            <nav className="hidden items-center gap-1 md:flex" aria-label={t({ en: 'Main', ar: 'الرئيسية' })}>
              {NAV.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  className={({ isActive }) =>
                    `rounded-md px-2.5 py-2 text-sm font-medium whitespace-nowrap transition-colors lg:px-3 ${isActive ? 'bg-brand-50 text-brand-800' : 'text-muted hover:bg-canvas hover:text-ink'}`
                  }
                >
                  {t(n.label)}
                </NavLink>
              ))}
            </nav>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDiscreet(!discreet)}
              aria-pressed={discreet}
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium transition-colors ${discreet ? 'bg-brand-50 text-brand-800' : 'text-muted hover:bg-canvas hover:text-ink'}`}
              title={t({ en: 'Discreet mode: a neutral name in the tab and header', ar: 'الوضع المتحفظ: اسم محايد في التبويب والعنوان' })}
            >
              {discreet ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
              <span className="hidden sm:inline md:hidden lg:inline">{t({ en: 'Discreet', ar: 'متحفظ' })}</span>
            </button>
            <div className="inline-flex h-9 items-center rounded-lg border border-line bg-canvas p-0.5" role="group" aria-label={t({ en: 'Language', ar: 'اللغة' })}>
              {(['en', 'ar'] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLang(l)}
                  aria-pressed={lang === l}
                  lang={l}
                  className={`h-full rounded-md px-2.5 text-sm font-semibold transition-colors ${lang === l ? 'bg-white text-ink shadow-xs' : 'text-muted hover:text-ink'}`}
                >
                  {l === 'en' ? 'EN' : 'عربي'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {persona && (
        <div className="border-b border-gold-300 bg-gold-50">
          <div className="container-app flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
            <p className="text-gold-700">
              <span className="font-semibold">{t({ en: 'Example:', ar: 'مثال:' })}</span> {t(persona.name)} · {t({ en: 'invented data, your own data is untouched', ar: 'بيانات مختلقة، ولا تُمسّ بياناتك' })}
            </p>
            <button
              type="button"
              className="font-semibold text-gold-700 underline-offset-4 hover:underline"
              onClick={() => {
                closeExample()
                window.location.hash = '#/'
                window.location.reload()
              }}
            >
              {t({ en: 'Leave the example', ar: 'اخرج من المثال' })}
            </button>
          </div>
        </div>
      )}

      <main className="flex-1">
        <VaultGate>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/check" element={<Check />} />
          <Route path="/result" element={<Result />} />
          <Route path="/share" element={<Share />} />
          <Route path="/report" element={<Report />} />
          <Route path="/d/:token" element={<Doctor />} />
          <Route path="/clinician" element={<Clinician />} />
          <Route path="/population" element={<Population />} />
          <Route path="/evaluation" element={<Evaluation />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/how" element={<How />} />
          <Route path="/example/:id" element={<Example />} />
          <Route path="/me" element={<Today />} />
          <Route path="/me/journey" element={<Journey />} />
          <Route path="/me/care" element={<Care />} />
          <Route path="/me/results" element={<Results />} />
          <Route path="/me/habits" element={<Habits />} />
          <Route path="/me/privacy" element={<Controls />} />
          <Route path="/me/check-in" element={<CheckIn />} />
          <Route path="/try/:id" element={<Try />} />
          <Route path="/invite" element={<InviteMaker />} />
          <Route path="/i/:from" element={<InviteLanding />} />
          <Route path="*" element={<Home />} />
        </Routes>
        </VaultGate>
      </main>

      {!inFlow && !inCompanion && (
        <footer className="border-t border-line bg-white">
          <div className="container-app grid gap-8 py-10 md:grid-cols-[1.4fr_1fr]">
            <div className="space-y-3">
              <div className="flex items-center gap-2.5 text-brand-800">
                <LogoMark className="h-7 w-7" />
                <span className="font-semibold text-ink">{t(APP_NAME)}</span>
              </div>
              <p className="max-w-md text-sm text-muted">
                {t({
                  en: 'Screening support, not a diagnosis or a medical device. In an emergency, call 998.',
                  ar: 'أداة فحص أولي داعمة، وليست تشخيصاً أو جهازاً طبياً. في حالات الطوارئ، اتصل بالرقم 998.',
                })}
              </p>
            </div>
            <nav className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-2" aria-label={t({ en: 'Footer', ar: 'التذييل' })}>
              {[{ to: '/check', label: { en: 'Start the check', ar: 'ابدأ الفحص' } }, { to: '/report', label: { en: 'Read my report', ar: 'اقرأ تقريري' } }, { to: '/invite', label: { en: 'Invite a partner', ar: 'ادعُ شريكاً' } }, ...NAV].map((n) => (
                <Link key={n.to} to={n.to} className="text-muted hover:text-ink">
                  {t(n.label)}
                </Link>
              ))}
            </nav>
          </div>
          <div className="border-t border-line">
            <p className="container-app py-4 text-xs text-faint">
              {t({
                en: 'Prototype for the Future Health Digital Innovation Challenge 2026 · Fertility: Reproductive Potential · Synthetic data only',
                ar: 'نموذج أولي لتحدي الابتكار الرقمي «مستقبل الصحة» 2026 · الخصوبة: القدرة الإنجابية · بيانات اصطناعية فقط',
              })}
            </p>
          </div>
        </footer>
      )}
    </div>
  )
}
