import { ArrowLeft, ChevronDown, CircleCheck, Copy, Download, ExternalLink, Eye, FileText, LockKeyhole, RefreshCw, Send, Share2, Undo2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Qr } from '../components/Qr'
import { Callout, LayerLabel, LevelPill, Switch } from '../components/ui'
import { fmtDay } from '../lib/companion/dates'
import { PROVIDERS } from '../lib/companion/directory'
import { exposureFlags } from '../lib/companion/exposures'
import { LAB_KINDS } from '../lib/companion/labs'
import { addReply, useCompanion } from '../lib/companion/useCompanion'
import type { StoredReply } from '../lib/companion/useCompanion'
import { assess } from '../lib/engine'
import { createShare, linkFor, shareStatus, withdrawShare } from '../lib/handoff'
import type { FailReason, OwnShare, ShareStatus, Ttl } from '../lib/handoff'
import { useI18n } from '../lib/i18n'
import { buildSummary, summaryText, toFhir } from '../lib/referral'
import type { ReferralSummary, ShareOptions } from '../lib/referral'
import type { ShareRequest } from '../lib/referral'
import { LEVEL_LABEL, stepFor } from '../lib/services'
import { activeExample, load, rid, useStored } from '../lib/storage'
import type { Answers } from '../lib/types'
import { exampleAnswers } from './Example'

export default function Share() {
  const { t, lang } = useI18n()
  const [params] = useSearchParams()
  const exampleId = params.get('example')
  const example = useMemo(() => exampleAnswers(exampleId), [exampleId])
  const [saved] = useState<Answers>(() => load('answers', {}))
  const answers = example ?? saved
  const [fixed] = useState(() => ({ id: rid('ref-'), pseudoId: `WQ-${rid().slice(0, 6).toUpperCase()}` }))
  const [opts, setOpts] = useState<ShareOptions>({ includeAnswers: false, includeSemen: false, includeDeclined: false, firstName: '' })
  const [refs, setRefs] = useStored<ReferralSummary[]>('referrals', [])
  const [shares, setShares] = useStored<OwnShare[]>('shares', [])
  const [ttl, setTtl] = useState<Ttl>('week')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<FailReason | null>(null)
  const [onDevice, setOnDevice] = useState(false)
  const [another, setAnother] = useState(false)
  const [withdrawn, setWithdrawn] = useState(false)
  const [copied, setCopied] = useState(false)

  const c = useCompanion()
  const provider = PROVIDERS.find((p) => p.id === params.get('provider'))
  const [purpose, setPurpose] = useState<ShareRequest['purpose']>(params.get('purpose') === 'teleconsult' ? 'teleconsult' : 'review')
  const [prefer, setPrefer] = useState<NonNullable<ShareRequest['prefer']>>([])
  const [includeLabs, setIncludeLabs] = useState(true)
  const [includeWork, setIncludeWork] = useState(false)
  const useCompanionData = !example && c.active
  // An example person's summary is marked synthetic, so a doctor never mistakes it for a real patient.
  const synthetic = !!example || !!activeExample()
  const base = useMemo(() => buildSummary(answers, opts, synthetic ? 'synthetic' : 'device', fixed), [answers, opts, synthetic, fixed])
  // With the companion in use, the doctor sees today's picture: the first check plus results over time,
  // and the step the rules suggest now (the doctor then confirms or changes it).
  const summary = useMemo(() => {
    if (!useCompanionData) return base
    const v = c.view
    const step = stepFor(v.emergency ? 'emergency' : v.rulesLevel, v.base.sex)
    const request: ShareRequest | undefined = purpose === 'teleconsult' || provider ? { purpose, providerId: provider?.id, providerName: provider?.name, prefer: prefer.length ? prefer : undefined } : undefined
    return {
      ...base,
      level: v.rulesLevel,
      emergency: v.emergency,
      step: step.title,
      flags: v.flags.filter((f) => !f.id.startsWith('EX_') || includeWork).map((f) => ({ id: f.id, level: f.level, title: f.title, because: f.because, action: f.action, sources: f.sources })),
      labs: includeLabs && c.labs.length ? c.labs.map((l) => ({ kind: l.kind, date: l.date, values: l.values, source: l.source })) : undefined,
      exposures: includeWork ? exposureFlags(c.work).map((f) => f.title) : undefined,
      request,
    }
  }, [base, useCompanionData, c.view, c.labs, c.work, includeLabs, includeWork, purpose, prefer, provider])
  const declinedCount = useMemo(() => assess(answers).declined.length, [answers])
  const sentHere = refs.some((r) => r.id === summary.id)
  const [now] = useState(() => Date.now())
  // An example page shows links made from examples; the person's own page shows only their own.
  const active = useMemo(() => [...shares].filter((s) => s.expiresAt > now && !!s.synthetic === (!!example || !!activeExample())).sort((a, b) => b.createdAt - a.createdAt)[0], [shares, now, example])

  if (Object.keys(answers).length === 0 || summary.age === undefined || summary.age < 18) {
    return (
      <div className="container-flow py-16">
        <div className="surface surface-pad space-y-4 text-center">
          <p className="text-body">{t({ en: 'Complete the check first.', ar: 'أكمل الفحص أولاً.' })}</p>
          <Link to="/check" className="btn btn-primary">
            {t({ en: 'Start the check', ar: 'ابدأ الفحص' })}
          </Link>
        </div>
      </div>
    )
  }

  const set = (patch: Partial<ShareOptions>) => setOpts((o) => ({ ...o, ...patch }))

  const create = async () => {
    setBusy(true)
    setProblem(null)
    setWithdrawn(false)
    const made = await createShare({ ...summary, createdAt: new Date().toISOString() }, ttl)
    setBusy(false)
    if (made.ok) {
      setShares((s) => [made.share, ...s.filter((x) => x.expiresAt > Date.now())])
      setAnother(false)
      window.scrollTo(0, 0)
    } else if (made.reason === 'unavailable') setOnDevice(true)
    else setProblem(made.reason)
  }
  const sendHere = () => setRefs((r) => [{ ...summary, createdAt: new Date().toISOString() }, ...r.filter((x) => x.id !== summary.id)])
  const withdrawHere = () => setRefs((r) => r.filter((x) => x.id !== summary.id))

  const download = () => {
    const blob = new Blob([JSON.stringify(toFhir(summary), null, 2)], { type: 'application/fhir+json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `wiqaya-summary-${summary.pseudoId}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(summaryText(summary, lang))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard blocked */
    }
  }

  const showEditor = !active || another

  return (
    <div className="container-flow space-y-8 py-8 sm:py-10">
      <div className="space-y-2">
        <Link to={exampleId ? `/result?example=${exampleId}` : '/result'} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
          <ArrowLeft className="icon-dir h-4 w-4" aria-hidden />
          {t({ en: 'Back to my result', ar: 'العودة إلى نتيجتي' })}
        </Link>
        <h1 className="title">{t({ en: 'Your summary for a doctor', ar: 'ملخصك للطبيب' })}</h1>
        <p className="text-muted">
          {t({
            en: 'You decide what goes in. Nothing leaves this device until you create a link, and you can withdraw it at any time.',
            ar: 'أنت من يقرر ما يتضمنه. لا يغادر شيء هذا الجهاز حتى تنشئ رابطاً، ويمكنك سحبه في أي وقت.',
          })}
        </p>
      </div>

      {withdrawn && (
        <Callout tone="info" icon={CircleCheck} title={t({ en: 'Withdrawn', ar: 'تم السحب' })}>
          {t({ en: 'The stored copy was deleted and the link no longer opens anything.', ar: 'حُذفت النسخة المحفوظة ولم يعد الرابط يفتح شيئاً.' })}
        </Callout>
      )}

      {active && (
        <LinkPanel
          key={active.id}
          share={active}
          onGone={(byMe) => {
            setShares((s) => s.filter((x) => x.id !== active.id))
            setWithdrawn(byMe)
          }}
        />
      )}

      {active && !another && (
        <button type="button" className="btn btn-secondary" onClick={() => setAnother(true)}>
          {t({ en: 'Create another link', ar: 'أنشئ رابطاً آخر' })}
        </button>
      )}

      {showEditor && (
        <>
          {(provider || purpose === 'teleconsult') && (
            <section className="surface surface-pad space-y-4">
              <div className="space-y-1">
                <h2 className="text-base font-semibold text-ink">{t({ en: 'Your request', ar: 'طلبك' })}</h2>
                {provider && (
                  <p className="text-sm text-muted">
                    {t({ en: 'To:', ar: 'إلى:' })} <span className="font-medium text-ink">{t(provider.name)}</span>
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ['review', { en: 'Review my summary', ar: 'راجع ملخصي' }],
                    ['teleconsult', { en: 'Video consultation', ar: 'استشارة بالفيديو' }],
                  ] as const
                ).map(([value, label]) => (
                  <button key={value} type="button" aria-pressed={purpose === value} onClick={() => setPurpose(value)} className={`inline-flex h-9 items-center rounded-full border px-3.5 text-sm font-medium ${purpose === value ? 'border-brand-700 bg-brand-800 text-white' : 'border-line-strong bg-white text-body hover:bg-canvas'}`}>
                    {t(label)}
                  </button>
                ))}
              </div>
              {purpose === 'teleconsult' && (
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium text-ink">{t({ en: 'Times that suit you', ar: 'الأوقات المناسبة لك' })}</legend>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        ['weekday_morning', { en: 'Weekday mornings', ar: 'صباح أيام الأسبوع' }],
                        ['weekday_evening', { en: 'Weekday evenings', ar: 'مساء أيام الأسبوع' }],
                        ['weekend', { en: 'Weekends', ar: 'نهاية الأسبوع' }],
                      ] as const
                    ).map(([value, label]) => {
                      const on = prefer.includes(value)
                      return (
                        <button key={value} type="button" aria-pressed={on} onClick={() => setPrefer((p) => (on ? p.filter((x) => x !== value) : [...p, value]))} className={`inline-flex h-9 items-center rounded-full border px-3.5 text-sm font-medium ${on ? 'border-brand-700 bg-brand-50 text-brand-800' : 'border-line-strong bg-white text-body hover:bg-canvas'}`}>
                          {t(label)}
                        </button>
                      )
                    })}
                  </div>
                </fieldset>
              )}
              <p className="text-xs text-muted">{t({ en: 'The doctor can reply with an appointment and any tests. Their reply appears on your phone and in your care journey.', ar: 'يستطيع الطبيب الرد بموعد وأي تحاليل، ويظهر ردّه على هاتفك وفي رحلة رعايتك.' })}</p>
            </section>
          )}

          <section className="surface divide-y divide-line">
            <div className="px-5 py-4 sm:px-6">
              <h2 className="text-base font-semibold text-ink">{t({ en: 'What to include', ar: 'ما الذي تريد تضمينه' })}</h2>
            </div>
            <div className="space-y-5 px-5 py-5 sm:px-6">
              <Switch checked disabled label={t({ en: 'Result and the reasons for it', ar: 'النتيجة وأسبابها' })} description={t({ en: 'Always included. This is what the doctor needs.', ar: 'تُضمَّن دائماً، فهي ما يحتاجه الطبيب.' })} />
              <Switch
                checked={opts.includeAnswers}
                onChange={(v) => set({ includeAnswers: v })}
                label={t({ en: 'All my answers', ar: 'جميع إجاباتي' })}
                description={t({ en: 'Saves time at the visit. Questions you declined are never included.', ar: 'يوفّر الوقت أثناء الزيارة، ولا تُضمَّن الأسئلة التي رفضت الإجابة عنها أبداً.' })}
              />
              {answers.semen_done === 'yes' && (
                <Switch checked={opts.includeSemen} onChange={(v) => set({ includeSemen: v })} label={t({ en: 'My semen analysis values', ar: 'قيم تحليل السائل المنوي' })} description={t({ en: 'Only the numbers you entered.', ar: 'الأرقام التي أدخلتها فقط.' })} />
              )}
              {useCompanionData && c.labs.length > 0 && (
                <Switch checked={includeLabs} onChange={setIncludeLabs} label={t({ en: `My results over time (${c.labs.length})`, ar: `نتائجي مع الوقت (${c.labs.length})` })} description={t({ en: 'Lab results, home estimates and readings, each with its source.', ar: 'النتائج المخبرية والتقديرات المنزلية والقراءات، مع مصدر كل منها.' })} />
              )}
              {useCompanionData && c.work && (
                <Switch checked={includeWork} onChange={setIncludeWork} label={t({ en: 'My work exposures', ar: 'التعرّض في عملي' })} description={t({ en: 'Only the type of exposure, never your employer.', ar: 'نوع التعرّض فقط، وليس جهة عملك أبداً.' })} />
              )}
              {declinedCount > 0 && (
                <Switch
                  checked={opts.includeDeclined}
                  onChange={(v) => set({ includeDeclined: v })}
                  label={t({ en: 'Which questions I chose not to answer', ar: 'الأسئلة التي اخترت عدم الإجابة عنها' })}
                  description={t({ en: 'Only the question names, so the doctor knows to ask in person.', ar: 'أسماء الأسئلة فقط، ليعرف الطبيب أن يسأل عنها شخصياً.' })}
                />
              )}
              <label className="grid gap-1.5">
                <span className="text-sm font-medium text-ink">{t({ en: 'First name (optional)', ar: 'الاسم الأول (اختياري)' })}</span>
                <input className="input" maxLength={40} value={opts.firstName} onChange={(e) => set({ firstName: e.target.value })} placeholder={t({ en: 'Leave blank to stay anonymous', ar: 'اتركه فارغاً لتبقى مجهول الهوية' })} />
              </label>
            </div>
          </section>

          {/* Document preview */}
          <section className="space-y-3">
            <h2 className="heading">{t({ en: 'Preview', ar: 'معاينة' })}</h2>
            <article className="surface overflow-hidden">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-canvas px-5 py-3.5 sm:px-6">
                <div className="flex items-center gap-2.5">
                  <FileText className="h-5 w-5 text-muted" strokeWidth={1.75} aria-hidden />
                  <div>
                    <p className="text-sm font-semibold text-ink">{t({ en: 'Reproductive health screening summary', ar: 'ملخص فحص الصحة الإنجابية' })}</p>
                    <p className="text-xs text-muted">
                      <span className="font-mono">{summary.pseudoId}</span>
                      {summary.firstName ? ` · ${summary.firstName}` : ''} · {t({ en: 'Age', ar: 'العمر' })} {summary.age}
                    </p>
                  </div>
                </div>
                <LevelPill level={summary.level} />
              </header>
              <div className="space-y-4 px-5 py-5 sm:px-6">
                <div className="space-y-1">
                  <LayerLabel layer="rules" />
                  <p className="text-[15px] font-semibold text-ink">{t(summary.step)}</p>
                </div>
                {summary.flags.length > 0 && (
                  <ul className="space-y-2">
                    {summary.flags.map((f) => (
                      <li key={f.id} className="text-sm">
                        <span className="font-medium text-ink">{t(f.title)}</span>
                        <span className="text-muted"> · {f.because.map(t).join('; ')}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {summary.semen && <p className="text-sm text-body">{summary.semen.map((v) => `${t(v.label)}: ${v.value}`).join(' · ')}</p>}
                {summary.labs && (
                  <p className="text-sm text-muted">
                    + {summary.labs.length} {t({ en: 'results over time, latest', ar: 'نتائج مع الوقت، أحدثها' })} {fmtDay(summary.labs[summary.labs.length - 1].date, lang)} ({t(LAB_KINDS[summary.labs[summary.labs.length - 1].kind].label)})
                  </p>
                )}
                {summary.request && (
                  <p className="text-sm text-muted">
                    {summary.request.purpose === 'teleconsult' ? t({ en: 'Asks for a video consultation', ar: 'يطلب استشارة بالفيديو' }) : t({ en: 'Asks for a review', ar: 'يطلب مراجعة' })}
                    {summary.request.providerName ? ` · ${t(summary.request.providerName)}` : ''}
                  </p>
                )}
                {summary.answers && (
                  <p className="text-sm text-muted">
                    + {summary.answers.length} {t({ en: 'answers included', ar: 'إجابة مضمّنة' })}
                  </p>
                )}
                {summary.declined && summary.declined.length > 0 && (
                  <p className="text-sm text-muted">
                    {t({ en: 'Chose not to answer:', ar: 'اختار عدم الإجابة عن:' })} {summary.declined.map(t).join('; ')}
                  </p>
                )}
                <p className="border-t border-line pt-3 text-xs text-faint">{t({ en: 'Screening result, not a diagnosis. Requires clinician review.', ar: 'نتيجة فحص أولي وليست تشخيصاً، وتتطلب مراجعة الطبيب.' })}</p>
              </div>
              <details className="group border-t border-line">
                <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-3 text-sm font-medium text-muted hover:bg-canvas/70 sm:px-6">
                  {t({ en: 'Technical format (HL7 FHIR R4, for Malaffi)', ar: 'الصيغة التقنية (HL7 FHIR R4 لـ«ملفي»)' })}
                  <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden />
                </summary>
                <pre className="max-h-80 overflow-auto bg-ink px-5 py-4 text-[11px] leading-relaxed text-slate-200" dir="ltr">
                  {JSON.stringify(toFhir(summary), null, 2)}
                </pre>
              </details>
            </article>
          </section>

          {/* Actions */}
          {onDevice ? (
            <section className="space-y-4">
              <Callout tone="warn">
                {t({
                  en: 'The secure link service is not available here, so this demo keeps the summary on this device instead.',
                  ar: 'خدمة الرابط الآمن غير متاحة هنا، لذلك يُبقي هذا العرض التجريبي الملخص على هذا الجهاز.',
                })}
              </Callout>
              {sentHere ? (
                <div className="surface surface-pad space-y-4 border-emerald-200">
                  <div className="flex gap-3">
                    <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
                    <p className="font-semibold text-ink">{t({ en: 'Placed in the clinician inbox on this device (demo)', ar: 'وُضع في صندوق الطبيب على هذا الجهاز (تجريبي)' })}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link to="/clinician" className="btn btn-primary">
                      {t({ en: 'Open the clinician view', ar: 'افتح عرض الطبيب' })}
                    </Link>
                    <button type="button" className="btn btn-secondary" onClick={withdrawHere}>
                      <Undo2 className="h-4 w-4" aria-hidden />
                      {t({ en: 'Withdraw', ar: 'سحب' })}
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" className="btn btn-primary btn-lg w-full sm:w-auto" onClick={sendHere}>
                  <Send className="h-4 w-4 rtl:-scale-x-100" aria-hidden />
                  {t({ en: 'Send to the on-device inbox (demo)', ar: 'أرسل إلى الصندوق على هذا الجهاز (تجريبي)' })}
                </button>
              )}
            </section>
          ) : (
            <section className="surface surface-pad space-y-5">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                  <LockKeyhole className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
                </span>
                <div className="space-y-0.5">
                  <h2 className="text-base font-semibold text-ink">{t({ en: 'Send it as a private link', ar: 'أرسله كرابط خاص' })}</h2>
                  <p className="text-sm text-muted">
                    {t({
                      en: 'The summary is locked on this phone before it is stored. Only someone with your link or QR code can open it. You can see when it is opened, read the doctor’s reply here, and withdraw it at any time.',
                      ar: 'يُقفل الملخص على هذا الهاتف قبل حفظه، ولا يفتحه إلا من يملك رابطك أو رمز QR. يمكنك معرفة وقت فتحه، وقراءة ردّ الطبيب هنا، وسحبه في أي وقت.',
                    })}
                  </p>
                </div>
              </div>

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-ink">{t({ en: 'Delete it automatically after', ar: 'يُحذف تلقائياً بعد' })}</legend>
                <div className="inline-flex overflow-hidden rounded-lg border border-line-strong shadow-xs">
                  {(
                    [
                      ['week', { en: '7 days', ar: '7 أيام' }],
                      ['day', { en: '24 hours', ar: '24 ساعة' }],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={ttl === value}
                      onClick={() => setTtl(value)}
                      className={`h-10 border-line-strong px-4 text-sm font-semibold transition-colors not-first:border-s ${ttl === value ? 'bg-brand-800 text-white' : 'bg-white text-body hover:bg-canvas'}`}
                    >
                      {t(label)}
                    </button>
                  ))}
                </div>
              </fieldset>

              {problem && (
                <Callout tone="warn">
                  {problem === 'busy'
                    ? t({ en: 'Too many links were created from this network in a short time. Please try again later.', ar: 'أُنشئت روابط كثيرة من هذه الشبكة خلال وقت قصير. يُرجى المحاولة لاحقاً.' })
                    : t({ en: 'The link could not be created. Please try again.', ar: 'تعذّر إنشاء الرابط، يُرجى المحاولة مرة أخرى.' })}
                </Callout>
              )}

              <div className="flex flex-col gap-2.5 sm:flex-row">
                <button type="button" className="btn btn-primary btn-lg sm:flex-1" disabled={busy} onClick={() => void create()}>
                  <LockKeyhole className="h-4 w-4" aria-hidden />
                  {busy ? t({ en: 'Locking and sending…', ar: 'جارٍ القفل والإرسال…' }) : t({ en: 'Create a private link for my doctor', ar: 'أنشئ رابطاً خاصاً لطبيبي' })}
                </button>
                <button type="button" className="btn btn-secondary btn-lg" onClick={download}>
                  <Download className="h-4 w-4" aria-hidden />
                  {t({ en: 'Download', ar: 'تنزيل' })}
                </button>
                <button type="button" className="btn btn-secondary btn-lg" onClick={() => void copy()}>
                  <Copy className="h-4 w-4" aria-hidden />
                  {copied ? t({ en: 'Copied', ar: 'تم النسخ' }) : t({ en: 'Copy text', ar: 'نسخ النص' })}
                </button>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

/** The link the person created: QR code, whether it was opened, the doctor's reply, and the way to withdraw it. */
function LinkPanel({ share, onGone }: { share: OwnShare; onGone: (withdrawnByMe: boolean) => void }) {
  const [, setReplies] = useStored<StoredReply[]>('replies', [])
  const { t, lang } = useI18n()
  const link = useMemo(() => linkFor(share), [share])
  const [status, setStatus] = useState<ShareStatus | null>(null)
  const [checking, setChecking] = useState(false)
  const [copied, setCopied] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)
  const [failed, setFailed] = useState(false)

  // The parent passes a new callback on every render: keep the latest one without restarting the timer below.
  const gone = useRef(onGone)
  useEffect(() => {
    gone.current = onGone
  })

  const refresh = useCallback(async () => {
    setChecking(true)
    const s = await shareStatus(share)
    setChecking(false)
    if (s.ok) {
      setStatus(s.status)
      // The doctor's reply also goes into the care journey (appointment offer, tests), once.
      const r = s.status.reply
      if (r) setReplies((list) => addReply(list, r, share.id))
    }
    else if (s.reason === 'withdrawn' || s.reason === 'expired') gone.current(false)
  }, [share, setReplies])

  // Check straight away, then every 12 seconds while this page is in front.
  useEffect(() => {
    const first = window.setTimeout(() => void refresh(), 0)
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh()
    }, 12000)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(timer)
    }
  }, [refresh])

  const when = (ms: number) => new Date(ms).toLocaleString(lang === 'ar' ? 'ar-AE' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard blocked */
    }
  }
  const canShare = typeof navigator.share === 'function'
  const shareLink = () => void navigator.share({ title: t({ en: 'Health summary', ar: 'ملخص صحي' }), url: link }).catch(() => {})
  const withdraw = async () => {
    setWithdrawing(true)
    setFailed(false)
    const r = await withdrawShare(share)
    setWithdrawing(false)
    if (r.ok) onGone(true)
    else setFailed(true)
  }

  const reply = status?.reply

  return (
    <section className="surface overflow-hidden border-brand-200">
      <div className="flex items-center gap-2.5 border-b border-brand-100 bg-brand-25 px-5 py-3.5 sm:px-6">
        <LockKeyhole className="h-[18px] w-[18px] text-brand-700" strokeWidth={1.75} aria-hidden />
        <h2 className="text-base font-semibold text-ink">{t({ en: 'Your private link is ready', ar: 'رابطك الخاص جاهز' })}</h2>
        <span className="ms-auto font-mono text-xs text-muted">{share.pseudoId}</span>
      </div>

      <div className="grid gap-5 p-5 sm:grid-cols-[176px_1fr] sm:p-6">
        <div className="mx-auto w-44 rounded-lg border border-line bg-white p-2 sm:mx-0">
          <Qr text={link} label={t({ en: 'QR code of your private link', ar: 'رمز QR لرابطك الخاص' })} className="h-auto w-full" />
        </div>
        <div className="min-w-0 space-y-4">
          <p className="text-sm text-body">
            {t({
              en: 'Show this code to your doctor to scan, or send the link. Anyone who has it can read the summary, so share it only with the person treating you.',
              ar: 'اعرض هذا الرمز على طبيبك ليمسحه، أو أرسل له الرابط. من يملكه يستطيع قراءة الملخص، فشاركه فقط مع من يعالجك.',
            })}
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => void copyLink()}>
              <Copy className="h-4 w-4" aria-hidden />
              {copied ? t({ en: 'Copied', ar: 'تم النسخ' }) : t({ en: 'Copy link', ar: 'نسخ الرابط' })}
            </button>
            {canShare && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={shareLink}>
                <Share2 className="h-4 w-4" aria-hidden />
                {t({ en: 'Send…', ar: 'إرسال…' })}
              </button>
            )}
            <a href={link} target="_blank" rel="noopener" className="btn btn-secondary btn-sm">
              <ExternalLink className="h-4 w-4" aria-hidden />
              {t({ en: 'Open the doctor’s view', ar: 'افتح عرض الطبيب' })}
            </a>
          </div>

          <dl className="space-y-1.5 text-sm">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 shrink-0 text-muted" aria-hidden />
              <dt className="sr-only">{t({ en: 'Opened', ar: 'الفتح' })}</dt>
              <dd className="text-body" aria-live="polite">
                {!status
                  ? t({ en: 'Checking…', ar: 'جارٍ التحقق…' })
                  : status.opens === 0 || !status.openedAt
                    ? t({ en: 'Not opened yet', ar: 'لم يُفتح بعد' })
                    : `${t({ en: 'Opened', ar: 'فُتح' })} ${status.opens} ${t({ en: status.opens === 1 ? 'time' : 'times', ar: status.opens === 1 ? 'مرة' : 'مرات' })} · ${t({ en: 'first', ar: 'أول مرة' })} ${when(status.openedAt)}`}
              </dd>
              <button type="button" className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-canvas hover:text-ink" onClick={() => void refresh()} disabled={checking}>
                <RefreshCw className={`h-3.5 w-3.5 ${checking ? 'animate-spin' : ''}`} aria-hidden />
                <span className="sr-only">{t({ en: 'Check again', ar: 'تحقق مجدداً' })}</span>
              </button>
            </div>
            <p className="text-muted">
              {t({ en: 'Deleted automatically on', ar: 'يُحذف تلقائياً في' })} {when(share.expiresAt)}
            </p>
          </dl>
        </div>
      </div>

      {reply && (
        <div className="space-y-1.5 border-t border-line bg-gold-50 px-5 py-4 text-sm sm:px-6">
          <LayerLabel layer="human">{t({ en: 'Your doctor’s reply', ar: 'ردّ طبيبك' })}</LayerLabel>
          <p className="text-ink">
            <span className="font-semibold">{reply.decision === 'agree' ? t({ en: 'Confirmed:', ar: 'تم التأكيد:' }) : t({ en: 'Changed to:', ar: 'تم التعديل إلى:' })}</span> {t(LEVEL_LABEL[reply.level])}
          </p>
          {reply.reason && <p className="text-body">“{reply.reason}”</p>}
          <p className="text-xs text-muted">
            {reply.reviewer} · {new Date(reply.at).toLocaleString(lang === 'ar' ? 'ar-AE' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-line bg-canvas px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <details className="group min-w-0 text-sm">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 font-medium text-muted hover:text-ink">
            {t({ en: 'How is this protected?', ar: 'كيف يُحمى هذا؟' })}
            <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <p className="mt-2 max-w-prose text-muted">
            {t({
              en: 'Your phone encrypted the summary (AES-256) before sending it. The key exists only inside the link and the QR code, which never reach our server. The server keeps scrambled bytes it cannot read, and deletes them when you withdraw or when the time runs out.',
              ar: 'شفّر هاتفك الملخص (AES-256) قبل إرساله. المفتاح موجود فقط داخل الرابط ورمز QR، ولا يصلان إلى خادمنا أبداً. يحتفظ الخادم ببيانات مشفّرة لا يستطيع قراءتها، ويحذفها عند السحب أو عند انتهاء المدة.',
            })}
          </p>
        </details>
        <div className="flex shrink-0 items-center gap-3">
          {failed && <span className="text-sm text-red-700">{t({ en: 'Could not withdraw. Try again.', ar: 'تعذّر السحب، حاول مجدداً.' })}</span>}
          <button type="button" className="btn btn-secondary" disabled={withdrawing} onClick={() => void withdraw()}>
            <Undo2 className="h-4 w-4" aria-hidden />
            {withdrawing ? t({ en: 'Withdrawing…', ar: 'جارٍ السحب…' }) : t({ en: 'Withdraw', ar: 'سحب' })}
          </button>
        </div>
      </div>
    </section>
  )
}
