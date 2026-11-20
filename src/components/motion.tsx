import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'

const still = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Eases its content in the first time it scrolls into view. `delay` is in seconds. */
export function Reveal({ children, delay = 0, className = '', as: Tag = 'div' }: { children: ReactNode; delay?: number; className?: string; as?: 'div' | 'section' | 'li' }) {
  const ref = useRef<HTMLElement | null>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || seen) return
    if (still()) return setSeen(true)
    // Two ways to notice it: the observer, and a plain position check on scroll. Content must never stay hidden
    // because one of them did not fire.
    const check = () => {
      const r = el.getBoundingClientRect()
      if (r.top < window.innerHeight * 0.94 && r.bottom > 0) setSeen(true)
    }
    const io = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setSeen(true), { threshold: 0.05 })
    io?.observe(el)
    window.addEventListener('scroll', check, { passive: true })
    window.addEventListener('resize', check)
    check()
    return () => {
      io?.disconnect()
      window.removeEventListener('scroll', check)
      window.removeEventListener('resize', check)
    }
  }, [seen])
  const Comp = Tag as 'div'
  return (
    <Comp ref={ref as never} className={`reveal ${seen ? 'in' : ''} ${className}`} style={{ '--d': `${delay}s` } as CSSProperties}>
      {children}
    </Comp>
  )
}

/** Counts up to a whole number the first time it is seen. */
export function CountUp({ to, ms = 900 }: { to: number; ms?: number }) {
  const ref = useRef<HTMLSpanElement | null>(null)
  const [n, setN] = useState(still() ? to : 0)
  useEffect(() => {
    const el = ref.current
    if (!el || still() || typeof IntersectionObserver === 'undefined') return setN(to)
    let raf = 0
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return
      io.disconnect()
      const t0 = performance.now()
      const tick = (now: number) => {
        const k = Math.min(1, (now - t0) / ms)
        setN(Math.round(to * (1 - Math.pow(1 - k, 3))))
        if (k < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    })
    io.observe(el)
    return () => {
      io.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [to, ms])
  return (
    <span ref={ref} className="tabular-nums">
      {n}
    </span>
  )
}
