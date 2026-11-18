// Generates the narration with ElevenLabs, one request per scene, each told what is said before and after it.
// Scenes whose text, voice and settings are unchanged are reused from .cache, so re-runs cost nothing.
// Usage: ELEVENLABS_API_KEY=... node video/tts.mjs [sceneId ...]          listed ids are regenerated
//        ELEVENLABS_API_KEY=... node video/tts.mjs --audition [sceneId]   one scene by every narrator in VOICES
//                                                                         → video/out/voice-samples/
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MODEL, SCENES, SETTINGS, VOICE, VOICES, ttsDir } from './narration.mjs'

const KEY = process.env.ELEVENLABS_API_KEY
if (!KEY) {
  console.error('Set ELEVENLABS_API_KEY in the environment (never in a file).')
  process.exit(1)
}
const HERE = fileURLToPath(new URL('.', import.meta.url))
const args = process.argv.slice(2)
const audition = args[0] === '--audition'
const force = new Set(audition ? [] : args)
let billed = 0

/** Makes sure scene i exists for this narrator and returns its mp3 path. */
async function speak(voice, i) {
  const s = SCENES[i]
  const dir = join(HERE, '.cache', ttsDir(voice))
  mkdirSync(dir, { recursive: true })
  const hash = createHash('sha1').update(JSON.stringify([voice.id, MODEL, SETTINGS, s.say])).digest('hex').slice(0, 12)
  const metaFile = join(dir, `${s.id}.json`)
  const mp3 = join(dir, `${s.id}.mp3`)
  if (!force.has(s.id) && existsSync(metaFile) && JSON.parse(readFileSync(metaFile, 'utf8')).hash === hash) {
    console.log(`= ${voice.name} ${s.id} (cached)`)
    return mp3
  }
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice.id}/with-timestamps?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ text: s.say, model_id: MODEL, voice_settings: SETTINGS, seed: 2026, previous_text: SCENES[i - 1]?.say, next_text: SCENES[i + 1]?.say }),
  })
  if (!res.ok) {
    console.error(`${voice.name} ${s.id}: HTTP ${res.status} ${(await res.text()).slice(0, 400)}`)
    process.exit(1)
  }
  const j = await res.json()
  writeFileSync(mp3, Buffer.from(j.audio_base64, 'base64'))
  writeFileSync(metaFile, JSON.stringify({ hash, text: s.say, alignment: j.alignment }))
  billed += Number(res.headers.get('character-cost') ?? s.say.length)
  console.log(`+ ${voice.name} ${s.id}: ${s.say.length} chars, ${j.alignment.character_end_times_seconds.at(-1).toFixed(2)} s`)
  return mp3
}

if (audition) {
  const i = Math.max(0, SCENES.findIndex((s) => s.id === (args[1] ?? 'intro')))
  const out = join(HERE, 'out', 'voice-samples')
  mkdirSync(out, { recursive: true })
  for (const [n, voice] of VOICES.entries()) copyFileSync(await speak(voice, i), join(out, `${n + 1}-${voice.name}.mp3`))
  console.log(`samples: ${out}`)
} else {
  for (const i of SCENES.keys()) await speak(VOICE, i)
}
console.log(`characters billed this run: ${billed}`)
