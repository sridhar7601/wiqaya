/**
 * Anonymous visit counting, so the team can see when the prototype is opened.
 *
 * One small event per page opening goes to PostHog: the page's name, the language, phone or desktop, and whether
 * an example person is open. It never sends the page address (which can carry an example id or the secret of a
 * doctor link), never an answer or a result, sets no cookie and stores nothing on the device. The visitor id is
 * a random number kept in memory, so it is new on every load and cannot follow anyone between visits.
 * Nothing is sent when no key is configured, when the browser asks not to be tracked, or in scripted browsers.
 */
const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined
const HOST = ((import.meta.env.VITE_POSTHOG_HOST as string | undefined) || 'https://us.i.posthog.com').replace(/\/+$/, '')

const PAGES = new Set(['check', 'result', 'share', 'report', 'd', 'clinician', 'population', 'evaluation', 'privacy', 'how', 'example', 'me', 'try', 'invite', 'i'])
const PLAN_PAGES = new Set(['journey', 'care', 'results', 'habits', 'privacy', 'check-in'])

/** "/me/journey" stays as it is; "/d/<link>" becomes "/d"; anything unknown becomes "/other". */
export function pageName(pathname: string): string {
  const [first, second] = pathname.split('/').filter(Boolean)
  if (!first) return '/'
  if (!PAGES.has(first)) return '/other'
  return first === 'me' && second && PLAN_PAGES.has(second) ? `/me/${second}` : `/${first}`
}

let visitor = ''
const visitorId = () => (visitor ||= typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `v-${Date.now()}-${Math.random().toString(36).slice(2)}`)

export function countVisit(page: string, more: { lang: string; example: boolean }): void {
  if (!KEY || navigator.webdriver || navigator.doNotTrack === '1') return
  const body = JSON.stringify({
    api_key: KEY,
    event: 'page_opened',
    distinct_id: visitorId(),
    properties: { page, lang: more.lang, example: more.example, device: window.innerWidth < 640 ? 'phone' : 'desktop', $process_person_profile: false },
  })
  // Counting must never get in the way of the app: any failure is ignored.
  void fetch(`${HOST}/i/v0/e/`, { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => {})
}
