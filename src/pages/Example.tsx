import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router'
import { CASES } from '../eval/cases'
import type { Answers } from '../lib/types'

/** Synthetic cases judges can open without answering every question. They never touch the person's own saved answers. */
export const EXAMPLES = [
  { id: 'W14', label: { en: 'Woman, 34, would like children in 3–5 years', ar: 'امرأة، 34، ترغب في الإنجاب خلال 3 إلى 5 سنوات' } },
  { id: 'W23', label: { en: 'Woman, 37, trying for 7 months', ar: 'امرأة، 37، تحاول الإنجاب منذ 7 أشهر' } },
  { id: 'C44', label: { en: 'Man, gym steroids, trying for a year', ar: 'رجل، ستيرويدات رياضية، ومحاولة إنجاب منذ عام' } },
  { id: 'C28', label: { en: 'Man, diabetes, weight and smoking', ar: 'رجل، سكري ووزن زائد وتدخين' } },
  { id: 'W31', label: { en: 'Severe one-sided pain, late period (emergency)', ar: 'ألم شديد في جهة واحدة مع تأخر الدورة (طارئ)' } },
  { id: 'C45', label: { en: 'Sudden severe testicular pain (emergency)', ar: 'ألم مفاجئ وشديد في الخصية (طارئ)' } },
]

export function exampleAnswers(id: string | null): Answers | null {
  if (!id) return null
  return CASES.find((c) => c.id === id)?.answers ?? null
}

/** Old links (/example/C44) keep working: they now open the read-only example view. */
export default function Example() {
  const { id } = useParams()
  const nav = useNavigate()
  useEffect(() => {
    nav(exampleAnswers(id ?? null) ? `/result?example=${id}` : '/', { replace: true })
  }, [id, nav])
  return null
}
