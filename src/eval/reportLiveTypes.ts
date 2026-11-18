export type ReportField = 'volume_ml' | 'concentration' | 'total_motility' | 'progressive' | 'morphology'

export interface ReportLiveCase {
  id: string
  layout: string
  /** clean = screenshot, photo = tilted phone picture, dim = dark and low resolution, rough = strongly tilted, blurred and small */
  condition: 'clean' | 'photo' | 'dim' | 'rough'
  case: string
  /** Tilt in degrees that the app measured and removed before reading (0 = left as it was). */
  tilt: number
  /** null = the picture is not a semen analysis and the reader must say so */
  expect: Partial<Record<ReportField, number>> | null
  got: Partial<Record<ReportField, number>> | null
  reason?: string
  /** Fields the cross-checks marked as doubtful: the app asks the person to type them, so no wrong number is shown. */
  flagged: ReportField[]
  /** Fields read with the wrong number and NOT caught by any check: the error that matters most. */
  wrong: ReportField[]
  /** Fields printed on the report that the reader left empty: the person types them in. */
  missed: ReportField[]
  /** Fields not on the report that the reader filled in anyway. */
  invented: ReportField[]
  pass: boolean
  ms: number
}

export interface ReportLiveReport {
  runAt: string
  deployment: string
  reports: number
  fields: number
  fieldsCorrect: number
  flagged: number
  wrong: number
  missed: number
  invented: number
  negatives: number
  negativesCorrect: number
  medianMs: number
  cases: ReportLiveCase[]
}
