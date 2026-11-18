// Renders the demo video frame by frame from the real app: deterministic timing, sharp text, narration in sync.
// Needs: dist/ (npm run build), the AI dev server on :8787 (npm run ai:dev), ffmpeg, Google Chrome, and
// narration from video/tts.mjs. Sound (voice, music, taps) is mixed in video/audio.mjs.
// Usage:  node video/render.mjs                   full render → video/out/wiqaya-demo.mp4, .srt, youtube.txt
//         STILLS=2,14.5,40 node video/render.mjs  PNG stills at those seconds → video/out/stills/
//         DSF=1 node video/render.mjs             1920×1080 instead of 2560×1440
//         PREVIEW=1 SKIP_AI=1 node video/render.mjs   badged review copy without the AI reply → wiqaya-demo-PREVIEW.mp4
//         TEXT_ONLY=1 node video/render.mjs       rewrite only the subtitles and youtube.txt
//         AUDIO_ONLY=1 node video/render.mjs      remix the sound onto the frames already rendered (same narration)
//         MIX_ONLY=1 node video/render.mjs        only the soundtrack → video/out/wiqaya-demo-sound.wav
//         VOICE=lily, MUSIC=a-new-year|none       another narrator or music bed; TAG=b adds "-b" to the file names
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mixAudio, musicCredit } from './audio.mjs'
import { SCENES, SUB_FIX, subtitle, ttsDir } from './narration.mjs'
import { startServer } from './server.mjs'

const HERE = fileURLToPath(new URL('.', import.meta.url))
const CACHE = join(HERE, '.cache')
const OUT = join(HERE, 'out')
const FPS = 30
const DSF = Number(process.env.DSF || 4 / 3)
const STILLS = process.env.STILLS ? process.env.STILLS.split(',').map(Number).sort((a, b) => a - b) : null
const PREVIEW = !!process.env.PREVIEW
const AUDIO_ONLY = !!process.env.AUDIO_ONLY
const NAME = `wiqaya-demo${process.env.TAG ? `-${process.env.TAG}` : ''}${PREVIEW ? '-PREVIEW' : ''}`
if (!STILLS && !PREVIEW && process.env.SKIP_AI) throw new Error('SKIP_AI is for check passes and previews only')
const PORT = 8899
const PROTOTYPE = 'https://wiqaya-health.vercel.app' // live link, printed in the YouTube description
const CDP_PORT = 9351
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const q = JSON.stringify
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v))
mkdirSync(join(OUT, 'stills'), { recursive: true })

// ---------------------------------------------------------------- narration timing
const CLIPS = Object.fromEntries(
  SCENES.map((s) => {
    const m = JSON.parse(readFileSync(join(CACHE, ttsDir(), `${s.id}.json`), 'utf8'))
    if (m.text !== s.say) throw new Error(`Narration for "${s.id}" is out of date: run video/tts.mjs`)
    const a = m.alignment
    return [s.id, { text: a.characters.join(''), start: a.character_start_times_seconds, end: a.character_end_times_seconds, file: join(CACHE, ttsDir(), `${s.id}.mp3`) }]
  }),
)

// ---------------------------------------------------------------- animation tracks
const EASE = {
  linear: (p) => p,
  in: (p) => p * p * p,
  out: (p) => 1 - (1 - p) ** 3,
  inOut: (p) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2),
}
const INIT = {
  'title.o': 1, 'title.y': 0, 'phone.o': 0, 'phone.x': 0, 'phone.y': 46, 'phone.s': 0.965, 'desk.o': 0, 'desk.y': 36, 'desk.s': 0.97,
  'cap.o': 0, 'cap.out': 0, 'end.o': 0, 'end.y': 26, 'touch.x': 0, 'touch.y': 0, 'touch.o': 0, 'touch.s': 1, 'touch.r': 0,
  'cur.x': 1500, 'cur.y': 820, 'cur.o': 0, 'cur.p': 0, 'hl.o': 0, 'veil.pf': 0, 'veil.df': 0, fade: 0,
}
const tracks = new Map()
function val(name, t) {
  let v = INIT[name] ?? 0
  for (const s of tracks.get(name) ?? []) {
    if (t < s.t0) break
    v = t >= s.t1 ? s.to : s.from + (s.to - s.from) * EASE[s.ease]((t - s.t0) / (s.t1 - s.t0))
  }
  return v
}
function tween(name, t0, dur, to, ease = 'inOut', from) {
  const segs = tracks.get(name) ?? []
  tracks.set(name, segs)
  segs.push({ t0, t1: t0 + Math.max(dur, 0.001), from: from ?? val(name, t0), to, ease })
  segs.sort((a, b) => a.t0 - b.t0)
}
const set = (name, t, v) => tween(name, t, 0.001, v, 'linear', v)

const scrolls = { pf: [], df: [] }
const scrollTween = (f, t0, dur, from, to) => scrolls[f].push({ t0, t1: t0 + dur, from, to })
function scrollAt(f, t) {
  for (const s of scrolls[f]) if (t >= s.t0 && t <= s.t1 + 1 / FPS) return s.from + (s.to - s.from) * EASE.inOut(clamp((t - s.t0) / (s.t1 - s.t0)))
  return null
}
const scrollEnd = (f, t) => scrolls[f].find((s) => t >= s.t0 - 1e-6 && t <= s.t1)?.to ?? null

// ---------------------------------------------------------------- cues (actions at a point in video time)
const cues = []
let seq = 0
const cue = (t, run) => cues.push({ t, run, seq: seq++ })
let js, send // bound once Chrome is up
const sfx = [] // { t, kind } for the sound mix: every tap, keystroke and click is heard

async function locate(f, query, now) {
  const r = await js(`S.locate(${q(f)}, ${q(query)})`)
  const fin = scrollEnd(f, now)
  if (fin != null) {
    console.warn(`  ! measured ${q(query.text ?? query.sel)} during a scroll at ${now.toFixed(2)}s`)
    r.y -= fin - r.sy
    r.sy = fin
    r.hit = r.y > 70 && r.y + r.h < r.vh - 90
  }
  return r
}
// Clicks and typing are done inside the page: debugger-dispatched input stalls for seconds after an iframe reload.
const press = (f, query) => js(`S.press(${q(f)}, ${q(query)})`)

/** Phone tap: scroll into view if needed, show the touch, press at t. */
let lastTap = -1
function tap(f, query, t, o = {}) {
  const lead = o.lead ?? 0.45
  sfx.push({ t, kind: 'tap' })
  cue(t - lead, async () => {
    const r = await locate(f, query, t - lead)
    let dy = 0
    if (!r.hit) {
      const target = clamp(r.sy + r.y + r.h / 2 - r.vh * (o.align ?? 0.45), 0, r.max)
      dy = target - r.sy
      scrollTween(f, t - lead + 0.01, Math.min(0.4, lead - 0.12), r.sy, target)
    }
    const x = r.fx + (r.x + r.w * (o.px ?? 0.5)) * r.s
    const y = r.fy + (r.y - dy + r.h * (o.py ?? 0.5)) * r.s
    const appear = t - 0.14
    if (lastTap > t - 0.8 && val('touch.o', appear) > 0.05) {
      tween('touch.x', appear - 0.08, 0.22, x)
      tween('touch.y', appear - 0.08, 0.22, y)
    } else {
      set('touch.x', appear, x)
      set('touch.y', appear, y)
      set('touch.s', appear, 1.25)
      tween('touch.s', appear + 0.002, 0.14, 1, 'out')
    }
    tween('touch.o', appear, 0.12, 1, 'out')
    lastTap = t
    const me = t
    cue(t, async () => {
      const before = o.advance ? await js(`S.h1(${q(f)})`) : null
      await press(f, query)
      set('touch.r', t, 0)
      tween('touch.r', t + 0.002, 0.45, 1, 'out')
      tween('touch.s', t, 0.07, 0.86, 'out')
      tween('touch.s', t + 0.08, 0.18, 1, 'out')
      if (o.advance) cue(t + 0.12, () => js(`S.untilH1Not(${q(f)}, ${q(before)})`))
      if (o.resetScroll)
        cue(t + 0.13, async () => {
          const sy = await js(`S.sy(${q(f)})`)
          if (sy > 1) scrollTween(f, t + 0.14, 0.2, sy, 0)
        })
      cue(t + 0.24, () => {
        if (lastTap === me) tween('touch.o', t + 0.24, 0.26, 0, 'in')
      })
    })
  })
}

/** Desktop pointer: glide to the target, press at t (or only hover). */
function click(f, query, t, o = {}) {
  const move = o.move ?? 0.65
  if (o.press !== false) sfx.push({ t, kind: 'click' })
  const lead = move + 0.5
  cue(t - lead, async () => {
    const r = await locate(f, query, t - lead)
    let dy = 0
    if (!r.hit) {
      const target = clamp(r.sy + r.y + r.h / 2 - r.vh * (o.align ?? 0.55), 0, r.max)
      dy = target - r.sy
      scrollTween(f, t - lead + 0.01, 0.45, r.sy, target)
    }
    const x = r.fx + (r.x + r.w * (o.px ?? 0.5)) * r.s
    const y = r.fy + (r.y - dy + r.h * (o.py ?? 0.5)) * r.s
    tween('cur.x', t - move, move, x)
    tween('cur.y', t - move, move, y)
    if (o.press === false) return
    cue(t, async () => {
      await press(f, query)
      tween('cur.p', t, 0.06, 1, 'out')
      tween('cur.p', t + 0.1, 0.2, 0, 'out')
    })
  })
}
const hover = (f, query, t, o = {}) => click(f, query, t, { ...o, press: false })

const type = (f, text, t, cps = 9) =>
  [...text].forEach((ch, i) => {
    sfx.push({ t: t + i / cps, kind: 'key' })
    cue(t + i / cps, () => js(`S.typeChar(${q(f)}, ${q(ch)})`))
  })

function scrollTo(f, target, t, dur = 0.9, align = 0.12) {
  cue(t, async () => {
    const sy = await js(`S.sy(${q(f)})`)
    let y
    if (typeof target === 'number') y = target
    else if (target.by != null) y = sy + target.by
    else {
      const r = await js(`S.locate(${q(f)}, ${q(target)})`)
      y = r.sy + r.y - r.vh * align
    }
    const max = await js(`S.doc(${q(f)}).documentElement.scrollHeight - S.win(${q(f)}).innerHeight`)
    scrollTween(f, t, dur, sy, clamp(y, 0, max))
  })
}

let hlCur = 0
const highlights = [] // for the log, so each one can be checked in the finished video
function hl(f, query, t, dur = 1.8) {
  highlights.push([t, query.text ?? query.sel])
  cue(t, async () => {
    await js(`S.hlTarget(${q(f)}, ${q(query)})`)
    const r = await js(`S.locate(${q(f)}, ${q(query)})`)
    if (!r.hit) console.warn(`  ! highlight on ${q(query.text ?? query.sel)} at ${t.toFixed(2)}s is not on the visible screen`)
    const me = ++hlCur
    tween('hl.o', t, 0.22, 1, 'out')
    cue(t + dur, () => {
      if (hlCur === me) tween('hl.o', t + dur, 0.3, 0, 'in')
    })
  })
}

function veil(f, t, fn) {
  tween(`veil.${f}`, t, 0.16, 1, 'in')
  cue(t + 0.17, fn)
  tween(`veil.${f}`, t + 0.2, 0.3, 0, 'out', 1)
}

const waitText = (f, text, t, timeout = 20000) => cue(t, () => js(`S.untilText(${q(f)}, ${q(text)}, ${timeout})`))

const CHAPTERS = ['start', 'red', 'check', 'result', 'ai', 'share', 'clinician', 'evidence']
let capIn = -1e9
function caption(id, t, mode = 'phone', fadeOut = true) {
  if (fadeOut) tween('cap.out', t - 0.3, 0.28, 1, 'in')
  cue(t, async () => {
    const s = SCENES.find((x) => x.id === id)
    await js(`S.setCaption(${q(s.caption ?? null)}, ${q(mode)}, ${CHAPTERS.indexOf(id) + 1}, ${CHAPTERS.length})`)
    capIn = t
  })
  set('cap.out', t, 0)
}

// ---------------------------------------------------------------- the story, scene by scene
const BUILD = {
  intro(sc) {
    const swap = sc.at('yet often') - 0.2
    tween('title.o', swap, 0.6, 0, 'in')
    tween('title.y', swap, 0.6, -26, 'in')
    tween('phone.o', swap + 0.3, 0.7, 1, 'out')
    tween('phone.y', swap + 0.3, 0.9, 0, 'out')
    tween('phone.s', swap + 0.3, 0.9, 1, 'out')
    set('cap.o', swap + 0.4, 1)
    caption('intro', swap + 0.4, 'phone', false)
  },
  start(sc) {
    caption('start', sc.t0)
    tap('pf', { text: 'عربي', sel: 'button', exact: true }, sc.at('Arabic') + 0.1)
    tap('pf', { text: 'EN', sel: 'button', exact: true }, sc.at('no name') + 0.15)
    tap('pf', { text: 'Start the check', sel: 'a' }, sc.at('Consent') - 0.3, { advance: true })
    scrollTo('pf', { text: 'I am 18 or older', sel: 'label' }, sc.at('Consent') + 0.05, 0.7, 0.3)
    tap('pf', { text: 'I am 18 or older', sel: 'label' }, Math.max(sc.at('and the AI') + 0.05, sc.at('Consent') + 1.25), { px: 0.05 })
    tap('pf', { text: 'Optional:', sel: 'label' }, sc.at('separate') + 0.05, { px: 0.05 })
    tap('pf', { text: 'Start the check', sel: 'button' }, sc.a1 + 0.3, { advance: true })
    return sc.a1 + 0.3
  },
  red(sc) {
    caption('red', sc.t0)
    tap('pf', { sel: 'input' }, sc.t0 + 0.2)
    type('pf', '34', sc.t0 + 0.4, 7)
    tap('pf', { text: 'Continue', sel: 'button' }, sc.t0 + 1.05, { advance: true })
    tap('pf', { text: 'Sudden, severe pain', sel: 'button' }, Math.max(sc.at('Sudden') + 0.1, sc.t0 + 1.7))
    tap('pf', { text: 'Continue', sel: 'button' }, sc.at('stops') + 0.05, { advance: true })
    hl('pf', { text: 'Call 998', sel: 'a' }, sc.at('nine nine eight') - 0.1, 2.2)
    return sc.at('nine nine eight') + 2.0
  },
  check(sc) {
    caption('check', sc.t0)
    veil('pf', sc.t0 - 0.12, async () => {
      await js(`S.storage(${q({ 'wiqaya.answers': { age: 34, urgent_symptoms: ['none'] }, 'wiqaya.step': 'body' })}, true)`)
      await js(`S.reload('pf')`)
      await js(`S.untilText('pf', 'Your height and weight')`)
    })
    let t = sc.t0 + 0.7
    tap('pf', { sel: 'input', nth: 0 }, t)
    type('pf', '178', t + 0.18, 10)
    tap('pf', { sel: 'input', nth: 1 }, t + 0.75)
    type('pf', '92', t + 0.93, 10)
    t += 1.45
    tap('pf', { text: 'Continue', sel: 'button' }, t, { advance: true })
    const steps = [
      ['s', 'Yes, we are trying now'], ['s', 'More than 12 months'], ['s', 'Under 35'], ['m', 'None of these'],
      ['s', 'No'], ['s', 'No'], ['s', 'No'], ['m', 'None of these'], ['m', 'Testosterone, anabolic steroids'],
      ['m', 'None of these'], ['s', 'Daily'], ['m', 'None of these'], ['s', '2–4 days'], ['s', '6–8 hours'],
      ['s', 'More than 3 years ago'], ['s', 'No'], ['s', 'No'],
    ]
    const multis = steps.filter((s) => s[0] === 'm').length
    const hold = clamp((sc.a1 - 0.35 - t - multis * 0.45) / steps.length, 0.55, 0.85)
    for (const [kind, text] of steps) {
      t += hold
      if (kind === 's') tap('pf', { text, sel: 'button', exact: text === 'No' }, t, { advance: true })
      else {
        tap('pf', { text, sel: 'button' }, t)
        t += 0.45
        tap('pf', { text: 'Continue', sel: 'button' }, t, { advance: true, resetScroll: true })
      }
    }
    waitText('pf', 'Your next step', t + 0.15)
    return t + 0.2
  },
  result(sc) {
    caption('result', sc.t0)
    hl('pf', { text: 'Decided by fixed clinical rules', sel: 'span' }, sc.at('transparent'), 2.0)
    scrollTo('pf', { text: 'Your plan', sel: 'h2' }, sc.at('He sees') - 0.25, 0.9, 0.1)
    scrollTo('pf', { text: 'Your fertility and your heart', sel: 'p' }, sc.at('a nudge') - 0.15, 0.9, 0.16)
    hl('pf', { text: 'Your fertility and your heart', sel: 'p', closest: 'div.rounded-xl' }, sc.at('a nudge') + 0.8, 2.0)
    scrollTo('pf', { text: 'What we found', sel: 'h2' }, sc.at('the reasons') - 0.15, 1.0, 0.1)
    hl('pf', { sel: 'details[open] span.flex-wrap' }, sc.at('published'), 2.6)
    return sc.a1
  },
  ai(sc) {
    caption('ai', sc.t0)
    scrollTo('pf', { text: 'Explain it in plain words', sel: 'h2' }, sc.t0 + 0.02, 1.0, 0.1)
    const press = Math.max(sc.at('explains') - 0.2, sc.t0 + 1.6)
    tap('pf', { text: 'Explain my result', sel: 'button' }, press)
    const SKIP = !!process.env.SKIP_AI // layout checks only, when the AI service is unreachable; never for the final render
    if (!SKIP) waitText('pf', 'AI can make mistakes', press + 1.1, 40000)
    hl('pf', { text: 'Optional. The AI helper sees', sel: 'p' }, sc.at('only sees') - 0.1, 1.8)
    scrollTo('pf', { by: 180 }, sc.at('only sees') + 1.95, 1.8)
    if (!SKIP) hl('pf', { text: 'AI can make mistakes', sel: 'p' }, sc.at('guardrails') - 0.1, 2.2)
    return sc.a1
  },
  share(sc) {
    caption('share', sc.t0)
    scrollTo('pf', { text: 'Prepare a summary', sel: 'a' }, sc.t0 + 0.02, 0.55, 0.55)
    tap('pf', { text: 'Prepare a summary', sel: 'a' }, sc.t0 + 0.95, { advance: true })
    tap('pf', { text: 'All my answers', sel: 'label' }, Math.max(sc.at('exactly') + 0.25, sc.t0 + 1.75), { px: 0.88 })
    scrollTo('pf', { text: 'Technical format', sel: 'summary' }, sc.at('standard') - 0.75, 0.7, 0.3)
    tap('pf', { text: 'Technical format', sel: 'summary' }, sc.at('fire') + 0.05)
    const said = sc.at('withdraw')
    tap('pf', { text: 'Send to my doctor', sel: 'button' }, said - 0.3, { lead: 0.8, align: 0.62 })
    // On a phone, Withdraw wraps under the first button and lands below the fold: bring it up before pointing at it.
    scrollTo('pf', { text: 'Withdraw', sel: 'button' }, said - 0.12, 0.5, 0.72)
    hl('pf', { text: 'Withdraw', sel: 'button' }, said + 0.45, 1.7)
    return said + 2.3
  },
  clinician(sc) {
    cue(sc.t0 - 0.1, async () => {
      await js(`S.go('df', '/clinician')`)
      await js(`S.untilText('df', 'Referral inbox')`)
      await js(`S.scroll('df', 0)`)
    })
    tween('phone.o', sc.t0, 0.4, 0, 'in')
    tween('phone.x', sc.t0, 0.45, 80, 'in')
    tween('desk.o', sc.t0 + 0.2, 0.6, 1, 'out')
    tween('desk.y', sc.t0 + 0.2, 0.7, 0, 'out')
    tween('desk.s', sc.t0 + 0.2, 0.7, 1, 'out')
    caption('clinician', sc.t0 + 0.15, 'desk')
    tween('cur.o', sc.t0 + 0.7, 0.3, 1, 'out')
    hover('df', { text: 'WQ-', sel: 'button', contains: true }, sc.at('reviews') - 0.1, { move: 0.7, px: 0.3 })
    scrollTo('df', { text: 'Signals and evidence', sel: 'h3' }, sc.at('every signal') - 0.5, 0.8, 0.06)
    click('df', { text: 'Confirm suggested step', sel: 'button' }, Math.max(sc.at('confirms') + 0.15, sc.at('every signal') + 1.5), { move: 0.65, align: 0.7 })
    hl('df', { text: 'Confirmed:', sel: 'p', closest: 'div' }, sc.at('recorded'), 2.4)
    return sc.a1 + 0.2
  },
  evidence(sc) {
    caption('evidence', sc.t0, 'desk')
    tween('cur.o', sc.t0 - 0.1, 0.25, 0, 'in')
    veil('df', sc.t0 - 0.1, async () => {
      await js(`S.go('df', '/evaluation')`)
      await js(`S.untilText('df', 'Safety and performance testing')`)
      await js(`S.scroll('df', 0)`)
    })
    hl('df', { text: 'Red flags caught', sel: 'p', closest: '.surface' }, sc.at('every red flag') - 0.05, 1.4)
    hl('df', { text: 'Under-triaged', sel: 'p', closest: '.surface' }, sc.at('none are') - 0.05, 1.5)
    hl('df', { text: 'Fairness', sel: 'p', closest: '.surface' }, sc.at('Nationality') - 0.05, 1.9)
    scrollTo('df', { text: 'AI explainer: live model test', sel: 'h2,h3', contains: true }, sc.at('in live') - 0.7, 1.3, 0.2)
    hl('df', { text: 'AI explainer: live model test', sel: 'h2,h3', contains: true, closest: 'div' }, sc.at('twenty-one') - 0.2, 2.0)
    return sc.a1
  },
  end(sc) {
    tween('desk.o', sc.t0, 0.5, 0, 'in')
    tween('desk.s', sc.t0, 0.5, 0.98, 'in')
    tween('cap.o', sc.t0, 0.4, 0, 'in')
    tween('end.o', sc.t0 + 0.35, 0.8, 1, 'out')
    tween('end.y', sc.t0 + 0.35, 0.9, 0, 'out')
    return sc.a1 + 1.8
  },
}

// lead = visual time before the voice starts, tail = minimum hold after it ends
const PLAN = [['intro', 2.4, 0.4], ['start', 0.35, 0.6], ['red', 0.3, 0.9], ['check', 0.6, 0.5], ['result', 0.35, 0.5], ['ai', 0.3, 0.6], ['share', 1.2, 0.9], ['clinician', 0.9, 0.8], ['evidence', 0.7, 0.6], ['end', 0.8, 5]]
const placed = []
let cursorT = 0
for (const [id, lead, tail] of PLAN) {
  const c = CLIPS[id]
  const a0 = cursorT + lead
  const sc = {
    id,
    t0: cursorT,
    a0,
    a1: a0 + c.end.at(-1),
    at(phrase) {
      const i = c.text.indexOf(phrase)
      if (i < 0) throw new Error(`"${phrase}" is not in the ${id} narration`)
      return a0 + c.start[i]
    },
  }
  const need = BUILD[id](sc) ?? 0
  sc.t1 = Math.max(sc.a1 + tail, need + 0.4)
  placed.push(sc)
  cursorT = sc.t1
}
const TOTAL = cursorT
tween('fade', TOTAL - 0.7, 0.7, 1, 'in')
const fmt = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`
console.log(placed.map((s) => `${s.id.padEnd(10)} ${fmt(s.t0)} → ${fmt(s.t1)}  (voice ${fmt(s.a0)}–${fmt(s.a1)})`).join('\n'))
console.log(`total ${fmt(TOTAL)}`)
console.log(`highlights: ${highlights.map(([t, what]) => `${t.toFixed(1)}s ${what}`).join(' | ')}`)
if (TOTAL >= 178) throw new Error('Video would be 2:58 or longer; the limit is under 3 minutes.')

function stateAt(t) {
  const v = (n) => val(n, t)
  return {
    title: { o: v('title.o'), y: v('title.y') },
    end: { o: v('end.o'), y: v('end.y') },
    phone: { o: v('phone.o'), x: v('phone.x'), y: v('phone.y'), s: v('phone.s') },
    desk: { o: v('desk.o'), y: v('desk.y'), s: v('desk.s') },
    cap: { o: v('cap.o'), out: v('cap.out'), age: t - capIn },
    touch: { x: v('touch.x'), y: v('touch.y'), o: v('touch.o'), s: v('touch.s'), r: v('touch.r') },
    cursor: { x: v('cur.x'), y: v('cur.y'), o: v('cur.o'), p: v('cur.p') },
    hl: v('hl.o'),
    veil: { pf: v('veil.pf'), df: v('veil.df') },
    fade: v('fade'),
    scroll: { pf: scrollAt('pf', t), df: scrollAt('df', t) },
  }
}

// ---------------------------------------------------------------- audio, subtitles, description
const ts = (s) => {
  const ms = Math.max(0, Math.round(s * 1000))
  const p = (n, w = 2) => String(n).padStart(w, '0')
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`
}
function writeSubtitles() {
  const out = []
  for (const sc of placed) {
    const c = CLIPS[sc.id]
    const words = [...c.text.matchAll(/\S+/g)].map((m) => ({ w: m[0], i: m.index, j: m.index + m[0].length - 1 }))
    // A spoken form of several words ("nine nine eight") stays in one cue, so its written form can replace it.
    for (const [spoken] of SUB_FIX) {
      const n = spoken.split(' ').length
      for (let k = 0; n > 1 && k + n <= words.length; k++) {
        const run = words.slice(k, k + n)
        const joined = run.map((x) => x.w).join(' ')
        if (joined.startsWith(spoken)) words.splice(k, n, { w: joined, i: run[0].i, j: run.at(-1).j })
      }
    }
    let cur = []
    const flush = () => {
      if (!cur.length) return
      out.push({ start: sc.a0 + c.start[cur[0].i], end: sc.a0 + c.end[cur.at(-1).j], text: subtitle(cur.map((x) => x.w).join(' ')) })
      cur = []
    }
    words.forEach((w, k) => {
      cur.push(w)
      const len = cur.map((x) => x.w).join(' ').length
      const next = words[k + 1]
      if (/[.!?]$/.test(w.w) || (/[,;:]$/.test(w.w) && len > 34) || (next && len + 1 + next.w.length > 78)) flush()
    })
    flush()
  }
  const lines = (s) => {
    if (s.length <= 42) return s
    let cut = s.lastIndexOf(' ', Math.ceil(s.length / 2))
    const alt = s.indexOf(' ', Math.ceil(s.length / 2))
    if (alt > 0 && (cut < 0 || alt - s.length / 2 < s.length / 2 - cut)) cut = alt
    return `${s.slice(0, cut)}\n${s.slice(cut + 1)}`
  }
  const srt = out.map((x, i) => `${i + 1}\n${ts(x.start)} --> ${ts(Math.min(x.end + 0.3, out[i + 1]?.start - 0.04 || Infinity))}\n${lines(x.text)}\n`).join('\n')
  writeFileSync(join(OUT, `${NAME}.en.srt`), srt)
}
function writeDescription() {
  const ch = []
  for (const sc of placed) {
    const name = SCENES.find((s) => s.id === sc.id).chapter
    const at = sc.id === 'intro' ? 0 : sc.t0
    if (ch.length && at - ch.at(-1).at < 10) ch.at(-1).name += ` / ${name}`
    else ch.push({ at, name })
  }
  const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
  writeFileSync(
    join(OUT, NAME === 'wiqaya-demo' ? 'youtube.txt' : `${NAME}.youtube.txt`),
    `TITLE
Wiqaya: a private men’s health check | Team Zord | Future Health Digital Innovation Challenge

DESCRIPTION
Wiqaya (وقاية) is a private, bilingual health check for men in Abu Dhabi. It uses fertility, which men do come forward for, as a front door to the heart and metabolic screening they often skip.

Challenge: [Fertility] Male Reproductive Health, Future Health Digital Innovation Challenge
Team Zord: Sridhar S K, Sruthi K
Try the prototype: ${PROTOTYPE}

${ch.map((c) => `${mmss(c.at)} ${c.name}`).join('\n')}

What you see is a real run of the working prototype on a phone and in a desktop browser. The patient is synthetic. Wiqaya is a screening and navigation aid, not a diagnosis: the next step comes from 31 guideline-based rules on the device, the optional Azure OpenAI explanation runs behind input and output guardrails, and a clinician always confirms or changes the step.

${[musicCredit(), 'Narration voice and interface sounds: ElevenLabs (elevenlabs.io)'].filter(Boolean).join('\n')}
`,
  )
}

// The rendered frames are only valid for the timeline they were made with.
const videoOnly = join(CACHE, 'video-only.mp4')
const stamp = join(CACHE, 'video-only.json')
const timeline = q({ scale: DSF, preview: PREVIEW, scenes: placed.map((sc) => [sc.id, sc.t0, sc.a0, sc.t1].map((v) => (typeof v === 'number' ? +v.toFixed(3) : v))) })
async function sound(wav) {
  const mix = await mixAudio({ total: TOTAL, clips: placed.map((sc) => ({ file: CLIPS[sc.id].file, at: sc.a0 })), sfx, wav, work: CACHE })
  console.log(`sound: ${mix.loudness} LUFS, peak ${mix.peak} dBFS, ${mix.hits} taps and clicks${mix.musicUnderVoice == null ? ', no music' : `, music ${-mix.musicUnderVoice.toFixed(1)} dB under the voice`}`)
}
async function finish() {
  const wav = join(CACHE, 'mix.wav')
  await sound(wav)
  const final = join(OUT, `${NAME}.mp4`)
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', videoOnly, '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-ac', '2', '-movflags', '+faststart', final])
  writeSubtitles()
  writeDescription()
  console.log(`done: ${final}`)
}

if (process.env.TEXT_ONLY) {
  writeSubtitles()
  writeDescription()
  process.exit(0)
}
if (process.env.MIX_ONLY) {
  await sound(join(OUT, `${NAME}-sound.wav`))
  process.exit(0)
}
if (AUDIO_ONLY) {
  if (!existsSync(stamp) || readFileSync(stamp, 'utf8') !== timeline) throw new Error('The rendered frames do not match this narration and timing: run a full render first.')
  await finish()
  process.exit(0)
}

// ---------------------------------------------------------------- Chrome
const server = await startServer({ port: PORT })
const profile = mkdtempSync(join(CACHE, 'chrome-'))
const chrome = spawn(
  CHROME,
  ['--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--mute-audio', '--force-color-profile=srgb', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--window-size=1920,1080', 'about:blank'],
  { stdio: 'ignore' },
)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let ws
for (let i = 0; i < 60 && !ws; i++) {
  try {
    const page = (await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json()).find((x) => x.type === 'page')
    if (page) {
      ws = new WebSocket(page.webSocketDebuggerUrl)
      await new Promise((r, j) => ((ws.onopen = r), (ws.onerror = j)))
    }
  } catch {
    ws = undefined
  }
  if (!ws) await sleep(200)
}
if (!ws) throw new Error('Could not connect to Chrome')
let id = 0
const pending = new Map()
ws.onmessage = (m) => {
  const x = JSON.parse(m.data)
  if (x.id && pending.has(x.id)) {
    pending.get(x.id)(x)
    pending.delete(x.id)
  } else if (x.method === 'Runtime.exceptionThrown') console.warn('  page error:', x.params.exceptionDetails.exception?.description?.split('\n')[0])
}
send = (method, params = {}) =>
  new Promise((r, j) => {
    const n = ++id
    const timer = setTimeout(() => j(new Error(`no reply in 60 s: ${method} ${String(params.expression ?? params.type ?? '').slice(0, 160)}`)), 60000)
    pending.set(n, (x) => (clearTimeout(timer), r(x)))
    ws.send(JSON.stringify({ id: n, method, params }))
  })
js = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })
  if (r.error) throw new Error(r.error.message)
  if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description?.split('\n')[0] ?? 'evaluation failed')
  return r.result.result.value
}

let ff
try {
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: DSF, mobile: false })
  await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/` })
  for (let i = 0; i < 100 && !(await js('!!(window.S && S.ready)').catch(() => false)); i++) await sleep(100)
  if (PREVIEW) await js(`S.preview(${q(process.env.SKIP_AI ? 'Preview · not for upload · AI reply missing' : 'Preview · not for upload')})`)
  await js(`S.storage({ 'wiqaya.lang': 'en' })`)
  await js(`S.load('pf', '/')`)
  await js(`S.load('df', '/')`)

  const frames = Math.ceil(TOTAL * FPS)
  const stillFrames = new Set((STILLS ?? []).map((s) => Math.round(s * FPS)))
  const lastFrame = STILLS ? Math.max(...stillFrames) : frames - 1
  if (!STILLS) {
    rmSync(stamp, { force: true })
    ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-vf', 'scale=in_range=full:out_range=tv:in_color_matrix=bt601:out_color_matrix=bt709,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-profile:v', 'high', '-g', '60', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', '-movflags', '+faststart', videoOnly], { stdio: ['pipe', 'inherit', 'inherit'] })
  }
  const due = (t) => cues.filter((c) => c.t <= t + 1e-6).sort((a, b) => a.t - b.t || a.seq - b.seq)[0]
  const started = Date.now()
  for (let f = 0; f <= lastFrame; f++) {
    const t = f / FPS
    const capture = !STILLS || stillFrames.has(f)
    // Every frame is applied (scroll positions and layout must be real when a cue measures or clicks).
    await js(`S.apply(${q(stateAt(t))})`)
    let c = due(t)
    while (c) {
      cues.splice(cues.indexOf(c), 1)
      const w0 = Date.now()
      try {
        await c.run()
      } catch (e) {
        throw new Error(`cue at ${c.t.toFixed(2)}s failed: ${e.message}`)
      }
      if (Date.now() - w0 > 2500) console.warn(`  slow cue at ${c.t.toFixed(2)}s: ${((Date.now() - w0) / 1000).toFixed(1)}s`)
      c = due(t)
    }
    if (!capture) {
      // Keeps the compositor producing frames; without it headless Chrome stalls input and animation frames.
      await send('Page.captureScreenshot', { format: 'jpeg', quality: 20, clip: { x: 0, y: 0, width: 8, height: 8, scale: 1 } })
      continue
    }
    const st = stateAt(t)
    await js(`S.apply(${q(st)})`)
    await js('S.raf()')
    const shot = await send('Page.captureScreenshot', STILLS ? { format: 'png' } : { format: 'jpeg', quality: 92, optimizeForSpeed: true })
    const buf = Buffer.from(shot.result.data, 'base64')
    if (STILLS) {
      writeFileSync(join(OUT, 'stills', `t${t.toFixed(2).padStart(6, '0')}.png`), buf)
      console.log(`still ${t.toFixed(2)}s`)
    } else {
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r))
      if (f % 300 === 0 && f) {
        const el = (Date.now() - started) / 1000
        console.log(`frame ${f}/${frames}  ${fmt(t)}  elapsed ${Math.round(el)}s  eta ${Math.round((el / f) * (frames - f))}s`)
      }
    }
  }
  if (ff) {
    ff.stdin.end()
    await new Promise((r, j) => ff.on('close', (code) => (code === 0 ? r() : j(new Error(`ffmpeg exited ${code}`)))))
  }
} finally {
  ws.close()
  chrome.kill()
  server.close()
  await sleep(300)
  rmSync(profile, { recursive: true, force: true })
}

if (!STILLS) {
  writeFileSync(stamp, timeline)
  await finish()
}
