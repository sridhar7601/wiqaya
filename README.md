# Wiqaya: reproductive potential over time, for women and men

Prototype for the **Future Health Digital Innovation Challenge 2026**, Fertility Challenge 02: *Reproductive Potential*.

A private check in Arabic and English for women and men in Abu Dhabi, followed by a companion that tracks change over time: weekly check-ins (with cycle length for women), lab and hormone results, work exposures and the doctor's replies. There is no fertility score. Fixed, sourced rules explain what can and cannot be changed, what is still unknown, and which options are worth discussing now: healthy habits, tests, preconception counselling, a fertility-preservation discussion, a specialist, or urgent care.

What it adds beyond a questionnaire:

1. **A view of change over time.** Cycle lengths, AMH/FSH/TSH, semen analyses, blood pressure, weight and HbA1c are charted, and trend rules read the direction of change.
2. **Clinicians stay in charge.** A summary is encrypted on the phone and opened by link or QR code; the doctor confirms or changes the step, and that decision stands for 90 days. Every summary is marked for care only, never employment or insurance.
3. **A health-system view without individual data.** `/population` shows, on an invented population, which groups would benefit from earlier advice and whether advice reaches everyone fairly. Only totals are shown, and groups under 10 are hidden.
4. **Every claim is measured.** The Evidence page runs the rules live on 89 synthetic cases and reports calibration, false reassurance and the live-model AI tests.

Example people with months of history: `/#/try/mariam`, `/#/try/fatima`, `/#/try/omar`, `/#/try/yousef`.

> Screening support, not a diagnosis or a medical device. Tested with synthetic data only.

## How it works

| Stage | Who does it | What it does |
|---|---|---|
| Consent gate | Person | Nothing starts without consent. Each AI feature asks again, at the moment it is used. |
| Safety-first intake | Rules | Red-flag symptoms are asked right after age. Any red flag shows emergency or urgent advice straight away. |
| Lab report reader (optional) | AI, then code, then person | The AI transcribes numbers from a photo (`infra/ai/report.mjs`). Code straightens the picture first (`src/lib/deskew.ts`), then cross-checks the numbers against each other. The person confirms every value. |
| Data-quality gate | Rules | Catches missing, impossible and inconsistent values, ignores them, and asks the person to check. |
| Risk-signal rules | Rules | 51 deterministic rules, 20 of them for women only and 13 for men only (`src/lib/engine.ts`). Each shows the triggering answer and a guideline source. |
| Triage and navigation | Rules | One of five next steps; the highest wins. Offers lower-friction options. |
| Plain-language explainer (optional) | AI | Rewrites the result. It cannot change the step, and output guardrails block diagnosis claims and doses (`infra/ai/index.mjs`). |
| User-controlled hand-off | Person | The person picks what to share. An HL7 FHIR R4 bundle with a Consent resource (`src/lib/referral.ts`) is encrypted on the phone (`src/lib/crypto.ts`) and stored as ciphertext (`infra/server/share.mjs`). |
| Clinician review | Clinician | Confirms or changes the step with a reason (`/d/<link>` and `/clinician`). The decision returns, encrypted, to the person's phone. |

The AI never decides anything. The rules run on the phone.

## What the server holds

| Data | Stored? | Detail |
|---|---|---|
| Answers and results | No | They stay in the browser's storage on the person's device. |
| Shared summary | Ciphertext only | AES-256-GCM, key derived (HKDF) from a secret that exists only in the link after the `#`. Deleted on withdrawal, or after 1 or 7 days. |
| Report picture | No | Passed to the model and dropped. Never logged. |
| Explainer request | No | Result titles and the suggested step only. Never logged. |
| Feedback | Counters | Two ratings, time taken, language. Nothing else is accepted. |
| Network address | Salted hash, up to 2 hours | Only for rate limits. |

Request bodies are never written to logs.

## Run it

Needs Node 22 or newer.

```bash
npm install
npm run ai:dev                                      # API on :8787 (AI, hand-off, feedback), in-memory store
AI_PROXY_URL=http://localhost:8787 npm run dev      # app on http://localhost:5173
npm test                                            # unit tests (no network)
npm run build                                       # type-check, run tests, build to dist/
```

AI settings: copy `.env.example` to `.env.local` and fill in one of: a Google Vertex AI service-account key (Gemini, what the live demo uses), an OpenAI key, or the Azure OpenAI values. Or pass them as environment variables. If you use a service other than Vertex AI, set `VITE_AI_PROVIDER` to its name when building, so the consent text names the right service. Keys are never committed. Without them the AI features answer "not available" and everything else works.

Use `localhost`, not a LAN address, to try the private link: browsers only allow encryption on a secure address.

## Deploy (Vercel)

1. `npx vercel deploy --prod` from this folder. `vercel.json` sets the build, headers and function limits.
2. Add the **Upstash for Redis** integration to the project (Storage tab). It sets `KV_REST_API_URL` and `KV_REST_API_TOKEN`, which turn on the private link, the feedback counters and the shared rate limits.
3. Set `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_DEPLOYMENT`, `AZURE_OPENAI_API_VERSION` and `AZURE_OPENAI_API_KEY` in the project settings to turn on the two AI features.

Each part degrades on its own: without the store the hand-off stays on the device, and without the AI key the numbers are typed by hand.

The AWS scripts in `infra/aws` deploy the static app and the explainer only.

## Testing

| What | How | Where the result shows |
|---|---|---|
| Rules engine | 54 synthetic cases, run live in the browser | `/evaluation` |
| AI explainer | 21 live calls in English and Arabic: `npm run ai:eval` | `/evaluation` |
| Lab report reader | 18 synthetic pictures, live model: `npm run ai:eval:reports` | `/evaluation` |
| Hand-off, feedback, rate limits, report checks | Unit tests: `npm test` | Build fails if any fails |
| Encryption | Self-test in the visitor's browser | `/evaluation` |

The report pictures are generated by `npm run fixtures` (needs Chrome and ffmpeg): five layouts, as screenshots and as tilted, dark or blurred phone-style pictures, one with a result taped over, plus two pictures that are not semen analyses.

## Limits to know about

- Expected results for the 54 cases were written by the team from guidelines. They **still need independent clinician labelling**.
- The report reader was tested on synthetic, computer-printed reports only. Real reports with stamps, handwriting, glare or folds are not measured yet.
- The private link is a prototype channel. Anyone holding the link can read the summary until it expires or is withdrawn, and the clinician is not signed in. A pilot would deliver through Malaffi with clinician sign-in.
- The Arabic text needs review by a native-speaking clinician.

## Pages

`/` home · `/check` consent and check-in · `/result` · `/report` lab report reader · `/share` summary and private link · `/d/<link>` what the doctor opens · `/clinician` inbox · `/evaluation` evidence · `/privacy` · `/how` · `/example/C44` instant sample result · add `?lang=ar` to any link for Arabic.
