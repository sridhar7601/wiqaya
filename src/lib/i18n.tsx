import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useStored } from './storage'
import type { L10n, Lang } from './types'

export const APP_NAME: L10n = { en: 'Wiqaya', ar: 'وقاية' }
const FULL_TITLE: L10n = { en: 'Wiqaya: reproductive potential over time', ar: 'وقاية: القدرة الإنجابية مع الوقت' }
const DISCREET_TITLE: L10n = { en: 'Health check', ar: 'فحص صحي' }

interface I18n {
  lang: Lang
  setLang: (l: Lang) => void
  t: (s: L10n) => string
  discreet: boolean
  setDiscreet: (d: boolean) => void
}

const Ctx = createContext<I18n | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useStored<Lang>('lang', 'en')
  const [discreet, setDiscreet] = useStored<boolean>('discreet', false)

  // A shared link can pick the language, e.g. https://…/#/?lang=ar
  // Read during the first render: child pages (like /example) may rewrite the URL in their own effects.
  const [urlLang] = useState<Lang | null>(() => {
    const m = window.location.hash.match(/[?&]lang=(en|ar)\b/)
    return m ? (m[1] as Lang) : null
  })
  useEffect(() => {
    if (urlLang) setLang(urlLang)
    const onHash = () => {
      const m = window.location.hash.match(/[?&]lang=(en|ar)\b/)
      if (m) setLang(m[1] as Lang)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [urlLang, setLang])

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
    document.title = (discreet ? DISCREET_TITLE : FULL_TITLE)[lang]
  }, [lang, discreet])

  const t = (s: L10n) => s[lang] || s.en
  return <Ctx.Provider value={{ lang, setLang, t, discreet, setDiscreet }}>{children}</Ctx.Provider>
}

export function useI18n(): I18n {
  const v = useContext(Ctx)
  if (!v) throw new Error('useI18n outside I18nProvider')
  return v
}
