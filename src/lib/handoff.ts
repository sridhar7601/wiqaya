import { b64u, cryptoReady, deriveKeys, randomBytes, seal, sha256Hex, unb64u, unseal } from './crypto'
import type { Sealed } from './crypto'
import type { ReferralSummary, Review } from './referral'
import { load, save } from './storage'
import type { Level } from './types'

/**
 * Doctor hand-off: the summary is encrypted on this device, stored as ciphertext on the server, and opened
 * by whoever holds the link. See infra/server/share.mjs for the server side and src/lib/crypto.ts for the keys.
 */
const ENDPOINT = (import.meta.env.VITE_SHARE_URL as string | undefined) || '/api/share'

export type Ttl = 'day' | 'week'

/** Kept only on the phone that created the link: what is needed to follow it up or withdraw it. */
export interface OwnShare {
  id: string
  /** The key in the link. Never sent to the server. */
  secret: string
  ownerToken: string
  summaryId: string
  pseudoId: string
  level: Level
  createdAt: number
  expiresAt: number
  ttl: Ttl
  /** True when the summary was one of the built-in examples, not the person's own check. */
  synthetic?: boolean
}

/** The doctor's decision, as it travels back to the person's phone. */
export type DoctorReply = Review

export interface ShareStatus {
  opens: number
  openedAt: number | null
  lastOpenedAt: number | null
  expiresAt: number
  reply: DoctorReply | null
}

export interface OpenedShare {
  summary: ReferralSummary
  createdAt: number
  expiresAt: number
  reply: DoctorReply | null
}

export type FailReason = 'unavailable' | 'expired' | 'withdrawn' | 'forbidden' | 'busy' | 'error'
export type Fail = { ok: false; reason: FailReason }

/** Encryption needs https. On a plain-http address the app keeps the on-device demo instead. */
export const handoffReady = cryptoReady

interface Wire {
  status: number
  data: Record<string, unknown> | null
}

async function post(body: Record<string, unknown>): Promise<Wire> {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), 15000)
  try {
    const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal })
    let data: Record<string, unknown> | null = null
    try {
      data = (await res.json()) as Record<string, unknown>
    } catch {
      /* not JSON: a static host answering 404 with a page */
    }
    return { status: res.status, data }
  } catch {
    return { status: 0, data: null }
  } finally {
    clearTimeout(timer)
  }
}

function failure(w: Wire): Fail {
  if (w.status === 404 && w.data?.error === 'gone') return { ok: false, reason: w.data.why === 'withdrawn' ? 'withdrawn' : 'expired' }
  if (w.status === 0 || w.status === 503 || w.status === 404 || w.status === 405) return { ok: false, reason: 'unavailable' }
  if (w.status === 403) return { ok: false, reason: 'forbidden' }
  if (w.status === 429) return { ok: false, reason: 'busy' }
  return { ok: false, reason: 'error' }
}

const keysFor = (secret: string) => deriveKeys(unb64u(secret))

async function openReply(key: CryptoKey, box: unknown): Promise<DoctorReply | null> {
  if (!box || typeof box !== 'object') return null
  try {
    return await unseal<DoctorReply>(key, box as Sealed)
  } catch {
    return null // not written with this link's key: ignore it
  }
}

/** Encrypts the summary here, then stores the ciphertext. Returns what the phone must keep. */
export async function createShare(summary: ReferralSummary, ttl: Ttl): Promise<{ ok: true; share: OwnShare } | Fail> {
  if (!handoffReady()) return { ok: false, reason: 'unavailable' }
  try {
    const secret = b64u(randomBytes(16))
    const ownerToken = b64u(randomBytes(24))
    const { key, readToken } = await keysFor(secret)
    const box = await seal(key, summary)
    const w = await post({ action: 'create', ...box, readHash: await sha256Hex(readToken), ownerHash: await sha256Hex(ownerToken), ttl })
    if (w.status !== 201 || typeof w.data?.id !== 'string') return failure(w)
    return {
      ok: true,
      share: { id: w.data.id, secret, ownerToken, summaryId: summary.id, pseudoId: summary.pseudoId, level: summary.level, createdAt: Date.now(), expiresAt: Number(w.data.expiresAt), ttl, synthetic: summary.origin === 'synthetic' },
    }
  } catch {
    return { ok: false, reason: 'error' }
  }
}

/** The address a doctor opens. Everything after the # stays in the browser. */
export function linkFor(share: { id: string; secret: string }): string {
  return `${window.location.origin}${window.location.pathname}#/d/${share.id}.${share.secret}`
}

export function parseToken(token: string | undefined): { id: string; secret: string } | null {
  const m = /^([A-Za-z0-9_-]{16})\.([A-Za-z0-9_-]{22})$/.exec(token ?? '')
  return m ? { id: m[1], secret: m[2] } : null
}

/** The doctor's device: fetch the ciphertext and decrypt it with the key from the link. */
export async function openShare(id: string, secret: string, peek = false): Promise<({ ok: true } & OpenedShare) | Fail> {
  if (!handoffReady()) return { ok: false, reason: 'unavailable' }
  try {
    const { key, readToken } = await keysFor(secret)
    const w = await post({ action: 'open', id, readToken, peek })
    if (w.status !== 200 || !w.data) return failure(w)
    const summary = await unseal<ReferralSummary>(key, { ct: String(w.data.ct), iv: String(w.data.iv) })
    return { ok: true, summary, createdAt: Number(w.data.createdAt), expiresAt: Number(w.data.expiresAt), reply: await openReply(key, w.data.reply) }
  } catch {
    return { ok: false, reason: 'forbidden' } // the key in the link does not open this box
  }
}

/** The person's phone: was the link opened, and is there a reply? */
export async function shareStatus(share: OwnShare): Promise<{ ok: true; status: ShareStatus } | Fail> {
  if (!handoffReady()) return { ok: false, reason: 'unavailable' }
  try {
    const w = await post({ action: 'status', id: share.id, ownerToken: share.ownerToken })
    if (w.status !== 200 || !w.data) return failure(w)
    const { key } = await keysFor(share.secret)
    return {
      ok: true,
      status: {
        opens: Number(w.data.opens) || 0,
        openedAt: (w.data.openedAt as number | null) ?? null,
        lastOpenedAt: (w.data.lastOpenedAt as number | null) ?? null,
        expiresAt: Number(w.data.expiresAt),
        reply: await openReply(key, w.data.reply),
      },
    }
  } catch {
    return { ok: false, reason: 'error' }
  }
}

/** The doctor's decision goes back encrypted with the same key, so only the person's phone can read it. */
export async function sendReply(id: string, secret: string, reply: DoctorReply): Promise<{ ok: true } | Fail> {
  try {
    const { key, readToken } = await keysFor(secret)
    const w = await post({ action: 'reply', id, readToken, ...(await seal(key, reply)) })
    return w.status === 200 ? { ok: true } : failure(w)
  } catch {
    return { ok: false, reason: 'error' }
  }
}

/** Deletes the stored summary now. Only the phone that created the link holds the token for this. */
export async function withdrawShare(share: OwnShare): Promise<{ ok: true } | Fail> {
  const w = await post({ action: 'withdraw', id: share.id, ownerToken: share.ownerToken })
  return w.status === 200 ? { ok: true } : failure(w)
}

/** Links a clinician has opened on this device, so the inbox can list them again. */
export interface InboxLink {
  id: string
  secret: string
  addedAt: number
}

/** Links this phone created that have not expired yet, newest first. */
export function ownShares(): OwnShare[] {
  return load<OwnShare[]>('shares', [])
    .filter((s) => s.expiresAt > Date.now())
    .sort((a, b) => b.createdAt - a.createdAt)
}

/** "Delete all my data" must also delete what was stored for a doctor: withdraw every link this phone created. */
export async function withdrawAll(): Promise<void> {
  const mine = ownShares()
  await Promise.all(mine.map((s) => withdrawShare(s)))
  save('shares', null)
}
