import { describe, expect, it } from 'vitest'
import { assess } from '../engine'
import { visibleQuestions } from '../questions'
import type { Answers } from '../types'
import type { CheckIn } from './checkins'
import { today } from './dates'
import { personaData } from './personas'
import { cycleLengths } from './trends'
import type { CompanionInput } from './view'
import { companionView } from './view'

const T = today()
const view = (id: 'mariam' | 'fatima') => {
  const d = personaData(id, T) as unknown as Omit<CompanionInput, 'today'>
  return { d, v: companionView({ ...d, journey: d.journey ?? [], today: T }) }
}

describe("women's check", () => {
  it('asks a woman only her own questions, in her own wording', () => {
    const ids = visibleQuestions({ sex: 'female', ttc: 'not_now' }).map((q) => q.id)
    for (const id of ['cycle', 'gyn_symptoms', 'gyn_history', 'meds_f', 'plans_when', 'hormone_done', 'menopause_fh']) expect(ids).toContain(id)
    for (const id of ['anat', 'mumps', 'sexual', 'heat', 'semen_done', 'meds', 'partner_age']) expect(ids).not.toContain(id)
    const urgent = visibleQuestions({ sex: 'female' }).find((q) => q.id === 'urgent_symptoms')
    expect(urgent?.options?.map((o) => o.value)).toEqual(['ectopic_signs', 'heavy_bleeding', 'pelvic_fever', 'none'])
  })

  it('leaves a man’s check exactly as it was when sex is missing', () => {
    const ids = visibleQuestions({}).map((q) => q.id)
    expect(ids).toContain('anat')
    expect(ids).not.toContain('cycle')
    expect(assess({ age: 30, urgent_symptoms: ['none'] }).sex).toBe('male')
  })

  it('a woman’s findings speak to her, and options are offered alongside the step', () => {
    const as = assess({ sex: 'female', age: 34, urgent_symptoms: ['none'], ttc: 'not_now', plans_when: '3to5y' })
    const f = as.flags.find((x) => x.id === 'PR_TIMING')
    expect(f?.option).toBe('preservation')
    expect(f?.action.en).toMatch(/discussion, not a recommendation/)
    // Age and timing alone never raise the step: the conversation is offered, not prescribed.
    expect(as.level).toBe('selfcare')
  })
})

describe('cycle lengths over time', () => {
  const ci = (week: string, periodStart?: string): CheckIn => ({ id: week, week, at: `${week}T10:00:00.000Z`, redFlags: [], heatDays: '0', nicotine: 'none', sleep: '6to8', active: '2to4', periodStart })
  it('turns period starts into cycle lengths and skips long gaps', () => {
    const list = [ci('2026-01-05', '2026-01-06'), ci('2026-02-02', '2026-02-05'), ci('2026-03-09', '2026-03-12'), ci('2026-08-03', '2026-08-04')]
    expect(cycleLengths(list).map((c) => c.days)).toEqual([30, 35])
  })
})

describe('example women', () => {
  it('Mariam: irregular cycles found over time, her doctor decides, counselling and a preservation talk offered', () => {
    const { d, v } = view('mariam')
    const cycles = cycleLengths((d as { checkins: CheckIn[] }).checkins).map((c) => c.days)
    expect(cycles.length).toBeGreaterThanOrEqual(4)
    const ids = v.flags.map((f) => f.id)
    expect(ids).toEqual(expect.arrayContaining(['GY_IRREGULAR', 'PR_TIMING', 'LT_CYCLE_IRREGULAR', 'LT_AMH_DIRECTION', 'INFO_EARLY_MENOPAUSE_FH']))
    expect(v.decidedBy).toBe('clinician')
    expect(v.level).toBe('primary')
    expect(v.desired.map((s) => s.kind)).toEqual(expect.arrayContaining(['primary', 'preservation']))
  })

  it('Fatima: 38 and trying 7 months goes straight to a couple fertility assessment', () => {
    const { v } = view('fatima')
    expect(v.level).toBe('fertility')
    expect(v.flags.some((f) => f.id === 'FS_DURATION')).toBe(true)
    expect(v.flags.find((f) => f.id === 'FS_DURATION')?.action.en).toMatch(/partner/)
  })

  it('men’s answers never change a woman’s result', () => {
    const base: Answers = { sex: 'female', age: 30, urgent_symptoms: ['none'] }
    const leftover: Answers = { ...base, anat: ['varicocele'], sexual: ['erection'], meds: ['testosterone'], heat: ['sauna'], semen_done: 'yes', concentration: 1 }
    expect(assess(leftover).flags.map((f) => f.id)).toEqual(assess(base).flags.map((f) => f.id))
  })
})
