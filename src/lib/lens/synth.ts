/**
 * Synthetic microscope clips with a known answer, for testing the motility estimate without real videos.
 *
 * A clip is a field of small blobs ("heads") on a grey background. A chosen share of them swims forward, a share
 * circles on the spot, and the rest keep still; optionally the whole picture drifts or shakes (a hand-held phone),
 * the focus is soft, the light is dim, and there is debris that is not a sperm. Everything comes from a seeded
 * random generator, so the same options always give exactly the same frames.
 *
 * The field wraps around at the edges (a head that leaves on the right comes back on the left), so the number of
 * heads in view, and therefore the true shares, stay fixed for the whole clip.
 */
import type { LensClip } from './motility'

export interface SynthOptions {
  width: number
  height: number
  fps: number
  seconds: number
  /** Heads in the field. */
  cells: number
  /** Shares of the heads, 0-1; the rest are immotile. */
  progressive: number
  nonProgressive: number
  /** Scale: µm per pixel. 1 matches the estimator's default field of view (320 µm across 320 px). */
  umPerPx: number
  /** Forward swimmers' speed range, µm/s. */
  speedUmS: [number, number]
  polarity: 'bright' | 'dark'
  /** Background grey level, head contrast (grey levels at the centre) and pixel noise (standard deviation). */
  background: number
  contrast: number
  noise: number
  /** Whole-picture drift (µm/s) and random jitter per frame (µm, standard deviation). */
  driftUmS: [number, number]
  shakeUm: number
  /** Side-to-side wobble of swimming heads, µm. */
  wiggleUm: number
  /** Extra blur (Gaussian, px): soft focus. */
  blurPx: number
  /** Debris the estimator must ignore: small specks, half of the opposite polarity, half faint ones of the same. */
  debris: number
  /** Large round blobs of the same polarity (round cells, too big to be a head). */
  roundCells: number
  seed: number
}

export const SYNTH_DEFAULTS: SynthOptions = {
  width: 320,
  height: 240,
  fps: 25,
  seconds: 6,
  cells: 60,
  progressive: 0.4,
  nonProgressive: 0.15,
  umPerPx: 1,
  speedUmS: [25, 70],
  polarity: 'bright',
  background: 110,
  contrast: 70,
  noise: 4,
  driftUmS: [0, 0],
  shakeUm: 0,
  wiggleUm: 0.8,
  blurPx: 0,
  debris: 0,
  roundCells: 0,
  seed: 1,
}

/** The answer the estimator should find, in percent of the heads. */
export interface SynthTruth {
  cells: number
  progressivePct: number
  nonProgressivePct: number
  immotilePct: number
  motilePct: number
}

/** Small, fast, seeded random numbers (mulberry32). Never Math.random, so clips are reproducible. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Mover = (time: number) => [number, number]

export function synthClip(options: Partial<SynthOptions> = {}): { clip: LensClip; truth: SynthTruth } {
  const o: SynthOptions = { ...SYNTH_DEFAULTS, ...options }
  const rand = seededRandom(o.seed)
  const gauss = () => {
    const u = Math.max(1e-12, rand())
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand())
  }
  const { width: W, height: H } = o
  const worldW = W * o.umPerPx
  const worldH = H * o.umPerPx
  const nProg = Math.round(o.cells * o.progressive)
  const nNon = Math.round(o.cells * o.nonProgressive)
  const nStill = Math.max(0, o.cells - nProg - nNon)

  // movement of each head, in µm, as a function of time (s); returns position, heading is taken from the motion
  const movers: Mover[] = []
  for (let i = 0; i < nProg; i++) {
    const x0 = rand() * worldW
    const y0 = rand() * worldH
    const heading = rand() * 2 * Math.PI
    const speed = o.speedUmS[0] + rand() * (o.speedUmS[1] - o.speedUmS[0])
    const turn = gauss() * 0.3 // rad/s: gently curved paths
    const beat = 6 + rand() * 4 // Hz
    const phase = rand() * 2 * Math.PI
    movers.push((t) => {
      // position along a circular arc of curvature turn/speed, plus a sideways wobble
      const th = heading + turn * t
      const along = Math.abs(turn) < 1e-6 ? [Math.cos(heading) * speed * t, Math.sin(heading) * speed * t] : [(speed / turn) * (Math.sin(th) - Math.sin(heading)), (speed / turn) * (Math.cos(heading) - Math.cos(th))]
      const side = o.wiggleUm * Math.sin(2 * Math.PI * beat * t + phase)
      return [x0 + along[0] - Math.sin(th) * side, y0 + along[1] + Math.cos(th) * side]
    })
  }
  for (let i = 0; i < nNon; i++) {
    const x0 = rand() * worldW
    const y0 = rand() * worldH
    const radius = 2 + rand() * 2
    const omega = (4 + rand() * 5) * (rand() < 0.5 ? -1 : 1)
    const phase = rand() * 2 * Math.PI
    const wander = [gauss() * 0.5, gauss() * 0.5]
    movers.push((t) => [x0 + wander[0] * t + radius * Math.cos(omega * t + phase), y0 + wander[1] * t + radius * Math.sin(omega * t + phase)])
  }
  for (let i = 0; i < nStill; i++) {
    const x0 = rand() * worldW
    const y0 = rand() * worldH
    movers.push(() => [x0, y0])
  }
  const debris: [number, number][] = []
  for (let i = 0; i < o.debris; i++) debris.push([rand() * worldW, rand() * worldH])
  const round: [number, number][] = []
  for (let i = 0; i < o.roundCells; i++) round.push([rand() * worldW, rand() * worldH])

  // pre-made noise, looked up with a fast seeded index: per-pixel Box-Muller would dominate the run time
  const NOISE = 1 << 16
  const table = new Float32Array(NOISE)
  for (let i = 0; i < NOISE; i++) table[i] = gauss() * o.noise
  let idx = (o.seed * 2654435761) >>> 0 || 1

  // background with a mild vignette, as through a real eyepiece
  const base = new Float32Array(W * H)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (x - W / 2) / (W / 2)
      const dy = (y - H / 2) / (H / 2)
      base[y * W + x] = o.background * (1 - 0.12 * (dx * dx + dy * dy))
    }
  }
  const sign = o.polarity === 'bright' ? 1 : -1
  const frames: Uint8Array[] = []
  const n = Math.round(o.seconds * o.fps)
  const img = new Float32Array(W * H)
  const tmp = new Float32Array(W * H)
  const prevPos = movers.map((m) => m(-1 / o.fps))
  let shakeX = 0
  let shakeY = 0
  for (let f = 0; f < n; f++) {
    const t = f / o.fps
    img.set(base)
    if (o.shakeUm > 0) {
      shakeX = gauss() * o.shakeUm
      shakeY = gauss() * o.shakeUm
    }
    const camX = o.driftUmS[0] * t + shakeX
    const camY = o.driftUmS[1] * t + shakeY
    const toPx = (wx: number, wy: number): [number, number] => [mod(wx - camX, worldW) / o.umPerPx, mod(wy - camY, worldH) / o.umPerPx]
    for (let i = 0; i < movers.length; i++) {
      const pos = movers[i](t)
      const [px, py] = toPx(pos[0], pos[1])
      const hx = pos[0] - prevPos[i][0]
      const hy = pos[1] - prevPos[i][1]
      prevPos[i] = pos
      const len = Math.hypot(hx, hy)
      const ang = len > 1e-9 ? Math.atan2(hy, hx) : (i * 2.399) % (2 * Math.PI)
      // a head: an elongated Gaussian spot (with its halo about 7 x 5 µm, like VISEM heads), pointing where it goes
      blob(img, W, H, px, py, 1.8 / o.umPerPx, 1.25 / o.umPerPx, ang, sign * o.contrast)
    }
    for (let i = 0; i < debris.length; i++) {
      const [px, py] = toPx(debris[i][0], debris[i][1])
      // half are dark specks (opposite polarity), half faint specks of the heads' polarity
      if (i % 2 === 0) blob(img, W, H, px, py, 0.9 / o.umPerPx, 0.9 / o.umPerPx, 0, -sign * o.contrast * 0.8)
      else blob(img, W, H, px, py, 0.8 / o.umPerPx, 0.8 / o.umPerPx, 0, sign * o.contrast * 0.25)
    }
    for (const [rx, ry] of round) {
      const [px, py] = toPx(rx, ry)
      blob(img, W, H, px, py, 4 / o.umPerPx, 4 / o.umPerPx, 0, sign * o.contrast * 0.7)
    }
    if (o.blurPx > 0) gaussianBlur(img, tmp, W, H, o.blurPx)
    const out = new Uint8Array(W * H)
    for (let i = 0; i < W * H; i++) {
      idx ^= idx << 13
      idx ^= idx >>> 17
      idx ^= idx << 5
      idx >>>= 0
      const v = img[i] + table[idx & (NOISE - 1)]
      out[i] = v <= 0 ? 0 : v >= 255 ? 255 : Math.round(v)
    }
    frames.push(out)
  }
  const pct = (k: number) => (o.cells > 0 ? (100 * k) / o.cells : 0)
  return {
    clip: { width: W, height: H, fps: o.fps, frames },
    truth: { cells: o.cells, progressivePct: pct(nProg), nonProgressivePct: pct(nNon), immotilePct: pct(nStill), motilePct: pct(nProg + nNon) },
  }
}

/** Adds an elliptical Gaussian spot (sigmas `sa` along angle `ang`, `sb` across) of height `amp` at (cx, cy), wrapping at the edges. */
function blob(img: Float32Array, W: number, H: number, cx: number, cy: number, sa: number, sb: number, ang: number, amp: number): void {
  const reach = Math.ceil(3 * Math.max(sa, sb))
  const c = Math.cos(ang)
  const s = Math.sin(ang)
  const ia = 1 / (2 * sa * sa)
  const ib = 1 / (2 * sb * sb)
  const x0 = Math.floor(cx)
  const y0 = Math.floor(cy)
  for (let y = y0 - reach; y <= y0 + reach; y++) {
    const yy = mod(y, H)
    for (let x = x0 - reach; x <= x0 + reach; x++) {
      const dx = x - cx
      const dy = y - cy
      const u = dx * c + dy * s
      const v = -dx * s + dy * c
      const e = u * u * ia + v * v * ib
      if (e > 9) continue
      img[yy * W + mod(x, W)] += amp * Math.exp(-e)
    }
  }
}

/** Gaussian blur approximated by three box passes in each direction. */
function gaussianBlur(img: Float32Array, tmp: Float32Array, W: number, H: number, sigma: number): void {
  const r = Math.max(1, Math.round(Math.sqrt((12 * sigma * sigma) / 3 + 1) / 2))
  for (let pass = 0; pass < 3; pass++) {
    boxRows(img, tmp, W, H, r)
    boxCols(tmp, img, W, H, r)
  }
}

function boxRows(src: Float32Array, dst: Float32Array, W: number, H: number, r: number): void {
  const k = 1 / (2 * r + 1)
  for (let y = 0; y < H; y++) {
    const o = y * W
    let acc = 0
    for (let x = -r; x <= r; x++) acc += src[o + clampInt(x, W)]
    for (let x = 0; x < W; x++) {
      dst[o + x] = acc * k
      acc += src[o + clampInt(x + r + 1, W)] - src[o + clampInt(x - r, W)]
    }
  }
}

function boxCols(src: Float32Array, dst: Float32Array, W: number, H: number, r: number): void {
  const k = 1 / (2 * r + 1)
  for (let x = 0; x < W; x++) {
    let acc = 0
    for (let y = -r; y <= r; y++) acc += src[clampInt(y, H) * W + x]
    for (let y = 0; y < H; y++) {
      dst[y * W + x] = acc * k
      acc += src[clampInt(y + r + 1, H) * W + x] - src[clampInt(y - r, H) * W + x]
    }
  }
}

const clampInt = (v: number, n: number) => (v < 0 ? 0 : v >= n ? n - 1 : v)
const mod = (v: number, n: number) => ((v % n) + n) % n
