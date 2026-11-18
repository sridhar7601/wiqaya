import { Zip, ZipDeflate, strToU8, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { importAppleHealth, summariseXmlText } from './appleHealth'
import type { ImportSummary } from './appleHealth'

// Small made-up exports, laid out like the real export.xml: a DTD, the HealthData root, ExportDate, Me, then Records.
const HEAD = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE HealthData [
<!-- HealthKit Export Version: 14 -->
<!ELEMENT HealthData (ExportDate,Me,(Record|Correlation|Workout|ActivitySummary|ClinicalRecord|Audiogram|VisionPrescription)*)>
<!ATTLIST HealthData
  locale CDATA #REQUIRED
>
<!ELEMENT Record ((MetadataEntry|HeartRateVariabilityMetadataList)*)>
<!ATTLIST Record
  type          CDATA #REQUIRED
  unit          CDATA #IMPLIED
  value         CDATA #IMPLIED
  sourceName    CDATA #REQUIRED
  startDate     CDATA #REQUIRED
  endDate       CDATA #REQUIRED
>
]>
<HealthData locale="en_AE">
 <ExportDate value="2026-10-06 21:04:11 +0400"/>
 <Me HKCharacteristicTypeIdentifierDateOfBirth="1992-03-14" HKCharacteristicTypeIdentifierBiologicalSex="HKBiologicalSexMale" HKCharacteristicTypeIdentifierBloodType="HKBloodTypeNotSet" HKCharacteristicTypeIdentifierFitzpatrickSkinType="HKFitzpatrickSkinTypeNotSet" HKCharacteristicTypeIdentifierCardioFitnessMedicationsUse="None"/>
`
const healthExport = (...records: string[]): string => `${HEAD}${records.join('\n')}\n</HealthData>\n`

/** "2026-10-01 07:30" in Abu Dhabi, as the export writes it. */
const t = (when: string): string => `${when}:00 +0400`

/** A <Record>, attributes in the order Apple writes them. */
const record = (type: string, source: string, start: string, end: string, value: string | number, unit?: string): string =>
  ` <Record type="${type}" sourceName="${source}" sourceVersion="26.1"${unit ? ` unit="${unit}"` : ''} creationDate="${t(end)}" startDate="${t(start)}" endDate="${t(end)}" value="${value}"/>`

const steps = (source: string, start: string, end: string, n: number) => record('HKQuantityTypeIdentifierStepCount', source, start, end, n, 'count')
const exercise = (source: string, start: string, end: string, min: number) => record('HKQuantityTypeIdentifierAppleExerciseTime', source, start, end, min, 'min')
const sleep = (source: string, start: string, end: string, stage: string) => record('HKCategoryTypeIdentifierSleepAnalysis', source, start, end, `HKCategoryValueSleepAnalysis${stage}`)
const weight = (source: string, when: string, value: number, unit: string) => record('HKQuantityTypeIdentifierBodyMass', source, when, when, value, unit)
const restingHr = (source: string, date: string, bpm: number) => record('HKQuantityTypeIdentifierRestingHeartRate', source, `${date} 00:02`, `${date} 20:45`, bpm, 'count/min')
const heartRate = (date: string, bpm: number) =>
  ` <Record type="HKQuantityTypeIdentifierHeartRate" sourceName="Sridhar’s Apple Watch" sourceVersion="26.1" device="&lt;&lt;HKDevice: 0x30216e3f0&gt;, name:Apple Watch, manufacturer:Apple Inc., model:Watch, hardware:Watch7,3, software:26.1&gt;" unit="count/min" creationDate="${t(`${date} 10:00`)}" startDate="${t(`${date} 10:00`)}" endDate="${t(`${date} 10:00`)}" value="${bpm}">\n  <MetadataEntry key="HKMetadataKeyHeartRateMotionContext" value="1"/>\n </Record>`

/** A bit of everything, for the tests that only check that two ways of reading agree. */
const RICH = healthExport(
  heartRate('2026-10-01', 71),
  steps('iPhone', '2026-10-01 08:00', '2026-10-01 08:30', 1200),
  steps('Sridhar’s Apple Watch', '2026-10-01 08:00', '2026-10-01 08:30', 1300),
  steps('Sridhar’s Apple Watch', '2026-10-02 18:00', '2026-10-02 18:40', 4200),
  sleep('iPhone', '2026-10-01 22:55', '2026-10-02 06:40', 'InBed'),
  sleep('Sridhar’s Apple Watch', '2026-10-01 23:10', '2026-10-01 23:50', 'AsleepCore'),
  sleep('Sridhar’s Apple Watch', '2026-10-02 00:10', '2026-10-02 06:20', 'AsleepDeep'),
  restingHr('Sridhar’s Apple Watch', '2026-10-02', 68),
  weight('iPhone', '2026-10-02 07:00', 215, 'lb'),
  exercise('Sridhar’s Apple Watch', '2026-10-02 18:05', '2026-10-02 18:35', 30),
  heartRate('2026-10-02', 77),
)

const blobOf = (bytes: Uint8Array): Blob => new Blob([bytes.slice()])

/** fflate's streaming Zip writes each file's sizes after its data (a "data descriptor"), as other streaming zip tools do. */
function streamedZip(files: Record<string, string>): Uint8Array {
  const parts: Uint8Array[] = []
  const zip = new Zip((err, chunk) => {
    if (err) throw err
    parts.push(chunk)
  })
  for (const [name, text] of Object.entries(files)) {
    const file = new ZipDeflate(name, { level: 6 })
    zip.add(file)
    file.push(strToU8(text), true)
  }
  zip.end()
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}

/** The zip without its table of contents (the central directory at the end), like a download that stopped early. */
function withoutDirectory(zip: Uint8Array): Uint8Array {
  const end = zip.length - 22 // no zip comment
  const directory = (zip[end + 16] | (zip[end + 17] << 8) | (zip[end + 18] << 16)) + zip[end + 19] * 2 ** 24
  return zip.slice(0, directory)
}

const sameDays = (r: ImportSummary) => ({ days: r.days, from: r.from, to: r.to, recordsSeen: r.recordsSeen, recordsUsed: r.recordsUsed })

function* pieces(text: string, size: number): Generator<string> {
  for (let i = 0; i < text.length; i += size) yield text.slice(i, i + size)
}

describe('summariseXmlText', () => {
  it('keeps the larger of the iPhone and Apple Watch totals for a day, never their sum', async () => {
    const r = await summariseXmlText([
      healthExport(
        steps('iPhone', '2026-10-01 08:00', '2026-10-01 08:30', 1200),
        steps('Apple Watch', '2026-10-01 08:00', '2026-10-01 08:30', 1300),
        steps('iPhone', '2026-10-01 12:00', '2026-10-01 12:20', 800),
        steps('Apple Watch', '2026-10-01 12:01', '2026-10-01 12:20', 900),
        steps('Apple Watch', '2026-10-01 18:00', '2026-10-01 18:30', 600),
        steps('iPhone', '2026-10-02 09:00', '2026-10-02 10:00', 3000), // the watch was charging
        steps('Apple Watch', '2026-10-02 19:00', '2026-10-02 19:15', 1000),
        exercise('Apple Watch', '2026-10-01 08:00', '2026-10-01 08:10', 10),
        exercise('Apple Watch', '2026-10-01 18:00', '2026-10-01 18:15', 15),
        exercise('Fitness app', '2026-10-01 18:00', '2026-10-01 18:20', 20),
      ),
    ])
    expect(r.days).toEqual([
      { date: '2026-10-01', steps: 2800, exerciseMin: 25 },
      { date: '2026-10-02', steps: 3000 },
    ])
    expect(r.recordsSeen).toBe(10)
    expect(r.recordsUsed).toBe(10)
  })

  it('counts only asleep stages, never in-bed or awake time, and gives the night to the day it ends', async () => {
    const r = await summariseXmlText([
      healthExport(
        sleep('iPhone', '2026-10-01 22:55', '2026-10-02 06:40', 'InBed'),
        sleep('Apple Watch', '2026-10-01 23:10', '2026-10-01 23:50', 'AsleepCore'), // 40 min, ends before midnight
        sleep('Apple Watch', '2026-10-01 23:50', '2026-10-02 00:10', 'Awake'),
        sleep('Apple Watch', '2026-10-02 00:10', '2026-10-02 01:10', 'AsleepDeep'), // 60
        sleep('Apple Watch', '2026-10-02 01:10', '2026-10-02 02:00', 'AsleepREM'), // 50
        sleep('Apple Watch', '2026-10-02 02:00', '2026-10-02 06:20', 'AsleepCore'), // 260
        sleep('Apple Watch', '2026-10-02 06:20', '2026-10-02 06:30', 'Awake'),
        sleep('Old sleep app', '2026-10-02 14:00', '2026-10-02 14:30', 'Asleep'), // a nap, in the pre-iOS 16 wording: 30
      ),
    ])
    expect(r.days).toEqual([{ date: '2026-10-02', sleepH: 7.3 }]) // 440 min
    expect(r.recordsSeen).toBe(8)
    expect(r.recordsUsed).toBe(5)
  })

  it('merges overlapping sleep from two sources so no minute counts twice, and caps a day at 16 h', async () => {
    const r = await summariseXmlText([
      healthExport(
        sleep('Apple Watch', '2026-10-02 23:00', '2026-10-03 03:00', 'AsleepCore'),
        sleep('Apple Watch', '2026-10-03 03:30', '2026-10-03 06:00', 'AsleepCore'),
        sleep('AutoSleep', '2026-10-02 23:30', '2026-10-03 06:30', 'AsleepUnspecified'), // covers the gap at 3 am
        sleep('Apple Watch', '2026-10-03 01:00', '2026-10-03 02:00', 'AsleepDeep'), // inside what is already counted
        sleep('AutoSleep', '2026-10-04 06:00', '2026-10-05 12:00', 'AsleepUnspecified'), // a broken 30-hour record
      ),
    ])
    expect(r.days).toEqual([
      { date: '2026-10-03', sleepH: 7.5 }, // 23:00 to 06:30
      { date: '2026-10-05', sleepH: 16 },
    ])
  })

  it('converts pounds to kilograms, keeps the last weight of the day, and averages resting heart rate', async () => {
    const r = await summariseXmlText([
      healthExport(
        weight('iPhone', '2026-10-01 21:00', 97.6, 'kg'), // the evening reading, written first
        weight('iPhone', '2026-10-01 07:00', 216.1, 'lb'),
        weight('iPhone', '2026-10-02 07:00', 215, 'lb'), // 97.52 kg
        weight('Some scale', '2026-10-02 08:00', 3400, 'oz'), // a unit we do not convert: left out
        restingHr('Apple Watch', '2026-10-01', 72),
        restingHr('Oura', '2026-10-01', 75),
      ),
    ])
    expect(r.days).toEqual([
      { date: '2026-10-01', restingHr: 74, weightKg: 97.6 },
      { date: '2026-10-02', weightKg: 97.5 },
    ])
    expect(r.recordsUsed).toBe(5)
  })

  it('reads attributes in any order and either quote style, and skips elements that only look like records', async () => {
    const r = await summariseXmlText([
      healthExport(
        ` <Record value="4321" endDate="2026-10-01 09:00:00 +0400" sourceName="Apple Watch" type="HKQuantityTypeIdentifierStepCount" startDate="2026-10-01 08:00:00 +0400" unit="count"/>`,
        ` <Record\n   type='HKQuantityTypeIdentifierRestingHeartRate'  unit = "count/min"\n   startDate='2026-10-01 00:00:00 +0400'\tendDate='2026-10-01 23:59:00 +0400' value='61' sourceName="Apple Watch">\n  <MetadataEntry key="HKMetadataKeyHeartRateMotionContext" value="0"/>\n </Record>`,
        ` <Record device="scale > v2" sourceName="Withings" unit="kg" type="HKQuantityTypeIdentifierBodyMass" startDate="2026-10-01 07:10:00 +0400" endDate="2026-10-01 07:10:00 +0400" value="96.04"/>`,
        heartRate('2026-10-01', 88),
        ` <RecordingSession type="HKQuantityTypeIdentifierStepCount" startDate="2026-10-01 10:00:00 +0400" value="9999"/>`,
        ` <Workout workoutActivityType="HKWorkoutActivityTypeWalking" duration="31" durationUnit="min" sourceName="Apple Watch" startDate="2026-10-01 18:00:00 +0400" endDate="2026-10-01 18:31:00 +0400">\n  <WorkoutStatistics type="HKQuantityTypeIdentifierStepCount" startDate="2026-10-01 18:00:00 +0400" endDate="2026-10-01 18:31:00 +0400" sum="3900" unit="count"/>\n </Workout>`,
        ` <ActivitySummary dateComponents="2026-10-01" activeEnergyBurned="412.5" appleExerciseTime="22"/>`,
      ),
    ])
    expect(r.days).toEqual([{ date: '2026-10-01', steps: 4321, restingHr: 61, weightKg: 96 }])
    expect(r.recordsSeen).toBe(4)
    expect(r.recordsUsed).toBe(3)
  })

  it('gives the same answer however the text is cut into chunks, including inside a <Record', async () => {
    const whole = await summariseXmlText([RICH])
    expect(whole.days).toEqual([
      { date: '2026-10-01', steps: 1300 },
      { date: '2026-10-02', steps: 4200, sleepH: 6.8, restingHr: 68, weightKg: 97.5, exerciseMin: 30 },
    ])
    for (const size of [1, 2, 3, 7, 11, 64, 1000]) {
      expect(sameDays(await summariseXmlText(pieces(RICH, size))), `pieces of ${size}`).toEqual(sameDays(whole))
    }
    async function* trickle() {
      for (const piece of pieces(RICH, 5)) yield piece
    }
    expect(sameDays(await summariseXmlText(trickle()))).toEqual(sameDays(whole))
  })

  it('keeps only the last sinceDays days up to today; by default today is the latest date in the export', async () => {
    const xml = healthExport(
      steps('iPhone', '2026-03-01 10:00', '2026-03-01 10:30', 1000),
      steps('iPhone', '2026-06-01 10:00', '2026-06-01 10:30', 2000),
      steps('iPhone', '2026-09-01 10:00', '2026-09-01 10:30', 3000),
      steps('iPhone', '2026-10-01 10:00', '2026-10-01 10:30', 4000),
      steps('iPhone', '2026-10-05 10:00', '2026-10-05 10:30', 5000),
      weight('Scale with a wrong clock', '2031-01-01 07:00', 90, 'kg'), // after the export date: not "today"
    )
    const dates = (r: ImportSummary) => r.days.map((d) => d.date)

    const byDefault = await summariseXmlText([xml]) // 180 days up to 2026-10-05, from 2026-04-09
    expect(dates(byDefault)).toEqual(['2026-06-01', '2026-09-01', '2026-10-01', '2026-10-05'])
    expect([byDefault.from, byDefault.to, byDefault.recordsUsed, byDefault.recordsSeen]).toEqual(['2026-06-01', '2026-10-05', 4, 6])

    expect(dates(await summariseXmlText([xml], { sinceDays: 30 }))).toEqual(['2026-10-01', '2026-10-05'])
    expect(dates(await summariseXmlText([xml], { today: '2026-10-01', sinceDays: 31 }))).toEqual(['2026-09-01', '2026-10-01'])
    expect(dates(await summariseXmlText([xml], { today: '2026-12-31', sinceDays: 1 }))).toEqual([])
  })

  it('rejects XML that is not an Apple Health export', async () => {
    const cda = `<?xml version="1.0" encoding="UTF-8"?>\n<ClinicalDocument xmlns="urn:hl7-org:v3"><title>Health Data</title></ClinicalDocument>\n`
    await expect(summariseXmlText([cda])).rejects.toThrow('not_apple_health')
    await expect(summariseXmlText([''])).rejects.toThrow('not_apple_health')
    // Records alone are not enough: without the HealthData root it is someone else's format.
    await expect(summariseXmlText([`<Data>${steps('iPhone', '2026-10-01 08:00', '2026-10-01 08:30', 100)}</Data>`])).rejects.toThrow('not_apple_health')
  })
})

describe('importAppleHealth', () => {
  const ROUTE = '<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Apple Health Export"><trk><trkseg/></trk></gpx>\n'
  // A decoy: had it been read instead of export.xml, the answer would change.
  const CDA = healthExport(steps('iPhone', '2026-10-01 08:00', '2026-10-01 08:30', 99999))

  it('reads export.xml from export.zip and ignores export_cda.xml and the workout routes', async () => {
    const zip = zipSync({
      'apple_health_export/export_cda.xml': strToU8(CDA),
      'apple_health_export/workout-routes/route_2026-10-02_6.00pm.gpx': strToU8(ROUTE),
      'apple_health_export/export.xml': strToU8(RICH),
    })
    const r = await importAppleHealth(blobOf(zip))
    expect(sameDays(r)).toEqual(sameDays(await summariseXmlText([RICH])))
    expect(r.bytesRead).toBeGreaterThan(0)
  })

  it('reads a zip that gives each size after the data, as streaming zip tools write them', async () => {
    const zip = streamedZip({ 'apple_health_export/export_cda.xml': CDA, 'apple_health_export/export.xml': RICH })
    expect(zip[6] & 8).toBe(8) // the "sizes come after the data" flag of the first entry
    expect(sameDays(await importAppleHealth(blobOf(zip)))).toEqual(sameDays(await summariseXmlText([RICH])))
  })

  it('still reads a zip whose table of contents is missing, by walking it from the start', async () => {
    const files = { 'apple_health_export/export_cda.xml': CDA, 'apple_health_export/export.xml': RICH }
    const expected = sameDays(await summariseXmlText([RICH]))
    const sized = zipSync({ 'apple_health_export/export_cda.xml': strToU8(CDA), 'apple_health_export/export.xml': strToU8(RICH) })
    expect(sameDays(await importAppleHealth(blobOf(withoutDirectory(sized))))).toEqual(expected)
    expect(sameDays(await importAppleHealth(blobOf(withoutDirectory(streamedZip(files)))))).toEqual(expected)
  })

  it('skips the "._export.xml" shadow file a Mac adds when the folder is zipped again in Finder', async () => {
    const appleDouble = new Uint8Array([0, 5, 22, 7, 0, 2, 0, 0, ...strToU8('Mac OS X        '), 0, 2, 0, 0, 0, 9])
    const zip = zipSync({
      'apple_health_export/': new Uint8Array(0),
      '__MACOSX/apple_health_export/._export.xml': appleDouble,
      'apple_health_export/export.xml': strToU8(RICH),
    })
    const expected = sameDays(await summariseXmlText([RICH]))
    expect(sameDays(await importAppleHealth(blobOf(zip)))).toEqual(expected)
    expect(sameDays(await importAppleHealth(blobOf(withoutDirectory(zip))))).toEqual(expected)
  })

  it('finds the export under a translated file name, still skipping the CDA copy', async () => {
    const zip = zipSync({
      'apple_health_export/書き出したデータ_cda.xml': strToU8(CDA),
      'apple_health_export/書き出したデータ.xml': strToU8(RICH),
    })
    expect(sameDays(await importAppleHealth(blobOf(zip)))).toEqual(sameDays(await summariseXmlText([RICH])))
  })

  it('accepts a bare export.xml', async () => {
    const file = new Blob([RICH])
    const r = await importAppleHealth(file)
    expect(sameDays(r)).toEqual(sameDays(await summariseXmlText([RICH])))
    expect(r.bytesRead).toBeGreaterThanOrEqual(file.size)
  })

  it('names the problem: not a Health file, no export.xml, a cut-off zip', async () => {
    await expect(importAppleHealth(new Blob(['just some notes']))).rejects.toThrow('not_apple_health')
    await expect(importAppleHealth(new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10])]))).rejects.toThrow('not_apple_health') // a JPEG
    const cdaOnly = zipSync({ 'apple_health_export/export_cda.xml': strToU8(CDA), 'notes.txt': strToU8('hello') })
    await expect(importAppleHealth(blobOf(cdaOnly))).rejects.toThrow('no_export_xml')
    await expect(importAppleHealth(blobOf(withoutDirectory(cdaOnly)))).rejects.toThrow('no_export_xml')
    const zip = zipSync({ 'apple_health_export/export.xml': strToU8(RICH) })
    await expect(importAppleHealth(blobOf(zip.slice(0, 200)))).rejects.toThrow('bad_zip')
  })

  it('stops with "aborted" when the person cancels', async () => {
    const zip = blobOf(zipSync({ 'apple_health_export/export.xml': strToU8(RICH) }))
    const before = new AbortController()
    before.abort()
    await expect(importAppleHealth(zip, { signal: before.signal })).rejects.toThrow('aborted')
    const during = new AbortController()
    await expect(importAppleHealth(zip, { signal: during.signal, onProgress: () => during.abort() })).rejects.toThrow('aborted')
  })

  it('reports progress, rising to 1', async () => {
    const seen: number[] = []
    await importAppleHealth(blobOf(zipSync({ 'apple_health_export/export.xml': strToU8(RICH) })), { onProgress: (f) => seen.push(f) })
    expect(seen.length).toBeGreaterThan(0)
    expect(seen.at(-1)).toBe(1)
    expect(seen.every((f, i) => f >= 0 && f <= 1 && (i === 0 || f >= seen[i - 1]))).toBe(true)
  })
})
