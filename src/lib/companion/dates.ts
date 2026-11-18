import type { Lang } from '../types'

/**
 * Calendar dates as plain "YYYY-MM-DD" strings in the person's own time zone. Days are counted on the
 * calendar, never as 24-hour blocks, so a daylight-saving shift or a late-night entry cannot move a date.
 */
export type Day = string

const pad = (n: number) => String(n).padStart(2, '0')

export function dayOf(d: Date): Day {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export const today = (): Day => dayOf(new Date())

function parts(day: Day): [number, number, number] {
  const [y, m, d] = day.split('-').map(Number)
  return [y, m, d]
}

/** Noon local time, so adding days never lands on the wrong date. */
export function dateOf(day: Day): Date {
  const [y, m, d] = parts(day)
  return new Date(y, m - 1, d, 12)
}

export function addDays(day: Day, n: number): Day {
  const d = dateOf(day)
  d.setDate(d.getDate() + n)
  return dayOf(d)
}

/** Whole days from a to b (positive when b is later). */
export function daysBetween(a: Day, b: Day): number {
  const [ay, am, ad] = parts(a)
  const [by, bm, bd] = parts(b)
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000)
}

/** The Monday that starts the week containing this day. */
export function weekStart(day: Day): Day {
  const wd = dateOf(day).getDay() // 0 = Sunday
  return addDays(day, -((wd + 6) % 7))
}

export const isDay = (s: unknown): s is Day => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(dateOf(s).getTime())

const locale = (lang: Lang) => (lang === 'ar' ? 'ar-AE' : 'en-GB')

export function fmtDay(day: Day, lang: Lang, withYear = true): string {
  return dateOf(day).toLocaleDateString(locale(lang), withYear ? { day: 'numeric', month: 'short', year: 'numeric' } : { day: 'numeric', month: 'short' })
}

export function fmtDateTime(iso: string, lang: Lang): string {
  return new Date(iso).toLocaleString(locale(lang), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
