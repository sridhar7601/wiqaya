// Sound for the demo video: narration, a music bed that ducks under the voice, and interface taps and clicks,
// mixed to one stereo WAV at online-video loudness.
// MUSIC=<key> picks another bed from TRACKS, MUSIC=none leaves the music out.
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = fileURLToPath(new URL('.', import.meta.url))
const ASSETS = join(HERE, 'assets')
const SR = 48000

/** Music by Scott Buckley, CC-BY 4.0: the credit line must be in the video description. Files download on first use. */
export const TRACKS = {
  inbound: { title: 'Inbound', url: 'https://www.scottbuckley.com.au/library/wp-content/uploads/2019/11/sb_inbound.mp3' },
  'a-new-year': { title: 'A New Year', url: 'http://www.scottbuckley.com.au/library/wp-content/uploads/2018/01/sb_anewyear.mp3' },
}
const KEY = process.env.MUSIC ?? 'inbound'
if (KEY !== 'none' && !TRACKS[KEY]) throw new Error(`MUSIC must be one of: ${Object.keys(TRACKS).join(', ')}, none`)
export const TRACK = KEY === 'none' ? null : TRACKS[KEY]
export const musicCredit = () => (TRACK ? `Music: “${TRACK.title}” by Scott Buckley, released under CC-BY 4.0. www.scottbuckley.com.au` : null)

// Levels in dBFS before the final normalisation. The narration is the reference.
const TARGET_LUFS = -15 // whole mix; natural speech has tall peaks, and a louder target would lean on the limiter
const VOICE_RMS = -20 // while speaking
const MUSIC_UNDER = [-18, -16] // relative to the voice, at the start and at the end of the video (a slow build)
const MUSIC_OPEN = 6 // lift where nobody speaks
const DUCK_IN = 0.5 // seconds to settle under the voice
const DUCK_OUT = 0.9 // seconds to come back up
const SFX = {
  tap: { file: 'tap.wav', peak: -15, onset: 0.008, rate: 1 },
  key: { file: 'tap.wav', peak: -19, onset: 0.008, rate: 1.12 },
  click: { file: 'click.wav', peak: -13, onset: 0.006, rate: 1 },
}

const db = (x) => 10 ** (x / 20)
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const smooth = (x) => {
  const p = clamp(x, 0, 1)
  return p * p * (3 - 2 * p)
}
function decode(file, channels, { filter, seconds } = {}) {
  const args = ['-v', 'error', '-i', file, ...(seconds ? ['-t', String(seconds)] : []), ...(filter ? ['-af', filter] : []), '-f', 'f32le', '-ac', String(channels), '-ar', String(SR), '-']
  const raw = execFileSync('ffmpeg', args, { maxBuffer: 1 << 30 })
  return new Float32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength))
}
/** RMS over the parts of a clip where someone is speaking (50 ms blocks within 30 dB of the loudest). */
function activeRms(x) {
  const n = SR / 20
  const power = []
  for (let i = 0; i + n <= x.length; i += n) {
    let s = 0
    for (let k = i; k < i + n; k++) s += x[k] * x[k]
    power.push(s / n)
  }
  const gate = Math.max(...power) / 1000
  const active = power.filter((p) => p > gate)
  return Math.sqrt(active.reduce((a, b) => a + b, 0) / active.length)
}
function seeded(seed) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
async function musicFile() {
  const file = join(ASSETS, 'music', `${KEY}.mp3`)
  if (!existsSync(file)) {
    const res = await fetch(TRACK.url, { headers: { 'user-agent': 'Mozilla/5.0' } })
    if (!res.ok) throw new Error(`Could not download the music (${res.status}): ${TRACK.url}`)
    mkdirSync(join(ASSETS, 'music'), { recursive: true })
    writeFileSync(file, Buffer.from(await res.arrayBuffer()))
  }
  return file
}
function loudness(args) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', ...args, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 26 })
  const summary = r.stderr.slice(r.stderr.lastIndexOf('Summary:'))
  return { i: Number(/I:\s+(-?[\d.]+) LUFS/.exec(summary)[1]), peak: Number(/Peak:\s+(-?[\d.]+) dBFS/.exec(summary)[1]) }
}

/**
 * clips: [{ file, at }] narration clips and their start times; sfx: [{ t, kind }] with kind tap | key | click.
 * Writes `wav` and returns what was measured.
 */
export async function mixAudio({ total, clips, sfx, wav, work }) {
  const n = Math.ceil(total * SR)
  const voice = new Float32Array(n)
  const fx = new Float32Array(n)
  const voiced = []
  for (const c of clips) {
    const x = decode(c.file, 1)
    const g = db(VOICE_RMS) / activeRms(x)
    const off = Math.round(c.at * SR)
    for (let i = 0; i < x.length && off + i < n; i++) voice[off + i] += x[i] * g
    voiced.push([c.at, c.at + x.length / SR])
  }

  const rnd = seeded(7)
  const sound = Object.fromEntries([...new Set(Object.values(SFX).map((s) => s.file))].map((f) => [f, decode(join(ASSETS, 'sfx', f), 1)]))
  for (const e of sfx) {
    const k = SFX[e.kind]
    const src = sound[k.file]
    const g = db(k.peak + 1 + (rnd() - 0.5) * 2.4) // the sources peak at -1 dBFS; each hit differs slightly, like a real finger
    const rate = k.rate * (1 + (rnd() - 0.5) * 0.08)
    const off = Math.round((e.t - k.onset) * SR)
    for (let i = 0; i < Math.floor((src.length - 1) / rate); i++) {
      const p = i * rate
      const j = Math.floor(p)
      if (off + i >= 0 && off + i < n) fx[off + i] += (src[j] + (src[j + 1] - src[j]) * (p - j)) * g
    }
  }

  const L = new Float32Array(n)
  const R = new Float32Array(n)
  let under = null
  if (TRACK) {
    // A dip around 2.4 kHz leaves room for the consonants of the voice.
    const all = decode(await musicFile(), 2, { filter: 'equalizer=f=2400:t=q:w=0.8:g=-3.5', seconds: total + 8 })
    // Tracks open with a second or two of silence; the bed starts where the music does.
    let first = 0
    while (first < all.length && Math.abs(all[first]) < 0.001) first++
    const m = all.subarray(Math.max(0, first - (first % 2) - SR / 10))
    const frames = Math.min(n, Math.floor(m.length / 2))
    // Ride the fader: the track's own slow build is evened out to the MUSIC_UNDER curve, in steps of half a second.
    const hop = SR / 2
    const power = []
    for (let i = 0; i < frames; i += hop) {
      let s = 0
      const end = Math.min(frames, i + hop)
      for (let k = i; k < end; k++) s += ((m[2 * k] + m[2 * k + 1]) / 2) ** 2
      power.push(s / (end - i))
    }
    const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length
    const level = power.map((_, i) => 10 * Math.log10(mean(power.slice(Math.max(0, i - 4), i + 5)) + 1e-12))
    const ride = level.map((_, i) => {
      const t = (i * hop) / SR
      const target = VOICE_RMS + MUSIC_UNDER[0] + ((MUSIC_UNDER[1] - MUSIC_UNDER[0]) * t) / total
      return clamp(target - mean(level.slice(Math.max(0, i - 6), i + 7)), -16, 10)
    })
    const lift = (t) => {
      let since = Infinity
      let until = Infinity
      for (const [a, b] of voiced) {
        if (t >= a && t <= b) return 0
        if (t > b) since = Math.min(since, t - b)
        else until = Math.min(until, a - t)
      }
      return Math.min(smooth(since / DUCK_OUT), smooth(until / DUCK_IN))
    }
    const step = SR / 100
    const gainAt = (j) => {
      const t = (j * step) / SR
      const r = (j * step) / hop
      const i = Math.min(ride.length - 1, Math.floor(r))
      const rideDb = ride[i] + ((ride[Math.min(ride.length - 1, i + 1)] - ride[i]) * (r - i))
      return db(rideDb + lift(t) * MUSIC_OPEN) * smooth(t / 0.8) * smooth((total - 0.15 - t) / 3)
    }
    let sum = 0
    let count = 0
    for (let j = 0; j * step < frames; j++) {
      const g0 = gainAt(j)
      const g1 = gainAt(j + 1)
      const speaking = lift((j * step) / SR) === 0
      for (let k = 0; k < step && j * step + k < frames; k++) {
        const i = j * step + k
        const g = g0 + ((g1 - g0) * k) / step
        L[i] = m[2 * i] * g
        R[i] = m[2 * i + 1] * g
        if (speaking) {
          sum += ((L[i] + R[i]) / 2) ** 2
          count++
        }
      }
    }
    under = 10 * Math.log10(sum / count) - VOICE_RMS
  }
  for (let i = 0; i < n; i++) {
    L[i] += voice[i] + fx[i]
    R[i] += voice[i] + fx[i]
  }

  const both = new Float32Array(n * 2)
  for (let i = 0; i < n; i++) {
    both[2 * i] = L[i]
    both[2 * i + 1] = R[i]
  }
  const raw = join(work, 'mix.f32')
  writeFileSync(raw, Buffer.from(both.buffer))
  const input = ['-f', 'f32le', '-ar', String(SR), '-ac', '2', '-i', raw]
  const before = loudness(input)
  // Plain gain to the target, with a limiter for the speech peaks above -2 dBFS.
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...input, '-af', `volume=${(TARGET_LUFS - before.i).toFixed(2)}dB,alimiter=limit=0.79:level=disabled:attack=4:release=80`, '-ar', String(SR), '-c:a', 'pcm_s16le', wav])
  const after = loudness(['-i', wav])
  return { loudness: after.i, peak: after.peak, gain: TARGET_LUFS - before.i, musicUnderVoice: under, hits: sfx.length }
}
