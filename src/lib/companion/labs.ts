import { AMH_LOW, FSH_RAISED, TSH_RANGE, WHO2021 } from '../engine'
import { rid } from '../storage'
import type { L10n } from '../types'
import type { Day } from './dates'

/**
 * Results the person keeps over time: lab semen analyses, home estimates from Wiqaya Lens, egg-reserve and
 * hormone tests, blood pressure, weight, HbA1c and testosterone. Stored on the device only. A home estimate is kept apart from lab results
 * and never counts as one.
 */
export type LabKind = 'semen' | 'lens' | 'ovarian' | 'bp' | 'weight' | 'hba1c' | 'testosterone'

/** Where a value came from, shown beside it, so nobody mistakes an estimate or an example for a lab result. */
export type LabSource = 'photo' | 'typed' | 'clinician' | 'lens' | 'checkin' | 'import' | 'example'

export interface LabEntry {
  id: string
  kind: LabKind
  date: Day
  values: Record<string, number>
  source: LabSource
  addedAt: string
  note?: string
}

export interface LabField {
  id: string
  label: L10n
  unit: L10n
  min: number
  max: number
  step?: number
  /** Lower reference limit: values below it are flagged. */
  low?: number
  /** Upper threshold: values at or above it are flagged. */
  high?: number
  /** LOINC code, used in the HL7 FHIR export (checked against the NLM LOINC service; Malaffi uses LOINC for lab data). */
  loinc?: string
}

export interface LabKindInfo {
  kind: LabKind
  label: L10n
  fields: LabField[]
  /** Evidence behind the reference lines. */
  sources: string[]
  /** One plain sentence on what the reference line means. */
  refNote: L10n
}

const PCT: L10n = { en: '%', ar: '%' }

export const LAB_KINDS: Record<LabKind, LabKindInfo> = {
  semen: {
    kind: 'semen',
    label: { en: 'Semen analysis (lab)', ar: 'تحليل السائل المنوي (مختبر)' },
    fields: [
      { id: 'volume_ml', label: { en: 'Volume', ar: 'الحجم' }, unit: { en: 'mL', ar: 'مل' }, min: 0, max: 20, step: 0.1, low: WHO2021.volume_ml, loinc: '3160-9' },
      { id: 'concentration', label: { en: 'Concentration', ar: 'التركيز' }, unit: { en: 'million/mL', ar: 'مليون/مل' }, min: 0, max: 500, step: 0.1, low: WHO2021.concentration, loinc: '9780-8' },
      { id: 'total_motility', label: { en: 'Total motility', ar: 'الحركة الكلية' }, unit: PCT, min: 0, max: 100, low: WHO2021.total_motility, loinc: '6800-7' },
      { id: 'progressive', label: { en: 'Progressive motility', ar: 'الحركة التقدمية' }, unit: PCT, min: 0, max: 100, low: WHO2021.progressive, loinc: '14194-5' },
      { id: 'morphology', label: { en: 'Normal forms', ar: 'الأشكال الطبيعية' }, unit: PCT, min: 0, max: 100, low: WHO2021.morphology, loinc: '10622-9' },
    ],
    sources: ['WHO2021', 'SEMEN_VARIABILITY'],
    refNote: {
      en: 'The line is the WHO 2021 lower reference limit. Results vary a lot from one sample to the next, so doctors look at more than one test.',
      ar: 'الخط هو الحد المرجعي الأدنى لمنظمة الصحة العالمية (2021). تتفاوت النتائج كثيراً من عينة لأخرى، لذا ينظر الأطباء إلى أكثر من تحليل.',
    },
  },
  lens: {
    kind: 'lens',
    label: { en: 'Home motility estimate (Lens)', ar: 'تقدير منزلي للحركة (العدسة)' },
    fields: [
      { id: 'total_motility', label: { en: 'Moving sperm (estimate)', ar: 'الحيوانات المنوية المتحركة (تقدير)' }, unit: PCT, min: 0, max: 100, low: WHO2021.total_motility },
      { id: 'progressive', label: { en: 'Moving forward (estimate)', ar: 'المتحركة إلى الأمام (تقدير)' }, unit: PCT, min: 0, max: 100, low: WHO2021.progressive },
    ],
    sources: ['HOME_SPERM_TESTS', 'WHO2021'],
    refNote: {
      en: 'A home estimate is not a lab result. It can point to a lab test, but it cannot rule a problem out.',
      ar: 'التقدير المنزلي ليس نتيجة مخبرية. قد يدفع إلى إجراء تحليل مخبري، لكنه لا يستبعد وجود مشكلة.',
    },
  },
  ovarian: {
    kind: 'ovarian',
    label: { en: 'Egg reserve and hormones (lab)', ar: 'مخزون البويضات والهرمونات (مختبر)' },
    fields: [
      { id: 'amh', label: { en: 'AMH', ar: 'AMH' }, unit: { en: 'ng/mL', ar: 'نانوغرام/مل' }, min: 0, max: 30, step: 0.01, low: AMH_LOW, loinc: '38476-3' },
      { id: 'fsh', label: { en: 'FSH (day 2–5)', ar: 'FSH (اليوم 2-5)' }, unit: { en: 'IU/L', ar: 'وحدة/لتر' }, min: 0, max: 200, step: 0.1, high: FSH_RAISED, loinc: '15067-2' },
      { id: 'tsh', label: { en: 'TSH', ar: 'TSH' }, unit: { en: 'mIU/L', ar: 'ملي وحدة/لتر' }, min: 0, max: 100, step: 0.01, high: TSH_RANGE[1], loinc: '3016-3' },
    ],
    sources: ['ASRM_ORT2020', 'AMH_STEINER2017', 'ATA2017'],
    refNote: {
      en: 'AMH falls slowly with age in everyone, so the direction over the years means more than one value. It does not predict natural pregnancy. The line is a reference point, not a cut-off.',
      ar: 'ينخفض AMH ببطء مع العمر لدى الجميع، لذلك يعني الاتجاه عبر السنوات أكثر من قيمة واحدة. ولا يتنبأ بالحمل الطبيعي. الخط نقطة مرجعية وليس حداً فاصلاً.',
    },
  },
  bp: {
    kind: 'bp',
    label: { en: 'Blood pressure', ar: 'ضغط الدم' },
    fields: [
      { id: 'sys', label: { en: 'Systolic (top number)', ar: 'الانقباضي (الرقم الأعلى)' }, unit: { en: 'mmHg', ar: 'ملم زئبق' }, min: 60, max: 260, high: 140, loinc: '8480-6' },
      { id: 'dia', label: { en: 'Diastolic (bottom number)', ar: 'الانبساطي (الرقم الأدنى)' }, unit: { en: 'mmHg', ar: 'ملم زئبق' }, min: 30, max: 160, high: 90, loinc: '8462-4' },
    ],
    sources: ['BP_GUIDE'],
    refNote: {
      en: 'Readings at or above 140/90 on two different days are worth a visit to your family doctor.',
      ar: 'القراءات التي تبلغ 140/90 أو أكثر في يومين مختلفين تستحق زيارة طبيب الأسرة.',
    },
  },
  weight: {
    kind: 'weight',
    label: { en: 'Weight', ar: 'الوزن' },
    fields: [{ id: 'weight_kg', label: { en: 'Weight', ar: 'الوزن' }, unit: { en: 'kg', ar: 'كغ' }, min: 30, max: 350, step: 0.1, loinc: '29463-7' }],
    sources: [],
    refNote: { en: 'Shown with your body mass index (BMI) when your height is known.', ar: 'يُعرض مع مؤشر كتلة الجسم عندما يكون طولك معروفاً.' },
  },
  hba1c: {
    kind: 'hba1c',
    label: { en: 'HbA1c (average blood sugar)', ar: 'السكر التراكمي (HbA1c)' },
    fields: [{ id: 'hba1c', label: { en: 'HbA1c', ar: 'السكر التراكمي' }, unit: PCT, min: 3, max: 20, step: 0.1, high: 5.7, loinc: '4548-4' }],
    sources: ['ADA_SOC'],
    refNote: {
      en: 'From 5.7% it is above the usual range. From 6.5% it is at the level doctors use to check for diabetes. Only a doctor can confirm what it means.',
      ar: 'من 5.7% تكون النتيجة أعلى من المعدل المعتاد، ومن 6.5% تبلغ المستوى الذي يعتمده الأطباء للتحقق من السكري. الطبيب وحده يؤكد معناها.',
    },
  },
  testosterone: {
    kind: 'testosterone',
    label: { en: 'Testosterone (morning)', ar: 'التستوستيرون (صباحاً)' },
    fields: [{ id: 'total_t', label: { en: 'Total testosterone', ar: 'التستوستيرون الكلي' }, unit: { en: 'nmol/L', ar: 'نانومول/لتر' }, min: 0.3, max: 70, step: 0.1, low: 10.4, loinc: '14913-8' }],
    sources: ['AUA_T2018'],
    refNote: {
      en: 'Below about 10.4 nmol/L (300 ng/dL) doctors repeat a morning test before deciding anything.',
      ar: 'إذا كانت أقل من نحو 10.4 نانومول/لتر (300 نانوغرام/دسل) يعيد الأطباء التحليل صباحاً قبل اتخاذ أي قرار.',
    },
  },
}

/** ng/dL to nmol/L for total testosterone. */
export const ngdlToNmol = (ngdl: number) => Math.round(ngdl * 0.0347 * 10) / 10

export const SOURCE_LABEL: Record<LabSource, L10n> = {
  photo: { en: 'From your photo, checked by you', ar: 'من صورتك، وتحققتَ منها' },
  typed: { en: 'Typed by you', ar: 'أدخلتها بنفسك' },
  clinician: { en: 'From your doctor', ar: 'من طبيبك' },
  lens: { en: 'Home estimate (Lens)', ar: 'تقدير منزلي (العدسة)' },
  checkin: { en: 'From your weekly check-in', ar: 'من تسجيلك الأسبوعي' },
  import: { en: 'Imported from your phone', ar: 'مستورد من هاتفك' },
  example: { en: 'Example data', ar: 'بيانات نموذجية' },
}

export function newEntry(kind: LabKind, date: Day, values: Record<string, number>, source: LabSource, note?: string): LabEntry {
  return { id: rid('lab-'), kind, date, values, source, addedAt: new Date().toISOString(), note }
}

/** Oldest first; entries of the same day keep the order they were added. */
export function sortLabs(labs: LabEntry[]): LabEntry[] {
  return [...labs].sort((a, b) => (a.date === b.date ? a.addedAt.localeCompare(b.addedAt) : a.date.localeCompare(b.date)))
}

export const ofKind = (labs: LabEntry[], kind: LabKind) => sortLabs(labs).filter((l) => l.kind === kind)

/** Checks one entry: every value present must be a finite number inside its field's possible range. */
export function validEntry(e: LabEntry): boolean {
  const info = LAB_KINDS[e.kind]
  if (!info) return false
  const known = new Map(info.fields.map((f) => [f.id, f]))
  const entries = Object.entries(e.values)
  if (entries.length === 0) return false
  return entries.every(([k, v]) => {
    const f = known.get(k)
    return !!f && Number.isFinite(v) && v >= f.min && v <= f.max
  })
}

/** Which fields of an entry fall outside their reference line, in plain words. */
export function outOfRange(e: LabEntry): LabField[] {
  return LAB_KINDS[e.kind].fields.filter((f) => {
    const v = e.values[f.id]
    if (v === undefined) return false
    return (f.low !== undefined && v < f.low) || (f.high !== undefined && v >= f.high)
  })
}
