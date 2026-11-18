import { BookOpen, ChevronDown, House, Siren, Sparkles, Stethoscope, UserRound, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useI18n } from '../lib/i18n'
import { LEVEL_SHORT } from '../lib/services'
import { SOURCES } from '../lib/sources'
import type { FiredFlag, L10n, Level } from '../lib/types'

/* ---------- Brand ---------- */

export function LogoMark({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="8" fill="currentColor" />
      <path d="M16 6.5c-3.6 2.4-6.7 3-9 3v6.2c0 5.4 3.9 9 9 10.8 5.1-1.8 9-5.4 9-10.8V9.5c-2.3 0-5.4-.6-9-3z" fill="none" stroke="#E2C98A" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M12 16.4l2.9 2.9 5.4-5.8" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* ---------- Levels ---------- */

export const LEVEL_META: Record<Level, { icon: LucideIcon; pill: string; soft: string; strong: string; dot: string; ring: string }> = {
  selfcare: { icon: House, pill: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', soft: 'bg-emerald-50', strong: 'text-emerald-700', dot: 'bg-emerald-500', ring: 'border-emerald-200' },
  primary: { icon: UserRound, pill: 'bg-sky-50 text-sky-700 ring-sky-600/20', soft: 'bg-sky-50', strong: 'text-sky-700', dot: 'bg-sky-500', ring: 'border-sky-200' },
  fertility: { icon: Users, pill: 'bg-violet-50 text-violet-700 ring-violet-600/20', soft: 'bg-violet-50', strong: 'text-violet-700', dot: 'bg-violet-500', ring: 'border-violet-200' },
  specialist: { icon: Stethoscope, pill: 'bg-amber-50 text-amber-800 ring-amber-600/25', soft: 'bg-amber-50', strong: 'text-amber-700', dot: 'bg-amber-500', ring: 'border-amber-200' },
  urgent: { icon: Siren, pill: 'bg-red-50 text-red-700 ring-red-600/20', soft: 'bg-red-50', strong: 'text-red-700', dot: 'bg-red-500', ring: 'border-red-200' },
}

export function LevelPill({ level, label }: { level: Level; label?: string }) {
  const { t } = useI18n()
  const m = LEVEL_META[level]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${m.pill}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} aria-hidden />
      {label ?? t(LEVEL_SHORT[level])}
    </span>
  )
}

export function LevelIcon({ level, size = 'md' }: { level: Level; size?: 'md' | 'lg' }) {
  const m = LEVEL_META[level]
  const Icon = m.icon
  const box = size === 'lg' ? 'h-12 w-12 rounded-xl' : 'h-10 w-10 rounded-lg'
  return (
    <span className={`inline-flex shrink-0 items-center justify-center ${box} ${m.soft} ${m.strong}`}>
      <Icon className={size === 'lg' ? 'h-6 w-6' : 'h-5 w-5'} strokeWidth={1.75} aria-hidden />
    </span>
  )
}

/* ---------- Provenance: who said this? ---------- */

export type Layer = 'you' | 'rules' | 'ai' | 'human'
const LAYER: Record<Layer, { icon: LucideIcon; label: L10n; cls: string }> = {
  you: { icon: UserRound, label: { en: 'From your answers', ar: 'من إجاباتك' }, cls: 'text-muted' },
  rules: { icon: BookOpen, label: { en: 'Clinical rule', ar: 'قاعدة سريرية' }, cls: 'text-brand-700' },
  ai: { icon: Sparkles, label: { en: 'Written by AI', ar: 'كتبه الذكاء الاصطناعي' }, cls: 'text-ai-700' },
  human: { icon: Stethoscope, label: { en: 'Clinician decision', ar: 'قرار الطبيب' }, cls: 'text-gold-700' },
}

export function LayerLabel({ layer, children }: { layer: Layer; children?: ReactNode }) {
  const { t } = useI18n()
  const L = LAYER[layer]
  const Icon = L.icon
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${L.cls}`}>
      <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
      {children ?? t(L.label)}
    </span>
  )
}

export function Sources({ ids }: { ids: string[] }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {ids.map((id) => {
        const s = SOURCES[id]
        if (!s) return null
        const cls = 'inline-flex items-center rounded-md bg-canvas px-2 py-0.5 text-xs text-muted ring-1 ring-inset ring-line'
        return s.url ? (
          <a key={id} href={s.url} target="_blank" rel="noreferrer noopener" title={s.full} className={`${cls} hover:text-brand-700`}>
            {s.short}
          </a>
        ) : (
          <span key={id} title={s.full} className={cls}>
            {s.short}
          </span>
        )
      })}
    </span>
  )
}

/* ---------- A finding, expandable ---------- */

export function Finding({ flag, defaultOpen = false }: { flag: FiredFlag; defaultOpen?: boolean }) {
  const { t } = useI18n()
  return (
    <details className="group" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-start gap-3 px-5 py-4 hover:bg-canvas/70">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <h3 className="text-[15px] font-semibold text-ink">{t(flag.title)}</h3>
            {flag.level !== 'info' && <LevelPill level={flag.level} />}
          </div>
          <p className="mt-0.5 truncate text-sm text-muted group-open:hidden">{flag.because.map(t).join(' · ')}</p>
        </div>
        <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-faint transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="space-y-4 px-5 pb-5">
        <div className="space-y-1">
          <LayerLabel layer="you" />
          <ul className="space-y-0.5 text-sm text-body">
            {flag.because.map((b, i) => (
              <li key={i}>{t(b)}</li>
            ))}
          </ul>
        </div>
        <div className="space-y-1.5">
          <LayerLabel layer="rules" />
          <p className="text-sm text-body">{t(flag.why)}</p>
          <p className="rounded-lg bg-brand-25 px-3 py-2 text-sm font-medium text-brand-900 ring-1 ring-inset ring-brand-100">{t(flag.action)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {flag.changeable && (
            <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
              {t({ en: 'Often improvable or treatable', ar: 'يمكن غالباً تحسينه أو علاجه' })}
            </span>
          )}
          <Sources ids={flag.sources} />
        </div>
      </div>
    </details>
  )
}

/* ---------- Layout helpers ---------- */

export function SectionHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="space-y-1">
        <h2 className="heading">{title}</h2>
        {description && <p className="small max-w-2xl">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function Callout({ tone = 'info', icon: Icon, title, children }: { tone?: 'info' | 'warn' | 'danger' | 'ai' | 'heart'; icon?: LucideIcon; title?: string; children: ReactNode }) {
  const tones = {
    info: 'bg-brand-25 ring-brand-100 text-brand-950 [&_svg]:text-brand-600',
    warn: 'bg-amber-50 ring-amber-200 text-amber-950 [&_svg]:text-amber-600',
    danger: 'bg-red-50 ring-red-200 text-red-950 [&_svg]:text-red-600',
    ai: 'bg-ai-50 ring-ai-100 text-ai-700 [&_svg]:text-ai-600',
    heart: 'bg-sky-50 ring-sky-200 text-sky-950 [&_svg]:text-sky-600',
  }
  return (
    <div className={`flex gap-3 rounded-xl px-4 py-3.5 text-sm ring-1 ring-inset ${tones[tone]}`}>
      {Icon && <Icon className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={1.75} aria-hidden />}
      <div className="min-w-0 space-y-1">
        {title && <p className="font-semibold">{title}</p>}
        <div className="leading-relaxed opacity-90">{children}</div>
      </div>
    </div>
  )
}

export function StatusPill({ status, children }: { status: 'pass' | 'fail' | 'pending'; children?: ReactNode }) {
  const { t } = useI18n()
  const map = {
    pass: { cls: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', label: { en: 'Pass', ar: 'ناجح' } },
    fail: { cls: 'bg-red-50 text-red-700 ring-red-600/20', label: { en: 'Fail', ar: 'فاشل' } },
    pending: { cls: 'bg-slate-50 text-muted ring-slate-500/20', label: { en: 'Pending', ar: 'قيد الانتظار' } },
  }[status]
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${map.cls}`}>{children ?? t(map.label)}</span>
}

export function Stat({ label, value, hint, icon: Icon, tone = 'brand' }: { label: string; value: string; hint?: string; icon?: LucideIcon; tone?: 'brand' | 'good' | 'warn' }) {
  const color = tone === 'good' ? 'text-emerald-700' : tone === 'warn' ? 'text-amber-700' : 'text-ink'
  return (
    <div className="surface p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-muted">{label}</p>
        {Icon && <Icon className="h-4 w-4 text-faint" aria-hidden />}
      </div>
      <p className={`mt-2 text-3xl font-semibold tracking-tight tabular-nums ${color}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  )
}

export function Switch({ checked, onChange, label, description, disabled }: { checked: boolean; onChange?: (v: boolean) => void; label: string; description?: string; disabled?: boolean }) {
  return (
    <label className={`flex items-start justify-between gap-4 ${disabled ? 'opacity-70' : 'cursor-pointer'}`}>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-sm text-muted">{description}</span>}
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input type="checkbox" className="peer sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange?.(e.target.checked)} />
        <span className="h-6 w-11 rounded-full bg-line-strong transition-colors peer-checked:bg-brand-700 peer-focus-visible:ring-4 peer-focus-visible:ring-brand-100" />
        <span className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all ltr:left-0.5 rtl:right-0.5 ltr:peer-checked:left-[22px] rtl:peer-checked:right-[22px]" />
      </span>
    </label>
  )
}

export function Checkbox({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-sm text-body">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-[18px] w-[18px] shrink-0 cursor-pointer rounded border-line-strong accent-brand-700"
      />
      <span>{children}</span>
    </label>
  )
}
