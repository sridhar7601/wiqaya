/**
 * Apple Health importer. Reads the file the iPhone Health app makes with "Export All Health Data", on the person's own
 * device, and keeps only small daily summaries. Nothing is uploaded and the raw samples are never stored.
 *
 * The file is export.zip with apple_health_export/export.xml inside: every sample the phone and the watch ever
 * recorded, often 50-500 MB. It is read as a stream, a few hundred KB at a time (unzip, decode, scan, let go), so
 * memory use stays small whatever the size of the file.
 *
 * Per day (the date as written in the export, which is the phone's local date) we keep:
 *   - steps: the iPhone and the Apple Watch both count the same walk, so each source is added up on its own and the
 *     largest total is kept, never the sum. Exercise minutes follow the same rule.
 *   - sleep: only "asleep" (core, deep, REM, unspecified), never "in bed" or "awake". Pieces that overlap (the watch
 *     and a sleep app, say) are merged so no minute counts twice. A night counts for the day it ends; at most 16 h.
 *   - resting heart rate: the day's average. Weight: the day's last reading, in kg.
 *
 * How the scan works: find each `<Record` start tag and read its type first. Only the five types above are parsed
 * further; the rest (heart rate, energy, distance: most of the file) is skipped. A tag cut in two by a chunk boundary
 * is carried over to the next chunk.
 */

import { Unzip, UnzipInflate, UnzipPassThrough } from 'fflate'

export interface DailySignal {
  /** YYYY-MM-DD: the local date as written in the export */
  date: string
  steps?: number
  sleepH?: number
  restingHr?: number
  weightKg?: number
  exerciseMin?: number
}

export interface ImportSummary {
  /** one entry per day that has any data, oldest first */
  days: DailySignal[]
  /** the first and last day in `days` */
  from?: string
  to?: string
  /** every <Record> in the file, and how many of them went into `days` */
  recordsSeen: number
  recordsUsed: number
  /** bytes of the file read (for summariseXmlText: characters of text) */
  bytesRead: number
  ms: number
}

/** Every error thrown here has one of these as its message, for the screen to turn into a friendly sentence. */
export type AppleHealthError =
  | 'not_apple_health' // not an Apple Health export
  | 'no_export_xml' // a zip with no export.xml in it
  | 'bad_zip' // the zip is damaged or cut short
  | 'aborted' // the person cancelled

export interface SummariseOptions {
  /** how many days to keep, ending on `today`; default 180 */
  sinceDays?: number
  /** YYYY-MM-DD; default: the latest date in the export */
  today?: string
  signal?: AbortSignal
}

export interface ImportOptions extends SummariseOptions {
  /** 0 to 1, as the file is read */
  onProgress?: (fraction: number) => void
}

/** Reads export.zip (or the bare export.xml) and returns the daily summaries. */
export async function importAppleHealth(file: Blob, opts: ImportOptions = {}): Promise<ImportSummary> {
  const started = performance.now()
  const io: Io = { signal: opts.signal, bytes: 0, onChunk: () => {} }
  const first = await readRange(file, 0, 64, io)
  let text: AsyncIterable<string>
  if (isZip(first)) {
    text = await zipText(file, io, opts.onProgress)
  } else if (isXml(first)) {
    io.onChunk = progressMeter(file.size, opts.onProgress)
    text = decode(readStream(file, io))
  } else {
    fail('not_apple_health')
  }
  const summary = await summariseXmlText(text, opts)
  opts.onProgress?.(1)
  return { ...summary, bytesRead: io.bytes, ms: Math.round(performance.now() - started) }
}

/** The core, on text: export.xml in pieces of any size, each let go once it has been scanned. */
export async function summariseXmlText(
  xmlChunks: Iterable<string> | AsyncIterable<string>,
  opts: SummariseOptions = {},
): Promise<ImportSummary> {
  const started = performance.now()
  const summary = summariser()
  let chars = 0
  let paused = started
  for await (const text of typeof xmlChunks === 'string' ? [xmlChunks] : xmlChunks) {
    if (opts.signal?.aborted) fail('aborted')
    chars += text.length
    summary.push(text)
    if (performance.now() - paused > PAUSE_EVERY_MS) {
      await pause()
      paused = performance.now()
    }
  }
  if (opts.signal?.aborted) fail('aborted')
  return { ...summary.finish(opts), bytesRead: chars, ms: Math.round(performance.now() - started) }
}

// ---------------------------------------------------------------------------------------------------------------
// The scan

type Kind = 'steps' | 'sleep' | 'restingHr' | 'weight' | 'exercise'

const KINDS = new Map<string, Kind>([
  ['HKQuantityTypeIdentifierStepCount', 'steps'],
  ['HKCategoryTypeIdentifierSleepAnalysis', 'sleep'],
  ['HKQuantityTypeIdentifierRestingHeartRate', 'restingHr'],
  ['HKQuantityTypeIdentifierBodyMass', 'weight'],
  ['HKQuantityTypeIdentifierAppleExerciseTime', 'exercise'],
])

/** Sleep values that mean asleep: by name, and by HealthKit's number (1 unspecified, 3 core, 4 deep, 5 REM). */
const ASLEEP = new Set([
  'HKCategoryValueSleepAnalysisAsleep', // the name before iOS 16
  'HKCategoryValueSleepAnalysisAsleepUnspecified',
  'HKCategoryValueSleepAnalysisAsleepCore',
  'HKCategoryValueSleepAnalysisAsleepDeep',
  'HKCategoryValueSleepAnalysisAsleepREM',
  '1',
  '3',
  '4',
  '5',
])

/** Weight must name its unit; exercise time is in minutes unless it says otherwise. */
const KG_PER_UNIT = new Map([['kg', 1], ['g', 0.001], ['lb', 0.45359237], ['st', 6.35029318]])
const MINUTES_PER_UNIT = new Map([['min', 1], ['s', 1 / 60], ['hr', 60]])

const HOUR_MS = 3_600_000
const DAY_MS = 86_400_000
/** Asleep pieces less than this far apart are one night, so waking at 1 am for an hour does not split it in two. */
const SAME_NIGHT_GAP_MS = 3 * HOUR_MS
const MAX_SLEEP_H = 16
const DEFAULT_DAYS = 180
/** The <HealthData> root follows a header of about 10 KB. A file without it in the first 4 MB is something else. */
const ROOT_SEARCH_LIMIT = 4 << 20
/** The export date sits just after the root; this much text after the root is enough to include it. */
const AFTER_ROOT = 1024
/** A start tag is a few hundred characters. One that runs on longer than this is broken. */
const TAG_LIMIT = 1 << 16
/** On the main thread, hand control back to the page this often (ms), so the progress bar can move. */
const PAUSE_EVERY_MS = 50

interface Day {
  steps?: Map<number, number> // per source
  exercise?: Map<number, number> // minutes per source
  hrSum: number
  hrCount: number
  weightKg?: number
  weightAt: number // when that weight was measured, to keep the day's last one
  used: number // records that went into this day
}

interface Night {
  ms: number
  pieces: number
}

function summariser() {
  const days = new Map<string, Day>()
  const sources = new Map<string, number>()
  const sleepStart: number[] = []
  const sleepEnd: number[] = []
  const sleepDay: string[] = []
  let head = '' // the text up to the root element: the XML declaration and the DTD
  let rootAt = -1
  let scanning = false
  let carry = '' // the unfinished end of the previous chunk
  let exportDay: string | undefined
  let seen = 0

  function push(text: string): void {
    if (scanning) return scan(text, false)
    const from = Math.max(0, head.length - 10)
    head += text
    if (rootAt < 0) rootAt = head.indexOf('<HealthData', from)
    if (rootAt < 0) {
      if (head.length > ROOT_SEARCH_LIMIT) fail('not_apple_health')
      return
    }
    if (head.length - rootAt >= AFTER_ROOT) start()
  }

  /** The root is in: note the export date, then scan everything from the root on. */
  function start(): void {
    const rest = head.slice(rootAt)
    exportDay = /<ExportDate\s[^>]*?value\s*=\s*["'](\d{4}-\d{2}-\d{2})/.exec(rest.slice(0, AFTER_ROOT))?.[1]
    head = ''
    scanning = true
    scan(rest, false)
  }

  function scan(text: string, final: boolean): void {
    const buf = carry + text
    carry = ''
    // Keeps a tag that the chunk cut short for the next chunk (unless this is the last chunk, or the tag is broken).
    const wait = (at: number): void => {
      if (!final && buf.length - at < TAG_LIMIT) carry = buf.slice(at)
    }
    let pos = 0
    for (;;) {
      const at = buf.indexOf('<Record', pos)
      if (at < 0) break
      const body = at + 7 // just after "<Record"
      if (body >= buf.length) return wait(at)
      if (!isSpace(buf.charCodeAt(body))) {
        pos = body // another element whose name starts with "Record"
        continue
      }
      const gt = buf.indexOf('>', body)
      if (gt < 0) return wait(at)
      const type = quickType(buf.slice(body, gt))
      if (type !== undefined && !KINDS.has(type)) {
        seen++ // one of the many types we do not keep
        pos = gt + 1
        continue
      }
      let end = tagEnd(buf, body)
      if (end < 0) {
        if (!final && buf.length - at < TAG_LIMIT) return wait(at)
        end = gt // a broken tag: read what is there
      }
      seen++
      const attrs = attributesOf(buf.slice(body, end))
      const kind = KINDS.get(attrs.get('type') ?? '')
      if (kind) record(kind, attrs)
      pos = end + 1
    }
    if (!final) carry = buf.slice(Math.max(pos, buf.length - 7)) // "<Record" may be cut in two
  }

  function day(date: string): Day {
    let d = days.get(date)
    if (!d) days.set(date, (d = { hrSum: 0, hrCount: 0, weightAt: -Infinity, used: 0 }))
    return d
  }

  function sourceId(name: string): number {
    let id = sources.get(name)
    if (id === undefined) sources.set(detach(name), (id = sources.size))
    return id
  }

  function record(kind: Kind, a: Map<string, string>): void {
    if (kind === 'sleep') {
      if (!ASLEEP.has(a.get('value') ?? '')) return // in bed, awake
      const start = timeOf(a.get('startDate'))
      const end = timeOf(a.get('endDate'))
      const date = dateOf(a.get('endDate'))
      if (!(end > start) || !date) return
      sleepStart.push(start)
      sleepEnd.push(end)
      sleepDay.push(date)
      return
    }
    const date = dateOf(a.get('startDate'))
    const value = numberOf(a.get('value'))
    if (!date || !(value >= 0)) return // !(x >= 0) also catches NaN
    if (kind === 'steps' || kind === 'exercise') {
      const amount = kind === 'steps' ? value : value * (MINUTES_PER_UNIT.get(a.get('unit') ?? 'min') ?? NaN)
      if (!(amount >= 0)) return
      const d = day(date)
      const bySource = kind === 'steps' ? (d.steps ??= new Map()) : (d.exercise ??= new Map())
      const id = sourceId(a.get('sourceName') ?? '')
      bySource.set(id, (bySource.get(id) ?? 0) + amount)
      d.used++
    } else if (kind === 'restingHr') {
      if (value < 20 || value > 250) return
      const d = day(date)
      d.hrSum += value
      d.hrCount++
      d.used++
    } else {
      const kg = value * (KG_PER_UNIT.get(a.get('unit') ?? '') ?? NaN)
      if (!(kg >= 20 && kg <= 400)) return
      const d = day(date)
      const at = timeOf(a.get('startDate'))
      if (!(at < d.weightAt)) {
        d.weightKg = kg // the day's last reading; on a tie, the later line in the file
        d.weightAt = at
      }
      d.used++
    }
  }

  function finish(opts: SummariseOptions): Omit<ImportSummary, 'bytesRead' | 'ms'> {
    if (!scanning) {
      if (rootAt < 0) fail('not_apple_health')
      start()
    }
    scan('', true)
    const nights = sleepByDay(sleepStart, sleepEnd, sleepDay)
    const n = opts.sinceDays ?? DEFAULT_DAYS
    const sinceDays = n >= 1 ? Math.min(Math.floor(n), 100_000) : DEFAULT_DAYS
    let to = opts.today !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(opts.today) ? opts.today : ''
    if (!to) {
      // The latest date in the file. A date after the export itself is a clock error, so it does not count.
      const limit = exportDay ? addDays(exportDay, 1) : '9999-12-31'
      for (const d of [...days.keys(), ...nights.keys()]) if (d > to && d <= limit) to = d
    }
    if (!to) return { days: [], recordsSeen: seen, recordsUsed: 0 }
    const from = addDays(to, 1 - sinceDays)
    const dates = [...new Set([...days.keys(), ...nights.keys()])].filter((d) => d >= from && d <= to).sort()
    const out: DailySignal[] = []
    let used = 0
    for (const date of dates) {
      const d = days.get(date)
      const night = nights.get(date)
      const signal: DailySignal = { date }
      if (d?.steps) signal.steps = Math.round(largest(d.steps))
      if (night) signal.sleepH = Math.round(Math.min(MAX_SLEEP_H, night.ms / HOUR_MS) * 10) / 10
      if (d?.hrCount) signal.restingHr = Math.round(d.hrSum / d.hrCount)
      if (d?.weightKg !== undefined) signal.weightKg = Math.round(d.weightKg * 10) / 10
      if (d?.exercise) signal.exerciseMin = Math.round(largest(d.exercise))
      used += (d?.used ?? 0) + (night?.pieces ?? 0)
      out.push(signal)
    }
    return { days: out, from: out[0]?.date, to: out.at(-1)?.date, recordsSeen: seen, recordsUsed: used }
  }

  return { push, finish }
}

/**
 * Joins the asleep pieces into nights. Overlaps are merged, so no minute counts twice, and pieces less than 3 h
 * apart stay in one night, so a night that starts before midnight is not split. A night counts for the date its last
 * piece ends.
 */
function sleepByDay(start: number[], end: number[], endDay: string[]): Map<string, Night> {
  const byDay = new Map<string, Night>()
  let nightEnd = -Infinity
  let asleep = 0
  let pieces = 0
  let date = ''
  const close = (): void => {
    if (!pieces) return
    const night = byDay.get(date) ?? { ms: 0, pieces: 0 }
    night.ms += asleep
    night.pieces += pieces
    byDay.set(date, night)
  }
  for (const i of Array.from(start.keys()).sort((a, b) => start[a] - start[b])) {
    if (start[i] > nightEnd + SAME_NIGHT_GAP_MS) {
      close()
      asleep = 0
      pieces = 0
      nightEnd = start[i]
    }
    pieces++
    if (end[i] > nightEnd) {
      asleep += end[i] - Math.max(start[i], nightEnd)
      nightEnd = end[i]
      date = endDay[i]
    }
  }
  close()
  return byDay
}

/** Reads type="..." straight from the tag text. undefined if it is written some other way (the tag is then parsed in full). */
function quickType(tag: string): string | undefined {
  const i = tag.indexOf('type="')
  if (i < 0 || (i > 0 && !isSpace(tag.charCodeAt(i - 1)))) return undefined
  const j = tag.indexOf('"', i + 6)
  return j < 0 ? undefined : tag.slice(i + 6, j)
}

/** Where the start tag ends: the first ">" that is not inside a quoted value. -1 if the text ends first. */
function tagEnd(s: string, from: number): number {
  let quote = 0
  for (let i = from; i < s.length; i++) {
    const c = s.charCodeAt(i)
    if (quote) {
      if (c === quote) quote = 0
    } else if (c === 34 || c === 39) {
      quote = c // " or '
    } else if (c === 62) {
      return i // >
    }
  }
  return -1
}

const ATTRIBUTE = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g

/** Every name="value" (or name='value') in a start tag, in any order. The values we use never contain entities. */
function attributesOf(tag: string): Map<string, string> {
  const out = new Map<string, string>()
  for (const m of tag.matchAll(ATTRIBUTE)) out.set(m[1], m[2] ?? m[3])
  return out
}

const isSpace = (c: number): boolean => c === 32 || c === 10 || c === 13 || c === 9

const numberOf = (s: string | undefined): number => (s === undefined || s.trim() === '' ? NaN : Number(s))

const largest = (bySource: Map<number, number>): number => Math.max(...bySource.values())

/** A fresh copy of a short string. A slice of a big chunk would keep the whole chunk in memory while it is stored. */
const detach = (s: string): string => s.split('').join('')

/** "2026-10-01 07:30:00 +0400" gives "2026-10-01": the date as written, which is the phone's local date. */
function dateOf(s: string | undefined): string | undefined {
  return s !== undefined && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : undefined
}

const TIME = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?\s*(Z|[+-]\d{2}:?\d{2})?/

/** "2026-10-01 07:30:00 +0400" as milliseconds since 1970 (UTC), so pieces written in different time zones line up. */
function timeOf(s: string | undefined): number {
  const m = s === undefined ? null : TIME.exec(s)
  if (!m) return NaN
  const local = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0))
  const zone = m[7]
  if (!zone || zone === 'Z') return local
  const digits = zone.replace(':', '')
  const minutes = +digits.slice(1, 3) * 60 + +digits.slice(3, 5)
  return local - (zone[0] === '-' ? -minutes : minutes) * 60_000
}

/** "2026-10-01" plus n days, by the calendar. */
function addDays(date: string, n: number): string {
  const t = Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)) + n * DAY_MS
  return new Date(t).toISOString().slice(0, 10)
}

// ---------------------------------------------------------------------------------------------------------------
// Reading the file

interface Io {
  signal?: AbortSignal
  bytes: number // read so far
  onChunk: (n: number) => void // progress
}

function fail(code: AppleHealthError): never {
  throw new Error(code)
}

/** Lets the page repaint during a long import. A message, unlike a timer, is not slowed down in a background tab. */
function pause(): Promise<void> {
  return new Promise((resolve) => {
    const channel = new MessageChannel()
    channel.port1.onmessage = () => {
      channel.port1.close()
      resolve()
    }
    channel.port2.postMessage(null)
  })
}

async function readRange(file: Blob, start: number, end: number, io: Io): Promise<Uint8Array> {
  const bytes = new Uint8Array(await file.slice(start, end).arrayBuffer())
  io.bytes += bytes.length
  return bytes
}

/** The file's bytes in order, a chunk at a time. Nothing is kept after a chunk has been handed on. */
async function* readStream(blob: Blob, io: Io): AsyncGenerator<Uint8Array> {
  const reader = blob.stream().getReader()
  try {
    for (;;) {
      if (io.signal?.aborted) fail('aborted')
      const { done, value } = await reader.read()
      if (done) return
      io.bytes += value.length
      io.onChunk(value.length)
      yield value
    }
  } finally {
    reader.cancel().catch(() => {})
  }
}

async function* decode(bytes: AsyncIterable<Uint8Array>): AsyncGenerator<string> {
  const text = new TextDecoder()
  const out: string[] = []
  for await (const chunk of bytes) {
    decodeInto(out, text, chunk, false)
    yield* out.splice(0)
  }
  decodeInto(out, text, new Uint8Array(0), true)
  yield* out.splice(0)
}

/**
 * Bytes are turned into text at most this many at a time. Short strings are cheap for the JavaScript engine to throw
 * away; strings over about 128 KB are stored apart and wait for its occasional full clean-up, so they pile up.
 */
const TEXT_PIECE = 32 << 10

function decodeInto(out: string[], decoder: TextDecoder, bytes: Uint8Array, final: boolean): void {
  for (let i = 0; i < bytes.length; i += TEXT_PIECE) out.push(decoder.decode(bytes.subarray(i, i + TEXT_PIECE), { stream: true }))
  if (final) out.push(decoder.decode())
}

/** Calls onProgress with 0 to 1 as bytes arrive, at most once per whole percent. */
function progressMeter(total: number, onProgress?: (fraction: number) => void): (n: number) => void {
  let done = 0
  let shown = 0
  return (n) => {
    done += n
    const fraction = total > 0 ? Math.min(1, done / total) : 1
    if (onProgress && fraction - shown >= 0.01) {
      shown = fraction
      onProgress(fraction)
    }
  }
}

/** A zip starts with "PK" and a record number (3 = a file, 5 = an empty archive). */
const isZip = (b: Uint8Array): boolean => b[0] === 0x50 && b[1] === 0x4b && (b[2] === 3 || b[2] === 5)

/** XML starts with "<", after an optional byte-order mark and white space. */
function isXml(b: Uint8Array): boolean {
  let i = b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf ? 3 : 0
  while (b[i] === 0x20 || b[i] === 0x0a || b[i] === 0x0d || b[i] === 0x09) i++
  return b[i] === 0x3c
}

// ---------------------------------------------------------------------------------------------------------------
// The zip
//
// A zip ends with a table of contents (the "central directory") that gives every file's exact place and size. The
// file is a Blob, so we can jump there, then inflate only export.xml's bytes and never touch export_cda.xml or the
// workout routes. Reading the zip from the start instead (fflate's streaming Unzip) is the fallback, for a zip whose
// end is missing: where an entry's size is only written after its data, the streaming reader has to search for the
// end of the entry, and a long compressed entry can contain that marker by chance.

interface ZipEntry {
  name: string
  method: number // 0 stored, 8 deflate
  compressedSize: number
  size: number
  offset: number // of the entry's local header
}

const LOCAL_SIG = 0x04034b50
const ENTRY_SIG = 0x02014b50
const END_SIG = 0x06054b50
const END64_SIG = 0x06064b50
const LOCATOR64_SIG = 0x07064b50
const FULL32 = 0xffffffff
/**
 * Compressed bytes go into the inflater this many at a time. fflate grows a fresh output buffer by doubling on every
 * push, so one 64 KB push of XML (1-2 MB of text out) churns megabytes. With 16 KB pushes, and text made 32 KB at a
 * time (TEXT_PIECE), peak memory on a 200 MB export fell by about 30%, at the same speed (measured in Node on a Mac).
 */
const PIECE = 16 << 10

/** A chunk of bytes as pieces of at most PIECE bytes (views, not copies). */
function* piecesOf(bytes: Uint8Array): Generator<Uint8Array> {
  for (let i = 0; i < bytes.length; i += PIECE) yield bytes.subarray(i, i + PIECE)
}

async function zipText(file: Blob, io: Io, onProgress?: (fraction: number) => void): Promise<AsyncIterable<string>> {
  const entries = await listZip(file, io)
  if (entries) {
    const entry = pickExportXml(entries)
    if (!entry) fail('no_export_xml')
    const local = await readRange(file, entry.offset, entry.offset + 30, io)
    if (local.length === 30 && u32(local, 0) === LOCAL_SIG) {
      // The local header repeats the name and may carry a different "extra" field, so its own lengths count.
      const start = entry.offset + 30 + u16(local, 26) + u16(local, 28)
      io.onChunk = progressMeter(entry.compressedSize, onProgress)
      return inflateEntry(file.slice(start, start + entry.compressedSize), entry, io)
    }
  }
  io.onChunk = progressMeter(file.size, onProgress)
  return unzipFromStart(file, io)
}

/** The zip's table of contents. undefined if it cannot be found or read. */
async function listZip(file: Blob, io: Io): Promise<ZipEntry[] | undefined> {
  const tail = await readRange(file, Math.max(0, file.size - 22 - 0xffff), file.size, io)
  let e = tail.length - 22
  while (e >= 0 && u32(tail, e) !== END_SIG) e--
  if (e < 0) return undefined
  let size = u32(tail, e + 12)
  let offset = u32(tail, e + 16)
  if (size === FULL32 || offset === FULL32) {
    // Zip64 (archives over 4 GB): the real numbers are in a bigger record, which a "locator" just before this points to.
    const locator = e - 20
    if (locator < 0 || u32(tail, locator) !== LOCATOR64_SIG) return undefined
    const at = u64(tail, locator + 8)
    const end64 = await readRange(file, at, at + 56, io)
    if (end64.length < 56 || u32(end64, 0) !== END64_SIG) return undefined
    size = u64(end64, 40)
    offset = u64(end64, 48)
  }
  if (offset + size > file.size) return undefined
  const cd = await readRange(file, offset, offset + size, io)
  if (size > 0 && u32(cd, 0) !== ENTRY_SIG) return undefined
  const names = new TextDecoder()
  const entries: ZipEntry[] = []
  for (let p = 0; p + 46 <= cd.length && u32(cd, p) === ENTRY_SIG; ) {
    const nameLength = u16(cd, p + 28)
    const extraLength = u16(cd, p + 30)
    const entry: ZipEntry = {
      name: names.decode(cd.subarray(p + 46, p + 46 + nameLength)),
      method: u16(cd, p + 10),
      compressedSize: u32(cd, p + 20),
      size: u32(cd, p + 24),
      offset: u32(cd, p + 42),
    }
    readZip64(entry, cd.subarray(p + 46 + nameLength, p + 46 + nameLength + extraLength))
    entries.push(entry)
    p += 46 + nameLength + extraLength + u16(cd, p + 32)
  }
  return entries
}

/** A file over 4 GB keeps its real sizes and offset in a "zip64" extra field; the 32-bit fields then read 0xFFFFFFFF. */
function readZip64(entry: ZipEntry, extra: Uint8Array): void {
  for (let q = 0; q + 4 <= extra.length; q += 4 + u16(extra, q + 2)) {
    if (u16(extra, q) !== 1) continue
    let r = q + 4
    if (entry.size === FULL32) {
      entry.size = u64(extra, r)
      r += 8
    }
    if (entry.compressedSize === FULL32) {
      entry.compressedSize = u64(extra, r)
      r += 8
    }
    if (entry.offset === FULL32) entry.offset = u64(extra, r)
    return
  }
}

/**
 * export.xml in any folder, any letter case. Phones set to some languages give the file a translated name, so
 * failing that we take the largest other .xml that is not the clinical (CDA) copy; the root-element check confirms it.
 */
function pickExportXml(entries: ZipEntry[]): ZipEntry | undefined {
  const candidates = entries.filter((e) => isExportCandidate(e.name))
  return candidates.find((e) => /(^|\/)export\.xml$/i.test(e.name)) ?? candidates.sort((a, b) => b.size - a.size)[0]
}

/** An .xml file that is not export_cda.xml, nor the "._" shadow copies a Mac adds when it re-zips a folder. */
const isExportCandidate = (name: string): boolean =>
  /\.xml$/i.test(name) && !/_cda\.xml$/i.test(name) && !/(^|\/)(__MACOSX\/|\._)/.test(name)

/** One entry's compressed bytes in, its text out. */
async function* inflateEntry(data: Blob, entry: ZipEntry, io: Io): AsyncGenerator<string> {
  const text = new TextDecoder()
  const out: string[] = []
  let broken = false
  const inflater = entry.method === 8 ? new UnzipInflate() : entry.method === 0 ? new UnzipPassThrough() : fail('bad_zip')
  inflater.ondata = (err, chunk, final) => {
    if (err) broken = true
    else decodeInto(out, text, chunk, final)
  }
  let left = entry.compressedSize
  for await (const bytes of readStream(data, io)) {
    for (const piece of piecesOf(bytes)) {
      left -= piece.length
      inflater.push(piece, left <= 0)
      if (broken) fail('bad_zip')
      yield* out.splice(0)
    }
  }
  if (left > 0) fail('bad_zip') // the file ends before the entry does
}

type Walk = 'looking' | 'reading' | 'done'

/** The fallback: walk the zip from the start with fflate's streaming Unzip, and inflate the first export file found. */
async function* unzipFromStart(file: Blob, io: Io): AsyncGenerator<string> {
  const text = new TextDecoder()
  const out: string[] = []
  let walk = 'looking' as Walk
  let broken = false
  const unzip = new Unzip((entry) => {
    if (walk === 'looking' && isExportCandidate(entry.name)) {
      walk = 'reading'
      entry.ondata = (err, chunk, final) => {
        if (err) broken = true
        else decodeInto(out, text, chunk, final)
        if (final) walk = 'done'
      }
      entry.start()
    } else if (entry.compression === 0 || entry.compression === 8) {
      entry.ondata = () => {} // unpacked and dropped: an entry never started keeps all its bytes in memory
      entry.start()
    }
  })
  unzip.register(UnzipInflate)
  const push = (bytes: Uint8Array, final: boolean): void => {
    try {
      unzip.push(bytes, final)
    } catch {
      broken = true
    }
    if (broken) fail('bad_zip')
  }
  for await (const bytes of readStream(file, io)) {
    for (const piece of piecesOf(bytes)) {
      push(piece, false)
      yield* out.splice(0)
      if (walk === 'done') return
    }
  }
  if (walk === 'looking') fail('no_export_xml')
  push(new Uint8Array(0), true)
  yield* out.splice(0)
  if (walk !== 'done') fail('bad_zip') // the file ends inside export.xml
}

const u16 = (b: Uint8Array, i: number): number => b[i] | (b[i + 1] << 8)
const u32 = (b: Uint8Array, i: number): number => (u16(b, i) | (u16(b, i + 2) << 16)) >>> 0
const u64 = (b: Uint8Array, i: number): number => u32(b, i) + u32(b, i + 4) * 2 ** 32
