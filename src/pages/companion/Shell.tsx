import { CalendarCheck2, EyeOff, FlaskConical, House, ShieldCheck, Sprout } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { NavLink } from 'react-router'
import { useI18n } from '../../lib/i18n'
import type { L10n } from '../../lib/types'

export const TABS: { to: string; icon: LucideIcon; label: L10n; end?: boolean }[] = [
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
      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-semibold whitespace-nowrap text-muted ring-1 ring-inset ring-line transition-colors hover:bg-canvas hover:text-ink"
      title={t({ en: 'Leave quickly for a neutral page (or press Esc twice)', ar: 'غادر بسرعة إلى صفحة محايدة (أو اضغط Esc مرتين)' })}
    >
      <EyeOff className="h-4 w-4" aria-hidden />
      <span className="hidden 2xl:inline">{t({ en: 'Quick exit', ar: 'خروج سريع' })}</span>
      <span className="sr-only 2xl:hidden">{t({ en: 'Quick exit', ar: 'خروج سريع' })}</span>
    </button>
  )
}

/** The frame of every companion screen: a title row, the tabs (at the top on wide screens, at the bottom on phones). */
export function CompanionShell({ title, intro, action, wide, children }: { title: string; intro?: ReactNode; action?: ReactNode; wide?: boolean; children: ReactNode }) {
  const { t } = useI18n()
  return (
    <div className="pb-28 lg:pb-12">
      <div className={`mx-auto w-full space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 ${wide ? 'max-w-6xl' : 'max-w-5xl'}`}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h1 className="title">{title}</h1>
            {intro && <div className="max-w-2xl text-muted">{intro}</div>}
          </div>
          {action && <div className="flex items-center gap-2">{action}</div>}
        </div>
        {children}
      </div>

      {/* Phones and tablets: a floating tab bar within thumb reach. Wide screens use the switcher in the header. */}
      <nav
        className="fixed inset-x-3 bottom-3 z-20 mx-auto max-w-md rounded-2xl border border-line bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-xl backdrop-blur lg:hidden"
        aria-label={t({ en: 'Companion', ar: 'الرفيق' })}
      >
        <div className="grid grid-cols-5 p-1">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) => `flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-semibold transition-colors ${isActive ? 'bg-brand-50 text-brand-800' : 'text-muted'}`}
            >
              {({ isActive }) => (
                <>
                  <tab.icon className={`h-5 w-5 transition-transform duration-200 ${isActive ? 'scale-110' : ''}`} strokeWidth={isActive ? 2.2 : 1.8} aria-hidden />
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
