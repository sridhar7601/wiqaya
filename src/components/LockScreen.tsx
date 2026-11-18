import { Delete, LockKeyhole } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useI18n } from '../lib/i18n'
import { lockVault, unlockVault, useVaultState, vaultWaitSeconds, wipeAll } from '../lib/storage'
import { LogoMark } from './ui'

const AWAY_MS = 5 * 60_000

/** Shows the PIN pad while the person's data is locked, and locks again after 5 minutes away. */
export function VaultGate({ children }: { children: ReactNode }) {
  const vault = useVaultState()
  useEffect(() => {
    if (!vault.enabled || !vault.unlocked) return
    let hiddenAt = 0
    const onVis = () => {
      if (document.visibilityState === 'hidden') hiddenAt = Date.now()
      else if (hiddenAt && Date.now() - hiddenAt > AWAY_MS) void lockVault()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [vault.enabled, vault.unlocked])
  return vault.enabled && !vault.unlocked ? <LockScreen /> : <>{children}</>
}

function LockScreen() {
  const { t, discreet } = useI18n()
  const [pin, setPin] = useState('')
  const [wrong, setWrong] = useState(false)
  const [busy, setBusy] = useState(false)
  const [wait, setWait] = useState(vaultWaitSeconds())

  useEffect(() => {
    if (!wait) return
    const id = window.setInterval(() => setWait(vaultWaitSeconds()), 1000)
    return () => window.clearInterval(id)
  }, [wait])

  const tryPin = async (p: string) => {
    setBusy(true)
    const ok = await unlockVault(p)
    setBusy(false)
    if (!ok) {
      setWrong(true)
      setPin('')
      setWait(vaultWaitSeconds())
    }
  }
  const press = (d: string) => {
    if (busy || wait) return
    setWrong(false)
    setPin((p) => (p.length < 8 ? p + d : p))
  }

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center px-4 py-10">
      <div className="w-full max-w-xs space-y-6 text-center">
        <div className="flex flex-col items-center gap-3 text-brand-800">
          <LogoMark className="h-12 w-12" />
          <h1 className="text-xl font-semibold text-ink">{discreet ? t({ en: 'Health check', ar: 'فحص صحي' }) : t({ en: 'Enter your PIN', ar: 'أدخل رمزك' })}</h1>
          <p className="flex items-center gap-1.5 text-sm text-muted">
            <LockKeyhole className="h-4 w-4" aria-hidden />
            {t({ en: 'Your data is encrypted on this phone.', ar: 'بياناتك مشفّرة على هذا الهاتف.' })}
          </p>
        </div>
        <div className="flex justify-center gap-2.5" aria-live="polite" aria-label={t({ en: `${pin.length} digits entered`, ar: `أُدخل ${pin.length} أرقام` })}>
          {Array.from({ length: Math.max(4, pin.length) }, (_, i) => (
            <span key={i} className={`h-3 w-3 rounded-full ${i < pin.length ? 'bg-brand-800' : 'bg-line-strong'}`} />
          ))}
        </div>
        <p className="h-5 text-sm text-red-700">{wait ? t({ en: `Too many tries. Wait ${wait} s.`, ar: `محاولات كثيرة. انتظر ${wait} ثانية.` }) : wrong ? t({ en: 'Wrong PIN', ar: 'رمز غير صحيح' }) : ''}</p>
        <div className="grid grid-cols-3 gap-3" dir="ltr">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button key={d} type="button" className="h-14 rounded-xl border border-line bg-white text-xl font-semibold text-ink shadow-xs hover:bg-canvas" onClick={() => press(d)}>
              {d}
            </button>
          ))}
          <button type="button" className="h-14 rounded-xl text-sm font-medium text-muted hover:bg-canvas" onClick={() => setPin((p) => p.slice(0, -1))} aria-label={t({ en: 'Delete digit', ar: 'احذف رقماً' })}>
            <Delete className="mx-auto h-5 w-5" aria-hidden />
          </button>
          <button type="button" className="h-14 rounded-xl border border-line bg-white text-xl font-semibold text-ink shadow-xs hover:bg-canvas" onClick={() => press('0')}>
            0
          </button>
          <button type="button" className="h-14 rounded-xl bg-brand-800 text-sm font-semibold text-white hover:bg-brand-900 disabled:opacity-40" disabled={pin.length < 4 || busy || !!wait} onClick={() => void tryPin(pin)}>
            {busy ? '…' : t({ en: 'Open', ar: 'افتح' })}
          </button>
        </div>
        <button
          type="button"
          className="text-sm font-medium text-red-600 hover:underline"
          onClick={() => {
            if (!window.confirm(t({ en: 'Forgot your PIN? This deletes everything on this phone, so you can start again. It cannot be undone.', ar: 'نسيت رمزك؟ سيحذف هذا كل شيء على هذا الهاتف لتبدأ من جديد، ولا يمكن التراجع عنه.' }))) return
            wipeAll()
            window.location.hash = '#/'
            window.location.reload()
          }}
        >
          {t({ en: 'Forgot the PIN? Start again', ar: 'نسيت الرمز؟ ابدأ من جديد' })}
        </button>
      </div>
    </div>
  )
}
