import type { Answers, Level } from '../lib/types'

/**
 * Synthetic test cases. No real people.
 * The expected next step for each case was written from guideline reasoning (see `why`),
 * case by case, not by running the engine. They still need independent review by clinicians.
 */
export interface EvalCase {
  id: string
  title: string
  answers: Answers
  expected: Level | 'ineligible'
  expectEmergency?: boolean
  /** The case contains deliberately bad data that the data-quality gate must catch. */
  expectDataIssue?: string
  why: string
}

const BASE: Answers = {
  age: 31,
  urgent_symptoms: ['none'],
  height_cm: 176,
  weight_kg: 72,
  ttc: 'not_now',
  anat: ['none'],
  mumps: 'no',
  sti_now: 'no',
  sti_past: 'no',
  conditions: ['none'],
  meds: ['none'],
  sexual: ['none'],
  tobacco: 'no',
  heat: ['none'],
  activity: '2to4',
  sleep: '6to8',
  last_check: 'lt1y',
  semen_done: 'no',
  family_hx: 'no',
}

/** A woman with no risk signals, not trying yet and undecided on timing. */
const BASE_F: Answers = {
  sex: 'female',
  age: 29,
  urgent_symptoms: ['none'],
  height_cm: 165,
  weight_kg: 60,
  ttc: 'not_now',
  plans_when: 'unsure',
  cycle: 'regular',
  gyn_symptoms: ['none'],
  gyn_history: ['none'],
  sti_now: 'no',
  sti_past: 'no',
  conditions: ['none'],
  meds_f: ['none'],
  tobacco: 'no',
  activity: '2to4',
  sleep: '6to8',
  last_check: 'lt1y',
  hormone_done: 'no',
  family_hx: 'no',
  menopause_fh: 'no',
}

const f = (id: string, title: string, over: Answers, expected: EvalCase['expected'], why: string, extra: Partial<EvalCase> = {}): EvalCase => ({
  id,
  title,
  answers: { ...BASE_F, ...over },
  expected,
  why,
  ...extra,
})

const c = (id: string, title: string, over: Answers, expected: EvalCase['expected'], why: string, extra: Partial<EvalCase> = {}): EvalCase => ({
  id,
  title,
  answers: { ...BASE, ...over },
  expected,
  why,
  ...extra,
})

export const CASES: EvalCase[] = [
  // ---- Self-care ----
  c('C01', 'Healthy, recent check-up', {}, 'selfcare', 'No risk signals; routine check within the last year.'),
  c('C02', 'Daily smoker', { age: 26, tobacco: 'daily' }, 'selfcare', 'Tobacco is a modifiable habit; no clinical findings on its own.'),
  c('C03', 'Sauna and laptop user', { age: 34, heat: ['sauna', 'sitting'] }, 'selfcare', 'Heat exposure is modifiable and usually reversible.'),
  c('C04', 'Overweight (BMI ~27)', { age: 38, weight_kg: 84 }, 'selfcare', 'BMI 25–29.9: lifestyle advice, no referral needed by itself.'),
  c('C05', 'Past treated infection only', { age: 29, sti_past: 'yes' }, 'selfcare', 'Past treated infection is information for a clinician, not a referral trigger.'),
  c('C06', 'Normal semen analysis', { age: 33, semen_done: 'yes', volume_ml: 2.5, concentration: 45, total_motility: 55, progressive: 40, morphology: 6 }, 'selfcare', 'All values at or above WHO 2021 lower limits.'),
  c('C07', 'Trying 8 months, partner under 35', { age: 30, ttc: 'yes', ttc_months: '6to12', partner_age: 'under35' }, 'selfcare', 'Below the 12-month threshold with partner under 35 and no risk factors.'),
  c('C08', 'Trying 4 months, partner 35+', { age: 36, ttc: 'yes', ttc_months: 'lt6', partner_age: '35plus' }, 'selfcare', 'Below the 6-month threshold even with partner 35+.'),
  c('C09', 'Age 52 planning a child', { age: 52, ttc: 'planning' }, 'selfcare', 'Age is information only; no clinical finding.'),
  c('C10', 'Everything sensitive declined', { age: 27, sti_now: 'prefer_not', sti_past: 'prefer_not', sexual: ['prefer_not'], meds: ['prefer_not'], anat: ['prefer_not'] }, 'selfcare', 'Declining must never raise the level; it is recorded for the clinician only if shared.'),
  c('C11', 'Outdoor heat worker, inactive, short sleep', { age: 41, heat: ['outdoor_heat'], activity: '0to1', sleep: 'lt6' }, 'selfcare', 'All modifiable habits; no clinical findings.'),
  c('C12', 'Family history, planning', { age: 28, ttc: 'planning', family_hx: 'yes' }, 'selfcare', 'Family history is information for counselling, not a referral trigger.'),
  c('C13', 'No height or weight given', { age: 24, height_cm: undefined, weight_kg: undefined }, 'selfcare', 'Missing optional data must not break the result.'),
  c('C14', 'Check-up 1–3 years ago', { age: 35, last_check: '1to3y' }, 'selfcare', 'Due soon is a reminder only.'),
  c('C15', 'Impossible weight entered', { age: 30, weight_kg: 900 }, 'selfcare', 'Implausible weight must be ignored (no BMI) and flagged for checking.', { expectDataIssue: 'DQ_WEIGHT' }),
  c('C16', 'Inconsistent motility values', { age: 32, semen_done: 'yes', volume_ml: 2, concentration: 30, total_motility: 60, progressive: 70, morphology: 5 }, 'selfcare', 'Progressive > total is impossible and must be flagged; other values are normal.', { expectDataIssue: 'DQ_SEMEN_MOTILITY' }),

  // ---- Primary care ----
  c('C17', 'Overdue routine check', { age: 44, last_check: 'gt3y' }, 'primary', 'Periodic adult screening overdue: route to the family doctor (heart and diabetes checks).'),
  c('C18', 'Unsure when last checked', { age: 39, last_check: 'unsure' }, 'primary', 'Unknown screening status treated as overdue.'),
  c('C19', 'Obesity (BMI ~32)', { age: 37, weight_kg: 99 }, 'primary', 'BMI 30+: metabolic risk; family doctor for blood tests and weight support.'),
  c('C20', 'Diabetes', { age: 45, conditions: ['diabetes'] }, 'primary', 'Known diabetes affects sexual function and sperm; review control.'),
  c('C21', 'High blood pressure', { age: 50, conditions: ['high_bp'] }, 'primary', 'Vascular risk and medicine review.'),
  c('C22', 'Snoring and daytime tiredness', { age: 42, conditions: ['snoring'] }, 'primary', 'Possible sleep apnoea, linked with low testosterone.'),
  c('C23', 'Erection difficulty', { age: 40, sexual: ['erection'] }, 'primary', 'ED is an early cardiovascular marker; primary care check first.'),
  c('C24', 'Low desire only', { age: 35, sexual: ['low_desire'] }, 'primary', 'Hormone and metabolic check in primary care.'),
  c('C25', 'Current genital symptoms', { age: 25, sti_now: 'yes' }, 'primary', 'Confidential testing and treatment in primary or sexual health care.'),
  c('C26', 'Hair-loss tablets', { age: 30, meds: ['five_ari'] }, 'primary', 'Medicine review; do not stop on own.'),
  c('C27', 'Thyroid condition', { age: 33, conditions: ['thyroid'] }, 'primary', 'Make sure thyroid control is up to date.'),
  c('C28', 'Many metabolic risks together', { age: 47, conditions: ['diabetes'], sexual: ['erection'], weight_kg: 104, tobacco: 'daily', last_check: 'gt3y' }, 'primary', 'Several primary-care issues; still primary care, not a specialist, as first step.'),

  // ---- Fertility services ----
  c('C29', 'Trying 14 months', { age: 32, ttc: 'yes', ttc_months: 'gt12', partner_age: 'under35' }, 'fertility', '12+ months of trying: couple assessment.'),
  c('C30', 'Trying 8 months, partner 35+', { age: 38, ttc: 'yes', ttc_months: '6to12', partner_age: '35plus' }, 'fertility', '6+ months with partner 35+: assess earlier.'),
  c('C31', 'Trying 14 months with obesity', { age: 36, ttc: 'yes', ttc_months: 'gt12', partner_age: 'under35', weight_kg: 98 }, 'fertility', 'Fertility assessment is the main step; primary care for weight is a second step.'),
  c('C32', 'Trying 13 months on hair-loss tablets', { age: 34, ttc: 'yes', ttc_months: 'gt12', partner_age: 'under35', meds: ['five_ari'] }, 'fertility', 'Fertility assessment first; medicine review alongside.'),

  // ---- Men's health specialist ----
  c('C33', 'Gym steroid use', { age: 27, meds: ['testosterone'] }, 'specialist', 'Exogenous testosterone suppresses spermatogenesis; specialist-planned recovery.'),
  c('C34', 'Undescended testicle as a child', { age: 29, anat: ['undescended'] }, 'specialist', 'Cryptorchidism history: specialist review and semen analysis.'),
  c('C35', 'Possible varicocele', { age: 31, anat: ['varicocele'] }, 'specialist', 'Symptoms suggestive of varicocele: specialist examination or ultrasound.'),
  c('C36', 'Mumps orchitis after puberty', { age: 35, mumps: 'yes' }, 'specialist', 'Post-pubertal mumps orchitis can damage spermatogenesis.'),
  c('C37', 'Past chemotherapy', { age: 34, conditions: ['cancer_past'] }, 'specialist', 'Gonadotoxic treatment history.'),
  c('C38', 'Low sperm concentration', { age: 33, semen_done: 'yes', volume_ml: 2.2, concentration: 9, total_motility: 45, progressive: 33, morphology: 5 }, 'specialist', 'Concentration below WHO 2021 lower limit of 16 million/mL.'),
  c('C39', 'No sperm in sample', { age: 36, semen_done: 'yes', volume_ml: 2.8, concentration: 0 }, 'specialist', 'Azoospermia needs specialist assessment.'),
  c('C40', 'Low morphology only', { age: 30, semen_done: 'yes', volume_ml: 2.4, concentration: 35, total_motility: 50, progressive: 35, morphology: 3 }, 'specialist', 'A value below the WHO lower limit: specialist review (likely repeat test).'),
  c('C41', 'Ejaculation problems', { age: 37, sexual: ['ejaculation'] }, 'specialist', 'Low or absent ejaculate or pain: possible obstruction.'),
  c('C42', 'Hernia repair in the past', { age: 40, anat: ['injury_surgery'] }, 'specialist', 'Groin surgery can affect the vas deferens.'),
  c('C43', 'Trying 14 months with varicocele signs', { age: 33, ttc: 'yes', ttc_months: 'gt12', partner_age: 'under35', anat: ['varicocele'] }, 'specialist', 'Specific male finding: specialist is the main step, fertility service alongside.'),
  c('C44', 'Trying 13 months on steroids', { age: 30, ttc: 'yes', ttc_months: 'gt12', partner_age: 'under35', meds: ['testosterone'] }, 'specialist', 'Steroid-related suppression needs specialist planning first.'),

  // ---- Urgent (red flags) ----
  c('C45', 'Sudden severe testicular pain', { age: 19, urgent_symptoms: ['sudden_pain'] }, 'urgent', 'Possible torsion: emergency.', { expectEmergency: true }),
  c('C46', 'Painful swelling with fever', { age: 28, urgent_symptoms: ['swelling_fever'] }, 'urgent', 'Possible epididymo-orchitis: same-day assessment.'),
  c('C47', 'New lump', { age: 26, urgent_symptoms: ['new_lump'] }, 'urgent', 'Possible testicular cancer: urgent referral and ultrasound.'),
  c('C48', 'Cancer treatment about to start', { age: 31, conditions: ['cancer_planned'] }, 'urgent', 'Time-critical fertility preservation before treatment.'),
  c('C49', 'Sudden pain while trying, smoker', { age: 34, urgent_symptoms: ['sudden_pain'], ttc: 'yes', ttc_months: 'gt12', partner_age: '35plus', tobacco: 'daily' }, 'urgent', 'Emergency overrides every other step.', { expectEmergency: true }),
  c('C50', 'New lump, declined private questions', { age: 23, urgent_symptoms: ['new_lump'], sexual: ['prefer_not'], sti_now: 'prefer_not' }, 'urgent', 'Declining other questions must not hide a red flag.'),
  c('C51', 'Lump and fever together', { age: 30, urgent_symptoms: ['new_lump', 'swelling_fever'] }, 'urgent', 'Multiple red flags.'),
  c('C52', 'Lump with steroid use', { age: 28, urgent_symptoms: ['new_lump'], meds: ['testosterone'] }, 'urgent', 'Red flag outranks specialist findings.'),

  // ---- Eligibility ----
  c('C53', 'Under 18', { age: 17 }, 'ineligible', 'The check is for adults; under-18s are directed elsewhere.'),
  c('C54', 'Age missing', { age: undefined }, 'ineligible', 'Age is required; the gate asks for it.', { expectDataIssue: 'DQ_AGE_MISSING' }),

  // ---- Women: self-care ----
  f('W01', 'Woman 29, regular cycles, undecided on timing', {}, 'selfcare', 'No risk signals; under 32, so no timing conversation is needed yet.'),
  f('W02', 'Trying 8 months at 30, regular cycles', { age: 30, ttc: 'yes', ttc_months: '6to12', plans_when: undefined, folic: 'yes' }, 'selfcare', 'Below the 12-month threshold under 35 with no known cause (NICE CG156, ASRM 2021).'),
  f('W03', 'Underweight (BMI ~17)', { weight_kg: 46 }, 'selfcare', 'Low BMI with regular cycles: lifestyle advice (NICE CG156).'),
  f('W04', 'Daily smoker', { age: 27, tobacco: 'daily' }, 'selfcare', 'Modifiable habit; no clinical finding on its own.'),
  f('W05', 'AMH typed in pmol/L by mistake', { hormone_done: 'yes', amh: 20 }, 'selfcare', 'The data gate must flag the likely unit error; the value is not low.', { expectDataIssue: 'DQ_AMH_UNIT' }),
  f('W06', 'Men’s answers left over in a woman’s check', { anat: ['varicocele'], semen_done: 'yes', concentration: 2, heat: ['sauna'] }, 'selfcare', 'Answers that belong to a man’s check must never change a woman’s result.'),

  // ---- Women: family doctor or women’s health clinic ----
  f('W07', 'Irregular cycles with excess hair', { age: 24, cycle: 'irregular', gyn_symptoms: ['hair_acne'] }, 'primary', 'Possible PCOS: assessment in primary care (PCOS guideline 2023).'),
  f('W08', 'No period for 3 months, not trying', { age: 27, cycle: 'none_3m' }, 'primary', 'Secondary amenorrhoea needs assessment (pregnancy test, hormones).'),
  f('W09', 'Severe period pain', { age: 25, gyn_symptoms: ['severe_period_pain'] }, 'primary', 'Possible endometriosis: assess in primary care first (ESHRE 2022, NICE NG73).'),
  f('W10', 'Heavy periods', { age: 35, gyn_symptoms: ['heavy_periods'], plans_when: 'none' }, 'primary', 'Heavy menstrual bleeding: blood count and treatment options (NICE NG88).'),
  f('W11', 'Bleeding between periods', { age: 30, gyn_symptoms: ['bleeding_between'] }, 'primary', 'Intermenstrual bleeding needs an examination (NICE NG12).'),
  f('W12', 'Known PCOS, planning in 1–2 years', { age: 28, gyn_history: ['pcos'], plans_when: '1to2y', folic: 'no' }, 'primary', 'Known condition plus pregnancy planning: preconception counselling.'),
  f('W13', 'Planning next year, no folic acid', { age: 30, ttc: 'planning', plans_when: undefined, folic: 'no' }, 'primary', 'Preconception visit for everyone planning a pregnancy (WHO 2013); folic acid as self-care.'),
  f('W14', 'Age 34, would like children in 3–5 years', { age: 34, plans_when: '3to5y' }, 'selfcare', 'Age-related decline makes a timing conversation worth offering (ACOG 589), as an option, not a referral: age alone does not need a doctor.'),
  f('W15', 'Age 27, mother had early menopause, plans over 5 years', { age: 27, plans_when: 'gt5y', menopause_fh: 'yes' }, 'selfcare', 'Early menopause in the family brings the offered timing conversation forward (Torgerson 1997); still an option, not a referral.'),
  f('W16', 'Low AMH at 33, undecided', { age: 33, hormone_done: 'yes', amh: 0.6 }, 'primary', 'Low AMH is a counselling point about timing, not a fertility verdict (ASRM 2020; Steiner 2017).'),
  f('W17', 'Raised FSH at 38, no plans', { age: 38, plans_when: 'none', hormone_done: 'yes', fsh: 12 }, 'primary', 'Raised early-cycle FSH: discuss and possibly repeat.'),
  f('W18', 'TSH outside range', { age: 30, hormone_done: 'yes', tsh: 6.2 }, 'primary', 'Thyroid out of range: repeat and treat in primary care (ATA 2017).'),
  f('W19', 'Epilepsy medicine, planning a pregnancy', { age: 26, ttc: 'planning', plans_when: undefined, meds_f: ['valproate'], folic: 'yes' }, 'primary', 'Valproate needs specialist review before pregnancy (MHRA); never stop alone.'),
  f('W20', 'Isotretinoin, not planning', { age: 22, meds_f: ['isotretinoin'] }, 'primary', 'Isotretinoin needs a pregnancy prevention plan whatever the plans.'),
  f('W21', 'Obesity (BMI ~32)', { age: 31, weight_kg: 87 }, 'primary', 'BMI 30+: metabolic checks and weight support (NICE CG156).'),
  f('W22', 'Diabetes, planning next year', { age: 33, ttc: 'planning', plans_when: undefined, conditions: ['diabetes'], folic: 'yes' }, 'primary', 'Pre-pregnancy diabetes control matters (ADA); preconception counselling.'),

  // ---- Women: fertility assessment ----
  f('W23', 'Trying 7 months at 37', { age: 37, ttc: 'yes', ttc_months: '6to12', plans_when: undefined, folic: 'yes' }, 'fertility', 'From 35, assess after 6 months of trying (NICE CG156, ASRM 2021).'),
  f('W24', 'Trying 3 months at 41', { age: 41, ttc: 'yes', ttc_months: 'lt6', plans_when: undefined, folic: 'yes' }, 'fertility', 'Over 40, assess straight away (ASRM 2021).'),
  f('W25', 'Trying 14 months at 29', { ttc: 'yes', ttc_months: 'gt12', plans_when: undefined, folic: 'yes' }, 'fertility', '12 months without pregnancy: couple assessment.'),
  f('W26', 'Trying 4 months with absent periods', { age: 30, ttc: 'yes', ttc_months: 'lt6', plans_when: undefined, cycle: 'none_3m', folic: 'yes' }, 'fertility', 'Known cause (anovulation): do not wait 12 months (NICE CG156).'),
  f('W27', 'Trying 4 months after a pelvic infection', { age: 31, ttc: 'yes', ttc_months: 'lt6', plans_when: undefined, gyn_history: ['pid'], folic: 'yes' }, 'fertility', 'Possible tubal factor: earlier referral (NICE CG156).'),

  // ---- Women: specialist ----
  f('W28', 'Two miscarriages, trying again', { age: 32, ttc: 'yes', ttc_months: 'lt6', plans_when: undefined, gyn_history: ['miscarriage2'], folic: 'yes' }, 'specialist', 'Recurrent pregnancy loss: investigate after two losses (ESHRE 2022).'),
  f('W29', 'FSH 40 with absent periods at 34', { age: 34, cycle: 'none_3m', hormone_done: 'yes', fsh: 40 }, 'specialist', 'Possible premature ovarian insufficiency (ESHRE 2024).'),
  f('W30', 'Past chemotherapy', { age: 32, conditions: ['cancer_past'] }, 'specialist', 'Possible reduced ovarian reserve after gonadotoxic treatment.'),

  // ---- Women: urgent ----
  f('W31', 'Severe one-sided pain with a late period', { age: 28, urgent_symptoms: ['ectopic_signs'] }, 'urgent', 'Possible ectopic pregnancy: emergency (NICE NG126).', { expectEmergency: true }),
  f('W32', 'Very heavy bleeding', { age: 35, urgent_symptoms: ['heavy_bleeding'] }, 'urgent', 'Same-day assessment for haemorrhage risk.'),
  f('W33', 'Pelvic pain with fever', { age: 23, urgent_symptoms: ['pelvic_fever'] }, 'urgent', 'Possible pelvic inflammatory disease: same-day treatment (CDC 2021).'),
  f('W34', 'Cancer treatment about to start', { age: 30, conditions: ['cancer_planned'] }, 'urgent', 'Time-critical fertility preservation before treatment (ASCO 2018).'),
  f('W35', 'Ectopic signs, declined private questions', { age: 26, urgent_symptoms: ['ectopic_signs'], gyn_symptoms: ['prefer_not'], gyn_history: ['prefer_not'] }, 'urgent', 'Declining other questions must not hide a red flag.', { expectEmergency: true }),
]

/** Groups used only for fairness testing. The engine never sees these. */
export const NATIONALITY_GROUPS = ['Emirati', 'Other Arab', 'South Asian', 'Western', 'Other'] as const
export const LANGS = ['en', 'ar'] as const

export function ageBand(age: unknown): string {
  const n = typeof age === 'number' ? age : Number.NaN
  if (!Number.isFinite(n) || n < 18) return 'under 18 / unknown'
  if (n < 30) return '18–29'
  if (n < 40) return '30–39'
  if (n < 50) return '40–49'
  return '50+'
}
