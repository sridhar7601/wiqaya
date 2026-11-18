import { describe, expect, it } from 'vitest'
import { assess } from '../lib/engine'
import { QUESTIONS } from '../lib/questions'
import { RULES } from '../lib/engine'
import { SOURCES } from '../lib/sources'
import { CASES } from './cases'
import { runEval } from './runEval'

const report = runEval()

describe('safety benchmarks', () => {
  it('detects every red flag (100% sensitivity)', () => {
    expect(report.redFlag.sensitivity).toBe(1)
  })
  it('detects every emergency', () => {
    expect(report.emergency.sensitivity).toBe(1)
  })
  it('never under-triages a synthetic case', () => {
    expect(report.underTriage.map((r) => r.testCase.id)).toEqual([])
  })
  it('matches the expected next step for every case', () => {
    const wrong = report.results.filter((r) => !r.correct).map((r) => `${r.testCase.id}: expected ${r.testCase.expected}, got ${r.predicted}`)
    expect(wrong).toEqual([])
  })
})

describe('robustness', () => {
  it('catches every planted data error', () => {
    expect(report.dataQuality.detected).toBe(report.dataQuality.expected)
  })
  it('keeps red flags when most answers are missing, and never crashes', () => {
    expect(report.missingData.crashes).toBe(0)
    expect(report.missingData.redFlagsKept).toBe(report.missingData.redFlagCases)
  })
  it('gives the same result whatever the nationality group or language', () => {
    expect(report.counterfactual.changed).toBe(0)
  })
  it('handles an empty answer set', () => {
    const r = assess({})
    expect(r.eligible).toBe(false)
    expect(r.flags).toEqual([])
  })
  it('is deterministic', () => {
    for (const k of CASES) expect(JSON.stringify(assess(k.answers))).toBe(JSON.stringify(assess(k.answers)))
  })
})

describe('explainability and content', () => {
  it('every fired flag shows evidence and a source', () => {
    expect(report.explainability.withEvidence).toBe(report.explainability.flags)
    expect(report.explainability.withSource).toBe(report.explainability.flags)
  })
  it('every rule cites sources that exist', () => {
    for (const r of RULES) for (const s of r.sources) expect(SOURCES[s], `${r.id} -> ${s}`).toBeDefined()
  })
  it('every rule and question has Arabic text', () => {
    for (const r of RULES) for (const t of [r.title, r.why, r.action]) expect(t.ar.trim().length, r.id).toBeGreaterThan(0)
    for (const q of QUESTIONS) {
      expect(q.text.ar.trim().length, q.id).toBeGreaterThan(0)
      for (const o of q.options ?? []) expect(o.label.ar.trim().length, `${q.id}.${o.value}`).toBeGreaterThan(0)
    }
  })
  it('every rule fires in at least one test case', () => {
    const fired = new Set(report.results.flatMap((r) => r.flagIds))
    const unused = RULES.map((r) => r.id).filter((id) => !fired.has(id))
    expect(unused).toEqual([])
  })
})
