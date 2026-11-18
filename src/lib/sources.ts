/**
 * Evidence behind each rule. Compiled by the team from published guidelines.
 * Every entry must be checked against the original document before submission.
 */
export interface Source {
  id: string
  short: string
  full: string
  url?: string
}

export const SOURCES: Record<string, Source> = {
  WHO2021: {
    id: 'WHO2021',
    short: 'WHO 2021 semen manual',
    full: 'World Health Organization. WHO laboratory manual for the examination and processing of human semen, 6th edition (2021). Lower reference limits (5th centile).',
    url: 'https://www.who.int/publications/i/item/9789240030787',
  },
  AUA2020: {
    id: 'AUA2020',
    short: 'AUA/ASRM male infertility guideline',
    full: 'Schlegel PN, et al. Diagnosis and Treatment of Infertility in Men: AUA/ASRM Guideline (2020, amended 2024).',
    url: 'https://www.auanet.org/guidelines-and-quality/guidelines/male-infertility',
  },
  EAU2024: {
    id: 'EAU2024',
    short: 'EAU sexual & reproductive health guideline',
    full: 'European Association of Urology. EAU Guidelines on Sexual and Reproductive Health (2024).',
    url: 'https://uroweb.org/guidelines/sexual-and-reproductive-health',
  },
  NICE_CG156: {
    id: 'NICE_CG156',
    short: 'NICE fertility guideline (CG156)',
    full: 'NICE CG156. Fertility problems: assessment and treatment (2013, updated 2017).',
    url: 'https://www.nice.org.uk/guidance/cg156',
  },
  NICE_NG12: {
    id: 'NICE_NG12',
    short: 'NICE suspected cancer guideline (NG12)',
    full: 'NICE NG12. Suspected cancer: recognition and referral, testicular cancer section.',
    url: 'https://www.nice.org.uk/guidance/ng12',
  },
  EAU_SCROTUM: {
    id: 'EAU_SCROTUM',
    short: 'Acute scrotum: emergency practice',
    full: 'Standard urological emergency practice for the acute scrotum (e.g. EAU guidelines): suspected testicular torsion needs surgical assessment within hours.',
  },
  ASRM2022: {
    id: 'ASRM2022',
    short: 'ASRM optimizing natural fertility',
    full: 'Practice Committee of the American Society for Reproductive Medicine. Optimizing natural fertility: a committee opinion (2022).',
  },
  ED_CVD: {
    id: 'ED_CVD',
    short: 'Princeton III consensus (ED and heart risk)',
    full: 'Nehra A, et al. The Princeton III Consensus recommendations for the management of erectile dysfunction and cardiovascular disease. Mayo Clin Proc (2012).',
  },
  IFHAS: {
    id: 'IFHAS',
    short: 'IFHAS periodic screening (ADPHC)',
    full: 'Abu Dhabi Public Health Centre. IFHAS comprehensive screening programme: Thiqa holders aged 18 to 75, typically every 3 years; since August 2025 it includes reproductive health screening for men and women aged 20–35. Book through the Sahatna app or an approved provider.',
    url: 'https://www.adphc.gov.ae/en/Public-Health-Programs/IFHAS',
  },
  MIDDAY_BREAK: {
    id: 'MIDDAY_BREAK',
    short: 'UAE midday work break',
    full: 'UAE Government portal (u.ae), health and safety at the workplace: no work under direct sunlight or in open places from 12:30 to 3:00 pm, 15 June to 15 September every year (Ministerial Resolution No. 44 of 2022, MoHRE).',
    url: 'https://u.ae/en/information-and-services/jobs/Workplace-regulations/health-and-safety-at-workplace',
  },
  SPERM_CYCLE: {
    id: 'SPERM_CYCLE',
    short: 'Sperm production time',
    full: 'Heller CG, Clermont Y. Spermatogenesis in man: an estimate of its duration. Science. 1963;140(3563):184-6 (about 64 days). Misell LM, et al. A stable isotope-mass spectrometric method for measuring human spermatogenesis kinetics in vivo. J Urol. 2006;175(1):242-6 (new sperm first in the ejaculate after 64 ± 8 days). US FDA. Testicular toxicity: evaluation during drug development, guidance for industry (2018): one spermatogenic cycle taken as 13 weeks.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/16406920/',
  },
  SEMEN_VARIABILITY: {
    id: 'SEMEN_VARIABILITY',
    short: 'Repeat tests (EAU; Keel 2006)',
    full: 'European Association of Urology. Guidelines on Sexual and Reproductive Health, 2026 edition, male infertility §11.3: perform at least two semen analyses if the first is abnormal; abnormal on two tests means further investigation. Keel BA. Within- and between-subject variation in semen parameters in infertile men and normal semen donors. Fertil Steril. 2006;85(1):128-34 (within-person variation in sperm count about 46–54%).',
    url: 'https://uroweb.org/guidelines/sexual-and-reproductive-health/chapter/male-infertility',
  },
  HEAT_REVIEW: {
    id: 'HEAT_REVIEW',
    short: 'Testicular heat stress review',
    full: 'Durairajanayagam D, Agarwal A, Ong C. Causes, effects and molecular mechanisms of testicular heat stress. Reprod Biomed Online. 2015;30(1):14-27. Garolla A, et al. Seminal and molecular evidence that sauna exposure affects human spermatogenesis. Hum Reprod. 2013;28(4):877-85 (effects reversed 6 months after stopping).',
    url: 'https://pubmed.ncbi.nlm.nih.gov/25456164/',
  },
  DRIVERS_HEAT: {
    id: 'DRIVERS_HEAT',
    short: 'Scrotal temperature in drivers',
    full: 'Bujan L, Daudin M, Charlet JP, Thonneau P, Mieusset R. Increase in scrotal temperature in car drivers. Hum Reprod. 2000;15(6):1355-7 (1.7–2.2 °C higher after 2 hours of driving).',
    url: 'https://pubmed.ncbi.nlm.nih.gov/10831568/',
  },
  LAPTOP_HEAT: {
    id: 'LAPTOP_HEAT',
    short: 'Laptop on the lap',
    full: 'Sheynkin Y, Jung M, Yoo P, Schulsinger D, Komaroff E. Increase in scrotal temperature in laptop computer users. Hum Reprod. 2005;20(2):452-5 (about 2.6–2.8 °C after 60 minutes).',
    url: 'https://pubmed.ncbi.nlm.nih.gov/15591087/',
  },
  PESTICIDES: {
    id: 'PESTICIDES',
    short: 'Pesticides and sperm (review)',
    full: 'Martenies SE, Perry MJ. Environmental and occupational pesticide exposure and human sperm parameters: a systematic review. Toxicology. 2013;307:66-73 (15 of 17 studies found associations; lower concentration most often).',
    url: 'https://pubmed.ncbi.nlm.nih.gov/23438386/',
  },
  SOLVENTS: {
    id: 'SOLVENTS',
    short: 'Solvents at work',
    full: 'Cherry N, Labrèche F, Collins J, Tulandi T. Occupational exposure to solvents and male infertility. Occup Environ Med. 2001;58(10):635-40.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/11555684/',
  },
  LEAD: {
    id: 'LEAD',
    short: 'Lead and sperm count',
    full: 'Bonde JP, et al. Sperm count and chromatin structure in men exposed to inorganic lead: lowest adverse effect levels. Occup Environ Med. 2002;59(4):234-42 (median concentration 49% lower with blood lead above 50 µg/dL).',
    url: 'https://pubmed.ncbi.nlm.nih.gov/11934950/',
  },
  RADIATION: {
    id: 'RADIATION',
    short: 'Radiation and the testis',
    full: 'Ogilvy-Stuart AL, Shalet SM. Effect of radiation on the human reproductive system. Environ Health Perspect. 1993;101 Suppl 2:109-16. Howell SJ, Shalet SM. Spermatogenesis after cancer treatment: damage and recovery. J Natl Cancer Inst Monogr. 2005;(34):12-7.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/8243379/',
  },
  SHIFT_SLEEP: {
    id: 'SHIFT_SLEEP',
    short: 'Shift work, sleep and semen',
    full: 'Liu K, et al. Adverse effects of circadian desynchrony on the male reproductive system: an epidemiological and experimental study. Hum Reprod. 2020;35(7):1515-28. Zhong O, et al. Effects of sleep disorders and circadian rhythm changes on male reproductive health: a systematic review and meta-analysis. Front Physiol. 2022;13:913369.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/32619235/',
  },
  BMI_SPERM: {
    id: 'BMI_SPERM',
    short: 'Weight and sperm',
    full: 'Sermondade N, et al. BMI in relation to sperm count: an updated systematic review and collaborative meta-analysis. Hum Reprod Update. 2013;19(3):221-31. Andersen E, et al. Sperm count is increased by diet-induced weight loss and maintained by exercise or GLP-1 analogue treatment: a randomized controlled trial. Hum Reprod. 2022;37(7):1414-22.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/35580859/',
  },
  SMOKING: {
    id: 'SMOKING',
    short: 'Smoking and semen quality',
    full: 'Sharma R, Harlev A, Agarwal A, Esteves SC. Cigarette smoking and semen quality: a new meta-analysis examining the effect of the 2010 World Health Organization laboratory methods for the examination of human semen. Eur Urol. 2016;70(4):635-45.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/27113031/',
  },
  BP_GUIDE: {
    id: 'BP_GUIDE',
    short: '2025 AHA/ACC blood pressure guideline',
    full: 'Jones DW, et al. 2025 AHA/ACC/AANP/AAPA/ABC/ACCP/ACPM/AGS/AMA/ASPC/NMA/PCNA/SGIM guideline for the prevention, detection, evaluation and management of high blood pressure in adults. Hypertension. 2025;82(10):e212-e316 (stage 2: 140/90 or higher; severe: above 180 and/or 120).',
    url: 'https://pubmed.ncbi.nlm.nih.gov/40811516/',
  },
  ADA_SOC: {
    id: 'ADA_SOC',
    short: 'ADA Standards of Care 2026',
    full: 'American Diabetes Association Professional Practice Committee. 2. Diagnosis and classification of diabetes: Standards of Care in Diabetes—2026. Diabetes Care. 2026;49(Suppl 1):S27-S49 (A1C 5.7–6.4% prediabetes range, 6.5% or more diabetes range, usually confirmed by a repeat test).',
    url: 'https://pubmed.ncbi.nlm.nih.gov/41358893/',
  },
  AUA_T2018: {
    id: 'AUA_T2018',
    short: 'Testosterone guidelines (AUA, Endocrine Society)',
    full: 'Mulhall JP, et al. Evaluation and management of testosterone deficiency: AUA guideline. J Urol. 2018;200(2):423-32 (300 ng/dL ≈ 10.4 nmol/L; no testosterone therapy for men trying to conceive). Bhasin S, et al. Testosterone therapy in men with hypogonadism: an Endocrine Society clinical practice guideline. J Clin Endocrinol Metab. 2018;103(5):1715-44 (confirm with a repeat morning test).',
    url: 'https://pubmed.ncbi.nlm.nih.gov/29601923/',
  },
  HOME_SPERM_TESTS: {
    id: 'HOME_SPERM_TESTS',
    short: 'Smartphone sperm tests',
    full: 'US FDA 510(k) K241628, YO Home Sperm Test 3.0 (2024): a cleared smartphone-based home test for concentration and motility that "does not provide a comprehensive evaluation of a male\'s fertility status". Kanakasabapathy MK, et al. An automated smartphone-based diagnostic assay for point-of-care semen analysis. Sci Transl Med. 2017;9(382):eaai7863. Ernandez J, et al. Direct-to-consumer semen analysis products. Andrology. 2025;13(8):2206-15.',
    url: 'https://www.accessdata.fda.gov/cdrh_docs/pdf24/K241628.pdf',
  },

  // ---- Women's reproductive health (added with the women's check; each one to be checked against the original) ----
  ASRM_FEMALE_EVAL: {
    id: 'ASRM_FEMALE_EVAL',
    short: 'ASRM: fertility evaluation of women',
    full: 'Practice Committee of the American Society for Reproductive Medicine. Fertility evaluation of infertile women: a committee opinion. Fertil Steril. 2021;116(5):1255-65 (evaluate after 12 months of trying, after 6 months from age 35, and immediately over 40 or with a known cause).',
    url: 'https://pubmed.ncbi.nlm.nih.gov/34607703/',
  },
  ASRM_ORT2020: {
    id: 'ASRM_ORT2020',
    short: 'ASRM: testing ovarian reserve',
    full: 'Practice Committee of the American Society for Reproductive Medicine. Testing and interpreting measures of ovarian reserve: a committee opinion. Fertil Steril. 2020;114(6):1151-7 (AMH and FSH predict response to ovarian stimulation, not natural fertility).',
    url: 'https://pubmed.ncbi.nlm.nih.gov/33280722/',
  },
  AMH_STEINER2017: {
    id: 'AMH_STEINER2017',
    short: 'AMH does not predict natural pregnancy (JAMA 2017)',
    full: 'Steiner AZ, et al. Association between biomarkers of ovarian reserve and infertility among older women of reproductive age. JAMA. 2017;318(14):1367-76 (women aged 30–44 trying naturally: low AMH was not associated with lower chances of conceiving by 6 or 12 cycles of trying).',
    url: 'https://pubmed.ncbi.nlm.nih.gov/29049585/',
  },
  ACOG_AGE2014: {
    id: 'ACOG_AGE2014',
    short: 'ACOG: female age-related fertility decline',
    full: 'American College of Obstetricians and Gynecologists Committee on Gynecologic Practice and ASRM Practice Committee. Female age-related fertility decline. Committee Opinion No. 589. Obstet Gynecol. 2014;123(3):719-21 (fertility declines gradually from about 32, faster after 37; earlier evaluation from 35).',
    url: 'https://pubmed.ncbi.nlm.nih.gov/24553169/',
  },
  ASRM_OOCYTE2018: {
    id: 'ASRM_OOCYTE2018',
    short: 'ASRM: planned egg freezing',
    full: 'Ethics Committee of the American Society for Reproductive Medicine. Planned oocyte cryopreservation for women seeking to preserve future reproductive potential: an Ethics Committee opinion. Fertil Steril. 2018;110(6):1022-8 (emerging but ethically permissible, with uncertain efficacy; chances are best when eggs are frozen at younger ages; counselling should cover costs, risks and realistic chances).',
    url: 'https://pubmed.ncbi.nlm.nih.gov/30396539/',
  },
  ASCO_FP2018: {
    id: 'ASCO_FP2018',
    short: 'ASCO: fertility preservation in cancer',
    full: 'Oktay K, et al. Fertility preservation in patients with cancer: ASCO clinical practice guideline update. J Clin Oncol. 2018;36(19):1994-2001 (discuss fertility risk and preservation as early as possible, before treatment starts; refer promptly). Updated in: Su HI, et al. Fertility preservation in people with cancer: ASCO guideline update. J Clin Oncol. 2025;43(12):1488-1515.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/40106739/',
  },
  ESHRE_FP2020: {
    id: 'ESHRE_FP2020',
    short: 'ESHRE: female fertility preservation',
    full: 'ESHRE Guideline Group on Female Fertility Preservation. ESHRE guideline: female fertility preservation. Hum Reprod Open. 2020;2020(4):hoaa052.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/33225079/',
  },
  ESHRE_POI2024: {
    id: 'ESHRE_POI2024',
    short: 'ESHRE: premature ovarian insufficiency',
    full: 'Panay N, Anderson RA, Bennie A, et al.; ESHRE, ASRM, CREWHIRL and IMS Guideline Group on POI. Evidence-based guideline: premature ovarian insufficiency. Hum Reprod Open. 2024;2024(4):hoae065 (before 40: absent or infrequent periods for at least 4 months with FSH above 25 IU/L; one raised FSH is enough).',
    url: 'https://pubmed.ncbi.nlm.nih.gov/39660328/',
  },
  PCOS2023: {
    id: 'PCOS2023',
    short: 'International PCOS guideline 2023',
    full: 'Teede HJ, et al. Recommendations from the 2023 international evidence-based guideline for the assessment and management of polycystic ovary syndrome. Hum Reprod. 2023;38(9):1655-79 (irregular cycles in adults, more than 3 years after the first period: under 21 or over 35 days, fewer than 8 a year, or any single cycle over 90 days; PCOS affects about 10–13% of women).',
    url: 'https://pubmed.ncbi.nlm.nih.gov/37580037/',
  },
  FIGO2018: {
    id: 'FIGO2018',
    short: 'FIGO: normal menstrual cycles',
    full: 'Munro MG, Critchley HOD, Fraser IS; FIGO Menstrual Disorders Committee. The two FIGO systems for normal and abnormal uterine bleeding symptoms and classification of causes of abnormal uterine bleeding in the reproductive years: 2018 revisions. Int J Gynaecol Obstet. 2018;143(3):393-408 (normal regularity: shortest to longest cycle varies by 7–9 days or less).',
    url: 'https://pubmed.ncbi.nlm.nih.gov/30198563/',
  },
  ESHRE_ENDO2022: {
    id: 'ESHRE_ENDO2022',
    short: 'ESHRE endometriosis guideline 2022',
    full: 'Becker CM, et al. ESHRE guideline: endometriosis. Hum Reprod Open. 2022;2022(2):hoac009 (consider endometriosis with painful periods, deep pain with sex, or infertility; discuss fertility before ovarian surgery).',
    url: 'https://pubmed.ncbi.nlm.nih.gov/35350465/',
  },
  NICE_NG73: {
    id: 'NICE_NG73',
    short: 'NICE endometriosis guideline (NG73)',
    full: 'NICE NG73. Endometriosis: diagnosis and management (2017, updated 2024).',
    url: 'https://www.nice.org.uk/guidance/ng73',
  },
  NICE_NG88: {
    id: 'NICE_NG88',
    short: 'NICE heavy menstrual bleeding (NG88)',
    full: 'NICE NG88. Heavy menstrual bleeding: assessment and management (2018, updated 2026): check a full blood count in women with heavy menstrual bleeding.',
    url: 'https://www.nice.org.uk/guidance/ng88',
  },
  NICE_NG126: {
    id: 'NICE_NG126',
    short: 'NICE ectopic pregnancy and miscarriage (NG126)',
    full: 'NICE NG126. Ectopic pregnancy and miscarriage: diagnosis and initial management (2019, updated 2026): refer women who are haemodynamically unstable directly to emergency care (1.4.1); refer immediately to an early pregnancy assessment service with a positive pregnancy test plus pain and abdominal tenderness (1.4.7).',
    url: 'https://www.nice.org.uk/guidance/ng126',
  },
  ESHRE_RPL2022: {
    id: 'ESHRE_RPL2022',
    short: 'ESHRE recurrent pregnancy loss guideline',
    full: 'ESHRE Guideline Group on RPL. ESHRE guideline: recurrent pregnancy loss: an update in 2022. Hum Reprod Open. 2023;2023(1):hoad002 (recurrent pregnancy loss: two or more losses; offer investigation, including thyroid and antiphospholipid testing).',
    url: 'https://pubmed.ncbi.nlm.nih.gov/36873081/',
  },
  CDC_STI2021: {
    id: 'CDC_STI2021',
    short: 'CDC STI treatment guidelines 2021',
    full: 'Workowski KA, et al. Sexually transmitted infections treatment guidelines, 2021. MMWR Recomm Rep. 2021;70(4):1-187 (pelvic inflammatory disease: treat promptly to prevent tubal damage and infertility).',
    url: 'https://pubmed.ncbi.nlm.nih.gov/34292926/',
  },
  ATA2017: {
    id: 'ATA2017',
    short: 'ATA thyroid and pregnancy guideline',
    full: 'Alexander EK, et al. 2017 Guidelines of the American Thyroid Association for the diagnosis and management of thyroid disease during pregnancy and the postpartum. Thyroid. 2017;27(3):315-89.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/28056690/',
  },
  FOLIC_USPSTF2023: {
    id: 'FOLIC_USPSTF2023',
    short: 'USPSTF: folic acid before pregnancy',
    full: 'US Preventive Services Task Force. Folic acid supplementation to prevent neural tube defects: US Preventive Services Task Force reaffirmation recommendation statement. JAMA. 2023;330(5):454-9 (0.4–0.8 mg daily for anyone who could become pregnant, starting at least 1 month before conception and continuing through the first 2–3 months).',
    url: 'https://pubmed.ncbi.nlm.nih.gov/37526713/',
  },
  WHO_PRECONCEPTION: {
    id: 'WHO_PRECONCEPTION',
    short: 'WHO preconception care',
    full: 'World Health Organization. Preconception care: maximizing the gains for maternal and child health. Policy brief (2013): nutrition (including folic acid), vaccination (including rubella), tobacco, genetic conditions and other risks to address before pregnancy.',
    url: 'https://www.who.int/publications/i/item/WHO-FWC-MCA-13.02',
  },
  MHRA_VALPROATE: {
    id: 'MHRA_VALPROATE',
    short: 'MHRA: valproate and pregnancy',
    full: 'MHRA. Valproate – reproductive risks (published 10 Jun 2025, updated 23 Sep 2025): must not be prescribed to anyone able to have children unless the Pregnancy Prevention Programme is followed; do not stop without specialist advice.',
    url: 'https://www.gov.uk/guidance/valproate-reproductive-risks',
  },
  MENOPAUSE_FH: {
    id: 'MENOPAUSE_FH',
    short: 'Early menopause runs in families',
    full: 'Torgerson DJ, Thomas RE, Reid DM. Mothers and daughters menopausal ages: is there a link? Eur J Obstet Gynecol Reprod Biol. 1997;74(1):63-6 (odds of early or premature menopause 6.0 times higher when the mother had an early menopause). Cramer DW, Xu H, Harlow BL. Family history as a predictor of early menopause. Fertil Steril. 1995;64(4):740-5.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/9243205/',
  },
  NICE_NG12_GYN: {
    id: 'NICE_NG12_GYN',
    short: 'NICE NG12: gynaecological cancers',
    full: 'NICE NG12. Suspected cancer: recognition and referral, gynaecological cancers: refer on a suspected cancer pathway if, on examination, the cervix looks consistent with cervical cancer (1.5.16), and for unexplained vulval lump, ulceration or bleeding (1.5.17). Unexplained bleeding is assessed by examination.',
    url: 'https://www.nice.org.uk/guidance/ng12',
  },

}
