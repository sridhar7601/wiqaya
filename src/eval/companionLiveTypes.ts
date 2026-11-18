/** Live test of the companion AI features (grounded answers, care search, visit preparation). */
export interface CompanionLiveCase {
  id: string
  kind: 'ask' | 'search' | 'prep'
  lang: 'en' | 'ar'
  input: string
  ms: number
  /** What happened: pass, no_note, uncited, blocked, trimmed, emergency_prefilter, not_sent, ... */
  outcome: string
  checks: Record<string, boolean>
  pass: boolean
  /** The answer, the filters, or the preparation, as shown to the person. */
  output: string
  cited?: string[]
}

export interface CompanionLiveReport {
  runAt: string
  deployment: string
  n: number
  passed: number
  medianMs: number
  byKind: Record<'ask' | 'search' | 'prep', { n: number; passed: number }>
  cases: CompanionLiveCase[]
}
