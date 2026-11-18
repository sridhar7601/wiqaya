/**
 * Synthetic semen analysis reports, in the layouts labs really use. Every person, lab and number here is made up.
 * They are used to measure how accurately the report reader transcribes values (report-eval.test.ts),
 * and two of them are the "try a sample report" pictures in the app.
 */

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩'
const arNum = (n) => String(n).replace(/\d/g, (d) => AR_DIGITS[d]).replace('.', '٫')

const page = (body, { dir = 'ltr', font = "Helvetica, Arial, 'Geeza Pro', sans-serif", width = 820 } = {}) => `<!doctype html>
<html dir="${dir}"><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; }
  body { margin: 0; background: #fff; color: #1b1b1b; font: 13px/1.45 ${font}; width: ${width}px; padding: 34px 40px 30px; }
  h1 { font-size: 19px; margin: 0; letter-spacing: .3px; }
  h2 { font-size: 13px; margin: 18px 0 6px; text-transform: uppercase; letter-spacing: .6px; color: #1f3c5a; }
  table { width: 100%; border-collapse: collapse; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1f3c5a; padding-bottom: 10px; }
  .muted { color: #5c6470; font-size: 11.5px; }
  .tag { display: inline-block; border: 1px solid #b23b3b; color: #b23b3b; font-size: 10.5px; padding: 1px 6px; border-radius: 3px; letter-spacing: .4px; }
  .meta td { padding: 2px 0; font-size: 12.5px; }
  .res th { text-align: start; font-size: 11.5px; background: #eef2f6; border: 1px solid #c9d1da; padding: 5px 8px; }
  .res td { border: 1px solid #c9d1da; padding: 5px 8px; }
  .res td.v { font-weight: 700; text-align: center; }
  .low { color: #b23b3b; }
  .foot { margin-top: 22px; display: flex; justify-content: space-between; font-size: 11.5px; color: #5c6470; }
  .mono { font-family: Menlo, Consolas, monospace; }
</style></head><body>${body}</body></html>`

const header = (title, sub) => `
  <div class="head">
    <div><h1>${esc(title)}</h1><div class="muted">${esc(sub)}</div></div>
    <div style="text-align:end"><span class="tag">SYNTHETIC SAMPLE</span><div class="muted">Not a real patient</div></div>
  </div>`

const meta = (p) => `
  <table class="meta" style="margin-top:10px"><tr>
    <td><b>Patient:</b> ${esc(p.name)}</td><td><b>File no.:</b> ${esc(p.mrn)}</td><td><b>Age:</b> ${p.age} Y</td>
  </tr><tr>
    <td><b>Referred by:</b> ${esc(p.doctor)}</td><td><b>Collected:</b> ${esc(p.date)}</td><td><b>Abstinence:</b> ${p.abstinence} days</td>
  </tr></table>`

const flag = (value, limit) => (value < limit ? ' low' : '')

/** A result hidden under a strip of tape: the number is not in the picture at all, so the reader must leave it empty. */
const COVERED = '<span style="display:inline-block;width:70px;height:19px;background:#2b2723;border-radius:2px;transform:rotate(-3deg);vertical-align:middle"></span>'

/** 1. Current WHO-style table: results beside reference limits. */
export function who6(p) {
  const v = p.v
  const rows = [
    ['Volume', v.volume, 'mL', '≥ 1.4', flag(v.volume, 1.4)],
    ['pH', v.ph, '', '≥ 7.2', ''],
    ['Sperm concentration', v.concentration, 'million/mL', '≥ 16', flag(v.concentration, 16)],
    ['Total sperm number', v.totalCount, 'million/ejaculate', '≥ 39', flag(v.totalCount, 39)],
    ['Total motility (PR + NP)', v.pr + v.np, '%', '≥ 42', flag(v.pr + v.np, 42)],
    ['Progressive motility (PR)', v.pr, '%', '≥ 30', flag(v.pr, 30)],
    ['Non-progressive motility (NP)', v.np, '%', '', ''],
    ['Immotile (IM)', v.im, '%', '', ''],
    ['Vitality (live sperm)', v.vitality, '%', '≥ 54', flag(v.vitality, 54)],
    ['Normal forms (strict criteria)', v.normal, '%', '≥ 4', flag(v.normal, 4)],
    ['Leucocytes', v.wbc, 'million/mL', '< 1.0', ''],
  ]
  return page(`
    ${header('SAMPLE DIAGNOSTIC LABORATORY', 'Andrology unit · Semen analysis report')}
    ${meta(p)}
    <h2>Semen analysis (WHO laboratory manual, 6th edition)</h2>
    <table class="res">
      <tr><th>Parameter</th><th style="width:90px;text-align:center">Result</th><th style="width:150px">Unit</th><th style="width:150px">Reference limit</th></tr>
      ${rows.map(([n, val, u, ref, cls]) => `<tr><td>${n}</td><td class="v${cls}">${n === p.cover ? COVERED : val}</td><td>${u}</td><td class="muted">${ref}</td></tr>`).join('')}
    </table>
    <div class="foot"><span>Liquefaction: complete at ${v.liquefaction} min · Viscosity: normal · Appearance: grey-opalescent</span><span>Verified: Lab Scientist (sample)</span></div>
  `)
}

/** 2. Older style: motility as grades a-d, morphology as normal/abnormal, no totals printed. */
export function grades(p) {
  const v = p.v
  const line = (label, value) => `<tr><td style="width:46%;padding:3px 0">${label}</td><td style="padding:3px 0"><b>${value}</b></td></tr>`
  return page(
    `
    ${header('SEMINAL FLUID ANALYSIS', 'Sample Medical Centre · Clinical Laboratory')}
    ${meta(p)}
    <h2>Physical examination</h2>
    <table>
      ${line('Volume', `${v.volume} ml`)}
      ${line('Colour', 'Greyish white')}
      ${line('Viscosity', 'Normal')}
      ${line('Liquefaction time', `${v.liquefaction} minutes`)}
      ${line('Reaction (pH)', v.ph)}
    </table>
    <h2>Microscopic examination</h2>
    <table>
      ${line('Sperm count', v.concentration === 0 ? 'Nil (no sperm seen)' : `${v.concentration} x10^6/ml`)}
      ${v.morphologyAsAbnormal ? '' : line('Total count / ejaculate', `${v.totalCount} x10^6`)}
    </table>
    <h2>Motility (after 30 minutes)</h2>
    <table>
      ${line('Grade a &nbsp;(rapid progressive)', `${v.a} %`)}
      ${line('Grade b &nbsp;(slow progressive)', `${v.b} %`)}
      ${line('Grade c &nbsp;(non-progressive)', `${v.np} %`)}
      ${line('Grade d &nbsp;(immotile)', `${v.im} %`)}
    </table>
    <h2>Morphology</h2>
    <table>
      ${v.morphologyAsAbnormal ? line('Abnormal forms', `${100 - v.normal} %`) : line('Normal forms', `${v.normal} %`) + line('Abnormal forms', `${100 - v.normal} %`)}
      ${line('Pus cells', '1-2 /HPF')}
      ${line('RBCs', 'Nil')}
    </table>
    <div class="foot"><span>Normal values: count &gt; 15 x10^6/ml · motility (a+b) &gt; 32 % · normal forms &gt; 4 %</span><span>Pathologist (sample)</span></div>
  `,
    { font: "'Times New Roman', Times, 'Geeza Pro', serif", width: 760 },
  )
}

/** 3. Bilingual Arabic and English, as common in the Gulf. */
export function bilingual(p) {
  const v = p.v
  const rows = [
    ['Volume', 'الحجم', v.volume, 'mL', '≥ 1.4'],
    ['pH', 'درجة الحموضة', v.ph, '', '≥ 7.2'],
    ['Sperm concentration', 'تركيز الحيوانات المنوية', v.concentration === 0 ? 'Nil / لا يوجد' : v.concentration, 'x10⁶/mL', '≥ 16'],
    ['Total motility', 'الحركة الكلية', v.concentration === 0 ? '-' : v.pr + v.np, '%', '≥ 42'],
    ['Progressive motility', 'الحركة التقدمية', v.concentration === 0 ? '-' : v.pr, '%', '≥ 30'],
    ['Immotile', 'غير متحركة', v.concentration === 0 ? '-' : v.im, '%', ''],
    ['Normal morphology', 'الأشكال الطبيعية', v.concentration === 0 ? '-' : v.normal, '%', '≥ 4'],
    ['Round cells', 'الخلايا المستديرة', v.wbc, 'x10⁶/mL', '< 1'],
  ]
  return page(`
    <div class="head">
      <div><h1>SAMPLE FERTILITY LABORATORY</h1><div class="muted">Semen Analysis Report</div></div>
      <div style="text-align:center"><span class="tag">SYNTHETIC SAMPLE · عيّنة اصطناعية</span></div>
      <div dir="rtl" style="text-align:start"><h1>مختبر الخصوبة النموذجي</h1><div class="muted">تقرير تحليل السائل المنوي</div></div>
    </div>
    <table class="meta" style="margin-top:10px"><tr>
      <td><b>Name / الاسم:</b> ${esc(p.name)}</td><td><b>MRN / رقم الملف:</b> ${esc(p.mrn)}</td><td><b>Age / العمر:</b> ${p.age}</td>
    </tr><tr>
      <td><b>Doctor / الطبيب:</b> ${esc(p.doctor)}</td><td><b>Date / التاريخ:</b> ${esc(p.date)}</td><td><b>Abstinence / الامتناع:</b> ${p.abstinence} d</td>
    </tr></table>
    <table class="res" style="margin-top:14px">
      <tr><th>Test</th><th style="width:150px;text-align:center">Result / النتيجة</th><th style="width:90px">Unit</th><th style="width:100px">Reference</th><th dir="rtl" style="text-align:start">الفحص</th></tr>
      ${rows.map(([en, ar, val, u, ref]) => `<tr><td>${en}</td><td class="v">${val}</td><td>${u}</td><td class="muted">${ref}</td><td dir="rtl" style="text-align:start">${ar}</td></tr>`).join('')}
    </table>
    <div class="foot"><span>Reference: WHO 2021 · المرجع: منظمة الصحة العالمية ٢٠٢١</span><span>Laboratory Director (sample)</span></div>
  `)
}

/** 4. Dense computer-assisted (CASA) printout with many extra numbers around the ones that matter. */
export function casa(p) {
  const v = p.v
  const r = (name, val, unit, ref = '') => `<tr><td>${name}</td><td class="v mono">${val}</td><td class="mono">${unit}</td><td class="muted mono">${ref}</td></tr>`
  return page(
    `
    ${header('SAMPLE ANDROLOGY CENTRE', 'Computer-assisted semen analysis (CASA) · printout')}
    ${meta(p)}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:6px">
      <div>
        <h2>Concentration and count</h2>
        <table class="res">
          ${r('Volume', v.volume.toFixed(1), 'ml', '>= 1.4')}
          ${r('Concentration', v.concentration.toFixed(1), 'M/ml', '>= 16')}
          ${r('Total sperm count', v.totalCount.toFixed(1), 'M', '>= 39')}
          ${r('Motile sperm conc.', ((v.concentration * (v.pr + v.np)) / 100).toFixed(1), 'M/ml')}
          ${r('Round cells', v.wbc.toFixed(1), 'M/ml', '< 1.0')}
        </table>
        <h2>Morphology</h2>
        <table class="res">
          ${r('Normal forms', v.normal.toFixed(0), '%', '>= 4')}
          ${r('Head defects', Math.round((100 - v.normal) * 0.62), '%')}
          ${r('Midpiece defects', Math.round((100 - v.normal) * 0.21), '%')}
          ${r('Tail defects', Math.round((100 - v.normal) * 0.17), '%')}
        </table>
      </div>
      <div>
        <h2>Motility</h2>
        <table class="res">
          ${r('Motile (PR+NP)', (v.pr + v.np).toFixed(0), '%', '>= 42')}
          ${r('Progressive (PR)', v.pr.toFixed(0), '%', '>= 30')}
          ${r('Non-progressive (NP)', v.np.toFixed(0), '%')}
          ${r('Immotile (IM)', v.im.toFixed(0), '%')}
        </table>
        <h2>Kinetics</h2>
        <table class="res">
          ${r('VCL', (38 + v.pr / 2).toFixed(1), 'um/s')}
          ${r('VSL', (17 + v.pr / 3).toFixed(1), 'um/s')}
          ${r('VAP', (24 + v.pr / 3).toFixed(1), 'um/s')}
          ${r('LIN', (41 + v.pr / 5).toFixed(0), '%')}
          ${r('ALH', '2.9', 'um')}
          ${r('BCF', '11.4', 'Hz')}
        </table>
      </div>
    </div>
    <div class="foot"><span>pH ${v.ph} · Liquefaction ${v.liquefaction} min · Fields analysed: 8 · Chamber depth 20 um</span><span>Operator: sample</span></div>
  `,
    { font: "Arial, Helvetica, 'Geeza Pro', sans-serif", width: 900 },
  )
}

/** 5. Arabic only, with Arabic-Indic digits. */
export function arabic(p) {
  const v = p.v
  const rows = [
    ['الحجم', arNum(v.volume), 'مل', '≥ ١٫٤'],
    ['درجة الحموضة', arNum(v.ph), '', '≥ ٧٫٢'],
    ['تركيز الحيوانات المنوية', arNum(v.concentration), 'مليون/مل', '≥ ١٦'],
    ['الحركة الكلية', arNum(v.pr + v.np), '٪', '≥ ٤٢'],
    ['الحركة التقدمية', arNum(v.pr), '٪', '≥ ٣٠'],
    ['غير متحركة', arNum(v.im), '٪', ''],
    ['الأشكال الطبيعية', arNum(v.normal), '٪', '≥ ٤'],
  ]
  return page(
    `
    <div class="head">
      <div><h1>مختبر التحاليل الطبية النموذجي</h1><div class="muted">تقرير تحليل السائل المنوي</div></div>
      <div style="text-align:end"><span class="tag">عيّنة اصطناعية</span><div class="muted">ليست لمريض حقيقي</div></div>
    </div>
    <table class="meta" style="margin-top:10px"><tr>
      <td><b>الاسم:</b> ${esc(p.nameAr)}</td><td><b>رقم الملف:</b> ${esc(p.mrn)}</td><td><b>العمر:</b> ${arNum(p.age)} سنة</td>
    </tr><tr>
      <td><b>الطبيب المحوِّل:</b> ${esc(p.doctorAr)}</td><td><b>تاريخ العينة:</b> ${esc(p.date)}</td><td><b>مدة الامتناع:</b> ${arNum(p.abstinence)} أيام</td>
    </tr></table>
    <table class="res" style="margin-top:14px">
      <tr><th>الفحص</th><th style="width:110px;text-align:center">النتيجة</th><th style="width:120px">الوحدة</th><th style="width:130px">الحد المرجعي</th></tr>
      ${rows.map(([n, val, u, ref]) => `<tr><td>${n}</td><td class="v">${val}</td><td>${u}</td><td class="muted">${ref}</td></tr>`).join('')}
    </table>
    <div class="foot"><span>المرجع: دليل منظمة الصحة العالمية، الإصدار السادس (٢٠٢١)</span><span>مدير المختبر (نموذج)</span></div>
  `,
    { dir: 'rtl' },
  )
}

/** Not a semen analysis: the reader must say so instead of inventing values. */
export function bloodCount(p) {
  const rows = [
    ['Haemoglobin', '14.8', 'g/dL', '13.0 - 17.0'],
    ['White cell count', '6.9', 'x10^9/L', '4.0 - 11.0'],
    ['Platelets', '248', 'x10^9/L', '150 - 400'],
    ['Fasting glucose', '5.4', 'mmol/L', '3.9 - 5.6'],
    ['HbA1c', '5.5', '%', '< 5.7'],
    ['Total cholesterol', '4.6', 'mmol/L', '< 5.2'],
    ['Testosterone, total', '15.2', 'nmol/L', '8.6 - 29.0'],
  ]
  return page(`
    ${header('SAMPLE DIAGNOSTIC LABORATORY', 'Haematology and biochemistry report')}
    ${meta(p)}
    <table class="res" style="margin-top:14px">
      <tr><th>Test</th><th style="width:90px;text-align:center">Result</th><th style="width:120px">Unit</th><th style="width:150px">Reference range</th></tr>
      ${rows.map(([n, val, u, ref]) => `<tr><td>${n}</td><td class="v">${val}</td><td>${u}</td><td class="muted">${ref}</td></tr>`).join('')}
    </table>
    <div class="foot"><span>Specimen: venous blood</span><span>Verified: Lab Scientist (sample)</span></div>
  `)
}

/** Not a report at all. */
export function note() {
  return page(
    `<div style="padding:30px 10px;font-size:26px;line-height:1.9;font-family:'Bradley Hand','Marker Felt',cursive;color:#23324a">
      Saturday<br>• Call the garage about the car service<br>• Buy dates, laban and bread<br>• Gym 6 pm<br>• Book the dentist for Thursday
    </div>`,
    { width: 620 },
  )
}

export const LAYOUTS = { who6, grades, bilingual, casa, arabic, bloodCount, note }
