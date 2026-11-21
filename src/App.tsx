import { ArrowRight, CircleHelp, Eye, EyeOff, Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, Route, Routes, useLocation } from 'react-router'
import { VaultGate } from './components/LockScreen'
import { startTour, TOUR_PATHS } from './components/Tour'
import { LogoMark } from './components/ui'
import { PERSONAS } from './lib/companion/personas'
import { APP_NAME, useI18n } from './lib/i18n'
import { activeExample, closeExample } from './lib/storage'
import { countVisit, pageName } from './lib/visits'
import Check from './pages/Check'
import CheckIn from './pages/companion/CheckIn'
import Care from './pages/companion/Care'
import Controls from './pages/companion/Controls'
import { QuickExit, TABS } from './pages/companion/Shell'
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

const pill = ({ isActive }: { isActive: boolean }) =>
  `inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap transition-all duration-200 ${isActive ? 'bg-white text-brand-800 shadow-sm ring-1 ring-line' : 'text-muted hover:text-ink'}`

export default function App() {
  const { lang, setLang, t, discreet, setDiscreet } = useI18n()
  const { pathname } = useLocation()
  const inFlow = pathname.startsWith('/check')
  const inCompanion = pathname === '/me' || pathname.startsWith('/me/')
  const example = activeExample()
  const persona = PERSONAS.find((p) => p.id === example)
  const [menu, setMenu] = useState(false)
  const hasTour = TOUR_PATHS.has(pathname)
  // The menu closes whenever the page changes.
  useEffect(() => setMenu(false), [pathname])
  // One anonymous count per page opening: the page's name only, never its address (see lib/visits.ts).
  const page = pageName(pathname)
  useEffect(() => countVisit(page, { lang, example: !!example }), [page]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex min-h-dvh flex-col">
      <ScrollToTop />
      <header className="sticky top-0 z-30 border-b border-line/70 bg-white/80 backdrop-blur-xl">
        <div className="container-app flex h-16 items-center gap-2 sm:gap-3">
          <Link to="/" className="flex shrink-0 items-center gap-2.5 text-brand-800 transition-opacity hover:opacity-80" aria-label={t(APP_NAME)}>
            <LogoMark />
            <span className={`text-[17px] font-bold tracking-tight text-ink ${persona ? 'hidden sm:inline' : ''}`}>{discreet ? t({ en: 'Health check', ar: 'فحص صحي' }) : t(APP_NAME)}</span>
          </Link>

          {/* One bar, one switcher: the plan's tabs inside the plan, the site's pages everywhere else. */}
          {!inFlow && (
            <nav data-tour={inCompanion ? 'tabs' : undefined} className="mx-auto hidden items-center gap-0.5 rounded-full bg-canvas p-1 ring-1 ring-inset ring-line lg:flex" aria-label={t({ en: 'Main', ar: 'الرئيسية' })}>
              {inCompanion
                ? TABS.map((tab) => (
                    <NavLink key={tab.to} to={tab.to} end={tab.end} className={pill}>
                      <tab.icon className="h-4 w-4" aria-hidden />
                      {t(tab.label)}
                    </NavLink>
                  ))
                : NAV.map((n) => (
                    <NavLink key={n.to} to={n.to} className={pill}>
                      {t(n.label)}
                    </NavLink>
                  ))}
            </nav>
          )}

          <div className={`ms-auto flex items-center gap-1.5 ${inFlow ? '' : 'lg:ms-0'}`}>
            {persona && (
              <button
                type="button"
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-gold-50 ps-3 pe-2 text-[13px] font-semibold text-gold-700 ring-1 ring-inset ring-gold-300 transition-colors hover:bg-gold-100"
                title={t({ en: 'Example with invented data; your own data is untouched. Click to leave the example.', ar: 'مثال ببيانات مختلقة، ولا تُمسّ بياناتك. اضغط للخروج من المثال.' })}
                onClick={() => {
                  closeExample()
                  window.location.hash = '#/'
                  window.location.reload()
                }}
              >
                <span className="max-w-[9.5rem] truncate">
                  <span className="hidden sm:inline">{t({ en: 'Example', ar: 'مثال' })} · </span>
                  {t(persona.name)}
                </span>
                <X className="h-3.5 w-3.5" aria-hidden />
                <span className="sr-only">{t({ en: 'Leave the example', ar: 'اخرج من المثال' })}</span>
              </button>
            )}
            {inCompanion && <QuickExit />}
            {hasTour && (
              <button
                type="button"
                onClick={startTour}
                className="hidden h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-canvas hover:text-ink sm:inline-flex"
                title={t({ en: 'Show me around this page', ar: 'جولة في هذه الصفحة' })}
                aria-label={t({ en: 'Show me around this page', ar: 'جولة في هذه الصفحة' })}
              >
                <CircleHelp className="h-[18px] w-[18px]" aria-hidden />
              </button>
            )}
            <button
              type="button"
              onClick={() => setDiscreet(!discreet)}
              aria-pressed={discreet}
              className={`hidden h-9 w-9 items-center justify-center rounded-full transition-colors sm:inline-flex ${discreet ? 'bg-brand-50 text-brand-800' : 'text-muted hover:bg-canvas hover:text-ink'}`}
              title={t({ en: 'Discreet mode: a neutral name in the tab and header', ar: 'الوضع المتحفظ: اسم محايد في التبويب والعنوان' })}
              aria-label={t({ en: 'Discreet mode', ar: 'الوضع المتحفظ' })}
            >
              {discreet ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
            </button>
            <div data-tour="lang" className="inline-flex h-9 items-center rounded-full bg-canvas p-0.5 ring-1 ring-inset ring-line" role="group" aria-label={t({ en: 'Language', ar: 'اللغة' })}>
              {(['en', 'ar'] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLang(l)}
                  aria-pressed={lang === l}
                  lang={l}
                  className={`h-full rounded-full px-2.5 text-[13px] font-semibold transition-all ${lang === l ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink'}`}
                >
                  {l === 'en' ? 'EN' : 'عربي'}
                </button>
              ))}
            </div>
            {!inFlow && (
              <button
                type="button"
                onClick={() => setMenu((m) => !m)}
                aria-expanded={menu}
                aria-label={t({ en: 'Menu', ar: 'القائمة' })}
                className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-ink transition-colors hover:bg-canvas ${inCompanion ? '' : 'lg:hidden'}`}
              >
                {menu ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
              </button>
            )}
          </div>
        </div>

        {menu && (
          <>
            <button type="button" className="anim-fade fixed inset-0 top-16 -z-10 bg-ink/20" aria-label={t({ en: 'Close menu', ar: 'إغلاق القائمة' })} onClick={() => setMenu(false)} />
            <div className="anim-rise absolute inset-x-0 top-full border-b border-line bg-white shadow-xl">
              <nav className="container-app stagger grid gap-1 py-4 sm:grid-cols-2 lg:grid-cols-3" aria-label={t({ en: 'All pages', ar: 'كل الصفحات' })}>
                {[{ to: '/', label: { en: 'Home', ar: 'الرئيسية' } }, { to: '/check', label: { en: 'Start the check', ar: 'ابدأ الفحص' } }, ...NAV].map((n) => (
                  <NavLink
                    key={n.to}
                    to={n.to}
                    end
                    className={({ isActive }) => `flex items-center justify-between rounded-xl px-4 py-3 text-base font-semibold transition-colors ${isActive ? 'bg-brand-50 text-brand-800' : 'text-ink hover:bg-canvas'}`}
                  >
                    {t(n.label)}
                    <ArrowRight className="icon-dir h-4 w-4 text-faint" aria-hidden />
                  </NavLink>
                ))}
                {hasTour && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenu(false)
                      window.setTimeout(startTour, 250)
                    }}
                    className="flex items-center justify-between rounded-xl px-4 py-3 text-base font-semibold text-ink hover:bg-canvas"
                  >
                    {t({ en: 'Show me around', ar: 'جولة في الصفحة' })}
                    <CircleHelp className="h-4 w-4 text-faint" aria-hidden />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDiscreet(!discreet)}
                  aria-pressed={discreet}
                  className="flex items-center justify-between rounded-xl px-4 py-3 text-base font-semibold text-ink hover:bg-canvas sm:hidden"
                >
                  {t({ en: 'Discreet mode', ar: 'الوضع المتحفظ' })}
                  {discreet ? <EyeOff className="h-4 w-4 text-brand-700" aria-hidden /> : <Eye className="h-4 w-4 text-faint" aria-hidden />}
                </button>
              </nav>
            </div>
          </>
        )}
      </header>

      <main className="flex-1">
        <VaultGate>
        <div key={pathname} className="page-enter">
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
        </div>
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
