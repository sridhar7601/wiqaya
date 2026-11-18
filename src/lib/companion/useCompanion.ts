import { useEffect, useMemo } from 'react'
import type { Review } from '../referral'
import { useStored } from '../storage'
import type { Answers } from '../types'
import { sexOf } from '../types'
import type { CheckIn } from './checkins'
import type { Day } from './dates'
import { today as todayOf } from './dates'
import type { WorkProfile } from './exposures'
import type { JourneyStep } from './journey'
import { applyReply, syncJourney } from './journey'
import type { LabEntry } from './labs'
import type { DailySignal } from './trends'
import { companionView } from './view'

export interface StoredReply {
  reply: Review
  receivedAt: string
  shareId?: string
}

export interface SignalsSource {
  kind: 'apple-health' | 'example'
  importedAt: string
}

/** Adds a doctor's reply once (replies are identified by their time). */
export function addReply(list: StoredReply[], reply: Review, shareId?: string): StoredReply[] {
  return list.some((r) => r.reply.at === reply.at) ? list : [...list, { reply, receivedAt: new Date().toISOString(), shareId }]
}

/**
 * Everything the companion screens need, from the device's own storage, plus the derived picture.
 * It also keeps the care journey in step with the rules and with the doctor's replies.
 */
export function useCompanion() {
  const [answers] = useStored<Answers>('answers', {})
  const [labs, setLabs] = useStored<LabEntry[]>('labs', [])
  const [checkins, setCheckins] = useStored<CheckIn[]>('checkins', [])
  const [signals, setSignals] = useStored<DailySignal[]>('signals', [])
  const [signalsSource, setSignalsSource] = useStored<SignalsSource | null>('signalsSource', null)
  const [work, setWork] = useStored<WorkProfile | null>('work', null)
  const [replies, setReplies] = useStored<StoredReply[]>('replies', [])
  const [journey, setJourney] = useStored<JourneyStep[]>('journey', [])
  const [planStart, setPlanStart] = useStored<Day | null>('planStart', null)
  const today = todayOf()

  const hasCheck = typeof answers.age === 'number' && answers.age >= 18
  const active = hasCheck || labs.length > 0 || checkins.length > 0

  const view = useMemo(
    () => companionView({ answers, labs, checkins, signals, work, replies, journey, planStart, today }),
    [answers, labs, checkins, signals, work, replies, journey, planStart, today],
  )

  // Keep the journey's rule steps in line with the current picture, and add the doctor's steps once.
  useEffect(() => {
    if (!active) return
    const now = new Date().toISOString()
    let next = syncJourney(journey, view.desired, now, sexOf(answers))
    for (const r of replies) next = applyReply(next, r.reply, today, now)
    if (JSON.stringify(next) !== JSON.stringify(journey)) setJourney(next)
  }, [active, journey, view.desired, replies, today, setJourney, answers])

  // The plan starts the first time the companion is used after a check.
  useEffect(() => {
    if (active && !planStart) setPlanStart(today)
  }, [active, planStart, today, setPlanStart])

  return { answers, labs, setLabs, checkins, setCheckins, signals, setSignals, signalsSource, setSignalsSource, work, setWork, replies, setReplies, journey, setJourney, planStart, view, today, hasCheck, active }
}
