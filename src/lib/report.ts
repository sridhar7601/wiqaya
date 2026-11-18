import { estimateSkew, SKEW_MIN_DEGREES } from './deskew'
import { WHO2021 } from './engine'
import type { L10n } from './types'

/**
 * Lab report reader, phone side. The picture is straightened and cropped here, on the device, and only the
 * cropped part is sent to the AI service, which returns numbers. The server side is infra/ai/report.mjs.
 */
const ENDPOINT = (import.meta.env.VITE_REPORT_URL as string | undefined) || '/api/read-report'

export type ReadField = keyof typeof WHO2021
export const READ_FIELDS: ReadField[] = ['volume_ml', 'concentration', 'total_motility', 'progressive', 'morphology']

export interface ReadValue {
  value: number
  /** The result as printed on the report, for the person to compare. */
  printed?: string
  comparator?: '<' | '>'
  /** Set when the app (never the AI) worked the value out from other printed numbers. */
  derived?: 'grades_a_b' | 'progressive_plus_non_progressive' | 'from_immotile' | 'from_abnormal' | 'converted'
  /** Set when the numbers on the report do not agree with each other: the person is asked to type this one. */
  unsure?: 'sum' | 'unit' | 'order'
}

export type ReadResult =
  | { ok: true; values: Partial<Record<ReadField, ReadValue>>; missing: ReadField[]; notes: string[] }
  | { ok: false; reason: 'not_semen_report' | 'unreadable' | 'unavailable' | 'busy' | 'error' }

export async function readReport(dataUrl: string): Promise<ReadResult> {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), 45000)
  try {
    const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ image: dataUrl }), signal: ctl.signal })
    if (res.status === 503 || res.status === 404 || res.status === 405) return { ok: false, reason: 'unavailable' }
    if (res.status === 429) return { ok: false, reason: 'busy' }
    if (!res.ok) return { ok: false, reason: 'error' }
    const data = (await res.json()) as ReadResult
    if (data.ok) return { ok: true, values: data.values ?? {}, missing: data.missing ?? [], notes: data.notes ?? [] }
    return { ok: false, reason: data.reason === 'not_semen_report' || data.reason === 'unreadable' ? data.reason : 'error' }
  } catch {
    return { ok: false, reason: 'unavailable' }
  } finally {
    clearTimeout(timer)
  }
}

export const DERIVED_NOTE: Record<NonNullable<ReadValue['derived']>, L10n> = {
  grades_a_b: { en: 'Worked out by the app: grade a + grade b', ar: 'حسبه التطبيق: الدرجة a + الدرجة b' },
  progressive_plus_non_progressive: { en: 'Worked out by the app: progressive + non-progressive', ar: 'حسبه التطبيق: التقدمية + غير التقدمية' },
  from_immotile: { en: 'Worked out by the app: 100 minus immotile', ar: 'حسبه التطبيق: 100 ناقص غير المتحركة' },
  from_abnormal: { en: 'Worked out by the app: 100 minus abnormal forms', ar: 'حسبه التطبيق: 100 ناقص الأشكال غير الطبيعية' },
  converted: { en: 'Converted by the app to million per mL', ar: 'حوّله التطبيق إلى مليون لكل مل' },
}

// ---------- picture handling, all on the device ----------

export function loadImage(source: Blob | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = typeof source === 'string' ? source : URL.createObjectURL(source)
    const img = new Image()
    img.onload = () => {
      if (typeof source !== 'string') URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      if (typeof source !== 'string') URL.revokeObjectURL(url)
      reject(new Error('image'))
    }
    img.src = url
  })
}

function canvasOf(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(width))
  c.height = Math.max(1, Math.round(height))
  const ctx = c.getContext('2d')
  if (!ctx) throw new Error('canvas')
  return [c, ctx]
}

/** Draws the picture no larger than `maxSide`, on white (so transparent screenshots stay readable). */
export function toCanvas(img: HTMLImageElement, maxSide = 2000): HTMLCanvasElement {
  const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
  const [c, ctx] = canvasOf(img.naturalWidth * k, img.naturalHeight * k)
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.drawImage(img, 0, 0, c.width, c.height)
  return c
}

/** Measures the tilt of the page and turns the picture straight. Returns the same canvas when it is straight enough. */
export function straighten(source: HTMLCanvasElement): { canvas: HTMLCanvasElement; tilt: number } {
  const w = Math.min(480, source.width)
  const h = Math.max(2, Math.round((source.height / source.width) * w))
  const [, small] = canvasOf(w, h)
  small.drawImage(source, 0, 0, w, h)
  const px = small.getImageData(0, 0, w, h).data
  const gray = new Uint8Array(w * h)
  for (let i = 0; i < gray.length; i++) gray[i] = (px[i * 4] * 299 + px[i * 4 + 1] * 587 + px[i * 4 + 2] * 114) / 1000
  const tilt = estimateSkew(gray, w, h)
  if (Math.abs(tilt) < SKEW_MIN_DEGREES) return { canvas: source, tilt: 0 }

  const t = (-tilt * Math.PI) / 180
  const cos = Math.abs(Math.cos(t))
  const sin = Math.abs(Math.sin(t))
  const [c, ctx] = canvasOf(source.width * cos + source.height * sin, source.width * sin + source.height * cos)
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.translate(c.width / 2, c.height / 2)
  ctx.rotate(t)
  ctx.drawImage(source, -source.width / 2, -source.height / 2)
  return { canvas: c, tilt }
}

/** A crop frame in fractions of the picture (0-1). */
export interface Frame {
  x: number
  y: number
  w: number
  h: number
}

/** Cuts out the framed part and encodes it as a JPEG data URL, small enough to send. */
export function cropToJpeg(source: HTMLCanvasElement, frame: Frame, maxSide = 1600): string {
  const sx = frame.x * source.width
  const sy = frame.y * source.height
  const sw = Math.max(8, frame.w * source.width)
  const sh = Math.max(8, frame.h * source.height)
  const k = Math.min(1, maxSide / Math.max(sw, sh))
  const [c, ctx] = canvasOf(sw * k, sh * k)
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', 0.86)
}
