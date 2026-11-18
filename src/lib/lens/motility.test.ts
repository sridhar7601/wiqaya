import { describe, expect, it } from 'vitest'
import { estimateMotility } from './motility'
import type { LensParams, LensResult } from './motility'
import { synthClip } from './synth'
import type { SynthOptions } from './synth'

// The synthetic answer is set by how the clips are made: forward swimmers at 25-70 µm/s, circlers that cover at
// most about 8 µm net in a second, and still heads. These cut-offs sit between those groups, and the lab
// correction is off, so the tests check the measuring itself (finding, linking, drift, speeds). The cut-offs and
// the correction the app ships with come from real lab videos and are scored in infra/lens/visem-eval.test.ts.
const CUTS: Partial<LensParams> = { progressiveUmS: 12, motileUmS: 5, calibration: null }
/** Allowed difference from the true share, percentage points. */
const TOL = 6

const run = (o: Partial<SynthOptions>, p: Partial<LensParams> = CUTS) => {
  const { clip, truth } = synthClip({ seconds: 4, ...o })
  return { r: estimateMotility(clip, p), truth }
}

describe('Wiqaya Lens: shares on synthetic clips with a known answer', () => {
  const cases: [string, Partial<SynthOptions>][] = [
    ['typical sample', { cells: 60, progressive: 0.45, nonProgressive: 0.15, seed: 1 }],
    ['poor motility', { cells: 50, progressive: 0.1, nonProgressive: 0.15, seed: 2 }],
    ['almost all still', { cells: 50, progressive: 0.05, nonProgressive: 0.05, seed: 3 }],
    ['dark heads on a light background', { cells: 60, progressive: 0.5, nonProgressive: 0.2, polarity: 'dark', background: 170, seed: 4 }],
    ['hand-held drift of 20 µm/s', { cells: 60, progressive: 0.4, nonProgressive: 0.2, driftUmS: [18, -9], seed: 5 }],
    ['debris and round cells around', { cells: 60, progressive: 0.4, nonProgressive: 0.15, debris: 80, roundCells: 10, seed: 7 }],
  ]
  it.each(cases)(`recovers the shares within ±${TOL} points: %s`, (_name, o) => {
    const { r, truth } = run(o)
    expect(r.ok, r.issues.join(',')).toBe(true)
    expect(Math.abs(r.motilePct - truth.motilePct)).toBeLessThanOrEqual(TOL)
    expect(Math.abs(r.progressivePct - truth.progressivePct)).toBeLessThanOrEqual(TOL)
    expect(Math.abs(r.immotilePct - truth.immotilePct)).toBeLessThanOrEqual(TOL)
    expect(r.motilePct + r.immotilePct).toBeCloseTo(100, 0)
    expect(r.progressivePct + r.nonProgressivePct).toBeCloseTo(r.motilePct, 0)
  })

  it('works on larger frames too (640 x 480 is shrunk to 320 x 240 first)', () => {
    const { r, truth } = run({ width: 640, height: 480, umPerPx: 0.5, cells: 60, progressive: 0.45, nonProgressive: 0.15, seconds: 4, seed: 8 }, CUTS)
    expect(r.ok, r.issues.join(',')).toBe(true)
    expect(Math.abs(r.motilePct - truth.motilePct)).toBeLessThanOrEqual(TOL)
    expect(Math.abs(r.progressivePct - truth.progressivePct)).toBeLessThanOrEqual(TOL)
    // overlay points are in the clip's own pixels
    expect(r.tracks.every((t) => t.points.every(([x, y]) => x >= 0 && y >= 0 && x < 640 && y < 480))).toBe(true)
  })
})

describe('Wiqaya Lens: a moving camera is not a moving sperm', () => {
  it('a still field filmed with a drifting phone is reported as still', () => {
    const { r } = run({ cells: 60, progressive: 0, nonProgressive: 0, driftUmS: [20, -10], seed: 6 })
    expect(r.ok, r.issues.join(',')).toBe(true)
    expect(r.motilePct).toBeLessThanOrEqual(3)
  })
})

describe('Wiqaya Lens: quality gate (no numbers when the video cannot be judged)', () => {
  const gate = (o: Partial<SynthOptions>): LensResult => run({ seconds: 4, ...o }).r
  it('refuses an empty field', () => {
    const r = gate({ cells: 0, seed: 9 })
    expect(r.ok).toBe(false)
    expect(r.issues).toContain('too_few_cells')
  })
  it('refuses a dark clip', () => {
    const r = gate({ cells: 60, background: 10, contrast: 6, noise: 2, seed: 10 })
    expect(r.ok).toBe(false)
    expect(r.issues).toContain('too_dark')
  })
  it('refuses an over-crowded field', () => {
    // a smaller frame packed as densely as 2,000 heads in 320 x 240, to keep the test quick
    const r = gate({ width: 200, height: 150, cells: 800, seed: 11 })
    expect(r.ok).toBe(false)
    expect(r.issues).toContain('too_crowded')
  })
  it('refuses a blurred clip', () => {
    const r = gate({ cells: 60, blurPx: 3, seed: 12 })
    expect(r.ok).toBe(false)
    expect(r.issues).toContain('blurry')
  })
  it('refuses a shaking camera', () => {
    const r = gate({ cells: 60, shakeUm: 6, seed: 13 })
    expect(r.ok).toBe(false)
    expect(r.issues).toContain('unstable')
  })
  it('refuses a clip that is too short', () => {
    const r = gate({ cells: 60, seconds: 1.5, seed: 14 })
    expect(r.ok).toBe(false)
    expect(r.issues).toContain('too_short')
  })
})

describe('Wiqaya Lens: same input, same answer', () => {
  it('the generator and the estimator are deterministic', () => {
    const a = synthClip({ seconds: 3, seed: 42 })
    const b = synthClip({ seconds: 3, seed: 42 })
    expect(a.clip.frames.length).toBe(b.clip.frames.length)
    expect(a.clip.frames.every((f, i) => f.every((v, j) => v === b.clip.frames[i][j]))).toBe(true)
    const timeless = (r: LensResult) => ({ ...r, ms: 0 })
    expect(timeless(estimateMotility(a.clip))).toEqual(timeless(estimateMotility(a.clip)))
    expect(synthClip({ seconds: 3, seed: 43 }).clip.frames[0]).not.toEqual(a.clip.frames[0])
  })
})
