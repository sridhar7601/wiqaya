import type { Day } from './dates'
import { addDays, daysBetween } from './dates'
import type { LabEntry } from './labs'
import { LAB_KINDS, ofKind } from './labs'

/**
 * The 90-day window. New sperm take about 64 days to form and reach a sample (Heller & Clermont 1963;
 * Misell 2006 measured 64 ± 8 days), and regulators take one full cycle as 13 weeks (FDA 2018). So the sperm
 * in a sample today started forming about two months ago, and the effect of a habit started today is
 * best judged in a test about three months from now. One window, then a test that reflects it.
 */
export const FORMING_DAYS = 64
export const WINDOW_DAYS = 90

export interface CycleState {
  /** When this window began: the last lab semen test, or the start of the plan. */
  start: Day
  startReason: 'lab_test' | 'plan'
  /** 1 on the first day; above WINDOW_DAYS once the window is complete. */
  day: number
  end: Day
  /** A lab re-test makes sense from this date: the last test was low, or a clinician ordered one. */
  retestDue?: Day
  retestReason?: 'low_result' | 'clinician'
  /** Sperm in a sample taken today began forming around this date. */
  formingSince: Day
  /** Sperm that begin forming today will be in a sample from around this date. */
  showsFrom: Day
}

export function cycleState(labs: LabEntry[], planStart: Day | null, today: Day, orderedRetest?: Day): CycleState {
  const last = ofKind(labs, 'semen').at(-1)
  const start = last && (!planStart || last.date >= planStart) ? last.date : (planStart ?? today)
  const startReason = last && start === last.date ? 'lab_test' : 'plan'
  const lowLast = last ? LAB_KINDS.semen.fields.some((f) => f.low !== undefined && last.values[f.id] !== undefined && last.values[f.id] < f.low) : false
  let retestDue: Day | undefined
  let retestReason: CycleState['retestReason']
  if (orderedRetest) {
    retestDue = orderedRetest
    retestReason = 'clinician'
  } else if (last && lowLast) {
    retestDue = addDays(last.date, WINDOW_DAYS)
    retestReason = 'low_result'
  }
  return {
    start,
    startReason,
    day: Math.max(1, daysBetween(start, today) + 1),
    end: addDays(start, WINDOW_DAYS),
    retestDue,
    retestReason,
    formingSince: addDays(today, -FORMING_DAYS),
    showsFrom: addDays(today, FORMING_DAYS),
  }
}
