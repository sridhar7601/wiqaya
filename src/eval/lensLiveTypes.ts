import type { LensIssue } from '../lib/lens/motility'

/** Agreement with the lab on a set of clips. `r` is Pearson's correlation (null for a constant prediction). */
export interface LensLiveMetric {
  n: number
  /** Mean absolute error, percentage points. */
  mae: number
  r: number | null
}

export interface LensLiveTargets {
  motile: LensLiveMetric
  progressive: LensLiveMetric
}

/**
 * Agreement at a WHO 2021 lower reference limit (total motility 42%, progressive 30%): of the samples the lab put
 * below the limit, how many the estimate also put below it, and how many samples at or above it were called below.
 */
export interface LensLiveScreen {
  limit: number
  below: number
  caught: number
  above: number
  aboveCalledBelow: number
}

export interface LensLiveRow {
  /** VISEM participant ID. */
  id: number
  split: 'train' | 'test'
  /** Where the clip came from: a 30 s clip from VISEM-Tracking, or the start of the original VISEM video. */
  source: 'VISEM-Tracking' | 'VISEM'
  /** The lab's semen analysis for this participant (WHO method, whole sample). Concentration in million/mL. */
  lab: { motile: number; progressive: number; nonProgressive: number; immotile: number; concentration: number }
  /** Shares as measured, before the straight-line correction. */
  raw: { motile: number; progressive: number }
  /** What the app would show after the correction (only shown to a person when ok). */
  est: { motile: number; progressive: number; nonProgressive: number; immotile: number }
  cellsPerFrame: number
  tracked: number
  ok: boolean
  issues: LensIssue[]
  ms: number
  /** A second, later clip of the same sample, analysed the same way (null when there is none). */
  retest: { ok: boolean; motile: number; progressive: number } | null
}

export interface LensLiveReport {
  runAt: string
  dataset: string
  licence: string
  url: string
  /** What was analysed from each video. */
  clips: string
  /** How participants were split into training and held-out test sets. */
  split: string
  nTrain: number
  nTest: number
  /** Clips the quality gate refused (no numbers shown). */
  refused: { train: number; test: number; rate: number }
  /** Cut-offs chosen on the training set only (leave-one-out error), and the correction fitted on it. */
  tuned: { progressiveUmS: number; motileUmS: number; minTrackS: number }
  calibration: { motile: [number, number]; progressive: [number, number] }
  /** Held-out participants, clips the gate accepted. */
  test: {
    raw: LensLiveTargets
    calibrated: LensLiveTargets
    /** Always answering the training-set average. */
    baseline: LensLiveTargets
    /** Spearman correlation of heads per frame with the lab's concentration. */
    concentration: { n: number; spearman: number | null }
    /** Same, if the gate's verdict were ignored (all held-out clips). */
    ignoringGate: LensLiveTargets
    /** Mean of the first and the second clip, where both passed the gate. */
    twoClips: LensLiveTargets
    /** First clip against second clip of the same sample: how much a single 10 s look varies. */
    retest: LensLiveTargets
    /** Below / above the WHO lower reference limits, measured and corrected. */
    who: { motile: { raw: LensLiveScreen; calibrated: LensLiveScreen }; progressive: { raw: LensLiveScreen; calibrated: LensLiveScreen } }
  }
  /** Same measures on the training participants (in-sample: optimistic). */
  train: { calibrated: LensLiveTargets; baseline: LensLiveTargets; concentration: { n: number; spearman: number | null } }
  /** Heads found per frame against the annotated sperm count per frame (VISEM-Tracking's 20 annotated clips). */
  detection: { videos: number; spearman: number | null; ratio: number } | null
  medianMs: number
  rows: LensLiveRow[]
}
