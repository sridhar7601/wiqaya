import type { Lang } from './types'

/**
 * Anonymous feedback: two ratings, the time the check took and the language. Sent only when the person
 * presses "Send feedback". The server side (infra/server/feedback.mjs) accepts nothing else.
 */
const ENDPOINT = (import.meta.env.VITE_FEEDBACK_URL as string | undefined) || '/api/feedback'

export interface FeedbackTotals {
  n: number
  /** How many people gave each score, 1 to 5. */
  trust: number[]
  clarity: number[]
  avgTrust: number | null
  avgClarity: number | null
  lang: { en: number; ar: number }
  /** Responses that included how long the check took. */
  timed: number
  medianSec: number | null
  since: number | null
}

export async function sendFeedback(body: { trust: number; clarity: number; durationSec?: number; lang: Lang }): Promise<boolean> {
  try {
    const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    return res.ok
  } catch {
    return false
  }
}

export async function feedbackTotals(): Promise<FeedbackTotals | null> {
  try {
    const res = await fetch(ENDPOINT)
    if (!res.ok) return null
    const data = (await res.json()) as FeedbackTotals
    return typeof data?.n === 'number' ? data : null
  } catch {
    return null
  }
}
