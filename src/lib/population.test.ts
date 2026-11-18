import { describe, expect, it } from 'vitest'
import { byGroup, cell, cohort, insights, MIN_CELL, monthsEarlier, reach } from './population'

describe('health-system view (invented population)', () => {
  const people = cohort()
  it('is the same every time and runs every person through the rules', () => {
    expect(people.length).toBe(10000)
    expect(JSON.stringify(cohort().slice(0, 5).map((p) => p.as.level))).toBe(JSON.stringify(people.slice(0, 5).map((p) => p.as.level)))
  })
  it('hides any group smaller than the minimum', () => {
    expect(cell(MIN_CELL - 1).hidden).toBe(true)
    expect(cell(MIN_CELL).hidden).toBe(false)
    expect(cell(0).hidden).toBe(false)
    for (const g of byGroup(people)) for (const c of [...Object.values(g.levels), ...Object.values(g.options)]) if (c.n > 0 && c.n < MIN_CELL) expect(c.hidden).toBe(true)
  })
  it('finds each named group and an earlier-action estimate', () => {
    const ins = insights(people)
    expect(ins.map((i) => i.id)).toEqual(['timing', 'cycles', 'age_adjusted', 'men_no_test', 'preconception', 'overdue'])
    for (const i of ins) expect(i.base).toBeGreaterThan(0)
    const e = monthsEarlier(people)
    expect(e.women).toBeGreaterThan(0)
    expect(e.meanMonths).toBeGreaterThan(0)
    expect(e.meanMonths).toBeLessThanOrEqual(9)
  })
  it('reach shares add up', () => {
    const r = reach(people)
    const lang = r.filter((x) => x.key === 'ar' || x.key === 'en')
    expect(lang.reduce((s, x) => s + x.shareOfPopulation, 0)).toBeCloseTo(1, 5)
    expect(lang.reduce((s, x) => s + x.shareOfAdvised, 0)).toBeCloseTo(1, 5)
  })
})
