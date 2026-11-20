import type { LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useI18n } from '../lib/i18n'
import type { L10n } from '../lib/types'

export interface PageNavItem {
  id: string
  label: L10n
  icon: LucideIcon
}

/**
 * "On this page": jumps to a section and shows which one is in view. Buttons, not links, because the
 * address bar's # belongs to the router.
 */
export function PageNav({ items, className = '' }: { items: PageNavItem[]; className?: string }) {
  const { t } = useI18n()
  const [at, setAt] = useState(items[0]?.id)
  useEffect(() => {
    const spy = () => {
      let cur = items[0]?.id
      for (const it of items) {
        const el = document.getElementById(it.id)
        if (el && el.getBoundingClientRect().top < 160) cur = it.id
      }
      setAt(cur)
    }
    spy()
    window.addEventListener('scroll', spy, { passive: true })
    return () => window.removeEventListener('scroll', spy)
  }, [items])
  const present = items.filter((it) => typeof document === 'undefined' || document.getElementById(it.id))
  if (present.length < 2) return null
  return (
    <nav className={`surface p-2 ${className}`} aria-label={t({ en: 'On this page', ar: 'في هذه الصفحة' })}>
      <p className="px-3 pt-2 pb-1 text-[11px] font-bold tracking-[0.14em] text-faint uppercase">{t({ en: 'On this page', ar: 'في هذه الصفحة' })}</p>
      <ul>
        {present.map((it) => {
          const on = at === it.id
          return (
            <li key={it.id}>
              <button
                type="button"
                onClick={() => document.getElementById(it.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                aria-current={on ? 'true' : undefined}
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-start text-sm font-semibold transition-colors duration-200 ${on ? 'bg-brand-50 text-brand-800' : 'text-muted hover:bg-canvas hover:text-ink'}`}
              >
                <it.icon className="h-4 w-4 shrink-0" aria-hidden />
                {t(it.label)}
                <span className={`ms-auto h-1.5 w-1.5 rounded-full transition-colors ${on ? 'bg-brand-600' : 'bg-transparent'}`} aria-hidden />
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
