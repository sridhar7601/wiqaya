export type Lang = 'en' | 'ar'
export type L10n = { en: string; ar: string }

export type AnswerValue = string | string[] | number
export type Answers = Record<string, AnswerValue | undefined>

/**
 * Who the check is for. Saved checks from before this question existed have no answer, and were all men's
 * checks, so a missing answer means 'male'.
 */
export type Sex = 'male' | 'female'
export const sexOf = (a: Answers): Sex => (a.sex === 'female' ? 'female' : 'male')

/**
 * The choices the challenge names besides the care level itself. A finding can point to one of them; the
 * care journey then offers it as a step. None of them is a diagnosis or a treatment.
 */
export type CareOption = 'counselling' | 'preservation' | 'testing'

/** Triage levels, lowest to highest. These are the five next steps named in the challenge statement. */
export type Level = 'selfcare' | 'primary' | 'fertility' | 'specialist' | 'urgent'
export const LEVELS: Level[] = ['selfcare', 'primary', 'fertility', 'specialist', 'urgent']
export const LEVEL_RANK: Record<Level, number> = {
  selfcare: 0,
  primary: 1,
  fertility: 2,
  specialist: 3,
  urgent: 4,
}

/** Risk-input categories from the challenge statement, plus a few practical extras. */
export type Category =
  | 'urgent'
  | 'history'
  | 'lifestyle'
  | 'metabolic'
  | 'infectious'
  | 'anatomical'
  | 'test'
  | 'sexual'
  | 'screening'
  | 'family'

export interface FiredFlag {
  id: string
  category: Category
  /** 'info' flags are shown and shared but never change the next step. */
  level: Level | 'info'
  emergency: boolean
  /** True when the person can change it (habits) or it is commonly treatable. */
  changeable: boolean
  title: L10n
  why: L10n
  action: L10n
  /** The person's own answers that triggered this flag. */
  because: L10n[]
  sources: string[]
  /** A choice this finding opens: preconception counselling, a fertility-preservation discussion, or a test. */
  option?: CareOption
}

export interface DataIssue {
  id: string
  field: string
  kind: 'missing' | 'implausible' | 'inconsistent'
  message: L10n
}

export interface Assessment {
  engineVersion: string
  /** Whose check this is: decides which questions, rules and wording applied. */
  sex: Sex
  eligible: boolean
  level: Level
  emergency: boolean
  flags: FiredFlag[]
  dataIssues: DataIssue[]
  /** Question ids the person chose not to answer. Shared with a clinician only if the person agrees. */
  declined: string[]
  bmi?: number
  /** Routine adult screening is overdue or unknown, which feeds the heart and diabetes screening nudge. */
  screeningDue: boolean
}
