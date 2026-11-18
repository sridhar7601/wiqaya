import type { L10n } from '../types'
import type { City } from './exposures'

/**
 * Care finder. In a pilot every entry comes from the DoH Abu Dhabi licensing register and is re-checked
 * daily, and the list never takes payment for placement: it is sorted by fit to the person's next step
 * and preferences, then by the earliest slot.
 *
 * THIS PROTOTYPE USES AN EXAMPLE DIRECTORY. The names, slots and licence numbers below are invented and
 * labelled as examples everywhere they appear. The record shape follows HL7 FHIR R4 HealthcareService,
 * so the real register can replace it without changing the app.
 */
export type ServiceKind = 'screening' | 'primary' | 'telehealth' | 'andrology' | 'womens' | 'fertility' | 'lab' | 'urgent' | 'occupational'
export type Area = City | 'online'
export type Language = 'ar' | 'en' | 'hi' | 'ur' | 'ml' | 'tl'
export type Insurance = 'thiqa' | 'basic' | 'enhanced' | 'self_pay'

export interface Provider {
  id: string
  name: L10n
  services: ServiceKind[]
  area: Area
  district: L10n
  languages: Language[]
  maleClinician: boolean
  /** A woman clinician can be booked. */
  femaleClinician?: boolean
  telehealth: boolean
  evenings: boolean
  weekends: boolean
  insurance: Insurance[]
  referralNeeded: boolean
  /** Days until the next free slot (example data). */
  nextSlotDays: number
  licence: { id: string; checked: string }
}

export const SERVICE_LABEL: Record<ServiceKind, L10n> = {
  screening: { en: 'Routine health check (IFHAS)', ar: 'الفحص الصحي الدوري («إفحص»)' },
  primary: { en: 'Family doctor', ar: 'طبيب الأسرة' },
  telehealth: { en: 'Teleconsultation', ar: 'استشارة عن بُعد' },
  andrology: { en: "Men's health specialist (andrology / urology)", ar: 'أخصائي صحة الرجل (ذكورة / مسالك)' },
  womens: { en: "Women's health (gynaecology, reproductive medicine)", ar: 'صحة المرأة (أمراض النساء، الطب الإنجابي)' },
  fertility: { en: 'Fertility service', ar: 'خدمة الخصوبة' },
  lab: { en: 'Lab test (blood tests, semen analysis)', ar: 'تحليل مخبري (تحاليل دم، سائل منوي)' },
  urgent: { en: 'Urgent care, same day', ar: 'رعاية عاجلة في اليوم نفسه' },
  occupational: { en: 'Occupational health', ar: 'الصحة المهنية' },
}

export const LANGUAGE_LABEL: Record<Language, L10n> = {
  ar: { en: 'Arabic', ar: 'العربية' },
  en: { en: 'English', ar: 'الإنجليزية' },
  hi: { en: 'Hindi', ar: 'الهندية' },
  ur: { en: 'Urdu', ar: 'الأردية' },
  ml: { en: 'Malayalam', ar: 'المالايالامية' },
  tl: { en: 'Tagalog', ar: 'التاغالوغية' },
}

export const AREA_LABEL: Record<Area, L10n> = {
  abu_dhabi: { en: 'Abu Dhabi city', ar: 'مدينة أبوظبي' },
  al_ain: { en: 'Al Ain', ar: 'العين' },
  al_dhafra: { en: 'Al Dhafra', ar: 'الظفرة' },
  online: { en: 'Online', ar: 'عبر الإنترنت' },
}

const ex = (en: string, ar: string): L10n => ({ en: `${en} (example)`, ar: `${ar} (مثال)` })
const CHECKED = '2026-11-16'
const lic = (n: number) => ({ id: `DOH-EX-${String(n).padStart(5, '0')}`, checked: CHECKED })

export const PROVIDERS: Provider[] = [
  { id: 'p01', name: ex('Family Health Centre, Khalifa City', 'مركز صحة الأسرة، مدينة خليفة'), services: ['screening', 'primary'], area: 'abu_dhabi', district: { en: 'Khalifa City', ar: 'مدينة خليفة' }, languages: ['ar', 'en', 'ur'], maleClinician: true, femaleClinician: true, telehealth: true, evenings: true, weekends: false, insurance: ['thiqa', 'basic', 'enhanced'], referralNeeded: false, nextSlotDays: 2, licence: lic(1021) },
  { id: 'p02', name: ex('Family Health Centre, Al Mushrif', 'مركز صحة الأسرة، المشرف'), services: ['screening', 'primary'], area: 'abu_dhabi', district: { en: 'Al Mushrif', ar: 'المشرف' }, languages: ['ar', 'en'], maleClinician: true, telehealth: false, evenings: false, weekends: false, insurance: ['thiqa', 'enhanced'], referralNeeded: false, nextSlotDays: 4, licence: lic(1034) },
  { id: 'p03', name: ex('Family Health Centre, Al Jimi', 'مركز صحة الأسرة، الجيمي'), services: ['screening', 'primary'], area: 'al_ain', district: { en: 'Al Jimi', ar: 'الجيمي' }, languages: ['ar', 'en', 'hi'], maleClinician: true, femaleClinician: true, telehealth: true, evenings: true, weekends: true, insurance: ['thiqa', 'basic', 'enhanced'], referralNeeded: false, nextSlotDays: 1, licence: lic(2007) },
  { id: 'p04', name: ex('Family Health Centre, Madinat Zayed', 'مركز صحة الأسرة، مدينة زايد'), services: ['screening', 'primary'], area: 'al_dhafra', district: { en: 'Madinat Zayed', ar: 'مدينة زايد' }, languages: ['ar', 'en', 'ml'], maleClinician: true, telehealth: true, evenings: false, weekends: false, insurance: ['thiqa', 'basic', 'enhanced'], referralNeeded: false, nextSlotDays: 3, licence: lic(3002) },
  { id: 'p05', name: ex('Virtual Family Doctor', 'طبيب الأسرة الافتراضي'), services: ['primary', 'telehealth'], area: 'online', district: { en: 'Video or phone', ar: 'فيديو أو هاتف' }, languages: ['ar', 'en', 'hi', 'ur', 'tl'], maleClinician: true, femaleClinician: true, telehealth: true, evenings: true, weekends: true, insurance: ['thiqa', 'basic', 'enhanced', 'self_pay'], referralNeeded: false, nextSlotDays: 0, licence: lic(4001) },
  { id: 'p06', name: ex("Men's Health & Andrology Clinic, Al Khalidiyah", 'عيادة صحة الرجل وأمراض الذكورة، الخالدية'), services: ['andrology', 'lab'], area: 'abu_dhabi', district: { en: 'Al Khalidiyah', ar: 'الخالدية' }, languages: ['ar', 'en'], maleClinician: true, telehealth: true, evenings: true, weekends: false, insurance: ['thiqa', 'enhanced', 'self_pay'], referralNeeded: true, nextSlotDays: 6, licence: lic(1150) },
  { id: 'p07', name: ex('Urology Clinic, Al Ain', 'عيادة المسالك البولية، العين'), services: ['andrology'], area: 'al_ain', district: { en: 'Al Mutaredh', ar: 'المطارض' }, languages: ['ar', 'en', 'ur'], maleClinician: true, telehealth: false, evenings: false, weekends: false, insurance: ['thiqa', 'enhanced'], referralNeeded: true, nextSlotDays: 9, licence: lic(2140) },
  { id: 'p08', name: ex('Fertility Centre, Al Reem Island', 'مركز الخصوبة، جزيرة الريم'), services: ['fertility', 'womens', 'lab', 'andrology'], area: 'abu_dhabi', district: { en: 'Al Reem Island', ar: 'جزيرة الريم' }, languages: ['ar', 'en', 'hi'], maleClinician: true, femaleClinician: true, telehealth: true, evenings: true, weekends: true, insurance: ['thiqa', 'enhanced', 'self_pay'], referralNeeded: false, nextSlotDays: 5, licence: lic(1203) },
  { id: 'p09', name: ex('Fertility Clinic, Al Ain', 'عيادة الخصوبة، العين'), services: ['fertility', 'womens', 'lab'], area: 'al_ain', district: { en: 'Al Towayya', ar: 'الطوية' }, languages: ['ar', 'en'], maleClinician: false, femaleClinician: true, telehealth: true, evenings: false, weekends: false, insurance: ['thiqa', 'enhanced', 'self_pay'], referralNeeded: false, nextSlotDays: 7, licence: lic(2210) },
  { id: 'p10', name: ex('Andrology Lab, Mussafah', 'مختبر الذكورة، مصفح'), services: ['lab'], area: 'abu_dhabi', district: { en: 'Mussafah', ar: 'مصفح' }, languages: ['ar', 'en', 'hi', 'ur', 'ml'], maleClinician: true, telehealth: false, evenings: true, weekends: true, insurance: ['thiqa', 'basic', 'enhanced', 'self_pay'], referralNeeded: false, nextSlotDays: 1, licence: lic(1310) },
  { id: 'p11', name: ex('Diagnostic Lab, Al Ain', 'مختبر التشخيص، العين'), services: ['lab'], area: 'al_ain', district: { en: 'Central District', ar: 'المنطقة المركزية' }, languages: ['ar', 'en', 'ml'], maleClinician: true, telehealth: false, evenings: true, weekends: false, insurance: ['thiqa', 'basic', 'enhanced', 'self_pay'], referralNeeded: false, nextSlotDays: 1, licence: lic(2330) },
  { id: 'p12', name: ex('Urgent Care Centre, Mussafah', 'مركز الرعاية العاجلة، مصفح'), services: ['urgent'], area: 'abu_dhabi', district: { en: 'Mussafah', ar: 'مصفح' }, languages: ['ar', 'en', 'hi', 'ur', 'ml', 'tl'], maleClinician: true, telehealth: false, evenings: true, weekends: true, insurance: ['thiqa', 'basic', 'enhanced', 'self_pay'], referralNeeded: false, nextSlotDays: 0, licence: lic(1402) },
  { id: 'p13', name: ex('Urgent Care Centre, Al Ain', 'مركز الرعاية العاجلة، العين'), services: ['urgent'], area: 'al_ain', district: { en: 'Al Jimi', ar: 'الجيمي' }, languages: ['ar', 'en', 'ur'], maleClinician: true, telehealth: false, evenings: true, weekends: true, insurance: ['thiqa', 'basic', 'enhanced', 'self_pay'], referralNeeded: false, nextSlotDays: 0, licence: lic(2402) },
  { id: 'p14', name: ex('Occupational Health Clinic, Mussafah Industrial', 'عيادة الصحة المهنية، مصفح الصناعية'), services: ['occupational', 'lab'], area: 'abu_dhabi', district: { en: 'Mussafah Industrial', ar: 'مصفح الصناعية' }, languages: ['ar', 'en', 'hi', 'ur', 'ml'], maleClinician: true, telehealth: false, evenings: true, weekends: true, insurance: ['basic', 'enhanced', 'self_pay'], referralNeeded: false, nextSlotDays: 2, licence: lic(1505) },
  { id: 'p15', name: ex("Men's Health Video Clinic", 'عيادة صحة الرجل عبر الفيديو'), services: ['andrology', 'telehealth'], area: 'online', district: { en: 'Video', ar: 'فيديو' }, languages: ['ar', 'en'], maleClinician: true, telehealth: true, evenings: true, weekends: true, insurance: ['enhanced', 'self_pay'], referralNeeded: false, nextSlotDays: 1, licence: lic(4012) },
  { id: 'p16', name: ex('Family Health Centre, Baniyas', 'مركز صحة الأسرة، بني ياس'), services: ['screening', 'primary'], area: 'abu_dhabi', district: { en: 'Baniyas', ar: 'بني ياس' }, languages: ['ar', 'en', 'tl'], maleClinician: false, femaleClinician: true, telehealth: true, evenings: true, weekends: true, insurance: ['thiqa', 'basic', 'enhanced'], referralNeeded: false, nextSlotDays: 3, licence: lic(1088) },
  { id: 'p17', name: ex("Women's Health Clinic, Al Bateen", 'عيادة صحة المرأة، البطين'), services: ['womens', 'lab'], area: 'abu_dhabi', district: { en: 'Al Bateen', ar: 'البطين' }, languages: ['ar', 'en', 'tl'], maleClinician: false, femaleClinician: true, telehealth: true, evenings: true, weekends: false, insurance: ['thiqa', 'basic', 'enhanced', 'self_pay'], referralNeeded: false, nextSlotDays: 3, licence: lic(1620) },
  { id: 'p18', name: ex('Obstetrics & Gynaecology Clinic, Al Ain', 'عيادة النساء والولادة، العين'), services: ['womens'], area: 'al_ain', district: { en: 'Al Jimi', ar: 'الجيمي' }, languages: ['ar', 'en', 'ur'], maleClinician: true, femaleClinician: true, telehealth: false, evenings: false, weekends: true, insurance: ['thiqa', 'basic', 'enhanced'], referralNeeded: true, nextSlotDays: 6, licence: lic(2650) },
  { id: 'p19', name: ex("Women's Health Video Clinic", 'عيادة صحة المرأة عبر الفيديو'), services: ['womens', 'telehealth'], area: 'online', district: { en: 'Video', ar: 'فيديو' }, languages: ['ar', 'en', 'hi'], maleClinician: false, femaleClinician: true, telehealth: true, evenings: true, weekends: true, insurance: ['enhanced', 'self_pay'], referralNeeded: false, nextSlotDays: 1, licence: lic(4030) },
  { id: 'p20', name: ex("Women's Health Centre, Ruwais", 'مركز صحة المرأة، الرويس'), services: ['womens', 'primary', 'screening'], area: 'al_dhafra', district: { en: 'Ruwais', ar: 'الرويس' }, languages: ['ar', 'en', 'ml', 'tl'], maleClinician: false, femaleClinician: true, telehealth: true, evenings: false, weekends: false, insurance: ['thiqa', 'basic', 'enhanced'], referralNeeded: false, nextSlotDays: 4, licence: lic(3060) },
]

/** What the person may ask for. Every field is optional; empty means "no preference". */
export interface CareFilter {
  services?: ServiceKind[]
  area?: Area
  languages?: Language[]
  maleClinician?: boolean
  femaleClinician?: boolean
  telehealth?: boolean
  evenings?: boolean
  weekends?: boolean
  insurance?: Insurance
}

export interface Match {
  provider: Provider
  /** Preferences this provider meets, for "why this match". */
  meets: string[]
  /** Preferences it does not meet (it can still be listed). */
  misses: string[]
}

/**
 * Hard rule: the service must fit the next step. Everything else is a preference: providers meeting more
 * preferences come first, then the earliest slot. Online services count as available in every area.
 */
export function findCare(f: CareFilter, list: Provider[] = PROVIDERS): Match[] {
  const out: Match[] = []
  for (const p of list) {
    if (f.services?.length && !p.services.some((s) => f.services!.includes(s))) continue
    const meets: string[] = []
    const misses: string[] = []
    const check = (key: string, ok: boolean) => (ok ? meets : misses).push(key)
    if (f.area) check('area', p.area === f.area || p.area === 'online')
    if (f.languages?.length) check('language', f.languages.some((l) => p.languages.includes(l)))
    if (f.maleClinician) check('male', p.maleClinician)
    if (f.femaleClinician) check('female', !!p.femaleClinician)
    if (f.telehealth) check('telehealth', p.telehealth)
    if (f.evenings) check('evenings', p.evenings)
    if (f.weekends) check('weekends', p.weekends)
    if (f.insurance) check('insurance', p.insurance.includes(f.insurance))
    out.push({ provider: p, meets, misses })
  }
  return out.sort((a, b) => a.misses.length - b.misses.length || a.provider.nextSlotDays - b.provider.nextSlotDays || a.provider.id.localeCompare(b.provider.id))
}

/**
 * A rule-based reader for preferences typed in plain words, in English or Arabic. The AI care search uses
 * the same filter shape, and falls back to this when the AI is off. It never reads a clinical level.
 */
export function parsePreferences(text: string): CareFilter {
  const t = text.toLowerCase()
  const has = (...words: (string | RegExp)[]) => words.some((w) => (typeof w === 'string' ? t.includes(w) : w.test(t)))
  const f: CareFilter = {}
  if (has('al ain', 'alain', 'العين')) f.area = 'al_ain'
  else if (has('dhafra', 'madinat zayed', 'ruwais', 'الظفرة', 'مدينة زايد', 'الرويس')) f.area = 'al_dhafra'
  else if (has('abu dhabi', 'mussafah', 'khalifa city', 'reem', 'أبوظبي', 'ابوظبي', 'مصفح', 'مدينة خليفة', 'الريم')) f.area = 'abu_dhabi'
  const languages: Language[] = []
  if (has('arabic', 'عربي', 'العربية', 'بالعربي')) languages.push('ar')
  if (has('english', 'إنجليزي', 'انجليزي', 'الإنجليزية')) languages.push('en')
  if (has('hindi', 'هندي', 'الهندية')) languages.push('hi')
  if (has('urdu', 'أردو', 'الأردية')) languages.push('ur')
  if (has('malayalam', 'مالايالام')) languages.push('ml')
  if (has('tagalog', 'filipino', 'تاغالوغ', 'فلبيني')) languages.push('tl')
  if (languages.length) f.languages = languages
  // Check for a woman clinician first: "female doctor" contains "male doctor".
  if (has(/\bfemale\b/, /\bwoman\b/, /\blady\b/, 'طبيبة', 'دكتورة', 'امرأة', 'أنثى', 'سيدة')) f.femaleClinician = true
  else if (has(/\bmale\b/, /\bman\b/, 'male doctor', 'طبيب رجل', 'دكتور رجل', 'طبيب ذكر', 'رجل')) f.maleClinician = true
  if (has('online', 'video', 'tele', 'phone call', 'from home', 'عن بعد', 'عن بُعد', 'فيديو', 'اونلاين', 'أونلاين', 'من البيت', 'من المنزل')) f.telehealth = true
  if (has('evening', 'after work', 'night', 'مساء', 'بعد الدوام', 'بعد العمل', 'ليلا', 'ليلاً')) f.evenings = true
  if (has('weekend', 'saturday', 'sunday', 'friday', 'نهاية الأسبوع', 'السبت', 'الأحد', 'الجمعة')) f.weekends = true
  if (has('thiqa', 'ثقة')) f.insurance = 'thiqa'
  else if (has('basic', 'الأساسي', 'الاساسي')) f.insurance = 'basic'
  else if (has('enhanced', 'المعزز')) f.insurance = 'enhanced'
  else if (has('self pay', 'self-pay', 'cash', 'نقدا', 'نقداً', 'على حسابي')) f.insurance = 'self_pay'
  return f
}

/** The same record as HL7 FHIR R4 HealthcareService, as the DoH register would serve it. */
export function toHealthcareService(p: Provider): Record<string, unknown> {
  return {
    resourceType: 'HealthcareService',
    id: p.id,
    active: true,
    name: p.name.en,
    identifier: [{ system: 'urn:example:doh-abu-dhabi:facility-licence', value: p.licence.id }],
    type: p.services.map((s) => ({ text: SERVICE_LABEL[s].en })),
    communication: p.languages.map((l) => ({ coding: [{ system: 'urn:ietf:bcp:47', code: l }] })),
    characteristic: [
      ...(p.maleClinician ? [{ text: 'Male clinician available' }] : []),
      ...(p.femaleClinician ? [{ text: 'Female clinician available' }] : []),
      ...(p.referralNeeded ? [{ text: 'Referral needed' }] : []),
    ],
    appointmentRequired: true,
    availableTime: [
      { daysOfWeek: ['mon', 'tue', 'wed', 'thu', 'fri'], availableStartTime: '08:00:00', availableEndTime: p.evenings ? '21:00:00' : '17:00:00' },
      ...(p.weekends ? [{ daysOfWeek: ['sat', 'sun'], availableStartTime: '09:00:00', availableEndTime: '17:00:00' }] : []),
    ],
    extension: [
      { url: 'urn:example:telehealth', valueBoolean: p.telehealth },
      { url: 'urn:example:licence-checked', valueDate: p.licence.checked },
      { url: 'urn:example:demo-record', valueBoolean: true },
    ],
  }
}
