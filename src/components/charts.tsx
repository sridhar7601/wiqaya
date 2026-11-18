import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { Day } from '../lib/companion/dates'
import { dateOf, daysBetween, fmtDay } from '../lib/companion/dates'
import type { Lang } from '../lib/types'

/**
 * Small, hand-made SVG charts. Rules followed (see the dataviz guide): 2px lines, 8px dots with a 2px
 * surface ring, hairline solid gridlines, one y-axis only, text in text colours (never the series colour),
 * a legend whenever there are two series, direct labels only on the latest point, and a hover/focus
 * tooltip with a hit area larger than the dot. The values are always also listed in text below each chart.
 */
export const CHART = {
  s1: '#0d9488', // lab results / main series (passes the palette checks on white)
  s2: '#6d4fd6', // home estimates (Lens) — drawn hollow, so shape also carries the difference
  s3: '#c2410c', // second line where two measures share one axis (diastolic)
  grid: '#e4e7ec',
  axis: '#98a2b3',
  band: 'rgba(152, 162, 179, 0.14)',
  ink: '#101828',
  muted: '#667085',
}

function useWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null)
  const [w, setW] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)))
    ro.observe(el)
    setW(Math.round(el.getBoundingClientRect().width))
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

function niceTicks(min: number, max: number, count = 4): number[] {
  const span = max - min || 1
  const raw = span / count
  const pow = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw
  const start = Math.floor(min / step) * step
  const out: number[] = []
  for (let v = start; v <= max + step * 0.001; v += step) out.push(Math.round(v * 1000) / 1000)
  return out
}

export interface SeriesPoint {
  date: Day
  value: number
  note?: string
}

export interface Series {
  id: string
  label: string
  color: string
  hollow?: boolean
  points: SeriesPoint[]
}

export interface Threshold {
  value: number
  /** Which side is outside the usual range. */
  side: 'below' | 'above'
  label: string
}

const fmtV = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

export function TrendChart({ series, threshold, unit, lang, height = 190, title }: { series: Series[]; threshold?: Threshold | Threshold[]; unit: string; lang: Lang; height?: number; title: string }) {
  const limits = threshold === undefined ? [] : Array.isArray(threshold) ? threshold : [threshold]
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<{ s: Series; p: SeriesPoint; x: number; y: number } | null>(null)
  const all = series.flatMap((s) => s.points)

  const geo = useMemo(() => {
    if (!all.length || width < 80) return null
    const dates = all.map((p) => p.date).sort()
    const first = dates[0]
    const last = dates[dates.length - 1]
    const span = Math.max(14, daysBetween(first, last))
    const pad = Math.round(span * 0.06) + 2
    const x0 = -pad
    const x1 = span + pad
    let vmin = Math.min(...all.map((p) => p.value), ...limits.map((l) => l.value))
    let vmax = Math.max(...all.map((p) => p.value), ...limits.map((l) => l.value))
    const room = (vmax - vmin || Math.abs(vmax) || 1) * 0.18
    vmin = Math.max(0, vmin - room)
    vmax = vmax + room
    const ticks = niceTicks(vmin, vmax)
    const lo = Math.min(ticks[0], vmin)
    const hi = Math.max(ticks[ticks.length - 1], vmax)
    const left = 34
    const right = 56
    const top = 12
    const bottom = 26
    const X = (d: Day) => left + ((daysBetween(first, d) - x0) / (x1 - x0)) * (width - left - right)
    const Y = (v: number) => top + (1 - (v - lo) / (hi - lo)) * (height - top - bottom)
    // Month ticks along the bottom, at most ~6.
    const months: Day[] = []
    const d0 = dateOf(first)
    const cur = new Date(d0.getFullYear(), d0.getMonth() + 1, 1, 12)
    const lastDate = dateOf(last)
    while (cur <= lastDate) {
      months.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-01`)
      cur.setMonth(cur.getMonth() + 1)
    }
    const every = Math.ceil(months.length / Math.max(1, Math.floor((width - 90) / 70)))
    return { X, Y, ticks: ticks.filter((t) => t >= lo && t <= hi), months: months.filter((_, i) => i % every === 0), left, right, top, bottom, lo, hi }
  }, [all, width, height, limits])

  const summary = `${title}. ${series
    .map((s) => `${s.label}: ${s.points.map((p) => `${fmtV(p.value)} ${unit} on ${fmtDay(p.date, 'en')}`).join(', ')}`)
    .join('. ')}${limits.length ? `. ${limits.map((l) => l.label).join('. ')}.` : ''}`

  return (
    <div ref={ref} className="relative w-full select-none" dir="ltr">
      {geo && (
        <svg width={width} height={height} role="img" aria-label={summary} className="block overflow-visible">
          <g>
            {geo.ticks.map((t) => (
              <g key={t}>
                <line x1={geo.left} x2={width - geo.right + 8} y1={geo.Y(t)} y2={geo.Y(t)} stroke={CHART.grid} strokeWidth={1} />
                <text x={geo.left - 6} y={geo.Y(t) + 4} textAnchor="end" fontSize={11} fill={CHART.muted} className="tabular-nums">
                  {fmtV(t)}
                </text>
              </g>
            ))}
            {geo.months.map((m) => (
              <text key={m} x={geo.X(m)} y={height - 8} textAnchor="middle" fontSize={11} fill={CHART.muted}>
                {dateOf(m).toLocaleDateString(lang === 'ar' ? 'ar-AE' : 'en-GB', { month: 'short' })}
              </text>
            ))}
          </g>
          {limits.map((threshold) => (
            <g key={threshold.label}>
              <rect
                x={geo.left}
                width={width - geo.left - geo.right + 8}
                y={threshold.side === 'below' ? geo.Y(threshold.value) : geo.top}
                height={threshold.side === 'below' ? geo.Y(geo.lo) - geo.Y(threshold.value) : geo.Y(threshold.value) - geo.top}
                fill={CHART.band}
              />
              <line x1={geo.left} x2={width - geo.right + 8} y1={geo.Y(threshold.value)} y2={geo.Y(threshold.value)} stroke={CHART.axis} strokeWidth={1} />
              <text x={geo.left + 6} y={geo.Y(threshold.value) + (threshold.side === 'below' ? 14 : -6)} fontSize={11} fill={CHART.muted}>
                {threshold.label}
              </text>
            </g>
          ))}
          {series.map((s) => {
            const pts = [...s.points].sort((a, b) => a.date.localeCompare(b.date))
            const lastP = pts[pts.length - 1]
            return (
              <g key={s.id}>
                {!s.hollow && pts.length > 1 && (
                  <polyline points={pts.map((p) => `${geo.X(p.date)},${geo.Y(p.value)}`).join(' ')} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                )}
                {(pts.length > 24 && !s.hollow ? pts.slice(-1) : pts).map((p) => (
                  <circle key={`${p.date}-${p.value}`} cx={geo.X(p.date)} cy={geo.Y(p.value)} r={s.hollow ? 4.5 : 4} fill={s.hollow ? '#fff' : s.color} stroke={s.hollow ? s.color : '#fff'} strokeWidth={2} />
                ))}
                {lastP && (
                  <text x={geo.X(lastP.date) + 9} y={geo.Y(lastP.value) + 4} fontSize={12} fontWeight={600} fill={CHART.ink} className="tabular-nums">
                    {fmtV(lastP.value)}
                  </text>
                )}
                {pts.map((p) => (
                  <circle
                    key={`hit-${p.date}-${p.value}`}
                    cx={geo.X(p.date)}
                    cy={geo.Y(p.value)}
                    r={12}
                    fill="transparent"
                    tabIndex={0}
                    aria-label={`${s.label}: ${fmtV(p.value)} ${unit}, ${fmtDay(p.date, lang)}${p.note ? `, ${p.note}` : ''}`}
                    onPointerEnter={() => setHover({ s, p, x: geo.X(p.date), y: geo.Y(p.value) })}
                    onPointerLeave={() => setHover(null)}
                    onFocus={() => setHover({ s, p, x: geo.X(p.date), y: geo.Y(p.value) })}
                    onBlur={() => setHover(null)}
                    className="cursor-pointer outline-none"
                  />
                ))}
              </g>
            )
          })}
        </svg>
      )}
      {geo && hover && (
        <div
          className="pointer-events-none absolute z-10 min-w-36 rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-lg"
          style={{ left: Math.min(Math.max(hover.x - 72, 0), width - 150), top: Math.max(hover.y - 74, 0) }}
          dir={lang === 'ar' ? 'rtl' : 'ltr'}
        >
          <p className="text-sm font-semibold text-ink tabular-nums">
            {fmtV(hover.p.value)} {unit}
          </p>
          <p className="flex items-center gap-1.5 text-muted">
            <span className="inline-block h-0.5 w-3 rounded" style={{ background: hover.s.color }} aria-hidden />
            {hover.s.label} · {fmtDay(hover.p.date, lang)}
          </p>
          {hover.p.note && <p className="mt-0.5 text-faint">{hover.p.note}</p>}
        </div>
      )}
      {series.length > 1 && (
        <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
          {series.map((s) => (
            <li key={s.id} className="inline-flex items-center gap-1.5">
              {s.hollow ? (
                <span className="inline-block h-2.5 w-2.5 rounded-full border-2 bg-white" style={{ borderColor: s.color }} aria-hidden />
              ) : (
                <span className="inline-block h-0.5 w-4 rounded" style={{ background: s.color }} aria-hidden />
              )}
              {s.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Progress through the 90-day window, as a ring. The track is a lighter step of the same colour. */
export function CycleRing({ day, total, size = 112, label }: { day: number; total: number; size?: number; label: string }) {
  const r = size / 2 - 8
  const c = 2 * Math.PI * r
  const p = Math.min(1, day / total)
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#d2e8e4" strokeWidth={8} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={CHART.s1}
        strokeWidth={8}
        strokeLinecap="round"
        strokeDasharray={`${c * p} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="47%" textAnchor="middle" fontSize={size * 0.24} fontWeight={600} fill={CHART.ink}>
        {Math.min(day, total)}
      </text>
      <text x="50%" y="66%" textAnchor="middle" fontSize={size * 0.1} fill={CHART.muted}>
        / {total}
      </text>
    </svg>
  )
}

/** A quiet trend line for a stat tile: the de-emphasis colour, with the latest point in the accent. */
export function Sparkline({ values, width = 120, height = 32, label }: { values: number[]; width?: number; height?: number; label: string }) {
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const X = (i: number) => 2 + (i / (values.length - 1)) * (width - 6)
  const Y = (v: number) => 3 + (1 - (v - min) / (max - min || 1)) * (height - 6)
  return (
    <svg width={width} height={height} role="img" aria-label={label} className="overflow-visible">
      <polyline points={values.map((v, i) => `${X(i)},${Y(v)}`).join(' ')} fill="none" stroke={CHART.axis} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={X(values.length - 1)} cy={Y(values[values.length - 1])} r={3.5} fill={CHART.s1} stroke="#fff" strokeWidth={2} />
    </svg>
  )
}
