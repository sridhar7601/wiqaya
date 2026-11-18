/**
 * Finds how far a photographed page is tilted, so the app can straighten it before the AI reads it.
 *
 * Why: on a tilted photo a label and its number no longer sit on the same horizontal line, and the reader can
 * pick the number from the row above or below. Straightening first removes the cause.
 *
 * How (projection profile): text lines and table rules are horizontal. When the page is straight, counting the
 * "edge" pixels in each pixel row gives a spiky profile (rows of text, then gaps). When it is tilted the profile
 * smears out. We try each angle, and keep the one with the spikiest profile.
 *
 * Pure function over a small greyscale copy of the picture: it runs on the phone, and in the tests.
 */

/** `gray` holds one 0-255 value per pixel, row by row. Returns degrees; positive = the page is turned clockwise. */
export function estimateSkew(gray: ArrayLike<number>, width: number, height: number, maxDegrees = 15): number {
  // Edge pixels: places where brightness changes from one row to the next (the tops and bottoms of letters and lines).
  const xs: number[] = []
  const ys: number[] = []
  for (let y = 1; y < height - 1; y++) {
    const row = y * width
    for (let x = 1; x < width - 1; x++) {
      if (Math.abs(gray[row + width + x] - gray[row - width + x]) > 40) {
        xs.push(x - width / 2)
        ys.push(y - height / 2)
      }
    }
  }
  if (xs.length < 200) return 0 // nothing to measure (blank or very dark picture)

  const span = Math.ceil(Math.hypot(width, height))
  const bins = new Float64Array(span + 2)
  const sharpness = (degrees: number): number => {
    const t = (degrees * Math.PI) / 180
    const cos = Math.cos(t)
    const sin = Math.sin(t)
    bins.fill(0)
    for (let i = 0; i < xs.length; i++) bins[Math.round(ys[i] * cos - xs[i] * sin + span / 2)]++
    let score = 0
    for (let i = 1; i < bins.length; i++) {
      const d = bins[i] - bins[i - 1]
      score += d * d
    }
    return score
  }

  let best = 0
  let bestScore = -1
  for (let a = -maxDegrees; a <= maxDegrees; a += 0.5) {
    const s = sharpness(a)
    if (s > bestScore) {
      bestScore = s
      best = a
    }
  }
  for (let a = best - 0.4; a <= best + 0.4; a += 0.1) {
    const s = sharpness(a)
    if (s > bestScore) {
      bestScore = s
      best = a
    }
  }
  // A straight page scores almost as well as the best angle: do not "correct" what is already straight.
  return sharpness(0) > bestScore * 0.92 ? 0 : Math.round(best * 10) / 10
}

/** Below this, straightening changes nothing useful. */
export const SKEW_MIN_DEGREES = 0.8
