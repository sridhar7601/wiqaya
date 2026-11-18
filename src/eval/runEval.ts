import { assess } from '../lib/engine'
import type { Answers, Assessment, Level } from '../lib/types'
import { LEVEL_RANK, LEVELS } from '../lib/types'
import { ageBand, CASES, LANGS, NATIONALITY_GROUPS } from './cases'
import type { EvalCase } from './cases'

export type Outcome = Level | 'ineligible'
export const OUTCOMES: Outcome[] = ['ineligible', ...LEVELS]

export interface CaseResult {
  testCase: EvalCase
  predicted: Outcome
  emergency: boolean
  correct: boolean
  under: boolean
  over: boolean
  flagIds: string[]
  dataIssueIds: string[]
}

const outcomeOf = (as: Assessment): Outcome => (as.eligible ? as.level : 'ineligible')
const rank = (o: Outcome) => (o === 'ineligible' ? -1 : LEVEL_RANK[o])
const isRedFlag = (id: string) => id.startsWith('RF_')

export function runCase(k: EvalCase): CaseResult {
  const as = assess(k.answers)
  const predicted = outcomeOf(as)
  return {
    testCase: k,
    predicted,
    emergency: as.emergency,
    correct: predicted === k.expected && (k.expectEmergency === undefined || k.expectEmergency === as.emergency),
    under: rank(predicted) < rank(k.expected),
    over: rank(predicted) > rank(k.expected),
    flagIds: as.flags.map((f) => f.id),
    dataIssueIds: as.dataIssues.map((d) => d.id),
  }
}

export interface EvalReport {
  n: number
  correct: number
  accuracy: number
  underTriage: CaseResult[]
  overTriage: CaseResult[]
  redFlag: { positives: number; detected: number; sensitivity: number; negatives: number; falseAlarms: number; specificity: number }
  emergency: { positives: number; detected: number; sensitivity: number }
  dataQuality: { expected: number; detected: number }
  explainability: { flags: number; withEvidence: number; withSource: number }
  confusion: Record<Outcome, Record<Outcome, number>>
  byLevel: { level: Outcome; n: number; correct: number }[]
  byAgeBand: { band: string; n: number; correct: number }[]
  counterfactual: { runs: number; changed: number; groups: number; langs: number }
  missingData: { runs: number; crashes: number; redFlagCases: number; redFlagsKept: number }
  results: CaseResult[]
}

export function runEval(cases: EvalCase[] = CASES): EvalReport {
  const results = cases.map(runCase)
  const n = results.length
  const correct = results.filter((r) => r.correct).length

  const urgentExpected = results.filter((r) => r.testCase.expected === 'urgent')
  const urgentNot = results.filter((r) => r.testCase.expected !== 'urgent')
  const emerExpected = results.filter((r) => r.testCase.expectEmergency)
  const dqExpected = results.filter((r) => r.testCase.expectDataIssue)

  const confusion = Object.fromEntries(OUTCOMES.map((e) => [e, Object.fromEntries(OUTCOMES.map((p) => [p, 0]))])) as EvalReport['confusion']
  for (const r of results) confusion[r.testCase.expected][r.predicted]++

  const byLevel = OUTCOMES.map((level) => {
    const rs = results.filter((r) => r.testCase.expected === level)
    return { level, n: rs.length, correct: rs.filter((r) => r.correct).length }
  }).filter((x) => x.n > 0)

  const bands = new Map<string, { n: number; correct: number }>()
  for (const r of results) {
    const b = ageBand(r.testCase.answers.age)
    const cur = bands.get(b) ?? { n: 0, correct: 0 }
    cur.n++
    if (r.correct) cur.correct++
    bands.set(b, cur)
  }

  // Explainability: every flag must show the answer that triggered it and at least one source.
  let flags = 0
  let withEvidence = 0
  let withSource = 0
  for (const k of cases) {
    for (const f of assess(k.answers).flags) {
      flags++
      if (f.because.length > 0) withEvidence++
      if (f.sources.length > 0) withSource++
    }
  }

  // Counterfactual fairness: changing nationality group or language must never change the result.
  let runs = 0
  let changed = 0
  for (const k of cases) {
    const base = assess(k.answers)
    const sig = JSON.stringify([outcomeOf(base), base.flags.map((f) => f.id)])
    for (const g of NATIONALITY_GROUPS) {
      for (const l of LANGS) {
        runs++
        const v = assess({ ...k.answers, _nationality: g, _lang: l })
        if (JSON.stringify([outcomeOf(v), v.flags.map((f) => f.id)]) !== sig) changed++
      }
    }
  }

  // Missing data: keep only age and the safety questions. Must not crash and must keep every red flag.
  let crashes = 0
  let redFlagCases = 0
  let redFlagsKept = 0
  for (const k of cases) {
    const baseRed = assess(k.answers).flags.filter((f) => isRedFlag(f.id)).map((f) => f.id)
    const minimal: Answers = { sex: k.answers.sex, age: k.answers.age, urgent_symptoms: k.answers.urgent_symptoms, conditions: k.answers.conditions }
    try {
      const m = assess(minimal)
      if (baseRed.length) {
        redFlagCases++
        const kept = m.flags.filter((f) => isRedFlag(f.id)).map((f) => f.id)
        if (baseRed.every((id) => kept.includes(id))) redFlagsKept++
      }
    } catch {
      crashes++
    }
  }

  const ratio = (a: number, b: number) => (b === 0 ? 1 : a / b)
  const rfDetected = urgentExpected.filter((r) => r.predicted === 'urgent').length
  const falseAlarms = urgentNot.filter((r) => r.predicted === 'urgent').length
  const emerDetected = emerExpected.filter((r) => r.emergency).length

  return {
    n,
    correct,
    accuracy: ratio(correct, n),
    underTriage: results.filter((r) => r.under),
    overTriage: results.filter((r) => r.over),
    redFlag: {
      positives: urgentExpected.length,
      detected: rfDetected,
      sensitivity: ratio(rfDetected, urgentExpected.length),
      negatives: urgentNot.length,
      falseAlarms,
      specificity: ratio(urgentNot.length - falseAlarms, urgentNot.length),
    },
    emergency: { positives: emerExpected.length, detected: emerDetected, sensitivity: ratio(emerDetected, emerExpected.length) },
    dataQuality: {
      expected: dqExpected.length,
      detected: dqExpected.filter((r) => r.dataIssueIds.includes(r.testCase.expectDataIssue!)).length,
    },
    explainability: { flags, withEvidence, withSource },
    confusion,
    byLevel,
    byAgeBand: [...bands.entries()].map(([band, v]) => ({ band, ...v })).sort((a, b) => a.band.localeCompare(b.band)),
    counterfactual: { runs, changed, groups: NATIONALITY_GROUPS.length, langs: LANGS.length },
    missingData: { runs: cases.length, crashes, redFlagCases, redFlagsKept },
    results,
  }
}
