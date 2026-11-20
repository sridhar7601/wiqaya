import { ArrowRight, X } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../lib/i18n'
import { load, save } from '../lib/storage'
import type { L10n } from '../lib/types'

/** One stop of a walkthrough: the element marked data-tour="<target>" and what to say about it. */
export interface TourStep {
  target: string
  title: L10n
  body: L10n
}

const EVENT = 'wiqaya:tour'
/** Replays the walkthrough of the page that is open (the header's guide button). */
export const startTour = (): void => {
  window.dispatchEvent(new Event(EVENT))
}
/** Pages that have a walkthrough. */
export const TOUR_PATHS = new Set(['/', '/result', '/me'])

const seen = (id: string) => load<string[]>('tour', []).includes(id)
const markSeen = (id: string) => {
  const list = load<string[]>('tour', [])
  if (!list.includes(id)) save('tour', [...list, id])
}
// A link can switch the walkthrough off (…?tour=0), and scripted browsers never get it.
const blocked = () => /[?&]tour=0\b/.test(window.location.hash) || navigator.webdriver === true

/** The first element with this mark that is actually on screen (a phone and a desktop copy may both exist). */
function findTarget(name: string): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)) {
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) return el
  }
  return null
}

/** Inside something stuck to the screen (the header, the phone tab bar): scrolling would not move it. */
function pinned(el: HTMLElement): boolean {
  for (let n: HTMLElement | null = el; n && n !== document.body; n = n.parentElement) {
    const pos = getComputedStyle(n).position
    if (pos === 'fixed' || pos === 'sticky') return true
  }
  return false
}

interface Box {
  x: number
  y: number
  w: number
  h: number
}

const HEADER = 80
const CARD_ROOM = 250

/**
 * A short walkthrough for a first visit: dims the page, lights up one thing at a time and says what it is for.
 * It starts once per page, can be skipped at any point, and can be replayed from the header.
 */
export function Tour({ id, steps }: { id: string; steps: TourStep[] }) {
  const { t, lang } = useI18n()
  const [i, setI] = useState(-1)
  const [box, setBox] = useState<Box | null>(null)
  const [cardH, setCardH] = useState(220)
  const card = useRef<HTMLDivElement>(null)
  const nextBtn = useRef<HTMLButtonElement>(null)

  /** The nearest step from `from` in direction `dir` whose target is on screen, or -1. */
  const seek = useCallback(
    (from: number, dir: 1 | -1) => {
      for (let n = from; n >= 0 && n < steps.length; n += dir) if (findTarget(steps[n].target)) return n
      return -1
    },
    [steps],
  )

  const close = useCallback(() => {
    markSeen(id)
    setI(-1)
    setBox(null)
  }, [id])

  // Start once on a first visit, and whenever the header's guide button asks.
  useEffect(() => {
    const begin = () => {
      const n = seek(0, 1)
      if (n >= 0) setI(n)
    }
    window.addEventListener(EVENT, begin)
    const timer = !seen(id) && !blocked() ? window.setTimeout(begin, 1100) : undefined
    return () => {
      window.removeEventListener(EVENT, begin)
      if (timer) window.clearTimeout(timer)
    }
  }, [id, seek])

  // Bring the step's target into view and keep following it while the page scrolls or settles.
  useEffect(() => {
    if (i < 0) return
    const el = findTarget(steps[i].target)
    if (!el) return
    const r0 = el.getBoundingClientRect()
    const vh = window.innerHeight
    const fits = r0.height + CARD_ROOM + HEADER < vh
    const wantTop = fits ? Math.max(HEADER, (vh - r0.height - CARD_ROOM) / 2) : HEADER
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (!pinned(el)) window.scrollTo({ top: Math.max(0, window.scrollY + r0.top - wantTop), behavior: reduce ? 'auto' : 'smooth' })
    let raf = 0
    const tick = () => {
      const r = el.getBoundingClientRect()
      setBox((b) => (b && b.x === r.left && b.y === r.top && b.w === r.width && b.h === r.height ? b : { x: r.left, y: r.top, w: r.width, h: r.height }))
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [i, steps])

  const open = i >= 0 && box !== null
  useLayoutEffect(() => {
    if (open && card.current) setCardH(card.current.offsetHeight)
  }, [open, i, lang])
  useEffect(() => {
    if (open) nextBtn.current?.focus({ preventScroll: true })
  }, [open, i])

  // Esc closes the walkthrough. Capture phase, so the plan's "Esc twice to leave" does not also count it.
  useEffect(() => {
    if (i < 0) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      close()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [i, close])

  if (i < 0 || !box) return null

  const live = steps.map((s, n) => ({ s, n })).filter((x) => findTarget(x.s.target))
  const at = Math.max(0, live.findIndex((x) => x.n === i))
  const prev = seek(i - 1, -1)
  const next = seek(i + 1, 1)

  const vw = window.innerWidth
  const vh = window.innerHeight
  const pad = 8
  const w = Math.min(360, vw - 24)
  const left = Math.max(12, Math.min(box.x + box.w / 2 - w / 2, vw - w - 12))
  const below = vh - (box.y + box.h + pad)
  const above = box.y - pad
  const top = below >= cardH + 24 ? box.y + box.h + pad + 12 : above >= cardH + 24 ? box.y - pad - 12 - cardH : Math.max(12, vh - cardH - 16)

  return createPortal(
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={t({ en: 'Walkthrough', ar: 'جولة تعريفية' })}>
      {/* Blocks clicks on the page while the walkthrough is open. */}
      <div className="absolute inset-0" />
      {/* The lit area: everything outside it is dimmed by one very large shadow. */}
      <div
        className="pointer-events-none absolute rounded-2xl ring-2 ring-white/90"
        style={{ left: box.x - pad, top: box.y - pad, width: box.w + pad * 2, height: box.h + pad * 2, boxShadow: '0 0 0 200vmax rgba(8, 28, 32, 0.62)' }}
        aria-hidden
      />
      <div ref={card} className="absolute rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-line" style={{ top, left, width: w }}>
        <div key={i} className="anim-rise space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5" aria-hidden>
              {live.map((x, n) => (
                <span key={x.n} className={`h-1.5 rounded-full transition-all duration-300 ${n === at ? 'w-6 bg-brand-600' : n < at ? 'w-1.5 bg-brand-200' : 'w-1.5 bg-line'}`} />
              ))}
            </div>
            <span className="text-xs font-semibold text-muted tabular-nums">
              {at + 1} / {live.length}
            </span>
            <button type="button" onClick={close} className="-m-1.5 ms-auto inline-flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-canvas hover:text-ink" aria-label={t({ en: 'Close the walkthrough', ar: 'إغلاق الجولة' })}>
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg leading-snug font-bold text-ink">{t(steps[i].title)}</h2>
            <p className="text-sm leading-relaxed text-body">{t(steps[i].body)}</p>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button type="button" onClick={close} className="me-auto text-sm font-semibold text-muted hover:text-ink">
              {t({ en: 'Skip', ar: 'تخطٍّ' })}
            </button>
            {prev >= 0 && (
              <button type="button" onClick={() => setI(prev)} className="btn btn-secondary btn-sm">
                {t({ en: 'Back', ar: 'السابق' })}
              </button>
            )}
            <button ref={nextBtn} type="button" onClick={() => (next >= 0 ? setI(next) : close())} className="btn btn-primary btn-sm">
              {next >= 0 ? t({ en: 'Next', ar: 'التالي' }) : t({ en: 'Got it', ar: 'فهمت' })}
              {next >= 0 && <ArrowRight className="icon-dir h-4 w-4" aria-hidden />}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
