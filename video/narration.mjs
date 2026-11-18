// Narration, on-screen captions and subtitles for the demo video.
// `say` is what the voice reads (spelled for pronunciation); subtitles are derived from it with SUB_FIX.
// Edit here, then: ELEVENLABS_API_KEY=... node video/tts.mjs && node video/render.mjs   (VOICE=<name> picks another narrator)

export const MODEL = 'eleven_v4'
export const SETTINGS = { stability: 0.5, similarity_boost: 0.75, speed: 1 }

/** Narrators to compare with `node video/tts.mjs --audition`. The first one is used unless VOICE=<name> is set. */
export const VOICES = [
  { id: 'hpp4J3VqNfWAUOO0d1Us', name: 'Bella' },
  { id: 'XrExE9yKIg1WjnnlVkGX', name: 'Matilda' },
  { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah' },
]
const wanted = (process.env.VOICE || '').toLowerCase()
export const VOICE = wanted ? VOICES.find((v) => v.name.toLowerCase() === wanted) : VOICES[0]
if (!VOICE) throw new Error(`VOICE must be one of: ${VOICES.map((v) => v.name).join(', ')}`)
/** Narration cache folder (under video/.cache) for one narrator. */
export const ttsDir = (voice = VOICE) => `tts/${voice.name.toLowerCase()}-${MODEL}`

/** Spoken spelling → written form, for subtitles. */
export const SUB_FIX = [
  ['Wikaaya', 'Wiqaya'],
  ['nine nine eight', '998'],
  ['HL7 fire', 'HL7 FHIR'],
  ['thirty-one', '31'],
  ['fifty-four', '54'],
  ['twenty-one', '21'],
  ['about twenty', 'about 20'],
]

export const SCENES = [
  {
    id: 'intro',
    chapter: 'The idea',
    say: 'Men in Abu Dhabi will come forward for a fertility check, yet often skip the heart and metabolic screening that matters just as much. Wikaaya turns that first, private question into a front door to both.',
    caption: {
      eyebrow: 'The idea',
      title: 'Fertility as the front door to men’s health',
      points: ['Men come forward for fertility checks', 'Many skip heart and metabolic screening', 'Wiqaya connects the two, privately'],
    },
  },
  {
    id: 'start',
    chapter: 'Private by design',
    say: 'It runs on any phone, in English or Arabic, with no account and no name. Consent comes first, and the AI helper is a separate opt-in.',
    caption: {
      eyebrow: 'Private by design',
      title: 'No account, no name, Arabic or English',
      points: ['Consent before the first question', 'AI explanation is a separate opt-in', 'Answers stay on the phone'],
    },
  },
  {
    id: 'red',
    chapter: 'Safety first',
    say: 'Safety comes first. Sudden, severe testicular pain stops the check and points him straight to nine nine eight, because torsion can’t wait.',
    caption: {
      eyebrow: 'Safety first',
      title: 'Red flags stop the check',
      points: ['Possible torsion: call 998 now', 'Screened before any other health question'],
    },
  },
  {
    id: 'check',
    chapter: 'The check',
    say: 'Otherwise, about twenty short questions follow, on family plans, past infections, medicines including gym steroids, lifestyle, and his last health check. Sensitive questions always offer ‘prefer not to say’, and impossible values are caught before anything is scored.',
    caption: {
      eyebrow: 'The check',
      title: 'About 20 questions, about five minutes',
      points: ['Family plans, medicines, lifestyle, last check-up', '“Prefer not to say” on every sensitive question', 'Impossible values caught before scoring'],
    },
  },
  {
    id: 'result',
    chapter: 'The result',
    say: 'His next step is decided by thirty-one transparent rules, not by AI. He sees a clear plan, a nudge toward the heart and metabolic check he would otherwise skip, and the reasons behind every signal, each linked to a published guideline, from the World Health Organization to the American and European urology associations.',
    caption: {
      eyebrow: 'The result',
      title: 'Decided by 31 cited rules, not by AI',
      points: ['One clear next step, and a plan', 'Bridges to heart and metabolic checks (IFHAS)', 'Every signal cites WHO, AUA, EAU or NICE'],
    },
  },
  {
    id: 'ai',
    chapter: 'Optional AI',
    say: 'With his permission, Azure OpenAI explains the result in plain words. It only sees the result summary, never his answers. It can’t change the next step, and guardrails block any diagnosis or dosing advice.',
    caption: {
      eyebrow: 'Optional AI',
      title: 'Plain words, behind guardrails',
      points: ['Sees the result summary, never the answers', 'Cannot change the next step', 'No diagnoses, no doses, 998 on emergencies'],
    },
  },
  {
    id: 'share',
    chapter: 'Consent to share',
    say: 'He decides exactly what goes into the summary for his doctor. It’s a standard HL7 fire bundle, ready for Malaffi, and he can withdraw it at any time.',
    caption: {
      eyebrow: 'Consent to share',
      title: 'He chooses what his doctor sees',
      points: ['HL7 FHIR R4 bundle, ready for Malaffi', 'Nothing is sent until he presses Send', 'Withdraw at any time'],
    },
  },
  {
    id: 'clinician',
    chapter: 'Clinician in charge',
    say: 'His family doctor reviews every signal and its evidence, then confirms the next step, or changes it with a recorded reason. A clinician always has the final say.',
    caption: {
      eyebrow: 'Clinician in charge',
      title: 'A doctor confirms or changes the step',
      points: ['Every signal shows its evidence', 'Changes need a reason, and are recorded'],
    },
  },
  {
    id: 'evidence',
    chapter: 'Evidence',
    say: 'Every build runs the test suite. Across fifty-four synthetic cases, every red flag is caught and none are under-triaged. Nationality and language never change the result. And in live testing, the AI passed all twenty-one safety checks.',
    caption: {
      eyebrow: 'Evidence',
      title: 'Benchmarked, module by module',
      stats: [
        ['54/54', 'correct next step'],
        ['8/8', 'red flags caught'],
        ['0', 'cases under-triaged'],
        ['540/540', 'fairness runs unchanged'],
        ['21/21', 'live AI safety tests'],
      ],
    },
  },
  {
    id: 'end',
    chapter: 'Path to pilot',
    say: 'Next comes a supervised pilot with family physicians, through Sehatna and Malaffi. Wikaaya. A private first step for men’s health. Built by Team Zord.',
  },
]

export function subtitle(text) {
  return SUB_FIX.reduce((s, [a, b]) => s.split(a).join(b), text)
}
