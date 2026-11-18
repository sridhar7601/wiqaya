import { assess, num } from '../engine'
import type { Review } from '../referral'
import type { Answers, Assessment, CareOption, FiredFlag, Level } from '../types'
import { LEVEL_RANK, sexOf } from '../types'
import type { CheckIn } from './checkins'
import { byWeek } from './checkins'
import { cycleState } from './cycle'
import type { CycleState } from './cycle'
import type { Day } from './dates'
import { daysBetween } from './dates'
import type { WorkProfile } from './exposures'
import { exposureFlags, needsOccupationalHealth } from './exposures'
import type { DesiredStep, JourneyStep } from './journey'
import { desiredSteps } from './journey'
import type { LabEntry } from './labs'
import { ofKind } from './labs'
import type { DailySignal } from './trends'
import { trendFlags } from './trends'

/**
 * One picture of where the person stands, built from everything on the device: the first check, the
 * weekly check-ins, results over time, work exposures and the doctor's latest decision.
 *
 * Who decides the next step (the "clinical boundary"):
 * 1. A red flag, from the first check or any check-in in the last 7 days, always wins.
 * 2. Otherwise, a clinician's decision from the last 90 days stands. The app does not overrule it; new
 *    results since then are marked so the person can share them.
 * 3. Otherwise, the fixed rules decide.
 * The AI is not part of this at all.
 */
export interface CompanionInput {
  answers: Answers
  labs: LabEntry[]
  checkins: CheckIn[]
  signals: DailySignal[]
  work: WorkProfile | null
  replies: { reply: Review; receivedAt: string }[]
  journey: JourneyStep[]
  planStart: Day | null
  today: Day
}

export interface CompanionView {
  base: Assessment
  flags: FiredFlag[]
  rulesLevel: Level
  emergency: boolean
  level: Level
  decidedBy: 'rules' | 'clinician' | 'red_flag'
  review?: Review
  /** Results and check-ins added after the clinician's decision. */
  newSinceReview: number
  cycle: CycleState
  desired: DesiredStep[]
}

const REVIEW_VALID_DAYS = 90

function redFlagsFromCheckins(c: CompanionInput): FiredFlag[] {
  const latest = byWeek(c.checkins).find((x) => daysBetween(x.at.slice(0, 10), c.today) <= 7 && x.redFlags.length > 0)
  if (!latest) return []
  // The same red-flag rules as the first check, so a symptom means the same thing on day 1 and on day 90.
  const as = assess({ sex: sexOf(c.answers), age: num(c.answers, 'age') ?? 30, urgent_symptoms: latest.redFlags })
  return as.flags.filter((f) => f.id.startsWith('RF_')).map((f) => ({ ...f, because: [{ en: 'From your weekly check-in', ar: 'من تسجيلك الأسبوعي' }, ...f.because] }))
}

const maxLevel = (flags: FiredFlag[]): Level => flags.reduce<Level>((l, f) => (f.level !== 'info' && LEVEL_RANK[f.level] > LEVEL_RANK[l] ? f.level : l), 'selfcare')

export function companionView(c: CompanionInput): CompanionView {
  const base = assess(c.answers)
  const seen = new Set<string>()
  const flags = [...redFlagsFromCheckins(c), ...base.flags, ...trendFlags(c), ...exposureFlags(c.work, sexOf(c.answers))].filter((f) => (seen.has(f.id) ? false : (seen.add(f.id), true)))
  const rulesLevel = maxLevel(flags)
  const emergency = flags.some((f) => f.emergency)
  const review = [...c.replies].sort((a, b) => b.reply.at.localeCompare(a.reply.at))[0]?.reply
  const reviewValid = !!review && daysBetween(review.at.slice(0, 10), c.today) <= REVIEW_VALID_DAYS

  let level: Level = rulesLevel
  let decidedBy: CompanionView['decidedBy'] = 'rules'
  const redFlag = emergency || flags.some((f) => f.id.startsWith('RF_'))
  if (redFlag) {
    level = 'urgent'
    decidedBy = 'red_flag'
  } else if (reviewValid && review) {
    level = review.level
    decidedBy = 'clinician'
  }

  const newSinceReview = review
    ? c.labs.filter((l) => l.addedAt > review.at && l.source !== 'example').length + c.checkins.filter((x) => x.at > review.at).length
    : 0

  const orderedRetest = c.journey.find((s) => s.kind === 'order' && s.id.endsWith(':semen_repeat') && s.status !== 'done' && s.status !== 'skipped')?.dueBy
  const cycle = cycleState(c.labs, c.planStart, c.today, orderedRetest)
  const female = sexOf(c.answers) === 'female'
  const lastLab = female ? ofKind(c.labs, 'ovarian').at(-1) : ofKind(c.labs, 'semen').at(-1)
  const also = [...new Set(flags.filter((f) => f.level !== 'info' && LEVEL_RANK[f.level] < LEVEL_RANK[level]).map((f) => f.level as Level))].sort((a, b) => LEVEL_RANK[b] - LEVEL_RANK[a])
  const desired = desiredSteps({
    level,
    emergency,
    also,
    screeningDue: base.screeningDue || flags.some((f) => f.category === 'metabolic'),
    needsLabTest: (level === 'fertility' || level === 'specialist' || flags.some((f) => f.id === 'LT_LENS_LOW')) && (!lastLab || daysBetween(lastLab.date, c.today) > 180),
    retestDue: !female && cycle.retestDue && (!lastLab || cycle.retestDue > lastLab.date) ? cycle.retestDue : undefined,
    occupationalHealth: needsOccupationalHealth(c.work),
    options: [...new Set(flags.map((f) => f.option).filter((o): o is CareOption => !!o))],
  })

  return { base, flags, rulesLevel, emergency, level, decidedBy, review: reviewValid ? review : undefined, newSinceReview, cycle, desired }
}
