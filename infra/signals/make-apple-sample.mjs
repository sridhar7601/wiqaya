// Writes a made-up Apple Health export, for the demo and for trying the importer without a real iPhone:
//   node infra/signals/make-apple-sample.mjs [YYYY-MM-DD]      (the last day; default: today in Abu Dhabi)
// Output: public/samples/apple-health-sample.zip, laid out like the iPhone's "Export All Health Data" file:
//   apple_health_export/export.xml       DTD, the HealthData root, ExportDate, Me, Records, Workouts, ActivitySummaries
//   apple_health_export/export_cda.xml   a short clinical (CDA) copy; the importer must skip it
//   apple_health_export/workout-routes/  one GPX route
// The person is invented: a 34-year-old outdoor site engineer in Abu Dhabi. Over the 150 days his habits improve:
// steps about 4,500 to 8,000 a day, sleep about 5.4 to 7 h, resting heart rate about 74 to 66, weight 98 to 92 kg.
// Records come from two sources, "iPhone" and "Apple Watch", which count the same walks twice, as real ones do.
// Seeded random numbers and fixed zip timestamps: the same end date always gives the same file.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { strToU8, zipSync } from 'fflate'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, '../../public/samples/apple-health-sample.zip')
const DAYS = 150
const MIN = 60_000
const DAY = 86_400_000
const ZONE = '+0400' // Abu Dhabi, no daylight saving
const IOS = '26.1'
const WATCH_OS = '26.1'
const PHONE_DEVICE = `&lt;&lt;HKDevice: 0x302d4c5a0&gt;, name:iPhone, manufacturer:Apple Inc., model:iPhone, hardware:iPhone17,3, software:${IOS}, creation date:2025-10-02 14:21:40 +0000&gt;`
const WATCH_DEVICE = `&lt;&lt;HKDevice: 0x302d4c1e0&gt;, name:Apple Watch, manufacturer:Apple Inc., model:Watch, hardware:Watch7,3, software:${WATCH_OS}, creation date:2025-10-03 16:02:11 +0000&gt;`

const end = process.argv[2] ?? new Date(Date.now() + 4 * 3_600_000).toISOString().slice(0, 10)
if (!/^\d{4}-\d{2}-\d{2}$/.test(end)) {
  console.error('usage: node infra/signals/make-apple-sample.mjs [YYYY-MM-DD]')
  process.exit(1)
}

// ---- random numbers (mulberry32), always the same sequence
let seed = 0x5a17e5
function rand() {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const uniform = (a, b) => a + (b - a) * rand()
const normal = (mean, sd) => mean + sd * Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand())
const lerp = (a, b, t) => a + (b - a) * t
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x))
const smooth = (x) => {
  const t = clamp(x, 0, 1)
  return t * t * (3 - 2 * t)
}

// ---- time: local Abu Dhabi wall-clock time, kept as milliseconds on a UTC timeline and printed with +0400
const endDay = Date.UTC(+end.slice(0, 4), +end.slice(5, 7) - 1, +end.slice(8, 10))
const dayStart = (i) => endDay - (DAYS - 1 - i) * DAY
const stamp = (ms) => `${new Date(ms).toISOString().slice(0, 19).replace('T', ' ')} ${ZONE}`
const dateOf = (ms) => new Date(ms).toISOString().slice(0, 10)
const exportAt = endDay + (21 * 60 + 37) * MIN + 12_000
/** Saturday and Sunday: the UAE weekend. */
const isWeekend = (i) => [0, 6].includes(new Date(dayStart(i)).getUTCDay())

/** How far the new habits have taken hold: flat for two weeks, a steady change, settled for the last three weeks. */
const habit = (i) => smooth((i - 14) / (DAYS - 35))

// ---- the records, by type (a real export groups them by type too)
const records = new Map() // type -> [{ start, xml }]
const add = (type, start, xml) => {
  if (!records.has(type)) records.set(type, [])
  records.get(type).push({ start, xml })
}
const workouts = []
const summaries = []

function record(type, { source, unit, start, end: stop, value, device = true, children = '' }) {
  if (stop > exportAt) return
  const created = Math.min(exportAt, stop + Math.round(uniform(0.4, 18) * MIN))
  const deviceAttr = device ? ` device="${source === 'iPhone' ? PHONE_DEVICE : WATCH_DEVICE}"` : ''
  const unitAttr = unit ? ` unit="${unit}"` : ''
  const attrs = `type="${type}" sourceName="${source}" sourceVersion="${source === 'iPhone' ? IOS : WATCH_OS}"${deviceAttr}${unitAttr} creationDate="${stamp(created)}" startDate="${stamp(start)}" endDate="${stamp(stop)}" value="${value}"`
  add(type, start, children ? ` <Record ${attrs}>\n${children} </Record>` : ` <Record ${attrs}/>`)
}
const meta = (key, value) => `  <MetadataEntry key="${key}" value="${value}"/>\n`

// Walks on a work day and on a day off: [start, minutes] (minutes after midnight). Site rounds, then the 12:30-15:00
// summer break from outdoor work, then afternoon rounds.
const WORK_DAY = [[335, 8], [395, 22], [495, 28], [605, 26], [765, 10], [905, 30], [995, 18], [1250, 8]]
const DAY_OFF = [[520, 12], [630, 25], [795, 15], [1030, 30], [1215, 14]]

function day(i) {
  const start = dayStart(i)
  const p = habit(i)
  const weekend = isWeekend(i)

  // Steps, as the watch counts them (the larger source). Days off start lazy and end up the most active.
  const total = Math.max(1500, Math.round(lerp(4850, 7370, p) * (weekend ? lerp(0.75, 1.3, p) : 1) * normal(1, 0.12)))
  const exerciseTarget = Math.max(0, Math.round(lerp(9, 34, p) * (weekend ? lerp(0.6, 1.5, p) : 1) * normal(1, 0.25)))
  const bouts = (weekend ? DAY_OFF : WORK_DAY).map(([at, minutes]) => ({ at: at + normal(0, 9), minutes: minutes * uniform(0.7, 1.3), walk: false }))
  if (rand() < lerp(0.05, 0.85, p)) {
    // The new habit: an evening walk on the Corniche, or a long Saturday-morning one.
    const saturday = new Date(start).getUTCDay() === 6
    bouts.push({ at: saturday ? 430 + normal(0, 12) : 1160 + normal(0, 15), minutes: uniform(saturday ? 45 : 35, saturday ? 62 : 50), walk: true })
  }
  const walk = bouts.find((b) => b.walk)
  const walkSteps = walk ? Math.min(total * 0.55, normal(walk.minutes * 98, 250)) : 0
  const weights = bouts.map((b) => (b.walk ? 0 : b.minutes * uniform(0.6, 1.4)))
  const sum = weights.reduce((a, b) => a + b, 0)
  bouts.forEach((b, k) => (b.steps = b.walk ? walkSteps : ((total - walkSteps) * weights[k]) / sum))
  const charging = rand() < 0.06 // the watch charged through the early rounds; only the phone counted them
  for (const b of bouts) b.missed = charging && b.at < 540

  for (const b of bouts) {
    const from = start + Math.round(b.at * MIN)
    const to = from + Math.round(b.minutes * MIN)
    if (!b.missed) record('HKQuantityTypeIdentifierStepCount', { source: 'Apple Watch', unit: 'count', start: from, end: to, value: Math.round(b.steps) })
    if (b.missed || rand() < 0.8) {
      const phoneSteps = Math.round(b.steps * (b.missed ? uniform(0.9, 1) : uniform(0.62, 0.92)))
      const shift = Math.round(normal(0, 1.5) * MIN)
      record('HKQuantityTypeIdentifierStepCount', { source: 'iPhone', unit: 'count', start: from + shift, end: to + shift, value: phoneSteps })
      record('HKQuantityTypeIdentifierDistanceWalkingRunning', { source: 'iPhone', unit: 'km', start: from + shift, end: to + shift, value: (phoneSteps * 0.00071).toFixed(3) })
    }
  }

  // Exercise minutes: the brisk part of the walk first, the rest from the longest site rounds.
  let left = exerciseTarget
  const brisk = bouts.filter((b) => !b.missed).sort((a, b) => Number(b.walk) - Number(a.walk) || b.minutes - a.minutes).slice(0, 3)
  for (const b of brisk) {
    const minutes = Math.min(left, Math.floor(b.minutes - (b.walk ? 3 : 6)))
    if (minutes < 1) continue
    const from = start + Math.round((b.at + 2) * MIN)
    record('HKQuantityTypeIdentifierAppleExerciseTime', { source: 'Apple Watch', unit: 'min', start: from, end: from + minutes * MIN, value: minutes })
    left -= minutes
  }

  // Heart rate: a few readings a day (a real watch takes one every few minutes).
  const resting = Math.round(lerp(74, 66, habit(i - 14)) + normal(0, 1.3))
  for (const [at, kind] of [[185, 'sleep'], [450, 'rest'], [585, 'rest'], [690, 'rest'], [840, 'rest'], [960, 'rest'], [1110, 'rest'], [1320, 'rest']]) {
    const when = start + Math.round((at + normal(0, 20)) * MIN)
    const bpm = kind === 'sleep' ? resting - Math.round(uniform(3, 8)) : resting + Math.round(uniform(6, 24))
    record('HKQuantityTypeIdentifierHeartRate', { source: 'Apple Watch', unit: 'count/min', start: when, end: when, value: bpm, children: meta('HKMetadataKeyHeartRateMotionContext', '1') })
  }
  if (walk) {
    const when = start + Math.round((walk.at + walk.minutes / 2) * MIN)
    record('HKQuantityTypeIdentifierHeartRate', { source: 'Apple Watch', unit: 'count/min', start: when, end: when, value: Math.round(uniform(102, 124)), children: meta('HKMetadataKeyHeartRateMotionContext', '2') })
  }

  // Sleep: the night that ends this morning.
  const asleepH = clamp(lerp(5.06, 6.86, p) + (weekend ? lerp(1.2, 0.5, p) : 0) + normal(0, 0.35), 3.6, 9.4)
  const bedtime = (weekend ? lerp(24.6, 23.4, p) : lerp(23.5, 22.4, p)) + normal(0, 0.35) // hours after the previous midnight
  night(start - DAY + Math.round(bedtime * 60) * MIN, asleepH * 60 * MIN)
  record('HKQuantityTypeIdentifierRestingHeartRate', {
    source: 'Apple Watch', unit: 'count/min', device: false,
    start: start + Math.round(uniform(1, 9) * MIN), end: start + Math.round(uniform(19.5, 21) * 60 * MIN), value: resting + (asleepH < 5 ? 2 : 0),
  })

  // Weight: on the bathroom scale, typed into Health, on Sunday, Tuesday and Thursday mornings (and some others).
  const weekday = new Date(start).getUTCDay()
  if ([0, 2, 4].includes(weekday) || rand() < 0.12) {
    const kg = lerp(98, 92, smooth((i - 7) / (DAYS - 12))) + (weekday === 0 ? 0.25 : 0) + normal(0, 0.3)
    const when = start + Math.round(uniform(5.1, 5.6) * 60 * MIN) + (weekend ? 2 * 60 * MIN : 0)
    record('HKQuantityTypeIdentifierBodyMass', { source: 'iPhone', unit: 'kg', device: false, start: when, end: when, value: kg.toFixed(1) })
  }

  if (walk && new Date(start).getUTCDay() === 6) workouts.push(workout(start + Math.round(walk.at * MIN), walk.minutes, walk.steps))

  const stand = Math.round(clamp(normal(lerp(7, 10, p), 1.2), 4, 13))
  summaries.push(
    ` <ActivitySummary dateComponents="${dateOf(start)}" activeEnergyBurned="${(total * 0.041 + exerciseTarget * 4.6 + normal(95, 18)).toFixed(3)}" activeEnergyBurnedGoal="${p < 0.5 ? 450 : 600}" activeEnergyBurnedUnit="Cal" appleMoveTime="0" appleMoveTimeGoal="0" appleExerciseTime="${exerciseTarget}" appleExerciseTimeGoal="30" appleStandHours="${stand}" appleStandHoursGoal="12"/>`,
  )
}

/** One night, from getting into bed: watch stages in ~90-minute cycles (deep sleep early, REM late) with short wakings, and the phone's "in bed". */
function night(bedAt, asleepMs) {
  let t = bedAt + Math.round(uniform(6, 22) * MIN) // falling asleep
  let left = asleepMs
  const piece = (stage, ms) => {
    const d = Math.round(ms / 1000) * 1000
    if (d < MIN) return
    record('HKCategoryTypeIdentifierSleepAnalysis', { source: 'Apple Watch', start: t, end: t + d, value: `HKCategoryValueSleepAnalysis${stage}` })
    t += d
  }
  for (let cycle = 0; left > 4 * MIN; cycle++) {
    const length = Math.min(left, uniform(82, 102) * MIN)
    const deep = Math.max(0.04, 0.26 - 0.06 * cycle)
    const rem = Math.min(0.34, 0.12 + 0.055 * cycle)
    const core = (1 - deep - rem) / 2
    piece('AsleepCore', length * core)
    piece('AsleepDeep', length * deep)
    piece('AsleepCore', length * core)
    piece('AsleepREM', length * rem)
    left -= length
    if (left > 4 * MIN && rand() < 0.5) piece('Awake', uniform(1, 7) * MIN)
  }
  const wake = t
  piece('Awake', uniform(2, 8) * MIN)
  record('HKCategoryTypeIdentifierSleepAnalysis', {
    source: 'iPhone', device: false, start: bedAt - Math.round(uniform(1, 6) * MIN), end: wake + Math.round(uniform(4, 14) * MIN),
    value: 'HKCategoryValueSleepAnalysisInBed', children: meta('HKTimeZone', 'Asia/Dubai'),
  })
}

let route
function workout(from, minutes, steps) {
  const to = from + Math.round(minutes * MIN)
  const km = steps * 0.00074
  const kcal = minutes * uniform(4.2, 5.2)
  const span = `startDate="${stamp(from)}" endDate="${stamp(to)}"`
  const file = `route_${dateOf(from)}_${(new Date(from).getUTCHours() % 12) || 12}.${String(new Date(from).getUTCMinutes()).padStart(2, '0')}am.gpx`
  route = { file, from, to }
  return [
    ` <Workout workoutActivityType="HKWorkoutActivityTypeWalking" duration="${minutes.toFixed(4)}" durationUnit="min" sourceName="Apple Watch" sourceVersion="${WATCH_OS}" device="${WATCH_DEVICE}" creationDate="${stamp(to + MIN)}" ${span}>`,
    meta('HKIndoorWorkout', '0') + meta('HKTimeZone', 'Asia/Dubai') + meta('HKWeatherTemperature', `${Math.round(uniform(84, 95))} degF`) + meta('HKWeatherHumidity', `${Math.round(uniform(45, 70))}00 %`).trimEnd(),
    `  <WorkoutStatistics type="HKQuantityTypeIdentifierActiveEnergyBurned" ${span} sum="${kcal.toFixed(3)}" unit="Cal"/>`,
    `  <WorkoutStatistics type="HKQuantityTypeIdentifierDistanceWalkingRunning" ${span} sum="${km.toFixed(4)}" unit="km"/>`,
    `  <WorkoutStatistics type="HKQuantityTypeIdentifierHeartRate" ${span} average="${Math.round(uniform(104, 116))}" minimum="${Math.round(uniform(80, 90))}" maximum="${Math.round(uniform(124, 136))}" unit="count/min"/>`,
    `  <WorkoutRoute sourceName="Apple Watch" sourceVersion="${WATCH_OS}" device="${WATCH_DEVICE}" creationDate="${stamp(to + 2 * MIN)}" ${span}>`,
    `   <MetadataEntry key="HKMetadataKeySyncVersion" value="2"/>`,
    `   <FileReference path="/workout-routes/${file}"/>`,
    '  </WorkoutRoute>',
    ' </Workout>',
  ].join('\n')
}

/** The GPS track of the last Saturday walk: out along the Corniche and back. */
function gpx({ from, to }) {
  const points = []
  const n = 120
  for (let k = 0; k <= n; k++) {
    const leg = k <= n / 2 ? k / (n / 2) : (n - k) / (n / 2)
    const lat = 24.4772 + leg * 0.0205 + normal(0, 0.00003)
    const lon = 54.3301 + leg * 0.0248 + normal(0, 0.00003)
    const when = new Date(from - 4 * 3_600_000 + ((to - from) * k) / n).toISOString().replace('.000', '')
    points.push(`<trkpt lon="${lon.toFixed(6)}" lat="${lat.toFixed(6)}"><ele>${uniform(1.5, 4).toFixed(2)}</ele><time>${when}</time><extensions><speed>${uniform(1.25, 1.6).toFixed(2)}</speed><course>${((k <= n / 2 ? 48 : 228) + normal(0, 4)).toFixed(1)}</course><hAcc>${uniform(2.5, 6).toFixed(1)}</hAcc><vAcc>${uniform(1.5, 4).toFixed(1)}</vAcc></extensions></trkpt>`)
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Apple Health Export" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
 <metadata>
  <time>${new Date(from - 4 * 3_600_000).toISOString().replace('.000', '')}</time>
 </metadata>
 <trk>
  <name>Route ${dateOf(from)}</name>
  <trkseg>
${points.map((p) => `   ${p}`).join('\n')}
  </trkseg>
 </trk>
</gpx>
`
}

// ---- build
for (let i = 0; i < DAYS; i++) day(i)
// Height was entered once, long before.
const heightAt = endDay - 400 * DAY + 19 * 3_600_000
add('HKQuantityTypeIdentifierHeight', heightAt, ` <Record type="HKQuantityTypeIdentifierHeight" sourceName="iPhone" sourceVersion="${IOS}" unit="cm" creationDate="${stamp(heightAt)}" startDate="${stamp(heightAt)}" endDate="${stamp(heightAt)}" value="178"/>`)

const ORDER = [
  'HKQuantityTypeIdentifierHeight',
  'HKQuantityTypeIdentifierBodyMass',
  'HKQuantityTypeIdentifierHeartRate',
  'HKQuantityTypeIdentifierStepCount',
  'HKQuantityTypeIdentifierDistanceWalkingRunning',
  'HKQuantityTypeIdentifierRestingHeartRate',
  'HKQuantityTypeIdentifierAppleExerciseTime',
  'HKCategoryTypeIdentifierSleepAnalysis',
]
const endYear = +end.slice(0, 4)
const birthday = `${end.slice(5) >= '03-14' ? endYear - 34 : endYear - 35}-03-14` // 34 on the last day

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE HealthData [
<!-- HealthKit Export Version: 14 -->
<!ELEMENT HealthData (ExportDate,Me,(Record|Correlation|Workout|ActivitySummary|ClinicalRecord|Audiogram|VisionPrescription)*)>
<!ATTLIST HealthData
  locale CDATA #REQUIRED
>
<!ELEMENT ExportDate EMPTY>
<!ATTLIST ExportDate
  value CDATA #REQUIRED
>
<!ELEMENT Me EMPTY>
<!ATTLIST Me
  HKCharacteristicTypeIdentifierDateOfBirth                 CDATA #REQUIRED
  HKCharacteristicTypeIdentifierBiologicalSex               CDATA #REQUIRED
  HKCharacteristicTypeIdentifierBloodType                   CDATA #REQUIRED
  HKCharacteristicTypeIdentifierFitzpatrickSkinType         CDATA #REQUIRED
  HKCharacteristicTypeIdentifierCardioFitnessMedicationsUse CDATA #REQUIRED
>
<!ELEMENT Record ((MetadataEntry|HeartRateVariabilityMetadataList)*)>
<!ATTLIST Record
  type          CDATA #REQUIRED
  unit          CDATA #IMPLIED
  value         CDATA #IMPLIED
  sourceName    CDATA #REQUIRED
  sourceVersion CDATA #IMPLIED
  device        CDATA #IMPLIED
  creationDate  CDATA #IMPLIED
  startDate     CDATA #REQUIRED
  endDate       CDATA #REQUIRED
>
<!-- Note: Any Records that appear as children of a correlation also appear as top-level records in this document. -->
<!ELEMENT Correlation ((MetadataEntry|Record)*)>
<!ATTLIST Correlation
  type          CDATA #REQUIRED
  sourceName    CDATA #REQUIRED
  sourceVersion CDATA #IMPLIED
  device        CDATA #IMPLIED
  creationDate  CDATA #IMPLIED
  startDate     CDATA #REQUIRED
  endDate       CDATA #REQUIRED
>
<!ELEMENT Workout ((MetadataEntry|WorkoutEvent|WorkoutRoute|WorkoutStatistics)*)>
<!ATTLIST Workout
  workoutActivityType   CDATA #REQUIRED
  duration              CDATA #IMPLIED
  durationUnit          CDATA #IMPLIED
  totalDistance         CDATA #IMPLIED
  totalDistanceUnit     CDATA #IMPLIED
  totalEnergyBurned     CDATA #IMPLIED
  totalEnergyBurnedUnit CDATA #IMPLIED
  sourceName            CDATA #REQUIRED
  sourceVersion         CDATA #IMPLIED
  device                CDATA #IMPLIED
  creationDate          CDATA #IMPLIED
  startDate             CDATA #REQUIRED
  endDate               CDATA #REQUIRED
>
<!ELEMENT WorkoutStatistics EMPTY>
<!ATTLIST WorkoutStatistics
  type                  CDATA #REQUIRED
  startDate             CDATA #REQUIRED
  endDate               CDATA #REQUIRED
  average               CDATA #IMPLIED
  minimum               CDATA #IMPLIED
  maximum               CDATA #IMPLIED
  sum                   CDATA #IMPLIED
  unit                  CDATA #IMPLIED
>
<!ELEMENT WorkoutRoute ((MetadataEntry|FileReference)*)>
<!ATTLIST WorkoutRoute
  sourceName    CDATA #REQUIRED
  sourceVersion CDATA #IMPLIED
  device        CDATA #IMPLIED
  creationDate  CDATA #IMPLIED
  startDate     CDATA #REQUIRED
  endDate       CDATA #REQUIRED
>
<!ELEMENT FileReference EMPTY>
<!ATTLIST FileReference
  path CDATA #REQUIRED
>
<!ELEMENT ActivitySummary EMPTY>
<!ATTLIST ActivitySummary
  dateComponents           CDATA #IMPLIED
  activeEnergyBurned       CDATA #IMPLIED
  activeEnergyBurnedGoal   CDATA #IMPLIED
  activeEnergyBurnedUnit   CDATA #IMPLIED
  appleMoveTime            CDATA #IMPLIED
  appleMoveTimeGoal        CDATA #IMPLIED
  appleExerciseTime        CDATA #IMPLIED
  appleExerciseTimeGoal    CDATA #IMPLIED
  appleStandHours          CDATA #IMPLIED
  appleStandHoursGoal      CDATA #IMPLIED
>
<!ELEMENT MetadataEntry EMPTY>
<!ATTLIST MetadataEntry
  key   CDATA #REQUIRED
  value CDATA #REQUIRED
>
]>
<HealthData locale="en_AE">
 <ExportDate value="${stamp(exportAt)}"/>
 <Me HKCharacteristicTypeIdentifierDateOfBirth="${birthday}" HKCharacteristicTypeIdentifierBiologicalSex="HKBiologicalSexMale" HKCharacteristicTypeIdentifierBloodType="HKBloodTypeNotSet" HKCharacteristicTypeIdentifierFitzpatrickSkinType="HKFitzpatrickSkinTypeNotSet" HKCharacteristicTypeIdentifierCardioFitnessMedicationsUse="None"/>
${ORDER.flatMap((type) => (records.get(type) ?? []).sort((a, b) => a.start - b.start).map((r) => r.xml)).join('\n')}
${workouts.join('\n')}
${summaries.join('\n')}
</HealthData>
`

// The real export_cda.xml repeats every sample in HL7 CDA form; this stand-in holds the last week's weight and resting
// heart rate, enough to look the part.
const observation = (code, name, ms, value, unit) =>
  `<entry typeCode="DRIV"><organizer classCode="CLUSTER" moodCode="EVN"><templateId root="2.16.840.1.113883.10.20.22.4.26"/><code code="46680005" codeSystem="2.16.840.1.113883.6.96" codeSystemName="SNOMED CT" displayName="Vital signs"/><statusCode code="completed"/><component><observation classCode="OBS" moodCode="EVN"><templateId root="2.16.840.1.113883.10.20.22.4.27"/><code code="${code}" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="${name}"/><text><sourceName>${unit === 'kg' ? 'iPhone' : 'Apple Watch'}</sourceName><value>${value}</value><type>${name}</type><unit>${unit}</unit></text><statusCode code="completed"/><effectiveTime><low value="${stamp(ms).replace(/[-: ]/g, '').slice(0, 14)}+0400"/></effectiveTime><value xsi:type="PQ" value="${value}" unit="${unit}"/></observation></component></organizer></entry>`
const lastWeek = (type) => (records.get(type) ?? []).filter((r) => r.start > endDay - 7 * DAY)
const cda = `<?xml version="1.0" encoding="UTF-8"?>
<ClinicalDocument xmlns="urn:hl7-org:v3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:hl7-org:v3 ../../../CDA%20R2/cda-schemas-and-samples/infrastructure/cda/CDA.xsd" classCode="DOCCLIN" moodCode="EVN">
<realmCode code="US"/>
<typeId root="2.16.840.1.113883.1.3" extension="POCD_HD000040"/>
<templateId root="2.16.840.1.113883.10.20.22.1.2"/>
<code codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" code="34109-9" displayName="Note"/>
<title>Health Data</title>
<effectiveTime value="${stamp(exportAt).replace(/[-: ]/g, '').slice(0, 14)}+0400"/>
<confidentialityCode codeSystem="2.16.840.1.113883.5.25" code="N"/>
<languageCode code="en-AE"/>
<recordTarget><patientRole><patient><administrativeGenderCode codeSystem="2.16.840.1.113883.5.1" code="M"/><birthTime value="${birthday.replace(/-/g, '')}"/></patient></patientRole></recordTarget>
<component><structuredBody><component><section><templateId root="2.16.840.1.113883.10.20.22.2.4.1"/><code code="8716-3" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="Vital Signs"/><title>Vital Signs</title>
${[
  ...lastWeek('HKQuantityTypeIdentifierBodyMass').map((r) => observation('3141-9', 'Body mass', r.start, /value="([\d.]+)"/.exec(r.xml)[1], 'kg')),
  ...lastWeek('HKQuantityTypeIdentifierRestingHeartRate').map((r) => observation('40443-4', 'Resting heart rate', r.start, /value="([\d.]+)"/.exec(r.xml)[1], 'count/min')),
].join('\n')}
</section></component></structuredBody></component>
</ClinicalDocument>
`

// Same local time everywhere, so the zip's timestamps (and bytes) do not depend on the machine's time zone.
const mtime = new Date(+end.slice(0, 4), +end.slice(5, 7) - 1, +end.slice(8, 10), 21, 37, 12)
const files = {
  'apple_health_export/export.xml': [strToU8(xml), { mtime }],
  'apple_health_export/export_cda.xml': [strToU8(cda), { mtime }],
}
if (route) files[`apple_health_export/workout-routes/${route.file}`] = [strToU8(gpx(route)), { mtime }]
const zip = zipSync(files, { level: 9 })
mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, zip)

const count = [...records.values()].reduce((n, list) => n + list.length, 0)
console.log(`${OUT}`)
console.log(`  ${(zip.length / 1024).toFixed(0)} KB zipped, export.xml ${(xml.length / 1024 / 1024).toFixed(2)} MB, ${count} records, ${workouts.length} workouts`)
console.log(`  ${dateOf(dayStart(0))} to ${end} (${DAYS} days), exported ${stamp(exportAt)}, born ${birthday}`)
