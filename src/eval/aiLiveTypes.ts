export interface AiLiveCase {
  id: string
  caseId: string
  lang: 'en' | 'ar'
  mode: 'explain' | 'ask'
  question?: string
  level: string
  emergency: boolean
  ms: number
  guardrail: string
  words: number
  checks: Record<string, boolean>
  pass: boolean
  text: string
}

export interface AiLiveReport {
  runAt: string
  deployment: string
  n: number
  passed: number
  modelCompliant: number
  medianMs: number
  cases: AiLiveCase[]
}
