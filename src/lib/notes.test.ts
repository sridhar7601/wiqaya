import { describe, expect, it } from 'vitest'
import { NOTES, retrieve, suggestNotes } from './notes'
import { SOURCES } from './sources'

const top = (q: string) => retrieve(q, 3)[0]?.id

describe('Notes the AI may answer from', () => {
  it('every note has both languages and only known sources', () => {
    const ids = new Set<string>()
    for (const n of NOTES) {
      expect(ids.has(n.id), n.id).toBe(false)
      ids.add(n.id)
      for (const l of ['en', 'ar'] as const) {
        expect(n.q[l].length, `${n.id} q.${l}`).toBeGreaterThan(5)
        expect(n.a[l].length, `${n.id} a.${l}`).toBeGreaterThan(20)
      }
      for (const s of n.sources) expect(SOURCES[s], `${n.id} → ${s}`).toBeDefined()
    }
  })

  it('finds the right note for common questions, in English and Arabic', () => {
    expect(top('Is shisha bad for sperm?')).toBe('tobacco')
    expect(top('I work outside in the summer heat, does it matter?')).toBe('heat_work')
    expect(top('My result was low, am I infertile?')).toBe('low_result')
    expect(top('I take steroids at the gym')).toBe('steroids')
    expect(top('هل الشيشة تضر؟')).toBe('tobacco')
    expect(top('أعمل في الحر طوال اليوم')).toBe('heat_work')
    expect(top('متى يجب أن نراجع الطبيب إذا لم يحدث حمل؟')).toBe('when_to_see')
  })

  it('finds nothing for questions the notes do not cover, so the AI is not asked', () => {
    expect(retrieve('What is the weather in Dubai tomorrow?')).toEqual([])
    expect(retrieve('Recommend a good football team')).toEqual([])
    expect(retrieve('?')).toEqual([])
  })

  it('suggests notes that fit the findings first', () => {
    expect(suggestNotes(['EX_HEAT', 'SC_TOBACCO']).map((n) => n.id)).toEqual(['heat_work', 'tobacco', 'teleconsult'])
    expect(suggestNotes([]).map((n) => n.id)).toEqual(['teleconsult', 'not_diagnosis', 'link_privacy'])
  })

  it('answers a woman only from women’s or shared notes', () => {
    const topF = (q: string) => retrieve(q, 3, 'female')[0]?.id
    expect(topF('What does a low AMH mean?')).toBe('f_amh')
    expect(topF('Should I freeze my eggs?')).toBe('f_egg_freezing')
    expect(topF('My periods are irregular')).toBe('f_irregular')
    expect(topF('Will losing weight help?')).toBe('f_weight')
    expect(topF('هل الشيشة تضر؟')).toBe('f_smoking')
    for (const q of ['Is shisha bad?', 'Will losing weight help?', 'When should we see a doctor?', 'Does sleep matter?'])
      for (const n of retrieve(q, 3, 'female')) expect(n.sex, `${q} -> ${n.id}`).not.toBe('male')
    for (const n of retrieve('Will losing weight help?', 3, 'male')) expect(n.sex).not.toBe('female')
    expect(suggestNotes(['GY_IRREGULAR', 'PR_TIMING'], 3, 'female').map((n) => n.id)).toEqual(['f_irregular', 'f_age', 'f_egg_freezing'])
  })
})
