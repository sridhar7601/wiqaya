// Real-video check of Wiqaya Lens against lab semen analyses. Skipped unless LENS_EVAL=1.
// Run: LENS_EVAL=1 LENS_VISEM_DIR=/path/to/visem npx vitest run infra/lens/visem-eval.test.ts --silent=false
// (--silent=false shows the per-clip lines). Needs ffmpeg and ffprobe on the PATH. Takes about 3 minutes.
// Writes src/eval/lensLive.generated.ts for the /evaluation page.
//
// Data (not in the repo, about 1.9 GB), all from Simula/OsloMet, laid out under $LENS_VISEM_DIR:
//   clips/pNN_a.mp4   the first 30 s of participant NN's video. From VISEM-Tracking (Zenodo 7293726, CC BY 4.0):
//                     VISEM_Tracking_Train_v4/Train/NN/NN.mp4 for the 20 annotated videos, otherwise
//                     visem-extracted-30s-excluding-selected-20/NN_0_30.mp4.
//   clips/pNN_a.avi   for the 8 participants VISEM-Tracking leaves out (2, 7, 8, 9, 10, 41, 42, 46): the first
//                     56 MB (about 30 s) of the original MJPEG video from VISEM (Zenodo 2640506, CC BY-NC 4.0).
//   clips/pNN_b.mp4   a later 30 s clip of the same sample (VISEM-Tracking, 60-90 s, or the nearest of 90-120,
//                     30-60, 120-150 s): used only to see how much one look varies.
//   labels/semen_analysis_data.csv        VISEM's lab results (semicolon-separated, decimal comma).
//   labels/sperm_counts_per_frame.csv     optional, VISEM-Tracking's annotated sperm count per frame.
// The zip files are 6.3 and 35 GB, but they allow HTTP range requests, so single entries can be fetched.
//
// Honest-evaluation rules followed here:
// - The split is by participant and was fixed before any tuning: test = ID ending in 1, 4 or 7. Participants 1,
//   11, 14 and 31 were looked at while developing the estimator, so they were moved to training; 22 remain held out.
// - Everything learned from data uses training participants only: the head-detection limits in LENS_DEFAULTS
//   (from VISEM-Tracking boxes on 16 training videos), the two speed cut-offs (grid search below, scored by
//   leave-one-out error) and the straight-line correction (least squares below).
// - Held-out clips are analysed once, with the final settings; their lab values are used only to score.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { LensLiveMetric, LensLiveReport, LensLiveRow, LensLiveScreen, LensLiveTargets } from '../../src/eval/lensLiveTypes'
import { analyseLens, LENS_DEFAULTS, summariseLens } from '../../src/lib/lens/motility'
import type { LensAnalysis, LensClip, LensParams } from '../../src/lib/lens/motility'

const DIR = process.env.LENS_VISEM_DIR ?? ''
const SECONDS = 10
const WIDTH = 320
const HEIGHT = 240
const INSPECTED = [1, 11, 14, 31]
const isTest = (id: number) => [1, 4, 7].includes(id % 10) && !INSPECTED.includes(id)

interface Lab {
  motile: number
  progressive: number
  nonProgressive: number
  immotile: number
  concentration: number
}

function readLab(file: string): Map<number, Lab> {
  const out = new Map<number, Lab>()
  const num = (s: string) => Number(s.replace(',', '.'))
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/).slice(1)) {
    const c = line.split(';')
    if (c.length < 14 || !/^\d+$/.test(c[0].replace(/^﻿/, ''))) continue
    const progressive = num(c[11])
    const nonProgressive = num(c[12])
    const immotile = num(c[13])
    out.set(Number(c[0]), { motile: progressive + nonProgressive, progressive, nonProgressive, immotile, concentration: num(c[1]) })
  }
  return out
}

/** First 10 s, every second frame (about 25 per second), 320 x 240 greyscale: what a phone would hand over. */
function decode(file: string): LensClip {
  const rate = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=r_frame_rate', '-of', 'csv=p=0', file]).toString().trim()
  const [a, b] = rate.split('/').map(Number)
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-t', String(SECONDS), '-i', file, '-vf', `select='not(mod(n\\,2))',scale=${WIDTH}:${HEIGHT}:flags=area,format=gray`, '-fps_mode', 'passthrough', '-f', 'rawvideo', '-'], { maxBuffer: 1 << 28 })
  const size = WIDTH * HEIGHT
  const frames: Uint8Array[] = []
  for (let i = 0; i + size <= raw.length; i += size) frames.push(new Uint8Array(raw.buffer, raw.byteOffset + i, size))
  return { width: WIDTH, height: HEIGHT, fps: a / (b || 1) / 2, frames }
}

// ---- statistics ----
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length
function pearson(x: number[], y: number[]): number | null {
  if (x.length < 3) return null
  const mx = mean(x)
  const my = mean(y)
  let sxy = 0
  let sxx = 0
  let syy = 0
  for (let i = 0; i < x.length; i++) {
    sxy += (x[i] - mx) * (y[i] - my)
    sxx += (x[i] - mx) ** 2
    syy += (y[i] - my) ** 2
  }
  return sxx > 0 && syy > 0 ? round(sxy / Math.sqrt(sxx * syy), 3) : null
}
function ranks(x: number[]): number[] {
  const order = x.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0])
  const r = new Array<number>(x.length)
  for (let k = 0; k < order.length; ) {
    let j = k
    while (j + 1 < order.length && order[j + 1][0] === order[k][0]) j++
    for (let q = k; q <= j; q++) r[order[q][1]] = (k + j) / 2
    k = j + 1
  }
  return r
}
const spearman = (x: number[], y: number[]) => pearson(ranks(x), ranks(y))
const metric = (pred: number[], truth: number[]): LensLiveMetric => ({
  n: pred.length,
  mae: pred.length ? round(mean(pred.map((p, i) => Math.abs(p - truth[i]))), 1) : NaN,
  r: pearson(pred, truth),
})
/** Least-squares line y = a + b x. */
function fitLine(x: number[], y: number[]): [number, number] {
  const mx = mean(x)
  const my = mean(y)
  let sxy = 0
  let sxx = 0
  for (let i = 0; i < x.length; i++) {
    sxy += (x[i] - mx) * (y[i] - my)
    sxx += (x[i] - mx) ** 2
  }
  const b = sxx > 0 ? sxy / sxx : 0
  return [my - b * mx, b]
}
/** Leave-one-out mean absolute error of the straight-line correction. */
function looMae(x: number[], y: number[]): number {
  let s = 0
  for (let i = 0; i < x.length; i++) {
    const [a, b] = fitLine(
      x.filter((_, j) => j !== i),
      y.filter((_, j) => j !== i),
    )
    s += Math.abs(clamp(a + b * x[i], 0, 100) - y[i])
  }
  return s / x.length
}
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const round = (v: number, d = 1) => Math.round(v * 10 ** d) / 10 ** d

interface Clip {
  id: number
  part: 'a' | 'b'
  source: LensLiveRow['source']
  analysis: LensAnalysis
  ms: number
}

describe.skipIf(!process.env.LENS_EVAL)('Wiqaya Lens on VISEM videos, against the lab', () => {
  it(
    'tunes on training participants only and scores the held-out ones',
    () => {
      expect(existsSync(`${DIR}/clips`), 'set LENS_VISEM_DIR to the folder with clips/ and labels/').toBe(true)
      const lab = readLab(`${DIR}/labels/semen_analysis_data.csv`)
      const files = readdirSync(`${DIR}/clips`).filter((f) => /^p\d+_[ab]\.(mp4|avi)$/.test(f)).sort()

      // 1. Detection, shift measurement and linking, once per clip with the fixed settings (the slow part).
      const clips: Clip[] = []
      for (const f of files) {
        const id = Number(f.slice(1, f.indexOf('_')))
        if (!lab.has(id)) continue
        const clip = decode(`${DIR}/clips/${f}`)
        const t0 = performance.now()
        const analysis = analyseLens(clip)
        summariseLens(analysis) // timed as the app runs it: analysis plus summary
        const ms = Math.round(performance.now() - t0)
        clips.push({ id, part: f.includes('_a.') ? 'a' : 'b', source: f.endsWith('.avi') ? 'VISEM' : 'VISEM-Tracking', analysis, ms })
      }
      const first = clips.filter((c) => c.part === 'a')
      const second = new Map(clips.filter((c) => c.part === 'b').map((c) => [c.id, c]))
      const train = first.filter((c) => !isTest(c.id))
      // The gate does not depend on the two cut-offs tuned below, so which clips pass is settled here.
      const passes = (c: Clip) => summariseLens(c.analysis).ok
      const trainOk = train.filter(passes)

      // 2. Tune the two speed cut-offs on training clips: leave-one-out error after the straight-line correction.
      let best = { score: Infinity, progressiveUmS: LENS_DEFAULTS.progressiveUmS, motileUmS: LENS_DEFAULTS.motileUmS }
      for (const progressiveUmS of [5, 8, 10, 12, 15, 20, 25]) {
        for (const motileUmS of [3, 4, 5, 6, 8, 10]) {
          const opts: Partial<LensParams> = { progressiveUmS, motileUmS, calibration: null }
          const est = trainOk.map((c) => summariseLens(c.analysis, opts))
          const score =
            looMae(
              est.map((e) => e.motilePct),
              trainOk.map((c) => lab.get(c.id)!.motile),
            ) +
            looMae(
              est.map((e) => e.progressivePct),
              trainOk.map((c) => lab.get(c.id)!.progressive),
            )
          if (score < best.score - 1e-9) best = { score, progressiveUmS, motileUmS }
        }
      }
      const tuned: Partial<LensParams> = { progressiveUmS: best.progressiveUmS, motileUmS: best.motileUmS, calibration: null }

      // 3. Straight-line correction fitted on the training clips.
      const rawOf = (c: Clip) => summariseLens(c.analysis, tuned)
      const trainRaw = trainOk.map(rawOf)
      const calMotile = fitLine(
        trainRaw.map((e) => e.motilePct),
        trainOk.map((c) => lab.get(c.id)!.motile),
      )
      const calProgressive = fitLine(
        trainRaw.map((e) => e.progressivePct),
        trainOk.map((c) => lab.get(c.id)!.progressive),
      )
      const final: Partial<LensParams> = {
        ...tuned,
        calibration: { motile: [round(calMotile[0], 2), round(calMotile[1], 3)], progressive: [round(calProgressive[0], 2), round(calProgressive[1], 3)], source: 'VISEM training split' },
      }

      // 4. Score. Held-out clips are summarised once, with the final settings.
      const rows: LensLiveRow[] = first
        .map((c) => {
          const raw = rawOf(c)
          const est = summariseLens(c.analysis, final)
          const b = second.get(c.id)
          const re = b ? summariseLens(b.analysis, final) : null
          const L = lab.get(c.id)!
          return {
            id: c.id,
            split: isTest(c.id) ? 'test' : 'train',
            source: c.source,
            lab: L,
            raw: { motile: raw.motilePct, progressive: raw.progressivePct },
            est: { motile: est.motilePct, progressive: est.progressivePct, nonProgressive: est.nonProgressivePct, immotile: est.immotilePct },
            cellsPerFrame: est.cellsPerFrame,
            tracked: est.tracked,
            ok: est.ok,
            issues: est.issues,
            ms: c.ms,
            retest: re ? { ok: re.ok, motile: re.motilePct, progressive: re.progressivePct } : null,
          } satisfies LensLiveRow
        })
        .sort((x, y) => x.id - y.id)

      const testRows = rows.filter((r) => r.split === 'test')
      const trainRows = rows.filter((r) => r.split === 'train')
      const okTest = testRows.filter((r) => r.ok)
      const okTrain = trainRows.filter((r) => r.ok)
      const targets = (set: LensLiveRow[], pick: (r: LensLiveRow) => { motile: number; progressive: number }): LensLiveTargets => ({
        motile: metric(
          set.map((r) => pick(r).motile),
          set.map((r) => r.lab.motile),
        ),
        progressive: metric(
          set.map((r) => pick(r).progressive),
          set.map((r) => r.lab.progressive),
        ),
      })
      const trainMean = { motile: mean(okTrain.map((r) => r.lab.motile)), progressive: mean(okTrain.map((r) => r.lab.progressive)) }
      const both = okTest.filter((r) => r.retest?.ok)
      const avg = (r: LensLiveRow) => ({ motile: (r.est.motile + r.retest!.motile) / 2, progressive: (r.est.progressive + r.retest!.progressive) / 2 })
      const retest: LensLiveTargets = {
        motile: metric(
          both.map((r) => r.retest!.motile),
          both.map((r) => r.est.motile),
        ),
        progressive: metric(
          both.map((r) => r.retest!.progressive),
          both.map((r) => r.est.progressive),
        ),
      }

      // At the WHO 2021 lower reference limits: does the estimate put the same samples below them as the lab?
      const screen = (limit: number, lab: (r: LensLiveRow) => number, est: (r: LensLiveRow) => number): LensLiveScreen => {
        const below = okTest.filter((r) => lab(r) < limit)
        const above = okTest.filter((r) => lab(r) >= limit)
        return { limit, below: below.length, caught: below.filter((r) => est(r) < limit).length, above: above.length, aboveCalledBelow: above.filter((r) => est(r) < limit).length }
      }
      const who = {
        motile: { raw: screen(42, (r) => r.lab.motile, (r) => r.raw.motile), calibrated: screen(42, (r) => r.lab.motile, (r) => r.est.motile) },
        progressive: { raw: screen(30, (r) => r.lab.progressive, (r) => r.raw.progressive), calibrated: screen(30, (r) => r.lab.progressive, (r) => r.est.progressive) },
      }

      // Heads found against VISEM-Tracking's annotated sperm count, over the same frames.
      let detection: LensLiveReport['detection'] = null
      const countsFile = `${DIR}/labels/sperm_counts_per_frame.csv`
      if (existsSync(countsFile)) {
        const perFrame = new Map<string, number>()
        for (const line of readFileSync(countsFile, 'utf8').split(/\r?\n/).slice(1)) {
          const [name, sperm] = line.split(',')
          if (name && sperm) perFrame.set(name.trim(), Number(sperm))
        }
        const ours: number[] = []
        const theirs: number[] = []
        for (const c of first) {
          const counts: number[] = []
          for (let i = 0; i < c.analysis.frames; i++) {
            const v = perFrame.get(`${c.id}_frame_${i * 2}`)
            if (v !== undefined) counts.push(v)
          }
          if (counts.length > c.analysis.frames / 2) {
            ours.push(c.analysis.cellsPerFrame)
            theirs.push(mean(counts))
          }
        }
        if (ours.length) {
          const ratios = ours.map((o, i) => o / theirs[i]).sort((a, b) => a - b)
          detection = { videos: ours.length, spearman: spearman(ours, theirs), ratio: round(ratios[ratios.length >> 1], 2) }
        }
      }

      const ms = first.map((c) => c.ms).sort((a, b) => a - b)
      const report: LensLiveReport = {
        runAt: new Date().toISOString(),
        dataset: 'VISEM (Haugen et al., MMSys 2019) and VISEM-Tracking (Thambawita et al., Scientific Data 2023), Simula/OsloMet',
        licence: 'VISEM-Tracking clips: CC BY 4.0. VISEM lab values and the 8 original videos: CC BY-NC 4.0 on Zenodo; Simula: research and education only, no commercial use without written permission.',
        url: 'https://zenodo.org/records/7293726 and https://zenodo.org/records/2640506',
        clips: `Per participant: the first ${SECONDS} s of the first 30 s of the video, every second frame (about 25 per second), ${WIDTH} x ${HEIGHT} greyscale. Lab microscope at 400x, phase contrast; not a phone.`,
        split: 'By participant, fixed before tuning: held out = ID ending in 1, 4 or 7, except 1, 11, 14 and 31, which were looked at during development and moved to training.',
        nTrain: trainRows.length,
        nTest: testRows.length,
        refused: { train: trainRows.length - okTrain.length, test: testRows.length - okTest.length, rate: round((rows.length - okTrain.length - okTest.length) / rows.length, 3) },
        tuned: { progressiveUmS: best.progressiveUmS, motileUmS: best.motileUmS, minTrackS: LENS_DEFAULTS.minTrackS },
        calibration: { motile: final.calibration!.motile, progressive: final.calibration!.progressive },
        test: {
          raw: targets(okTest, (r) => r.raw),
          calibrated: targets(okTest, (r) => r.est),
          baseline: targets(okTest, () => trainMean),
          concentration: {
            n: okTest.length,
            spearman: spearman(
              okTest.map((r) => r.cellsPerFrame),
              okTest.map((r) => r.lab.concentration),
            ),
          },
          ignoringGate: targets(testRows, (r) => r.est),
          twoClips: targets(both, avg),
          retest,
          who,
        },
        train: {
          calibrated: targets(okTrain, (r) => r.est),
          baseline: targets(okTrain, () => trainMean),
          concentration: {
            n: okTrain.length,
            spearman: spearman(
              okTrain.map((r) => r.cellsPerFrame),
              okTrain.map((r) => r.lab.concentration),
            ),
          },
        },
        detection,
        medianMs: ms[ms.length >> 1],
        rows,
      }
      writeFileSync(
        new URL('../../src/eval/lensLive.generated.ts', import.meta.url),
        `// Generated by \`LENS_EVAL=1 npx vitest run infra/lens/visem-eval.test.ts\` on ${report.runAt}. Do not edit by hand.\nimport type { LensLiveReport } from './lensLiveTypes'\n\nexport const LENS_LIVE: LensLiveReport | null = ${JSON.stringify(report, null, 2)}\n`,
      )

      for (const r of rows)
        console.log(
          `${r.split.padEnd(5)} ${String(r.id).padStart(2)} lab m${r.lab.motile} p${r.lab.progressive} c${r.lab.concentration} | raw m${r.raw.motile} p${r.raw.progressive} | est m${r.est.motile} p${r.est.progressive} | cells ${r.cellsPerFrame} tracked ${r.tracked} ${r.ok ? 'ok' : r.issues.join(',')} ${r.ms}ms` +
            (r.retest ? ` | retest m${r.retest.motile} p${r.retest.progressive} ${r.retest.ok ? 'ok' : 'refused'}` : ''),
        )
      const t = report.test
      const line = (name: string, m: LensLiveTargets) => `${name.padEnd(14)} motile MAE ${m.motile.mae} r ${m.motile.r} (n ${m.motile.n}) · progressive MAE ${m.progressive.mae} r ${m.progressive.r}`
      console.log(`tuned: progressive >= ${best.progressiveUmS} µm/s, moving >= ${best.motileUmS} µm/s; correction motile ${JSON.stringify(report.calibration.motile)} progressive ${JSON.stringify(report.calibration.progressive)}`)
      console.log(`train ${report.nTrain} (${report.refused.train} refused) · test ${report.nTest} (${report.refused.test} refused) · refusal rate ${report.refused.rate}`)
      console.log(line('test raw', t.raw))
      console.log(line('test corrected', t.calibrated))
      console.log(line('test baseline', t.baseline))
      console.log(line('test no gate', t.ignoringGate))
      console.log(line('test 2 clips', t.twoClips))
      console.log(line('retest a vs b', t.retest))
      console.log(`WHO limits on test: ${JSON.stringify(who)}`)
      console.log(`concentration Spearman test ${t.concentration.spearman} (n ${t.concentration.n}) · train ${report.train.concentration.spearman} · detection vs annotation ${JSON.stringify(detection)} · median ${report.medianMs} ms`)
      if (LENS_DEFAULTS.progressiveUmS !== best.progressiveUmS || LENS_DEFAULTS.motileUmS !== best.motileUmS || JSON.stringify(LENS_DEFAULTS.calibration?.motile) !== JSON.stringify(report.calibration.motile) || JSON.stringify(LENS_DEFAULTS.calibration?.progressive) !== JSON.stringify(report.calibration.progressive))
        console.log('NOTE: LENS_DEFAULTS differs from the values tuned here; copy them into src/lib/lens/motility.ts so the app matches this report.')

      expect(report.nTest).toBeGreaterThan(10)
      expect(okTest.length).toBeGreaterThan(0)
    },
    1_800_000,
  )
})
