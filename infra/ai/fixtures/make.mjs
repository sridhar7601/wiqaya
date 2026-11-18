// Builds the synthetic lab-report pictures used to measure the report reader.
//   node infra/ai/fixtures/make.mjs
// Needs Google Chrome and ffmpeg. Writes reports/*.jpg, truth.json and the two sample pictures in public/samples.
// Every report is made up. "photo", "dim" and "rough" imitate phone pictures: tilted, skewed, blurred, noisy, badly lit.
import { execFileSync, spawn } from 'node:child_process'
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { LAYOUTS } from './templates.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, 'reports')
const WORK = join(HERE, '.work')
const SAMPLES = join(HERE, '../../../public/samples')
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

/** pr + np + im = 100. For the "grades" layout, a + b = pr. */
const VALUES = {
  normal: { volume: 3.2, ph: 7.6, concentration: 62, pr: 46, np: 12, im: 42, a: 21, b: 25, normal: 6, vitality: 71, wbc: 0.3, liquefaction: 20 },
  lowCount: { volume: 2.8, ph: 7.5, concentration: 11, pr: 34, np: 10, im: 56, a: 14, b: 20, normal: 5, vitality: 63, wbc: 0.4, liquefaction: 25 },
  lowMotility: { volume: 2.4, ph: 7.8, concentration: 37, pr: 18, np: 9, im: 73, a: 6, b: 12, normal: 4, vitality: 55, wbc: 0.6, liquefaction: 30 },
  lowForms: { volume: 4.1, ph: 7.4, concentration: 44, pr: 38, np: 11, im: 51, a: 16, b: 22, normal: 2, vitality: 66, wbc: 0.2, liquefaction: 20 },
  allLow: { volume: 1.9, ph: 7.9, concentration: 6.5, pr: 12, np: 7, im: 81, a: 3, b: 9, normal: 1, vitality: 38, wbc: 0.8, liquefaction: 35 },
  lowVolume: { volume: 0.8, ph: 7.2, concentration: 29, pr: 33, np: 14, im: 53, a: 13, b: 20, normal: 5, vitality: 60, wbc: 0.1, liquefaction: 15 },
  noSperm: { volume: 2.6, ph: 7.7, concentration: 0, pr: 0, np: 0, im: 0, a: 0, b: 0, normal: 0, vitality: 0, wbc: 0.2, liquefaction: 20 },
  onTheLimit: { volume: 1.4, ph: 7.3, concentration: 16, pr: 30, np: 12, im: 58, a: 12, b: 18, normal: 4, vitality: 54, wbc: 0.5, liquefaction: 25 },
}

const all = (v) => ({ volume_ml: v.volume, concentration: v.concentration, total_motility: v.pr + v.np, progressive: v.pr, morphology: v.normal })

/** id, layout, values, picture condition, what the reader must return. */
const REPORTS = [
  { id: 'r01', layout: 'who6', values: 'normal', condition: 'clean', truth: all },
  { id: 'r02', layout: 'who6', values: 'lowCount', condition: 'photo', truth: all },
  { id: 'r03', layout: 'who6', values: 'allLow', condition: 'dim', truth: all },
  { id: 'r04', layout: 'grades', values: 'lowMotility', condition: 'clean', truth: all },
  { id: 'r05', layout: 'grades', values: 'lowForms', condition: 'photo', truth: all, extra: { morphologyAsAbnormal: true } },
  { id: 'r06', layout: 'grades', values: 'lowVolume', condition: 'dim', truth: all },
  { id: 'r07', layout: 'bilingual', values: 'noSperm', condition: 'clean', truth: (v) => ({ volume_ml: v.volume, concentration: 0 }) },
  { id: 'r08', layout: 'bilingual', values: 'normal', condition: 'photo', truth: all },
  { id: 'r09', layout: 'bilingual', values: 'lowCount', condition: 'dim', truth: all },
  { id: 'r10', layout: 'casa', values: 'onTheLimit', condition: 'clean', truth: all },
  { id: 'r11', layout: 'casa', values: 'allLow', condition: 'photo', truth: all },
  { id: 'r12', layout: 'arabic', values: 'lowMotility', condition: 'clean', truth: all },
  { id: 'r13', layout: 'arabic', values: 'lowForms', condition: 'photo', truth: all },
  { id: 'r14', layout: 'who6', values: 'lowMotility', condition: 'rough', truth: all },
  { id: 'r15', layout: 'grades', values: 'allLow', condition: 'rough', truth: all },
  // The concentration is taped over while the total count stays visible: it must come back empty, not worked out.
  { id: 'r16', layout: 'who6', values: 'lowForms', condition: 'photo', truth: (v) => ({ ...all(v), concentration: undefined }), cover: 'Sperm concentration' },
  { id: 'r17', layout: 'bloodCount', values: 'normal', condition: 'clean', truth: null },
  { id: 'r18', layout: 'note', values: 'normal', condition: 'photo', truth: null },
]

const person = (i) => ({
  name: `SAMPLE PATIENT ${String(i + 1).padStart(2, '0')}`,
  nameAr: `مريض نموذجي ${i + 1}`,
  mrn: `SYN-${String(1040 + i * 37).padStart(6, '0')}`,
  age: 27 + ((i * 5) % 19),
  doctor: 'Dr. Sample Clinician',
  doctorAr: 'د. طبيب نموذجي',
  date: `2026-10-${String(3 + i).padStart(2, '0')}`,
  abstinence: 2 + (i % 4),
})

// Small deterministic variation so no two "photos" are distorted the same way.
const tilt = (i) => [2.2, -1.8, 3.1, -2.6, 1.4][i % 5]
const FILTERS = {
  clean: () => 'scale=1400:-2',
  photo: (i) =>
    [
      'scale=1400:-2',
      'pad=iw+180:ih+180:90:90:color=0x70685d',
      `rotate=${tilt(i)}*PI/180:fillcolor=0x70685d:ow=rotw(${tilt(i)}*PI/180):oh=roth(${tilt(i)}*PI/180)`,
      `perspective=x0=${0.02 + (i % 3) * 0.01}*W:y0=0.01*H:x1=0.99*W:y1=${0.03 + (i % 2) * 0.01}*H:x2=0:y2=0.985*H:x3=0.965*W:y3=H:interpolation=cubic`,
      'gblur=sigma=0.7',
      'noise=alls=7:allf=t',
      'colorbalance=rs=0.05:bs=-0.06',
      'eq=contrast=0.93:brightness=0.02:saturation=0.9',
      'vignette=PI/6',
      'scale=1500:-2',
    ].join(','),
  rough: (i) =>
    ['scale=1400:-2', 'pad=iw+260:ih+260:130:130:color=0x4a443d', `rotate=${tilt(i) * 3.4}*PI/180:fillcolor=0x4a443d`, 'gblur=sigma=1.5', 'noise=alls=10:allf=t', 'eq=contrast=0.86:brightness=-0.03', 'scale=820:-2'].join(','),
  dim: (i) => ['scale=1050:-2', `rotate=${tilt(i) / 2}*PI/180:fillcolor=0x3b3833`, 'eq=brightness=-0.11:contrast=0.78:gamma=0.9', 'gblur=sigma=0.9', 'noise=alls=12:allf=t', 'scale=980:-2'].join(','),
}
const QUALITY = { clean: 3, photo: 5, dim: 9, rough: 12 }

// ---------- headless Chrome over DevTools ----------
rmSync(WORK, { recursive: true, force: true })
mkdirSync(WORK, { recursive: true })
mkdirSync(OUT, { recursive: true })
mkdirSync(SAMPLES, { recursive: true })

const port = 9361
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${join(WORK, 'profile')}`, '--no-first-run', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let ws
for (let i = 0; i < 60 && !ws; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
    const tab = list.find((t) => t.type === 'page')
    if (tab) {
      ws = new WebSocket(tab.webSocketDebuggerUrl)
      await new Promise((r) => (ws.onopen = r))
    }
  } catch {
    /* Chrome is still starting */
  }
  await sleep(200)
}
if (!ws) throw new Error('Chrome did not start')
let seq = 0
const waiting = new Map()
ws.onmessage = (m) => {
  const x = JSON.parse(m.data)
  if (x.id && waiting.has(x.id)) {
    waiting.get(x.id)(x)
    waiting.delete(x.id)
  }
}
const send = (method, params = {}) =>
  new Promise((r) => {
    const n = ++seq
    waiting.set(n, r)
    ws.send(JSON.stringify({ id: n, method, params }))
  })
const js = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.result?.value

const truth = {}
try {
  await send('Page.enable')
  for (const [i, r] of REPORTS.entries()) {
    const values = { ...VALUES[r.values], ...r.extra }
    values.totalCount = Math.round(values.volume * values.concentration * 10) / 10
    const html = join(WORK, `${r.id}.html`)
    writeFileSync(html, LAYOUTS[r.layout]({ ...person(i), v: values, cover: r.cover }))

    await send('Emulation.setDeviceMetricsOverride', { width: 1000, height: 400, deviceScaleFactor: 2, mobile: false })
    await send('Page.navigate', { url: pathToFileURL(html).href })
    await sleep(350)
    await js('document.fonts.ready.then(() => true)')
    const box = JSON.parse(await js('JSON.stringify(document.body.getBoundingClientRect())'))
    const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: Math.floor(box.x), y: Math.floor(box.y), width: Math.ceil(box.width), height: Math.ceil(box.height), scale: 1 }, captureBeyondViewport: true })
    const png = join(WORK, `${r.id}.png`)
    writeFileSync(png, Buffer.from(shot.result.data, 'base64'))

    const jpg = join(OUT, `${r.id}.jpg`)
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', png, '-vf', FILTERS[r.condition](i), '-q:v', String(QUALITY[r.condition]), jpg])
    truth[r.id] = { layout: r.layout, condition: r.condition, case: r.values, expect: r.truth ? r.truth(values) : null }
    console.log(`${r.id}  ${r.layout.padEnd(10)} ${r.condition.padEnd(6)} ${r.values}`)
  }
} finally {
  ws.close()
  chrome.kill()
}

writeFileSync(join(HERE, 'truth.json'), `${JSON.stringify(truth, null, 2)}\n`)
copyFileSync(join(OUT, 'r02.jpg'), join(SAMPLES, 'report-en.jpg'))
copyFileSync(join(OUT, 'r08.jpg'), join(SAMPLES, 'report-ar.jpg'))
rmSync(WORK, { recursive: true, force: true })
console.log(`Wrote ${REPORTS.length} pictures to ${OUT}, truth.json, and 2 samples to public/samples.`)
