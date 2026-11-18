/**
 * Wiqaya Lens: a rough estimate of sperm motility from a short microscope video, worked out on the phone.
 *
 * What it gives: the share of sperm that swim forward (progressive), that move without getting anywhere
 * (non-progressive) and that do not move at all (immotile), the three WHO 2021 categories, plus how many heads
 * are in view per frame (a stand-in for concentration). It is a home estimate that points to a lab test, never a
 * diagnosis. When the video is not good enough to judge (dark, glare, out of focus, shaking, too few or too many
 * cells, too short), `ok` is false and the app must not show the numbers.
 *
 * How, in six steps (all plain arithmetic on a small greyscale copy of each frame, no AI model):
 * 1. Shrink each frame to about 320 px wide (whole-number factor, block average) and keep about 25-30 frames a
 *    second. That is enough to see a head move and keeps a 10 s clip to roughly half a second of work.
 * 2. Find heads. A lightly smoothed frame minus its local background (the mean of a box about 13 µm across) leaves
 *    small things that are brighter (or darker) than their surroundings. A blob is what stands out by a few times
 *    the frame's own noise, measured on that frame. It counts as a head only if it is head-sized, its brightest
 *    point stands out clearly (`minPeak`) and its middle is bright too: round cells and the halos around debris
 *    are rings with a darker middle. These limits were set on VISEM-Tracking's hand-drawn sperm boxes (16 training
 *    videos): they keep about 82% of annotated heads and drop about 91% of other blobs. Bigger blobs (clumps,
 *    round cells, glare) are counted but not used. Whether heads are lighter or darker than the background is
 *    read from which tail of the brightness spread is longer.
 *    Why not the usual "median of many frames" background: it erases everything that does not move, and the
 *    sperm that do not move are exactly the ones we must count.
 * 3. Measure how the whole picture shifts from one frame to the next. Every pair of heads in two consecutive
 *    frames votes for the shift between them; still objects (dead sperm, debris) all vote for the same shift, the
 *    camera's, while swimmers scatter their votes. A phone held by hand drifts, and the liquid itself can flow;
 *    without this step every still cell would look like a swimmer.
 * 4. Link heads from frame to frame, after removing that shift: nearest neighbour to where the head should be by
 *    now (last position plus last speed), never further than a top swimming speed allows, closest pairs first.
 *    A head may be missed for a couple of frames without breaking its track.
 * 5. For each track of at least `minTrackS`: VAP, the speed along the smoothed path (CASA's "average path
 *    velocity"), and progression, the straight-line distance covered per second. Both are medians over 1 s
 *    windows, so a few frames where a passing swimmer disturbs a still head's track do not count. Progression is
 *    what tells a forward swimmer from one that circles on the spot, even when the forward swimmer follows a large
 *    circle (WHO counts that as progressive). Progressive = progression at least `progressiveUmS` (WHO 2021 counts
 *    5 µm/s and up as slow progressive); otherwise non-progressive if VAP is at least `motileUmS`; otherwise immotile.
 * 6. Shares are weighted by how long each track is on screen. A lab counter classifies the sperm that are in view
 *    at a moment; a sperm's chance of being in view is proportional to the time it spends there. An optional
 *    straight-line correction (`calibration`) then maps the measured shares to the lab's scale.
 *
 * Distances are in µm through `fieldWidthUm`, the width of the field of view. The default (320 µm) fits the VISEM
 * lab videos (400x, phase contrast; estimated from the optics and the annotated head size, not stated by the
 * dataset); a clip-on phone lens needs its own value, measured once with a ruler slide.
 *
 * What the lab comparison showed (infra/lens/visem-eval.test.ts, src/eval/lensLive.generated.ts; 22 held-out lab
 * videos): the measured shares rank samples fairly well (r about 0.7-0.75) but read low, because debris of head
 * size counts as an immotile sperm and a sperm whose tail beats while its head hardly moves looks still at this
 * size. The straight-line correction brings the average error to about 8 points (total motility) and 11 points
 * (progressive), against 14 and 19 for always answering the average, but it pulls every answer towards the middle:
 * a sample in which nothing moves still reads 47% motile, and the one held-out sample with very low motility (4%)
 * was not caught. So the number is never reassurance; it can only add to the reason to get a lab test.
 *
 * Pure functions over plain arrays: they run on the phone (browser) and in Node for the tests.
 */

export interface LensClip {
  width: number
  height: number
  fps: number
  /** One 0-255 value per pixel, row by row, `width * height` long. */
  frames: Uint8Array[]
}

export type LensKind = 'progressive' | 'non_progressive' | 'immotile'

export interface LensTrack {
  /** Where the head was in the video, in the clip's own pixels (not drift-corrected), simplified to a few dozen points. */
  points: [number, number][]
  kind: LensKind
}

export type LensIssue = 'too_dark' | 'too_bright' | 'too_few_cells' | 'too_crowded' | 'unstable' | 'blurry' | 'too_short'

export interface LensResult {
  /** false = the quality gate failed: the app must NOT show the numbers below (they are kept for testing only). */
  ok: boolean
  issues: LensIssue[]
  motilePct: number
  progressivePct: number
  nonProgressivePct: number
  immotilePct: number
  /** Mean number of heads found per frame: a concentration proxy that depends on lens and chamber depth. */
  cellsPerFrame: number
  /** Tracks long enough to classify. */
  tracked: number
  /** For drawing an overlay: the longest tracks, at most `maxOverlayTracks`. */
  tracks: LensTrack[]
  ms?: number
}

/** Straight-line correction fitted against lab results: shown = intercept + slope x measured (percentage points). */
export interface LensCalibration {
  motile: [intercept: number, slope: number]
  progressive: [intercept: number, slope: number]
  /** Where the fit came from, e.g. "VISEM train split, 2026-11-17". */
  source: string
}

export interface LensParams {
  // ---- picture ----
  /** Frames are shrunk by a whole-number factor to about this width (px). */
  workWidth: number
  /** Frames are thinned by a whole-number step to about this rate (frames per second). */
  targetFps: number
  /** At most this many frames (after thinning) are used. */
  maxFrames: number
  /** Width of the field of view in µm: sets the scale for every distance and speed below. */
  fieldWidthUm: number
  /** 'bright' = heads lighter than the background (phase contrast, dark field); 'dark' = darker (plain bright field). */
  polarity: 'auto' | 'bright' | 'dark'
  // ---- finding heads ----
  /** Half-width of the local background box, µm. */
  backgroundUm: number
  /** A pixel is part of a blob when it stands out by this many noise units (noise measured per frame) ... */
  thresholdSigma: number
  /** ... and by at least this many grey levels. */
  minContrast: number
  /** A blob counts as a head only if its brightest point stands out by this many noise units ... */
  peakSigma: number
  /** ... and by at least this many grey levels (phase-contrast heads are very bright; most debris is not). */
  minPeak: number
  /** Area limits of one head above the threshold, µm² (VISEM heads: about 15-80 µm² including the halo). */
  headMinUm2: number
  headMaxUm2: number
  /** The blob's middle must be at least this share of its peak (rejects ring-shaped round cells and halos). */
  minCoreRatio: number
  // ---- linking ----
  /** Top swimming speed used to link heads between frames, µm/s. */
  maxSpeedUmS: number
  /** A head may be missed for this many frames without ending its track. */
  maxGapFrames: number
  // ---- classifying ----
  /** Tracks shorter than this are not classified, s. */
  minTrackS: number
  /** Smoothing window for the average path, s. */
  smoothS: number
  /** Window over which progression is measured, s. */
  windowS: number
  /** Progression (net distance per second over `windowS`) from which a sperm counts as progressive, µm/s.
   *  WHO 2021 calls 5-25 µm/s slow progressive; the tuned value is what matched the lab best on training videos. */
  progressiveUmS: number
  /** Average-path speed from which a non-progressing sperm counts as moving, µm/s. */
  motileUmS: number
  // ---- quality gate ----
  minSeconds: number
  /** Too dark when even the brightest 1% of pixels are below this grey level. */
  darkLevel: number
  /** Too bright when the mean is above this, or when more than `glareFraction` of pixels are near white. */
  brightMean: number
  glareFraction: number
  minCellsPerFrame: number
  minTracked: number
  /** Too crowded above this many heads per 100 x 100 µm, when more than `maxClumpFraction` of blobs are clumps
   *  (and there are at least `minCellsPerFrame` clumps per frame),
   *  when more than `maxCoverage` of the field is inside blobs, or when the fine texture (band-pass noise over mean
   *  brightness) passes `maxTexture`: cells packed into one carpet hide each other and few separate heads show. */
  maxCellsPer10kUm2: number
  maxClumpFraction: number
  maxCoverage: number
  maxTexture: number
  /** Unstable when the picture drifts faster than this (µm/s) ... */
  maxDriftUmS: number
  /** ... or jumps around by more than this per frame (µm, 90th percentile). */
  maxShakeUm: number
  /** Blurry when there are blobs at a coarse scale (at least twice `minCellsPerFrame`) but under this share of
   *  them are sharp enough to count as heads. */
  minSharpShare: number
  maxOverlayTracks: number
  /** Optional correction applied to the shares (null = report what was measured). */
  calibration: LensCalibration | null
}

/**
 * Where the values come from. Head finding (`minPeak` ... `minCoreRatio`): VISEM-Tracking's hand-drawn sperm boxes
 * on 16 training videos. Polarity rule, crowding (`maxTexture`) and blur limits: VISEM training clips and synthetic
 * clips. `minTrackS`, `progressiveUmS`, `motileUmS` and `calibration`: chosen and fitted on the VISEM training
 * participants only, by infra/lens/visem-eval.test.ts (run of 2026-11-17); the held-out scores are in
 * src/eval/lensLive.generated.ts. All of it is lab-microscope video (400x, phase contrast). Nothing here has been
 * checked on a phone with a clip-on lens.
 */
export const LENS_DEFAULTS: LensParams = {
  workWidth: 320,
  targetFps: 30,
  maxFrames: 300,
  fieldWidthUm: 320,
  polarity: 'auto',
  backgroundUm: 6,
  thresholdSigma: 4.5,
  minContrast: 5,
  peakSigma: 8,
  minPeak: 25,
  headMinUm2: 10,
  headMaxUm2: 140,
  minCoreRatio: 0.6,
  maxSpeedUmS: 200,
  maxGapFrames: 2,
  minTrackS: 0.3,
  smoothS: 0.2,
  windowS: 1,
  progressiveUmS: 8,
  motileUmS: 10,
  minSeconds: 3,
  darkLevel: 40,
  brightMean: 220,
  glareFraction: 0.08,
  minCellsPerFrame: 5,
  minTracked: 15,
  maxCellsPer10kUm2: 60,
  maxClumpFraction: 0.35,
  maxCoverage: 0.35,
  maxTexture: 0.1,
  maxDriftUmS: 80,
  maxShakeUm: 4,
  minSharpShare: 0.15,
  maxOverlayTracks: 150,
  // Pulls answers towards the training average: a field where nothing moves reads 47% motile, 16.5% progressive.
  calibration: { motile: [46.97, 0.578], progressive: [16.5, 0.684], source: 'VISEM training split (63 participants, 60 passed the gate), 2026-11-17' },
}

/** One linked head path. Positions in working pixels: `x`/`y` with the picture's shift removed, `cx`/`cy` as seen. */
export interface LensRawTrack {
  f: number[]
  x: number[]
  y: number[]
  cx: number[]
  cy: number[]
}

/** Everything measured from the video before classifying; `summariseLens` turns it into a result. */
export interface LensAnalysis {
  /** Rate of the frames actually used, and how many. */
  fps: number
  frames: number
  seconds: number
  /** Working size (after shrinking) and the shrink factor. */
  width: number
  height: number
  scale: number
  umPerPx: number
  polarity: 'bright' | 'dark'
  /** Brightness: mean, 99th percentile, share of near-white pixels. */
  meanLevel: number
  p99Level: number
  glare: number
  cellsPerFrame: number
  /** Searched area in µm² (the frame minus a thin border). */
  areaUm2: number
  clumpFraction: number
  clumpsPerFrame: number
  /** Share of the searched area inside any blob. */
  coverage: number
  /** Fine-scale texture: band-pass noise divided by mean brightness. A field packed with cells is all texture. */
  texture: number
  /** Heads per frame at the normal scale divided by blobs per frame at a coarse scale (sampled frames). */
  sharpShare: number
  coarsePerFrame: number
  driftUmS: number
  shakeUm: number
  tracks: LensRawTrack[]
}

// ---------------------------------------------------------------------------------------------------------------
// Step 1-2: finding heads in one frame
// ---------------------------------------------------------------------------------------------------------------

/** Scratch buffers reused for every frame, so a 10 s clip allocates almost nothing. */
interface Scratch {
  w: number
  h: number
  img: Float32Array
  sat: Float64Array
  band: Float32Array
  seen: Uint8Array
  stack: Int32Array
  sample: Float32Array
}

function scratch(w: number, h: number): Scratch {
  return {
    w,
    h,
    img: new Float32Array(w * h),
    sat: new Float64Array((w + 1) * (h + 1)),
    band: new Float32Array(w * h),
    seen: new Uint8Array(w * h),
    stack: new Int32Array(w * h),
    sample: new Float32Array(Math.ceil(w / 3) * Math.ceil(h / 3) + 8),
  }
}

/** Block-average shrink by a whole-number factor `f` into `out` (working size `w` x `h`). */
function shrink(src: Uint8Array, srcW: number, f: number, w: number, h: number, out: Float32Array): void {
  if (f === 1) {
    for (let i = 0; i < w * h; i++) out[i] = src[i]
    return
  }
  out.fill(0)
  const k = 1 / (f * f)
  for (let y = 0; y < h * f; y++) {
    const row = y * srcW
    const o = ((y / f) | 0) * w
    for (let x = 0; x < w; x++) {
      let s = 0
      const b = row + x * f
      for (let j = 0; j < f; j++) s += src[b + j]
      out[o + x] += s * k
    }
  }
}

/** Summed-area table: the sum over any box costs four reads. */
function integrate(src: Float32Array, w: number, h: number, sat: Float64Array): void {
  const W = w + 1
  for (let x = 0; x <= w; x++) sat[x] = 0
  for (let y = 0; y < h; y++) {
    let run = 0
    const o = (y + 1) * W
    sat[o] = 0
    for (let x = 0; x < w; x++) {
      run += src[y * w + x]
      sat[o + x + 1] = sat[o - W + x + 1] + run
    }
  }
}

/**
 * Band-pass: mean of a (2a+1)² box minus mean of a (2b+1)² box, times `sign` (+1 bright heads, -1 dark heads).
 * Only pixels at least `b` from the edge are filled; the border stays 0 and is never searched.
 */
function bandPass(sat: Float64Array, w: number, h: number, a: number, b: number, sign: number, out: Float32Array): void {
  out.fill(0)
  const W = w + 1
  const ka = sign / ((2 * a + 1) * (2 * a + 1))
  const kb = sign / ((2 * b + 1) * (2 * b + 1))
  for (let y = b; y < h - b; y++) {
    const ya0 = (y - a) * W
    const ya1 = (y + a + 1) * W
    const yb0 = (y - b) * W
    const yb1 = (y + b + 1) * W
    for (let x = b; x < w - b; x++) {
      const sa = sat[ya1 + x + a + 1] - sat[ya0 + x + a + 1] - sat[ya1 + x - a] + sat[ya0 + x - a]
      const sb = sat[yb1 + x + b + 1] - sat[yb0 + x + b + 1] - sat[yb1 + x - b] + sat[yb0 + x - b]
      out[y * w + x] = sa * ka - sb * kb
    }
  }
}

/** Robust noise of the band-passed frame: median and 1.4826 x median absolute deviation, on a sparse grid. */
function noiseOf(band: Float32Array, w: number, h: number, m: number, sample: Float32Array): [number, number] {
  let n = 0
  for (let y = m; y < h - m; y += 3) for (let x = m; x < w - m; x += 3) sample[n++] = band[y * w + x]
  if (n < 16) return [0, 1]
  const s = sample.subarray(0, n)
  s.sort()
  const med = s[n >> 1]
  for (let i = 0; i < n; i++) s[i] = Math.abs(s[i] - med)
  s.sort()
  return [med, Math.max(0.25, 1.4826 * s[n >> 1])]
}

interface Blobs {
  xs: number[]
  ys: number[]
  /** Blobs too big to be one head. */
  clumps: number
  /** Pixels inside any blob. */
  cover: number
  /** Noise of the band-passed frame (grey levels). */
  sigma: number
}

/** What makes a blob a head: its extent above `low`, a peak of at least `high`, a size, and a bright middle. */
interface BlobRule {
  low: number
  high: number
  minA: number
  maxA: number
  core: number
}

/**
 * Connected blobs (8-neighbours) above `rule.low`. A blob becomes a detection, at its weighted centre, when it is
 * head-sized, its peak reaches `rule.high`, and its middle is at least `rule.core` of its peak. That last test
 * drops round cells and the halos around debris: in phase contrast they are bright rings with a darker middle.
 */
function findBlobs(band: Float32Array, w: number, h: number, m: number, rule: BlobRule, k: Scratch): Blobs {
  const { seen, stack } = k
  const t = rule.low
  seen.fill(0)
  const xs: number[] = []
  const ys: number[] = []
  let clumps = 0
  let cover = 0
  for (let y = m; y < h - m; y++) {
    for (let x = m; x < w - m; x++) {
      const i0 = y * w + x
      if (seen[i0] || band[i0] <= t) continue
      let top = 0
      stack[top++] = i0
      seen[i0] = 1
      let area = 0
      let sw = 0
      let sx = 0
      let sy = 0
      let peak = 0
      while (top > 0) {
        const i = stack[--top]
        const b = band[i]
        const v = b - t
        const px = i % w
        const py = (i - px) / w
        area++
        sw += v
        sx += v * px
        sy += v * py
        if (b > peak) peak = b
        // the border (width m >= 1) is 0 and never above t, so neighbours never wrap around a row
        for (let dy = -w; dy <= w; dy += w) {
          for (let dx = -1; dx <= 1; dx++) {
            const j = i + dy + dx
            if (!seen[j] && band[j] > t) {
              seen[j] = 1
              stack[top++] = j
            }
          }
        }
      }
      cover += area
      if (peak < rule.high || sw <= 0) continue
      if (area > rule.maxA) {
        clumps++
        continue
      }
      if (area < rule.minA) continue
      const cx = sx / sw
      const cy = sy / sw
      if (band[Math.round(cy) * w + Math.round(cx)] < rule.core * peak) continue
      xs.push(cx)
      ys.push(cy)
    }
  }
  return { xs, ys, clumps, cover, sigma: 0 }
}

/** Geometry derived from the parameters for one clip. */
interface Geometry {
  w: number
  h: number
  f: number
  step: number
  fps: number
  umPerPx: number
  margin: number
  minA: number
  maxA: number
}

function geometry(clip: LensClip, p: LensParams): Geometry {
  const f = Math.max(1, Math.round(clip.width / p.workWidth))
  const w = Math.floor(clip.width / f)
  const h = Math.floor(clip.height / f)
  const fps = Number.isFinite(clip.fps) && clip.fps > 0 ? clip.fps : 0
  const step = Math.max(1, Math.round(fps / p.targetFps))
  const umPerPx = p.fieldWidthUm / w
  const margin = Math.max(3, Math.round(p.backgroundUm / umPerPx))
  return {
    w,
    h,
    f,
    step,
    fps: fps / step,
    umPerPx,
    margin,
    minA: Math.max(2, Math.round(p.headMinUm2 / (umPerPx * umPerPx))),
    maxA: Math.max(6, Math.round(p.headMaxUm2 / (umPerPx * umPerPx))),
  }
}

/** Heads in one (already shrunk) frame, at the normal scale. Fills `k.band`. */
function headsIn(k: Scratch, g: Geometry, p: LensParams, sign: number): Blobs {
  integrate(k.img, g.w, g.h, k.sat)
  bandPass(k.sat, g.w, g.h, 1, g.margin, sign, k.band)
  const [med, sigma] = noiseOf(k.band, g.w, g.h, g.margin, k.sample)
  const rule: BlobRule = {
    low: Math.max(med + p.thresholdSigma * sigma, p.minContrast),
    high: Math.max(med + p.peakSigma * sigma, p.minPeak),
    minA: g.minA,
    maxA: g.maxA,
    core: p.minCoreRatio,
  }
  const found = findBlobs(k.band, g.w, g.h, g.margin, rule, k)
  found.sigma = sigma
  return found
}

/**
 * Blobs at twice the scale, with a lower bar: an out-of-focus head still shows here, while above it is too faint
 * and wide to pass. Many of these and few sharp heads means the focus is off.
 */
function coarseBlobs(k: Scratch, g: Geometry, p: LensParams, sign: number): number {
  const b = g.margin * 2
  if (g.w <= 2 * b + 8 || g.h <= 2 * b + 8) return 0
  bandPass(k.sat, g.w, g.h, 2, b, sign, k.band)
  const [med, sigma] = noiseOf(k.band, g.w, g.h, b, k.sample)
  const low = Math.max(med + p.thresholdSigma * sigma, p.minContrast / 2)
  const rule: BlobRule = { low, high: low, minA: g.minA, maxA: g.maxA * 8, core: 0 }
  return findBlobs(k.band, g.w, g.h, b, rule, k).xs.length
}

// ---------------------------------------------------------------------------------------------------------------
// Step 3: how far the whole picture moved between two frames
// ---------------------------------------------------------------------------------------------------------------

interface Shift {
  dx: number
  dy: number
  /** Number of pairs that agree with the winning shift. */
  support: number
}

/**
 * Every pair (a in the earlier frame, b in the later one) closer than `r` px votes for the shift b - a.
 * Still objects pile their votes on the true shift; the best-supported shift wins and is refined to sub-pixel
 * precision as the mean of the pairs that agree with it.
 */
function shiftBetween(ax: number[], ay: number[], bx: number[], by: number[], r: number, w: number, h: number): Shift {
  const none = { dx: 0, dy: 0, support: 0 }
  if (ax.length === 0 || bx.length === 0) return none
  const cell = Math.max(4, r)
  const gw = Math.ceil(w / cell) + 2
  const gh = Math.ceil(h / cell) + 2
  const start = new Int32Array(gw * gh + 1)
  const cellOf = (x: number, y: number) => (Math.min(gh - 1, Math.max(0, Math.floor(y / cell) + 1)) * gw + Math.min(gw - 1, Math.max(0, Math.floor(x / cell) + 1)))
  for (let i = 0; i < ax.length; i++) start[cellOf(ax[i], ay[i]) + 1]++
  for (let c = 0; c < gw * gh; c++) start[c + 1] += start[c]
  const fill = start.slice(0, gw * gh)
  const items = new Int32Array(ax.length)
  for (let i = 0; i < ax.length; i++) items[fill[cellOf(ax[i], ay[i])]++] = i

  const side = 2 * r + 1
  const hist = new Float32Array(side * side)
  const visit = (fn: (dx: number, dy: number) => void) => {
    for (let j = 0; j < bx.length; j++) {
      const c = cellOf(bx[j], by[j])
      for (let oy = -gw; oy <= gw; oy += gw) {
        for (let ox = -1; ox <= 1; ox++) {
          const cc = c + oy + ox
          if (cc < 0 || cc >= gw * gh) continue
          for (let q = start[cc]; q < start[cc + 1]; q++) {
            const i = items[q]
            const dx = bx[j] - ax[i]
            const dy = by[j] - ay[i]
            if (dx >= -r && dx <= r && dy >= -r && dy <= r) fn(dx, dy)
          }
        }
      }
    }
  }
  visit((dx, dy) => {
    // bilinear vote, so a shift of 0.5 px is not split arbitrarily
    const fx = dx + r
    const fy = dy + r
    const x0 = Math.min(side - 2, Math.floor(fx))
    const y0 = Math.min(side - 2, Math.floor(fy))
    const tx = fx - x0
    const ty = fy - y0
    hist[y0 * side + x0] += (1 - tx) * (1 - ty)
    hist[y0 * side + x0 + 1] += tx * (1 - ty)
    hist[(y0 + 1) * side + x0] += (1 - tx) * ty
    hist[(y0 + 1) * side + x0 + 1] += tx * ty
  })
  let best = -1
  let bi = 0
  for (let y = 1; y < side - 1; y++) {
    for (let x = 1; x < side - 1; x++) {
      let s = 0
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) s += hist[(y + oy) * side + x + ox]
      if (s > best) {
        best = s
        bi = y * side + x
      }
    }
  }
  // Refine in two narrowing rounds. Slow swimmers move less than a pixel per frame and would pull a wide average
  // off the true shift; still objects agree with each other to a fraction of a pixel.
  const near: number[] = []
  const gather = (cx: number, cy: number, tol: number) => {
    near.length = 0
    visit((dx, dy) => {
      if (Math.abs(dx - cx) <= tol && Math.abs(dy - cy) <= tol) near.push(dx, dy)
    })
  }
  gather((bi % side) - r, Math.floor(bi / side) - r, 1)
  if (near.length === 0) return none
  const mx = median(near.filter((_, i) => i % 2 === 0))
  const my = median(near.filter((_, i) => i % 2 === 1))
  gather(mx, my, 0.45)
  const n = near.length / 2
  if (n === 0) return none
  let sx = 0
  let sy = 0
  for (let i = 0; i < near.length; i += 2) {
    sx += near[i]
    sy += near[i + 1]
  }
  let dx = sx / n
  let dy = sy / n
  let vx = 0
  let vy = 0
  for (let i = 0; i < near.length; i += 2) {
    vx += (near[i] - dx) ** 2
    vy += (near[i + 1] - dy) ** 2
  }
  // A shift smaller than twice its own uncertainty is noise: on a steady microscope it would only add jitter.
  if (n > 1 && Math.abs(dx) < 2 * Math.sqrt(vx / (n - 1) / n)) dx = 0
  if (n > 1 && Math.abs(dy) < 2 * Math.sqrt(vy / (n - 1) / n)) dy = 0
  return { dx, dy, support: n }
}

/** Fewer agreeing pairs than this and the shift is not trusted (the previous one is kept). */
function trustedSupport(na: number, nb: number): number {
  return Math.max(5, 0.2 * Math.min(na, nb))
}

// ---------------------------------------------------------------------------------------------------------------
// Polarity: are the heads lighter or darker than the background?
// ---------------------------------------------------------------------------------------------------------------

/**
 * Looks at which way the band-passed picture is lopsided: how far its brightest 0.2% of pixels stand above the
 * median, against how far its darkest 0.2% fall below. Heads are the strongest small objects in a sperm video, so
 * they set the longer tail: bright in phase contrast (all 63 VISEM training clips) and dark field, dark in plain
 * bright field. Counting blobs or moving blobs does not work: phase contrast also shows plenty of dark debris
 * and dark halos that move along with the heads.
 */
function choosePolarity(clip: LensClip, g: Geometry, p: LensParams, k: Scratch): 'bright' | 'dark' {
  const n = Math.min(clip.frames.length, p.maxFrames * g.step)
  if (n === 0) return 'bright'
  const ups: number[] = []
  const downs: number[] = []
  const values = new Float32Array(Math.ceil(g.w / 2) * Math.ceil(g.h / 2))
  for (let s = 0; s < 5; s++) {
    shrink(clip.frames[Math.floor((n * (s + 0.5)) / 5)], clip.width, g.f, g.w, g.h, k.img)
    integrate(k.img, g.w, g.h, k.sat)
    bandPass(k.sat, g.w, g.h, 1, g.margin, 1, k.band)
    let m = 0
    for (let y = g.margin; y < g.h - g.margin; y += 2) for (let x = g.margin; x < g.w - g.margin; x += 2) values[m++] = k.band[y * g.w + x]
    if (m < 100) continue
    const v = values.subarray(0, m).sort()
    const at = (q: number) => v[Math.round(q * (m - 1))]
    ups.push(at(0.998) - at(0.5))
    downs.push(at(0.5) - at(0.002))
  }
  return median(downs) > median(ups) ? 'dark' : 'bright'
}

// ---------------------------------------------------------------------------------------------------------------
// Steps 1-4 for a whole clip
// ---------------------------------------------------------------------------------------------------------------

interface Live extends LensRawTrack {
  vx: number
  vy: number
  last: number
}

/** Runs detection, shift measurement and linking over the clip. Slow part; classification is in `summariseLens`. */
export function analyseLens(clip: LensClip, opts: Partial<LensParams> = {}): LensAnalysis {
  const p: LensParams = { ...LENS_DEFAULTS, ...opts }
  const g = geometry(clip, p)
  const k = scratch(g.w, g.h)
  const polarity = p.polarity === 'auto' ? choosePolarity(clip, g, p, k) : p.polarity
  const sign = polarity === 'bright' ? 1 : -1

  const used: number[] = []
  // without a frame rate no speed can be measured: no frames are used, and the gate answers 'too_short'
  for (let i = 0; g.fps > 0 && i < clip.frames.length && used.length < p.maxFrames; i += g.step) used.push(i)

  const maxStep = p.maxSpeedUmS / g.fps / g.umPerPx
  const shiftR = Math.ceil(Math.max(p.maxShakeUm * 3, (p.maxDriftUmS * 2) / g.fps) / g.umPerPx) + 2
  const coarseEvery = Math.max(1, Math.floor(used.length / 8))

  let levelSum = 0
  let levelN = 0
  let glareN = 0
  const levels = new Uint32Array(256)
  let heads = 0
  let clumps = 0
  let cover = 0
  let sigmas = 0
  let coarse = 0
  let fineAtCoarse = 0
  let coarseFrames = 0
  let camX = 0
  let camY = 0
  const shifts: [number, number][] = []
  let prev: Blobs | null = null
  let lastShift: [number, number] = [0, 0]

  const live: Live[] = []
  const done: LensRawTrack[] = []

  for (let t = 0; t < used.length; t++) {
    shrink(clip.frames[used[t]], clip.width, g.f, g.w, g.h, k.img)
    for (let i = 0; i < g.w * g.h; i += 7) {
      const v = k.img[i]
      levelSum += v
      levelN++
      levels[Math.min(255, Math.max(0, Math.round(v)))]++
      if (v >= 250) glareN++
    }
    const found = headsIn(k, g, p, sign)
    heads += found.xs.length
    clumps += found.clumps
    cover += found.cover
    sigmas += found.sigma
    if (t % coarseEvery === 0) {
      coarse += coarseBlobs(k, g, p, sign)
      fineAtCoarse += found.xs.length
      coarseFrames++
    }

    // step 3: the picture's shift since the previous frame
    if (prev) {
      const sh = shiftBetween(prev.xs, prev.ys, found.xs, found.ys, shiftR, g.w, g.h)
      if (sh.support >= trustedSupport(prev.xs.length, found.xs.length)) {
        lastShift = [sh.dx, sh.dy]
        shifts.push(lastShift)
      }
      camX += lastShift[0]
      camY += lastShift[1]
    }
    prev = found

    // step 4: link detections to live tracks, closest pairs first
    const nd = found.xs.length
    const wx = new Float32Array(nd)
    const wy = new Float32Array(nd)
    for (let j = 0; j < nd; j++) {
      wx[j] = found.xs[j] - camX
      wy[j] = found.ys[j] - camY
    }
    const pd: number[] = []
    const pk: number[] = []
    const pj: number[] = []
    for (let q = 0; q < live.length; q++) {
      const tr = live[q]
      const gap = t - tr.last
      const n = tr.x.length
      const ex = tr.x[n - 1] + tr.vx * gap
      const ey = tr.y[n - 1] + tr.vy * gap
      // A head seen once may be anything up to top speed; after that, allow about twice its own speed. A still
      // head then cannot jump onto a swimmer passing a few pixels away, which in dense samples it otherwise does.
      const reach = maxStep * gap + 1.5
      const r = n === 1 ? reach : Math.min(reach, 2 * Math.hypot(tr.vx, tr.vy) * gap + 2)
      const r2 = r * r
      for (let j = 0; j < nd; j++) {
        const dx = wx[j] - ex
        if (dx > r || dx < -r) continue
        const dy = wy[j] - ey
        const d2 = dx * dx + dy * dy
        if (d2 <= r2) {
          pd.push(d2)
          pk.push(q)
          pj.push(j)
        }
      }
    }
    const order = pd.map((_, i) => i).sort((a, b) => pd[a] - pd[b])
    const takenT = new Uint8Array(live.length)
    const takenD = new Uint8Array(nd)
    for (const i of order) {
      const q = pk[i]
      const j = pj[i]
      if (takenT[q] || takenD[j]) continue
      takenT[q] = 1
      takenD[j] = 1
      const tr = live[q]
      const n = tr.x.length
      const gap = t - tr.last
      const vx = (wx[j] - tr.x[n - 1]) / gap
      const vy = (wy[j] - tr.y[n - 1]) / gap
      tr.vx = n === 1 ? vx : 0.5 * tr.vx + 0.5 * vx
      tr.vy = n === 1 ? vy : 0.5 * tr.vy + 0.5 * vy
      tr.f.push(t)
      tr.x.push(wx[j])
      tr.y.push(wy[j])
      tr.cx.push(found.xs[j])
      tr.cy.push(found.ys[j])
      tr.last = t
    }
    for (let q = live.length - 1; q >= 0; q--) {
      if (!takenT[q] && t - live[q].last > p.maxGapFrames) {
        const [tr] = live.splice(q, 1)
        done.push({ f: tr.f, x: tr.x, y: tr.y, cx: tr.cx, cy: tr.cy })
      }
    }
    for (let j = 0; j < nd; j++) {
      if (!takenD[j]) live.push({ f: [t], x: [wx[j]], y: [wy[j]], cx: [found.xs[j]], cy: [found.ys[j]], vx: 0, vy: 0, last: t })
    }
  }
  for (const tr of live) done.push({ f: tr.f, x: tr.x, y: tr.y, cx: tr.cx, cy: tr.cy })

  // drift and shake of the picture, from the trusted shifts
  let driftUmS = 0
  let shakeUm = 0
  if (shifts.length > 0) {
    const mx = median(shifts.map((s) => s[0]))
    const my = median(shifts.map((s) => s[1]))
    driftUmS = Math.hypot(mx, my) * g.fps * g.umPerPx
    shakeUm = quantile(
      shifts.map((s) => Math.hypot(s[0] - mx, s[1] - my)),
      0.9,
    ) * g.umPerPx
  }
  let p99 = 0
  for (let v = 0, acc = 0; v < 256; v++) {
    acc += levels[v]
    if (acc >= 0.99 * levelN) {
      p99 = v
      break
    }
  }
  const frames = used.length
  const areaPx = Math.max(1, (g.w - 2 * g.margin) * (g.h - 2 * g.margin))
  return {
    fps: g.fps,
    frames,
    seconds: g.fps > 0 ? frames / g.fps : 0,
    width: g.w,
    height: g.h,
    scale: g.f,
    umPerPx: g.umPerPx,
    polarity,
    meanLevel: levelN ? levelSum / levelN : 0,
    p99Level: p99,
    glare: levelN ? glareN / levelN : 0,
    cellsPerFrame: frames ? heads / frames : 0,
    areaUm2: areaPx * g.umPerPx * g.umPerPx,
    clumpFraction: heads + clumps > 0 ? clumps / (heads + clumps) : 0,
    clumpsPerFrame: frames ? clumps / frames : 0,
    coverage: frames ? cover / frames / areaPx : 0,
    texture: frames && levelSum > 0 ? sigmas / frames / (levelSum / levelN) : 0,
    sharpShare: coarse > 0 ? fineAtCoarse / coarse : 1,
    coarsePerFrame: coarseFrames ? coarse / coarseFrames : 0,
    driftUmS,
    shakeUm,
    tracks: done,
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Steps 5-6: per-track speeds, classes, shares and the quality gate
// ---------------------------------------------------------------------------------------------------------------

export interface LensKinematics {
  /** Frames from first to last sighting, inclusive: the track's weight. */
  span: number
  /** Speed along the smoothed path, µm/s: the median over `windowS` windows (whole track if shorter). */
  vap: number
  /** Net distance covered per second, µm/s: the median over `windowS` windows (whole track if shorter). */
  progression: number
  /** Net distance from first to last point per second, µm/s. */
  vsl: number
}

/**
 * Speeds of one track (see step 5 above). Distances in the track are working pixels, with the picture's shift removed.
 * Medians over 1 s windows rather than whole-track averages: when a swimmer passes over a still head, the still
 * head's track can jump for a few frames, and an average would count that jump as the head's own movement.
 */
export function trackKinematics(tr: LensRawTrack, fps: number, umPerPx: number, smoothS: number, windowS: number): LensKinematics {
  const n = tr.f.length
  const span = tr.f[n - 1] - tr.f[0] + 1
  if (n < 2) return { span, vap: 0, progression: 0, vsl: 0 }
  const half = Math.max(1, Math.round((smoothS * fps) / 2))
  const sx = new Float64Array(n)
  const sy = new Float64Array(n)
  const cx = new Float64Array(n + 1)
  const cy = new Float64Array(n + 1)
  for (let i = 0; i < n; i++) {
    cx[i + 1] = cx[i] + tr.x[i]
    cy[i + 1] = cy[i] + tr.y[i]
  }
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - half)
    const b = Math.min(n, i + half + 1)
    sx[i] = (cx[b] - cx[a]) / (b - a)
    sy[i] = (cy[b] - cy[a]) / (b - a)
  }
  // path length along the smoothed track, cumulative
  const along = new Float64Array(n)
  for (let i = 1; i < n; i++) along[i] = along[i - 1] + Math.hypot(sx[i] - sx[i - 1], sy[i] - sy[i - 1])
  const seconds = (tr.f[n - 1] - tr.f[0]) / fps
  const net = Math.hypot(sx[n - 1] - sx[0], sy[n - 1] - sy[0])
  const win = Math.max(2, Math.round(windowS * fps))
  let vap = along[n - 1] / seconds
  let progression = net / seconds
  if (tr.f[n - 1] - tr.f[0] >= win) {
    const paths: number[] = []
    const chords: number[] = []
    let j = 0
    for (let i = 0; i < n; i++) {
      while (j < n && tr.f[j] - tr.f[i] < win) j++
      if (j >= n) break
      const dt = (tr.f[j] - tr.f[i]) / fps
      paths.push((along[j] - along[i]) / dt)
      chords.push(Math.hypot(sx[j] - sx[i], sy[j] - sy[i]) / dt)
    }
    vap = median(paths)
    progression = median(chords)
  }
  return { span, vap: vap * umPerPx, progression: progression * umPerPx, vsl: (net / seconds) * umPerPx }
}

export function classifyTrack(kin: LensKinematics, p: Pick<LensParams, 'progressiveUmS' | 'motileUmS'>): LensKind {
  if (kin.progression >= p.progressiveUmS) return 'progressive'
  if (kin.vap >= p.motileUmS) return 'non_progressive'
  return 'immotile'
}

/** Turns the measurements into shares, the quality verdict and overlay tracks. Cheap: can be re-run with other cut-offs. */
export function summariseLens(a: LensAnalysis, opts: Partial<LensParams> = {}): LensResult {
  const p: LensParams = { ...LENS_DEFAULTS, ...opts }
  const minSpan = Math.max(3, Math.round(p.minTrackS * a.fps))
  const weight: Record<LensKind, number> = { progressive: 0, non_progressive: 0, immotile: 0 }
  const kept: { tr: LensRawTrack; kind: LensKind; span: number }[] = []
  for (const tr of a.tracks) {
    if (tr.f[tr.f.length - 1] - tr.f[0] + 1 < minSpan) continue
    const kin = trackKinematics(tr, a.fps, a.umPerPx, p.smoothS, p.windowS)
    const kind = classifyTrack(kin, p)
    weight[kind] += kin.span
    kept.push({ tr, kind, span: kin.span })
  }
  const total = weight.progressive + weight.non_progressive + weight.immotile
  let progressive = total ? (100 * weight.progressive) / total : 0
  let motile = total ? (100 * (weight.progressive + weight.non_progressive)) / total : 0
  if (p.calibration && total) {
    const [ma, mb] = p.calibration.motile
    const [pa, pb] = p.calibration.progressive
    motile = clamp(ma + mb * motile, 0, 100)
    progressive = clamp(pa + pb * progressive, 0, motile)
  }

  const issues: LensIssue[] = []
  if (a.seconds < p.minSeconds || a.frames < 10) issues.push('too_short')
  if (a.p99Level < p.darkLevel) issues.push('too_dark')
  if (a.meanLevel > p.brightMean || a.glare > p.glareFraction) issues.push('too_bright')
  const density = (a.cellsPerFrame / a.areaUm2) * 10_000
  const clumped = a.clumpFraction > p.maxClumpFraction && a.clumpsPerFrame >= p.minCellsPerFrame
  const crowded = density > p.maxCellsPer10kUm2 || clumped || a.coverage > p.maxCoverage || a.texture > p.maxTexture
  if (crowded) issues.push('too_crowded')
  if (a.coarsePerFrame >= 2 * p.minCellsPerFrame && a.sharpShare < p.minSharpShare) issues.push('blurry')
  if (!crowded && (a.cellsPerFrame < p.minCellsPerFrame || kept.length < p.minTracked)) issues.push('too_few_cells')
  if (a.driftUmS > p.maxDriftUmS || a.shakeUm > p.maxShakeUm) issues.push('unstable')
  // nothing was analysed (no frames, or no frame rate): the only honest reason is that there is no video to judge
  if (a.frames === 0) issues.splice(0, issues.length, 'too_short')

  const tracks: LensTrack[] = kept
    .sort((x, y) => y.span - x.span)
    .slice(0, p.maxOverlayTracks)
    .map(({ tr, kind }) => {
      const stride = Math.max(1, Math.ceil(tr.cx.length / 32))
      const points: [number, number][] = []
      for (let i = 0; i < tr.cx.length; i += stride) points.push(toClip(tr.cx[i], tr.cy[i], a.scale))
      if ((tr.cx.length - 1) % stride !== 0) points.push(toClip(tr.cx[tr.cx.length - 1], tr.cy[tr.cy.length - 1], a.scale))
      return { points, kind }
    })

  return {
    ok: issues.length === 0,
    issues,
    motilePct: round1(motile),
    progressivePct: round1(progressive),
    nonProgressivePct: round1(motile - progressive),
    immotilePct: round1(total ? 100 - motile : 0),
    cellsPerFrame: round1(a.cellsPerFrame),
    tracked: kept.length,
    tracks,
  }
}

/** The whole estimate: analyse the clip, classify the tracks, apply the quality gate. */
export function estimateMotility(clip: LensClip, opts: Partial<LensParams> = {}): LensResult {
  const t0 = now()
  const result = summariseLens(analyseLens(clip, opts), opts)
  result.ms = Math.round(now() - t0)
  return result
}

// ---------------------------------------------------------------------------------------------------------------

function toClip(x: number, y: number, scale: number): [number, number] {
  return [Math.round(((x + 0.5) * scale - 0.5) * 10) / 10, Math.round(((y + 0.5) * scale - 0.5) * 10) / 10]
}

function median(xs: number[]): number {
  return quantile(xs, 0.5)
}

function quantile(xs: number[], q: number): number {
  if (xs.length === 0) return 0
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor(q * s.length))]
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const round1 = (v: number) => Math.round(v * 10) / 10
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())
