// Live test of the lab report reader against the real model. Skipped unless AI_LIVE=1.
// Run: AI_LIVE=1 AZURE_OPENAI_*=... npx vitest run infra/ai/report-eval.test.ts   (npm run ai:eval:reports)
// Sends only the synthetic pictures in fixtures/reports, straightened first exactly as the app does.
// Writes src/eval/reportLive.generated.ts for the /evaluation page.
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { ReportField, ReportLiveCase, ReportLiveReport } from '../../src/eval/reportLiveTypes'
import { estimateSkew, SKEW_MIN_DEGREES } from '../../src/lib/deskew'
// @ts-expect-error plain JS module
import { modelName } from './index.mjs'
// @ts-expect-error plain JS module
import { handler } from './report.mjs'

type Truth = Record<string, { layout: string; condition: ReportLiveCase['condition']; case: string; expect: Partial<Record<ReportField, number>> | null }>
const FIELDS: ReportField[] = ['volume_ml', 'concentration', 'total_motility', 'progressive', 'morphology']
const here = (p: string) => new URL(p, import.meta.url)

/**
 * The same first step as in the app: measure the tilt with the shared estimator and turn the picture straight.
 * The app does it on a canvas; here ffmpeg decodes and rotates. Needs ffmpeg and ffprobe.
 */
function straighten(file: string): { jpeg: Buffer; tilt: number } {
  const [w0, h0] = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file]).toString().trim().split(',').map(Number)
  const w = 480
  const h = Math.round(((h0 / w0) * w) / 2) * 2
  const gray = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-vf', `scale=${w}:${h},format=gray`, '-f', 'rawvideo', '-'], { maxBuffer: 1 << 26 })
  const tilt = estimateSkew(gray, w, h)
  if (Math.abs(tilt) < SKEW_MIN_DEGREES) return { jpeg: readFileSync(file), tilt: 0 }
  const turn = `${-tilt}*PI/180`
  const jpeg = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-vf', `rotate=${turn}:ow=rotw(${turn}):oh=roth(${turn}):fillcolor=white`, '-q:v', '4', '-f', 'mjpeg', '-'], { maxBuffer: 1 << 26 })
  return { jpeg, tilt }
}

async function run(id: string, t: Truth[string]): Promise<ReportLiveCase> {
  const { jpeg, tilt } = straighten(fileURLToPath(here(`./fixtures/reports/${id}.jpg`)))
  const image = `data:image/jpeg;base64,${jpeg.toString('base64')}`
  const call = () => handler({ requestContext: { http: { method: 'POST', sourceIp: `eval-${id}` } }, headers: {}, body: JSON.stringify({ image }) })
  let t0 = Date.now()
  let r = await call()
  // A slow or failed connection to the model says nothing about reading accuracy: try once more.
  if (r.statusCode === 502) {
    await new Promise((done) => setTimeout(done, 4000))
    t0 = Date.now()
    r = await call()
  }
  const ms = Date.now() - t0
  const body = JSON.parse(r.body)
  // Only values the reader is sure of are filled in for the person; doubtful ones are handed back to be typed.
  const sure = (f: ReportField) => body.ok && body.values[f] && !body.values[f].unsure
  const got: Partial<Record<ReportField, number>> | null = body.ok ? Object.fromEntries(FIELDS.filter(sure).map((f) => [f, body.values[f].value])) : null

  const flagged: ReportField[] = body.ok ? FIELDS.filter((f) => body.values[f]?.unsure) : []
  const wrong: ReportField[] = []
  const missed: ReportField[] = []
  const invented: ReportField[] = []
  if (t.expect) {
    for (const f of FIELDS) {
      if (flagged.includes(f)) continue
      const want = t.expect[f]
      const have = got?.[f]
      if (want === undefined) {
        if (have !== undefined) invented.push(f)
      } else if (have === undefined) missed.push(f)
      else if (Math.abs(have - want) > 0.05) wrong.push(f)
    }
  }
  const pass = t.expect ? r.statusCode === 200 && wrong.length + invented.length === 0 : body.ok === false && body.reason === 'not_semen_report'
  return { id, layout: t.layout, condition: t.condition, case: t.case, tilt, expect: t.expect, got, reason: body.reason ?? body.error, flagged, wrong, missed, invented, pass, ms }
}

describe.skipIf(!process.env.AI_LIVE)('lab report reader, live model', () => {
  it(
    'transcribes synthetic reports and refuses pictures that are not semen analyses',
    async () => {
      const truth = JSON.parse(readFileSync(here('./fixtures/truth.json'), 'utf8')) as Truth
      const cases: ReportLiveCase[] = []
      for (const [id, t] of Object.entries(truth)) cases.push(await run(id, t))

      const positives = cases.filter((c) => c.expect)
      const negatives = cases.filter((c) => !c.expect)
      const count = (k: 'flagged' | 'wrong' | 'missed' | 'invented') => positives.reduce((n, c) => n + c[k].length, 0)
      const sorted = cases.map((c) => c.ms).sort((a, b) => a - b)
      const fields = positives.length * FIELDS.length
      const report: ReportLiveReport = {
        runAt: new Date().toISOString(),
        deployment: modelName(),
        reports: positives.length,
        fields,
        fieldsCorrect: fields - count('flagged') - count('wrong') - count('missed') - count('invented'),
        flagged: count('flagged'),
        wrong: count('wrong'),
        missed: count('missed'),
        invented: count('invented'),
        negatives: negatives.length,
        negativesCorrect: negatives.filter((c) => c.pass).length,
        medianMs: sorted[Math.floor(sorted.length / 2)],
        cases,
      }
      writeFileSync(
        here('../../src/eval/reportLive.generated.ts'),
        `// Generated by \`npm run ai:eval:reports\` on ${report.runAt}. Do not edit by hand.\nimport type { ReportLiveReport } from './reportLiveTypes'\n\nexport const REPORT_LIVE: ReportLiveReport | null = ${JSON.stringify(report, null, 2)}\n`,
      )
      for (const c of cases) console.log(`${c.pass ? 'PASS' : 'FAIL'} ${c.id} ${c.layout} ${c.condition} ${c.ms}ms ${JSON.stringify({ got: c.got, reason: c.reason, flagged: c.flagged, wrong: c.wrong, missed: c.missed, invented: c.invented })}`)
      console.log(`fields ${report.fieldsCorrect}/${report.fields} · flagged ${report.flagged} · wrong ${report.wrong} · missed ${report.missed} · invented ${report.invented} · negatives ${report.negativesCorrect}/${report.negatives}`)
      // A picture that is not a semen analysis must never produce values.
      expect(negatives.filter((c) => !c.pass)).toEqual([])
    },
    600_000,
  )
})
