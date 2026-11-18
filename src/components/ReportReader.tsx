import { Camera, CircleCheck, FileImage, ImageUp, RotateCcw, ScanLine, Sparkles, TriangleAlert } from 'lucide-react'
import { useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { AI_PROVIDER } from '../lib/ai'
import { WHO2021 } from '../lib/engine'
import { useI18n } from '../lib/i18n'
import { QUESTION_BY_ID } from '../lib/questions'
import { cropToJpeg, DERIVED_NOTE, loadImage, READ_FIELDS, readReport, straighten, toCanvas } from '../lib/report'
import type { Frame, ReadField, ReadResult, ReadValue } from '../lib/report'
import { Callout, LayerLabel } from './ui'

type Stage = 'pick' | 'crop' | 'reading' | 'review' | 'failed'
type Reason = Extract<ReadResult, { ok: false }>['reason']
type Draft = Record<ReadField, string>

const WHOLE: Frame = { x: 0.02, y: 0.02, w: 0.96, h: 0.96 }
const EMPTY: Draft = { volume_ml: '', concentration: '', total_motility: '', progressive: '', morphology: '' }
const FIELDS = QUESTION_BY_ID.semen.fields ?? []

/** Reads a number the way people type it: "2,5" and "2.5" both work. */
const toNumber = (s: string): number | undefined => {
  const n = Number(s.trim().replace(',', '.'))
  return s.trim() !== '' && Number.isFinite(n) && n >= 0 ? n : undefined
}

/**
 * Photograph a semen analysis report and get its numbers filled in.
 * The picture is straightened and cropped on the device; only the cropped part goes to the AI, which returns
 * numbers; the person checks them; the fixed rules do the rest.
 */
export function ReportReader({ onUse, onCancel }: { onUse: (values: Partial<Record<ReadField, number>>) => void; onCancel?: () => void }) {
  const { t, lang } = useI18n()
  const [stage, setStage] = useState<Stage>('pick')
  const picture = useRef<HTMLCanvasElement | null>(null)
  const [preview, setPreview] = useState('')
  const [tilt, setTilt] = useState(0)
  const [frame, setFrame] = useState<Frame>(WHOLE)
  const [read, setRead] = useState<Partial<Record<ReadField, ReadValue>>>({})
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [reason, setReason] = useState<Reason>('error')
  const [typed, setTyped] = useState(false)
  const camera = useRef<HTMLInputElement>(null)
  const library = useRef<HTMLInputElement>(null)

  const take = async (source: Blob | string) => {
    try {
      const straight = straighten(toCanvas(await loadImage(source)))
      picture.current = straight.canvas
      setPreview(straight.canvas.toDataURL('image/jpeg', 0.82))
      setTilt(straight.tilt)
      setFrame(WHOLE)
      setStage('crop')
    } catch {
      setReason('unreadable')
      setStage('failed')
    }
  }

  const send = async () => {
    if (!picture.current) return
    setStage('reading')
    const r = await readReport(cropToJpeg(picture.current, frame))
    if (!r.ok) {
      setReason(r.reason)
      setStage('failed')
      return
    }
    setRead(r.values)
    setTyped(false)
    // Only numbers the checks are sure of are filled in. Doubtful ones stay empty for the person to type.
    setDraft(Object.fromEntries(READ_FIELDS.map((f) => [f, r.values[f] && !r.values[f].unsure ? String(r.values[f].value) : ''])) as Draft)
    setStage('review')
  }

  const restart = () => {
    picture.current = null
    setPreview('')
    setStage('pick')
  }

  /** No picture, or the AI is not available: the same form, filled in by hand. The caller may supply its own way. */
  const typeIt =
    onCancel ??
    (() => {
      setRead({})
      setDraft(EMPTY)
      setTyped(true)
      setStage('review')
    })

  const use = () => {
    const values: Partial<Record<ReadField, number>> = {}
    for (const f of READ_FIELDS) {
      const n = toNumber(draft[f])
      if (n !== undefined) values[f] = n
    }
    onUse(values)
  }

  const onFile = (list: FileList | null) => {
    const file = list?.[0]
    if (file) void take(file)
  }

  return (
    <section className="surface overflow-hidden">
      <div className="flex items-start gap-3 border-b border-ai-100 bg-ai-50 px-5 py-4 sm:px-6">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-ai-600 ring-1 ring-inset ring-ai-100">
          <ScanLine className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
        </span>
        <div className="space-y-0.5">
          <h2 className="text-base font-semibold text-ink">{t({ en: 'Read my lab report', ar: 'اقرأ تقرير المختبر' })}</h2>
          <p className="text-sm text-muted">
            {t({
              en: 'Take a photo of your semen analysis report. The AI reads the numbers, you check them, and fixed rules compare them with the WHO limits.',
              ar: 'التقط صورة لتقرير تحليل السائل المنوي. يقرأ الذكاء الاصطناعي الأرقام، وتتحقق أنت منها، ثم تقارنها قواعد ثابتة بحدود منظمة الصحة العالمية.',
            })}
          </p>
        </div>
      </div>

      <div className="space-y-5 p-5 sm:p-6">
        {stage === 'pick' && (
          <>
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <button type="button" className="btn btn-ai sm:flex-1" onClick={() => camera.current?.click()}>
                <Camera className="h-4 w-4" aria-hidden />
                {t({ en: 'Take a photo', ar: 'التقط صورة' })}
              </button>
              <button type="button" className="btn btn-secondary sm:flex-1" onClick={() => library.current?.click()}>
                <ImageUp className="h-4 w-4" aria-hidden />
                {t({ en: 'Choose a picture', ar: 'اختر صورة' })}
              </button>
            </div>
            <input ref={camera} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => onFile(e.target.files)} />
            <input ref={library} type="file" accept="image/jpeg,image/png,image/webp,image/*" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => onFile(e.target.files)} />
            <ul className="space-y-1.5 text-sm text-muted">
              <li>{t({ en: 'Lay the page flat in good light. A screenshot of a PDF report works too.', ar: 'ضع الورقة مسطّحة في إضاءة جيدة. تصلح أيضاً لقطة شاشة لتقرير بصيغة PDF.' })}</li>
              <li>{t({ en: 'Only the results table is needed. On the next step you can leave your name out of the picture.', ar: 'نحتاج إلى جدول النتائج فقط. في الخطوة التالية يمكنك إبقاء اسمك خارج الصورة.' })}</li>
            </ul>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-4">
              <button type="button" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ai-700 hover:underline" onClick={() => void take(`${import.meta.env.BASE_URL}samples/report-${lang === 'ar' ? 'ar' : 'en'}.jpg`)}>
                <FileImage className="h-4 w-4" aria-hidden />
                {t({ en: 'No report at hand? Try a sample report', ar: 'ليس لديك تقرير الآن؟ جرّب تقريراً نموذجياً' })}
              </button>
              <button type="button" className="text-sm font-medium text-muted hover:text-ink" onClick={typeIt}>
                {t({ en: 'Type the numbers myself', ar: 'سأكتب الأرقام بنفسي' })}
              </button>
            </div>
          </>
        )}

        {stage === 'crop' && (
          <>
            <p className="text-sm text-body">
              {t({ en: 'Drag the corners so the frame holds the results table. Keep your name outside it.', ar: 'اسحب الزوايا ليحتوي الإطار على جدول النتائج، وأبقِ اسمك خارجه.' })}
              {tilt !== 0 && (
                <span className="text-muted">
                  {' '}
                  {t({ en: 'The picture was tilted, so it was straightened by', ar: 'كانت الصورة مائلة، فتم تعديلها بمقدار' })} {Math.abs(tilt).toLocaleString(lang === 'ar' ? 'ar-AE' : 'en-GB')}°.
                </span>
              )}
            </p>
            <CropBox src={preview} frame={frame} onChange={setFrame} label={t({ en: 'Your picture with the frame to send', ar: 'صورتك مع الإطار الذي سيُرسل' })} />
            <p className="flex items-start gap-2 text-xs text-muted">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ai-600" aria-hidden />
              {t({ en: 'Only the part inside the frame is sent to our AI service', ar: 'يُرسل فقط الجزء الموجود داخل الإطار إلى خدمة الذكاء الاصطناعي لدينا' })} ({AI_PROVIDER}){t({ en: ' to read the numbers. We do not keep it.', ar: ' لقراءة الأرقام، ولا نحتفظ به.' })}
            </p>
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <button type="button" className="btn btn-ai sm:flex-1" onClick={() => void send()}>
                <ScanLine className="h-4 w-4" aria-hidden />
                {t({ en: 'Read the numbers', ar: 'اقرأ الأرقام' })}
              </button>
              <button type="button" className="btn btn-secondary" onClick={restart}>
                <RotateCcw className="h-4 w-4" aria-hidden />
                {t({ en: 'Another picture', ar: 'صورة أخرى' })}
              </button>
            </div>
          </>
        )}

        {stage === 'reading' && (
          <div className="flex items-center gap-3 py-6" role="status" aria-live="polite">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-ai-200 border-t-ai-600" aria-hidden />
            <p className="text-body">{t({ en: 'Reading the numbers…', ar: 'جارٍ قراءة الأرقام…' })}</p>
          </div>
        )}

        {stage === 'review' && (
          <>
            {typed ? (
              <p className="text-sm text-body">{t({ en: 'Type the numbers from your report. Leave blank what it does not show.', ar: 'اكتب الأرقام من تقريرك، واترك ما لا يظهر فيه فارغاً.' })}</p>
            ) : (
              <Callout tone="warn" icon={TriangleAlert} title={t({ en: 'Check each number against your report', ar: 'تحقق من كل رقم مقابل تقريرك' })}>
                {t({ en: 'AI can misread, especially on blurred pictures. Correct anything that differs, and fill in what is empty.', ar: 'قد يخطئ الذكاء الاصطناعي في القراءة، خاصةً في الصور غير الواضحة. صحّح ما يختلف، واملأ ما هو فارغ.' })}
              </Callout>
            )}
            <ul className="divide-y divide-line rounded-lg border border-line">
              {FIELDS.map((f) => {
                const id = f.id as ReadField
                const v = read[id]
                const n = toNumber(draft[id])
                const low = n !== undefined && n < WHO2021[id]
                return (
                  <li key={id} className="grid gap-x-4 gap-y-2 px-4 py-3.5 sm:grid-cols-[1fr_168px] sm:items-center">
                    <div className="min-w-0 space-y-1">
                      <label htmlFor={`rr-${id}`} className="block text-sm font-semibold text-ink">
                        {t(f.label)}
                      </label>
                      {v?.unsure ? (
                        <p className="text-sm text-amber-800">
                          {t({ en: 'We read', ar: 'قرأنا' })} <span className="font-semibold tabular-nums">{v.value}</span>
                          {t({ en: ', but the numbers on this report do not agree with each other. Please type this one from your report.', ar: '، لكن أرقام هذا التقرير لا تتوافق مع بعضها. يُرجى كتابة هذا الرقم من تقريرك.' })}
                        </p>
                      ) : v?.derived ? (
                        <p className="text-xs text-muted">{t(DERIVED_NOTE[v.derived])}</p>
                      ) : v ? (
                        <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                          <LayerLabel layer="ai">{t({ en: 'Read by AI', ar: 'قرأه الذكاء الاصطناعي' })}</LayerLabel>
                          {v.printed && (
                            <span>
                              {t({ en: 'on the report:', ar: 'في التقرير:' })}{' '}
                              <bdi dir="ltr">
                                {v.comparator ?? ''}
                                {v.printed}
                              </bdi>
                            </span>
                          )}
                        </p>
                      ) : typed ? null : (
                        <p className="text-xs text-muted">{t({ en: 'Not found in the picture. Add it if it is on your report.', ar: 'لم نجده في الصورة. أضِفه إن كان موجوداً في تقريرك.' })}</p>
                      )}
                      {n !== undefined && (
                        <p className={`inline-flex items-center gap-1.5 text-xs font-medium ${low ? 'text-amber-700' : 'text-emerald-700'}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${low ? 'bg-amber-500' : 'bg-emerald-500'}`} aria-hidden />
                          {low ? t({ en: 'Below the WHO lower limit of', ar: 'أقل من الحد الأدنى للمنظمة:' }) : t({ en: 'At or above the WHO lower limit of', ar: 'عند الحد الأدنى للمنظمة أو أعلى:' })} {WHO2021[id]}
                        </p>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        id={`rr-${id}`}
                        className={`input pe-24 tabular-nums ${v?.unsure && draft[id] === '' ? 'border-amber-400 focus:border-amber-500 focus:ring-amber-100' : ''}`}
                        inputMode="decimal"
                        value={draft[id]}
                        onChange={(e) => setDraft((d) => ({ ...d, [id]: e.target.value }))}
                      />
                      <span className="pointer-events-none absolute inset-y-0 end-3.5 flex items-center text-sm text-muted">{t(f.unit)}</span>
                    </div>
                  </li>
                )
              })}
            </ul>
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <button type="button" className="btn btn-primary sm:flex-1" disabled={READ_FIELDS.every((f) => toNumber(draft[f]) === undefined)} onClick={use}>
                <CircleCheck className="h-4 w-4" aria-hidden />
                {t({ en: 'These match my report', ar: 'هذه الأرقام تطابق تقريري' })}
              </button>
              <button type="button" className="btn btn-secondary" onClick={restart}>
                <RotateCcw className="h-4 w-4" aria-hidden />
                {typed ? t({ en: 'Use a picture instead', ar: 'استخدم صورة بدلاً من ذلك' }) : t({ en: 'Another picture', ar: 'صورة أخرى' })}
              </button>
            </div>
          </>
        )}

        {stage === 'failed' && (
          <>
            <Callout tone="warn" icon={TriangleAlert}>
              {reason === 'not_semen_report'
                ? t({ en: 'This does not look like a semen analysis report, so nothing was read from it.', ar: 'لا يبدو هذا تقرير تحليل سائل منوي، لذلك لم يُقرأ منه شيء.' })
                : reason === 'unreadable'
                  ? t({ en: 'The numbers in this picture could not be read. Try again with the page flat and in good light, or type the numbers yourself.', ar: 'تعذّرت قراءة الأرقام في هذه الصورة. حاول مجدداً والورقة مسطّحة وفي إضاءة جيدة، أو اكتب الأرقام بنفسك.' })
                  : reason === 'busy'
                    ? t({ en: 'The AI reader has reached its limit for now. Please try later, or type the numbers yourself.', ar: 'بلغ قارئ الذكاء الاصطناعي حدّه الآن. يُرجى المحاولة لاحقاً، أو اكتب الأرقام بنفسك.' })
                    : reason === 'unavailable'
                      ? t({ en: 'The AI reader is not available right now. You can type the numbers yourself: the result is the same.', ar: 'قارئ الذكاء الاصطناعي غير متاح الآن. يمكنك كتابة الأرقام بنفسك، والنتيجة واحدة.' })
                      : t({ en: 'Something went wrong. Please try again.', ar: 'حدث خطأ ما، يُرجى المحاولة مرة أخرى.' })}
            </Callout>
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <button type="button" className="btn btn-secondary" onClick={restart}>
                <RotateCcw className="h-4 w-4" aria-hidden />
                {t({ en: 'Try another picture', ar: 'جرّب صورة أخرى' })}
              </button>
              <button type="button" className="btn btn-ghost" onClick={typeIt}>
                {t({ en: 'Type the numbers myself', ar: 'سأكتب الأرقام بنفسي' })}
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  )
}

type Grip = 'move' | 'nw' | 'ne' | 'sw' | 'se'
const MIN = 0.14
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

function moved(kind: Grip, f: Frame, dx: number, dy: number): Frame {
  if (kind === 'move') return { ...f, x: clamp(f.x + dx, 0, 1 - f.w), y: clamp(f.y + dy, 0, 1 - f.h) }
  const right = f.x + f.w
  const bottom = f.y + f.h
  const x1 = kind === 'nw' || kind === 'sw' ? clamp(f.x + dx, 0, right - MIN) : f.x
  const y1 = kind === 'nw' || kind === 'ne' ? clamp(f.y + dy, 0, bottom - MIN) : f.y
  const x2 = kind === 'ne' || kind === 'se' ? clamp(right + dx, f.x + MIN, 1) : right
  const y2 = kind === 'sw' || kind === 'se' ? clamp(bottom + dy, f.y + MIN, 1) : bottom
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }
}

/** The picture with a movable frame. Everything outside the frame is dimmed, and is not sent. */
function CropBox({ src, frame, onChange, label }: { src: string; frame: Frame; onChange: (f: Frame) => void; label: string }) {
  const box = useRef<HTMLDivElement>(null)
  const drag = useRef<{ kind: Grip; x: number; y: number; from: Frame } | null>(null)

  const start = (kind: Grip) => (e: ReactPointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    box.current?.setPointerCapture(e.pointerId)
    drag.current = { kind, x: e.clientX, y: e.clientY, from: frame }
  }
  const move = (e: ReactPointerEvent) => {
    const d = drag.current
    const el = box.current
    if (!d || !el) return
    const r = el.getBoundingClientRect()
    onChange(moved(d.kind, d.from, (e.clientX - d.x) / r.width, (e.clientY - d.y) / r.height))
  }
  const end = () => {
    drag.current = null
  }

  const pct = (v: number) => `${v * 100}%`
  const corner = 'absolute h-9 w-9 touch-none after:absolute after:h-4 after:w-4 after:rounded-sm after:border-2 after:border-white after:bg-ai-600'
  return (
    <div className="flex justify-center rounded-lg bg-ink/90 p-2" dir="ltr">
      <div ref={box} className="relative inline-block touch-none overflow-hidden select-none" onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
        <img src={src} alt={label} draggable={false} className="block max-h-[62vh] w-auto max-w-full" />
        <div
          className="absolute cursor-move touch-none border-2 border-white shadow-[0_0_0_9999px_rgba(16,24,40,0.6)]"
          style={{ left: pct(frame.x), top: pct(frame.y), width: pct(frame.w), height: pct(frame.h) }}
          onPointerDown={start('move')}
        >
          <span className={`${corner} -top-3 -left-3 cursor-nwse-resize after:top-2 after:left-2`} onPointerDown={start('nw')} />
          <span className={`${corner} -top-3 -right-3 cursor-nesw-resize after:top-2 after:right-2`} onPointerDown={start('ne')} />
          <span className={`${corner} -bottom-3 -left-3 cursor-nesw-resize after:bottom-2 after:left-2`} onPointerDown={start('sw')} />
          <span className={`${corner} -right-3 -bottom-3 cursor-nwse-resize after:right-2 after:bottom-2`} onPointerDown={start('se')} />
        </div>
      </div>
    </div>
  )
}
