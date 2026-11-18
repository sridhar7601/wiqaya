import { describe, expect, it } from 'vitest'
import { boundaryChecks } from './boundaries'

describe('Clinical boundaries across the care pathway', () => {
  it('every boundary holds on the example people', () => {
    const out = boundaryChecks()
    expect(out.length).toBeGreaterThanOrEqual(9)
    expect(out.filter((c) => !c.pass).map((c) => `${c.id}: ${c.got}`)).toEqual([])
  })
})
