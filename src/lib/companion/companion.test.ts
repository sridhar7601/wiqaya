import { describe, expect, it } from 'vitest'
import type { Review } from '../referral'
import type { Answers } from '../types'
import type { CheckIn } from './checkins'
import { habitCount, streak, upsertCheckIn } from './checkins'
import { consentsToFhir, decision } from './consents'
import type { ConsentEvent } from './consents'
import { cycleState } from './cycle'
import { addDays, daysBetween, weekStart } from './dates'
import { findCare, parsePreferences, PROVIDERS, toHealthcareService } from './directory'
import { exposureFlags } from './exposures'
import { toIcs } from './ics'
import { acceptOffer, applyReply, desiredSteps, journeyMeasures, syncJourney } from './journey'
import type { JourneyStep } from './journey'
import type { LabEntry } from './labs'
import { validEntry } from './labs'
import { personaData } from './personas'
import type { PersonaId } from './personas'
import { trendFlags } from './trends'
import type { DailySignal } from './trends'
import type { CompanionInput } from './view'
import { companionView } from './view'

const T = '2026-11-17'
const d = (n: number) => addDays(T, n)
let n = 0
const lab = (kind: LabEntry['kind'], date: string, values: Record<string, number>, source: LabEntry['source'] = 'typed'): LabEntry => ({ id: `t${n++}`, kind, date, values, source, addedAt: `${date}T10:00:00.000Z` })
const semen = (date: string, concentration: number) => lab('semen', date, { volume_ml: 3, concentration, total_motility: 50, progressive: 35, morphology: 5 })
const ci = (week: string, patch: Partial<CheckIn> = {}): CheckIn => ({ id: `c${n++}`, week, at: `${addDays(week, 2)}T19:00:00.000Z`, redFlags: [], heatDays: '0', nicotine: 'none', sleep: '6to8', active: '2to4', ...patch })
const ids = (labs: LabEntry[], extra: Partial<Parameters<typeof trendFlags>[0]> = {}) => trendFlags({ answers: {}, labs, checkins: [], signals: [], today: T, ...extra }).map((f) => f.id)
const answers: Answers = { age: 34, urgent_symptoms: ['none'], ttc: 'yes', ttc_months: 'lt6', partner_age: 'under35' }

function input(patch: Partial<CompanionInput> = {}): CompanionInput {
  return { answers, labs: [], checkins: [], signals: [], work: null, replies: [], journey: [], planStart: d(-60), today: T, ...patch }
}
const review = (level: Review['level'], daysAgo: number, extra: Partial<Review> = {}): { reply: Review; receivedAt: string } => ({
  reply: { decision: 'agree', level, reason: 'ok', at: `${d(-daysAgo)}T08:00:00.000Z`, reviewer: 'Dr Test', ...extra },
  receivedAt: `${d(-daysAgo)}T09:00:00.000Z`,
})

describe('trend rules', () => {
  it('two low tests weeks apart give one finding, and it is the stronger one', () => {
    const f = ids([semen(d(-120), 10), semen(d(-30), 12)])
    expect(f).toContain('LT_SEMEN_LOW_TWICE')
    expect(f).not.toContain('LT_SEMEN_RECENT_LOW')
  })

  it('a better result is information only: the earlier low result still stands', () => {
    const f = ids([semen(d(-120), 10), semen(d(-30), 20)])
    expect(f).toEqual(expect.arrayContaining(['LT_SEMEN_RECENT_LOW', 'LT_SEMEN_IMPROVED']))
    const flags = trendFlags({ answers: {}, labs: [semen(d(-120), 10), semen(d(-30), 20)], checkins: [], signals: [], today: T })
    expect(flags.find((x) => x.id === 'LT_SEMEN_IMPROVED')?.level).toBe('info')
  })

  it('a home estimate only ever suggests a lab test, and a later lab test replaces it', () => {
    const est = lab('lens', d(-20), { total_motility: 30, progressive: 20 }, 'lens')
    const f = trendFlags({ answers: {}, labs: [est], checkins: [], signals: [], today: T })
    expect(f.map((x) => x.id)).toEqual(['LT_LENS_LOW'])
    expect(f[0].level).toBe('primary')
    expect(ids([est, semen(d(-5), 30)])).not.toContain('LT_LENS_LOW')
    // A home estimate is never treated as a lab result.
    expect(ids([lab('lens', d(-20), { total_motility: 10, progressive: 5 }, 'lens')])).not.toContain('LT_SEMEN_RECENT_LOW')
  })

  it('blood pressure: two high days → family doctor; one very high reading → urgent with the 998 advice', () => {
    expect(ids([lab('bp', d(-30), { sys: 142, dia: 88 }), lab('bp', d(-10), { sys: 138, dia: 92 })])).toContain('LT_BP_HIGH_TWICE')
    expect(ids([lab('bp', d(-10), { sys: 142, dia: 88 })])).not.toContain('LT_BP_HIGH_TWICE')
    const f = trendFlags({ answers: {}, labs: [lab('bp', d(-1), { sys: 186, dia: 110 })], checkins: [], signals: [], today: T })
    expect(f[0].id).toBe('LT_BP_VERY_HIGH')
    expect(f[0].level).toBe('urgent')
    expect(f[0].action.en).toContain('998')
  })

  it('HbA1c, testosterone and weight thresholds', () => {
    expect(ids([lab('hba1c', d(-5), { hba1c: 6.1 })])).toContain('LT_HBA1C_HIGH')
    expect(ids([lab('hba1c', d(-5), { hba1c: 5.4 })])).toEqual([])
    expect(ids([lab('testosterone', d(-5), { total_t: 9.2 })])).toContain('LT_TESTOSTERONE_LOW')
    expect(ids([lab('testosterone', d(-5), { total_t: 15 })])).toEqual([])
    expect(ids([lab('weight', d(-120), { weight_kg: 100 }), lab('weight', d(-5), { weight_kg: 94 })])).toContain('LT_WEIGHT_DOWN')
  })

  it('hot weeks and short sleep become habit findings', () => {
    const weeks = [0, 1, 2, 3].map((i) => weekStart(d(-7 * i)))
    expect(ids([], { checkins: weeks.map((w, i) => ci(w, { heatDays: i < 3 ? '6to7' : '0' })) })).toContain('LT_HEAT_WEEKS')
    const nights: DailySignal[] = Array.from({ length: 10 }, (_, i) => ({ date: d(-i - 1), sleepH: 5.2 }))
    expect(ids([], { signals: nights })).toContain('LT_SLEEP_SHORT')
  })
})

describe('clinical boundary: who decides the next step', () => {
  it('a red flag in a recent check-in always wins, even over a doctor’s decision', () => {
    const v = companionView(input({ checkins: [ci(weekStart(T), { at: `${T}T08:00:00.000Z`, redFlags: ['new_lump'] })], replies: [review('primary', 10)] }))
    expect(v.decidedBy).toBe('red_flag')
    expect(v.level).toBe('urgent')
  })

  it('sudden severe pain means emergency: the journey offers 998 only, no booking', () => {
    const v = companionView(input({ checkins: [ci(weekStart(T), { at: `${T}T08:00:00.000Z`, redFlags: ['sudden_pain'] })] }))
    expect(v.emergency).toBe(true)
    expect(v.desired).toEqual([{ kind: 'emergency' }])
  })

  it('a recent clinician decision stands, also when it is lower than the rules', () => {
    const labs = [semen(d(-40), 10)] // rules: specialist
    const higher = companionView(input({ labs, replies: [review('specialist', 20)] }))
    expect([higher.level, higher.decidedBy]).toEqual(['specialist', 'clinician'])
    const lower = companionView(input({ labs, replies: [review('primary', 20)] }))
    expect([lower.level, lower.decidedBy]).toEqual(['primary', 'clinician'])
  })

  it('after 90 days the rules decide again, and newer results are counted for sharing', () => {
    const labs = [semen(d(-40), 10)]
    const old = companionView(input({ labs, replies: [review('primary', 120)] }))
    expect([old.level, old.decidedBy]).toEqual(['specialist', 'rules'])
    const fresh = companionView(input({ labs, replies: [review('specialist', 50)] }))
    expect(fresh.newSinceReview).toBe(1)
  })
})

describe('care journey', () => {
  it('builds the rule steps for a fertility result', () => {
    const steps = desiredSteps({ level: 'fertility', emergency: false, also: ['primary'], screeningDue: true, needsLabTest: true, occupationalHealth: false })
    expect(steps.map((s) => s.kind)).toEqual(['fertility', 'primary', 'lab_test', 'screening'])
  })

  it('keeps history, drops steps no longer needed that were never started, adds new ones', () => {
    const now = `${T}T10:00:00.000Z`
    const first = syncJourney([], [{ kind: 'primary' }, { kind: 'screening' }], now)
    const booked = first.map((s) => (s.kind === 'primary' ? { ...s, status: 'booked' as const } : s))
    const next = syncJourney(booked, [{ kind: 'specialist' }], now)
    expect(next.map((s) => `${s.kind}:${s.status}`).sort()).toEqual(['primary:booked', 'specialist:todo'])
  })

  it('turns a clinician reply into steps once, and an accepted offer becomes a booking', () => {
    const r: Review = { decision: 'agree', level: 'primary', reason: '', at: `${d(-1)}T08:00:00.000Z`, reviewer: 'Dr Test', offer: { at: `${d(3)}T09:00`, mode: 'video' }, orders: [{ kind: 'hba1c', inWeeks: 2 }] }
    const once = applyReply([], r, T, `${T}T10:00:00.000Z`)
    const twice = applyReply(once, r, T, `${T}T10:00:00.000Z`)
    expect(twice).toHaveLength(2)
    expect(once.find((s) => s.kind === 'order')?.dueBy).toBe(d(14))
    const offer = once.find((s) => s.kind === 'appointment') as JourneyStep
    const accepted = acceptOffer(once, offer.id, `${T}T10:00:00.000Z`).find((s) => s.id === offer.id)
    expect(accepted?.status).toBe('booked')
    expect(accepted?.booking?.at).toBe(`${d(3)}T09:00`)
  })
})

describe('care finder', () => {
  it('only lists services that fit the step, and ranks by preferences met, then the earliest slot', () => {
    const m = findCare({ services: ['andrology'], area: 'al_ain', maleClinician: true })
    expect(m.length).toBeGreaterThan(0)
    expect(m.every((x) => x.provider.services.includes('andrology'))).toBe(true)
    expect(m[0].misses).toEqual([])
    // Online services count as available everywhere.
    expect(m.some((x) => x.provider.area === 'online' && x.misses.length === 0)).toBe(true)
  })

  it('reads preferences in English and Arabic the same way', () => {
    const want = { area: 'al_ain', languages: ['ar'], maleClinician: true, evenings: true }
    expect(parsePreferences('A male doctor in Al Ain who speaks Arabic, in the evening')).toEqual(want)
    expect(parsePreferences('طبيب رجل في العين يتكلم العربية مساءً')).toEqual(want)
    expect(parsePreferences('online at the weekend, I have Thiqa')).toEqual({ telehealth: true, weekends: true, insurance: 'thiqa' })
  })

  it('every example entry is labelled as an example and exports as a FHIR HealthcareService', () => {
    for (const p of PROVIDERS) {
      expect(p.name.en).toMatch(/\(example\)$/)
      const r = toHealthcareService(p)
      expect(r.resourceType).toBe('HealthcareService')
      expect(JSON.stringify(r)).toContain('"urn:example:demo-record","valueBoolean":true')
    }
  })
})

describe('the rest of the companion', () => {
  it('90-day window: starts at the last lab test, re-test due 90 days after a low one, a clinician order wins', () => {
    const c = cycleState([semen(d(-30), 10)], d(-150), T)
    expect([c.start, c.startReason, c.day, c.retestDue, c.retestReason]).toEqual([d(-30), 'lab_test', 31, d(60), 'low_result'])
    expect(cycleState([semen(d(-30), 10)], d(-150), T, d(40)).retestReason).toBe('clinician')
    expect(cycleState([], d(-10), T).startReason).toBe('plan')
  })

  it('calendar files are valid, folded and neutral by default', () => {
    const ics = toIcs([{ id: 'x1', title: 'Appointment', start: '2026-11-22T10:30', minutes: 30 }, { id: 'x2', title: 'Reminder', start: '2026-12-01' }], new Date('2026-11-17T10:00:00Z'))
    expect(ics).toContain('DTSTART:20261122T103000')
    expect(ics).toContain('DTSTART;VALUE=DATE:20261201')
    expect(ics.split('\r\n').every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true)
    expect(ics).not.toMatch(/sperm|semen|fertility/i)
  })

  it('check-ins: habits, streaks and one per week', () => {
    const w = weekStart(T)
    expect(habitCount(ci(w, { nicotine: 'daily', heatDays: '6to7' }))).toBe(2)
    const list = upsertCheckIn([ci(w), ci(addDays(w, -7)), ci(addDays(w, -14))], ci(w, { sleep: 'lt6' }))
    expect(list.filter((c) => c.week === w)).toHaveLength(1)
    expect(streak(list, T)).toBe(3)
  })

  it('consent: the latest decision counts, and the log exports as FHIR Consent', () => {
    const log: ConsentEvent[] = [
      { scope: 'weather', granted: true, at: '2026-11-01T10:00:00Z', version: 'v', via: 'prompt' },
      { scope: 'weather', granted: false, at: '2026-11-02T10:00:00Z', version: 'v', via: 'settings' },
    ]
    expect(decision(log, 'weather')).toBe(false)
    expect(decision(log, 'ai_ask')).toBeUndefined()
    const b = consentsToFhir(log) as { entry: { resource: { provision: { type: string } } }[] }
    expect(b.entry.map((e) => e.resource.provision.type)).toEqual(['permit', 'deny'])
  })

  it('work exposures add advice only, never a higher step', () => {
    const f = exposureFlags({ occupation: 'metal_weld', nightShifts: true, extra: ['pesticides'], heatAlerts: false, updatedAt: '' })
    expect(f.map((x) => x.id).sort()).toEqual(['EX_HEAT', 'EX_METALS', 'EX_NIGHT', 'EX_PESTICIDES'])
    expect(f.every((x) => x.level === 'selfcare' || x.level === 'info')).toBe(true)
  })
})

describe('example people', () => {
  const view = (id: PersonaId) => {
    const p = personaData(id, T) as Record<string, unknown>
    return {
      p,
      v: companionView({
        answers: p.answers as Answers,
        labs: p.labs as LabEntry[],
        checkins: p.checkins as CheckIn[],
        signals: p.signals as DailySignal[],
        work: p.work as CompanionInput['work'],
        replies: p.replies as CompanionInput['replies'],
        journey: p.journey as JourneyStep[],
        planStart: p.planStart as string,
        today: T,
      }),
    }
  }

  it('Omar: specialist decided by a clinician, a better repeat test, weight down, and every value valid', () => {
    const { p, v } = view('omar')
    expect((p.labs as LabEntry[]).every(validEntry)).toBe(true)
    expect([v.level, v.decidedBy]).toEqual(['specialist', 'clinician'])
    expect(v.flags.map((f) => f.id)).toEqual(expect.arrayContaining(['FS_DURATION', 'LT_SEMEN_RECENT_LOW', 'LT_SEMEN_IMPROVED', 'LT_WEIGHT_DOWN', 'EX_HEAT']))
    const m = journeyMeasures(p.journey as JourneyStep[], p.planStart as string)
    expect(m.daysToEvaluation).toBe(22)
  })

  it('Yousef: primary care, blood pressure and HbA1c found over time, and an appointment offer waiting', () => {
    const { p, v } = view('yousef')
    expect((p.labs as LabEntry[]).every(validEntry)).toBe(true)
    expect([v.level, v.decidedBy]).toEqual(['primary', 'clinician'])
    expect(v.flags.map((f) => f.id)).toEqual(expect.arrayContaining(['LT_BP_HIGH_TWICE', 'LT_HBA1C_HIGH', 'LT_TESTOSTERONE_LOW', 'PC_ED_LIBIDO']))
    expect((p.journey as JourneyStep[]).some((s) => s.kind === 'appointment' && s.offer)).toBe(true)
  })

  it('dates stay relative to today', () => {
    const p = personaData('omar', '2027-03-01') as { planStart: string }
    expect(daysBetween(p.planStart, '2027-03-01')).toBe(150)
  })
})
