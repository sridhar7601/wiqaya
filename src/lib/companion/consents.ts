import { useStored } from '../storage'
import type { L10n } from '../types'

/**
 * Consent, one feature at a time, with a log the person can see and download. Nothing that leaves the
 * device is on by default: each feature asks at the moment it is first used, and can be turned off here.
 */
export type ConsentScope = 'ai_explain' | 'ai_report' | 'ai_ask' | 'ai_search' | 'weather' | 'feedback' | 'population'

export interface ConsentEvent {
  scope: ConsentScope
  granted: boolean
  at: string
  version: string
  via: 'settings' | 'prompt'
}

export const CONSENT_TEXT_VERSION = 'consent-0.2'

export interface ScopeInfo {
  scope: ConsentScope
  title: L10n
  sends: L10n
  to: L10n
}

export const SCOPES: ScopeInfo[] = [
  {
    scope: 'ai_explain',
    title: { en: 'AI explanation of my result', ar: 'شرح نتيجتي بالذكاء الاصطناعي' },
    sends: { en: 'The titles of what was found and your next step. Never your answers.', ar: 'عناوين ما تم العثور عليه وخطوتك التالية، ولا تُرسل إجاباتك أبداً.' },
    to: { en: 'Our AI service, which does not keep it', ar: 'خدمة الذكاء الاصطناعي لدينا، ولا تحتفظ به' },
  },
  {
    scope: 'ai_report',
    title: { en: 'AI reading of my lab report photo', ar: 'قراءة صورة تقرير المختبر بالذكاء الاصطناعي' },
    sends: { en: 'Only the part of the picture inside the frame you set.', ar: 'جزء الصورة الموجود داخل الإطار الذي تحدده فقط.' },
    to: { en: 'Our AI service, which does not keep it', ar: 'خدمة الذكاء الاصطناعي لدينا، ولا تحتفظ به' },
  },
  {
    scope: 'ai_ask',
    title: { en: 'AI answers and visit preparation', ar: 'إجابات الذكاء الاصطناعي والاستعداد للزيارة' },
    sends: { en: 'Your question, the titles of your findings and next step, and the notes of ours that match your question. Never your answers.', ar: 'سؤالك وعناوين ما وُجد وخطوتك التالية، وملاحظاتنا التي تطابق سؤالك، ولا تُرسل إجاباتك أبداً.' },
    to: { en: 'Our AI service, which does not keep it', ar: 'خدمة الذكاء الاصطناعي لدينا، ولا تحتفظ به' },
  },
  {
    scope: 'ai_search',
    title: { en: 'AI care search', ar: 'البحث عن الرعاية بالذكاء الاصطناعي' },
    sends: { en: 'Only the words you type in the search box, such as “male doctor in Al Ain”.', ar: 'الكلمات التي تكتبها في مربع البحث فقط، مثل «طبيب رجل في العين».' },
    to: { en: 'Our AI service, which does not keep it', ar: 'خدمة الذكاء الاصطناعي لدينا، ولا تحتفظ به' },
  },
  {
    scope: 'weather',
    title: { en: 'Heat alerts for my city', ar: 'تنبيهات الحرارة لمدينتي' },
    sends: { en: 'Only the city you chose, never your location.', ar: 'المدينة التي اخترتها فقط، وليس موقعك أبداً.' },
    to: { en: 'Open-Meteo, a public weather service', ar: 'Open-Meteo، خدمة طقس عامة' },
  },
  {
    scope: 'feedback',
    title: { en: 'Anonymous feedback', ar: 'ملاحظات مجهولة الهوية' },
    sends: { en: 'Two ratings, how long the check took, and the language.', ar: 'تقييمان ومدة الفحص واللغة.' },
    to: { en: 'Our server, as counters only', ar: 'خادمنا، كعدّادات فقط' },
  },
  {
    scope: 'population',
    title: { en: 'Count me in anonymous health-system statistics', ar: 'احتسبني في إحصاءات النظام الصحي المجهولة' },
    sends: {
      en: 'Your age band, sex, area and language, and which next step and options you were given, added to totals. Never your answers, results or anything that identifies you. Never used for employment, insurance or any decision about you.',
      ar: 'فئتك العمرية وجنسك ومنطقتك ولغتك، والخطوة التالية والخيارات التي أُعطيتها، تُضاف إلى أرقام إجمالية. لا تُرسل إجاباتك أو نتائجك أو أي شيء يحدد هويتك أبداً، ولا تُستخدم أبداً للتوظيف أو التأمين أو أي قرار بشأنك.',
    },
    to: { en: 'Health-system planning, as totals only; groups under 10 are hidden (in a pilot: nothing is sent from this prototype)', ar: 'تخطيط النظام الصحي، كأرقام إجمالية فقط، وتُخفى المجموعات الأقل من 10 (في المرحلة التجريبية؛ لا يُرسل شيء من هذا النموذج)' },
  },
]

/** The latest decision for a scope: true, false, or undefined when never asked. */
export function decision(log: ConsentEvent[], scope: ConsentScope): boolean | undefined {
  for (let i = log.length - 1; i >= 0; i--) if (log[i].scope === scope) return log[i].granted
  return undefined
}

export function useConsents(): { log: ConsentEvent[]; set: (scope: ConsentScope, granted: boolean, via?: ConsentEvent['via']) => void; is: (scope: ConsentScope) => boolean | undefined } {
  const [log, setLog] = useStored<ConsentEvent[]>('consents', [])
  return {
    log,
    set: (scope, granted, via = 'settings') => setLog((l) => [...l, { scope, granted, at: new Date().toISOString(), version: CONSENT_TEXT_VERSION, via }]),
    is: (scope) => decision(log, scope),
  }
}

/** The log as HL7 FHIR R4 Consent resources, one per decision, for the person to download. */
export function consentsToFhir(log: ConsentEvent[]): Record<string, unknown> {
  return {
    resourceType: 'Bundle',
    type: 'collection',
    timestamp: new Date().toISOString(),
    entry: log.map((e, i) => ({
      fullUrl: `urn:uuid:consent-${i + 1}`,
      resource: {
        resourceType: 'Consent',
        status: 'active',
        scope: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/consentscope', code: 'patient-privacy' }] },
        category: [{ text: SCOPES.find((s) => s.scope === e.scope)?.title.en ?? e.scope }],
        dateTime: e.at,
        policyRule: { text: `Wiqaya ${e.version}, recorded via ${e.via}` },
        provision: { type: e.granted ? 'permit' : 'deny' },
      },
    })),
  }
}
