import { CalendarCheck2, EyeOff, FlaskConical, House, ShieldCheck, Sprout } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { NavLink } from 'react-router'
import { useI18n } from '../../lib/i18n'
import type { L10n } from '../../lib/types'

const TABS: { to: string; icon: LucideIcon; label: L10n; end?: boolean }[] = [
  { to: '/me', icon: House, label: { en: 'Today', ar: 'اليوم' }, end: true },
  { to: '/me/journey', icon: CalendarCheck2, label: { en: 'Journey', ar: 'الرحلة' } },
  { to: '/me/results', icon: FlaskConical, label: { en: 'Results', ar: 'النتائج' } },
  { to: '/me/habits', icon: Sprout, label: { en: 'Habits & work', ar: 'العادات والعمل' } },
  { to: '/me/privacy', icon: ShieldCheck, label: { en: 'Privacy', ar: 'الخصوصية' } },
]

/** Leaves the app for a neutral page at once, for when someone looks over the person's shoulder. */
export function quickExit(): void {
  window.location.replace('https://www.google.com/search?q=weather')
}

export function QuickExit() {
  const { t } = useI18n()
  // Pressing Esc twice within a second also leaves.
  useEffect(() => {
    let last = 0
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const now = Date.now()
      if (now - last < 1000) quickExit()
      last = now
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return (
    <button
      type="button"
      onClick={quickExit}
      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-white px-3 text-sm font-medium text-muted shadow-xs hover:text-ink"
      title={t({ en: 'Leave quickly for a neutral page (or press Esc twice)', ar: 'غادر بسرعة إلى صفحة محايدة (أو اضغط Esc مرتين)' })}
    >
      <EyeOff className="h-4 w-4" aria-hidden />
      {t({ en: 'Quick exit', ar: 'خروج سريع' })}
    </button>
  )
}

/** The frame of every companion screen: a title row, the tabs (at the top on wide screens, at the bottom on phones). */
export function CompanionShell({ title, intro, action, children }: { title: string; intro?: ReactNode; action?: ReactNode; children: ReactNode }) {
  const { t } = useI18n()
  return (
    <div className="pb-24 md:pb-12">
      <nav className="sticky top-16 z-10 hidden border-b border-line bg-white/90 backdrop-blur md:block" aria-label={t({ en: 'Companion', ar: 'الرفيق' })}>
        <div className="mx-auto flex max-w-4xl items-center gap-1 px-6">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `inline-flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition-colors ${isActive ? 'border-brand-700 text-brand-800' : 'border-transparent text-muted hover:text-ink'}`
              }
            >
              <tab.icon className="h-4 w-4" aria-hidden />
              {t(tab.label)}
            </NavLink>
          ))}
          <span className="ms-auto">
            <QuickExit />
          </span>
        </div>
      </nav>

      <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h1 className="title">{title}</h1>
            {intro && <div className="max-w-2xl text-muted">{intro}</div>}
          </div>
          <div className="flex items-center gap-2">
            {action}
            <span className="md:hidden">
              <QuickExit />
            </span>
          </div>
        </div>
        {children}
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label={t({ en: 'Companion', ar: 'الرفيق' })}>
        <div className="grid grid-cols-5">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${isActive ? 'text-brand-800' : 'text-muted'}`}
            >
              {({ isActive }) => (
                <>
                  <span className={`inline-flex h-7 w-12 items-center justify-center rounded-full transition-colors ${isActive ? 'bg-brand-50' : ''}`}>
                    <tab.icon className="h-[18px] w-[18px]" strokeWidth={isActive ? 2.2 : 1.8} aria-hidden />
                  </span>
                  <span className="max-w-full truncate px-1">{t(tab.label)}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
