import { useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { b64u, randomBytes, unb64u } from './crypto'

/**
 * Everything the person enters stays in this browser's storage. Nothing is sent to a server
 * unless they press a button that says so (a doctor link, the AI helper, feedback).
 *
 * Profiles: the person's own data lives under "wiqaya.". An example person (synthetic, for judges and
 * testers) lives under "wiqaya.x.<id>.", so trying an example never touches real data.
 *
 * App lock: with a PIN, all of the person's data is kept in one encrypted entry (AES-256-GCM, key derived
 * from the PIN with PBKDF2-SHA256, 600,000 rounds) and is decrypted into memory only while unlocked.
 * Without the PIN it cannot be read, also not by us. There is no recovery: a forgotten PIN means starting again.
 *
 * Every component that reads a key with `useStored` sees changes made by any other component at once.
 */
const BASE = 'wiqaya.'
/** Interface preferences and the lock itself stay outside the vault, so the lock screen shows in the right language. */
const GLOBAL_KEYS = new Set(['lang', 'discreet', 'vault', 'vaultFails', 'tour'])
const PROFILE_KEY = 'wiqaya.profile' // sessionStorage: which example is open in this tab
const VAULT_ITERATIONS = 600_000
const VAULT_AAD = new TextEncoder().encode('wiqaya-vault-v1')

// ---------- raw browser storage (wrapped: private modes can throw) ----------

const ls = {
  get(k: string): string | null {
    try {
      return localStorage.getItem(k)
    } catch {
      return null
    }
  },
  set(k: string, v: string): void {
    try {
      localStorage.setItem(k, v)
    } catch {
      /* storage full or blocked: the app still works for this visit */
    }
  },
  remove(k: string): void {
    try {
      localStorage.removeItem(k)
    } catch {
      /* ignore */
    }
  },
  keys(): string[] {
    try {
      const out: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k !== null) out.push(k)
      }
      return out
    } catch {
      return []
    }
  },
}

function readProfile(): string | null {
  try {
    return sessionStorage.getItem(PROFILE_KEY)
  } catch {
    return null
  }
}

let profile = readProfile()

/** The example person open in this tab, or null for the person's own data. */
export const activeExample = (): string | null => profile

const prefixFor = (key: string) => (GLOBAL_KEYS.has(key) || !profile ? BASE : `${BASE}x.${profile}.`)
const fullKey = (key: string) => prefixFor(key) + key

// ---------- vault state ----------

interface VaultFile {
  v: 1
  iter: number
  salt: string
  iv: string
  ct: string
  at: number
}

let vaultKey: CryptoKey | null = null
let vaultData: Record<string, unknown> | null = null
let writing: Promise<void> = Promise.resolve()

const readVaultFile = (): VaultFile | null => {
  const raw = ls.get(BASE + 'vault')
  if (!raw) return null
  try {
    return JSON.parse(raw) as VaultFile
  } catch {
    return null
  }
}

/** The person's own data is behind a PIN (examples never are). */
export const vaultEnabled = (): boolean => !profile && readVaultFile() !== null
export const vaultUnlocked = (): boolean => vaultKey !== null && vaultData !== null
const usesVault = (key: string) => !profile && !GLOBAL_KEYS.has(key) && readVaultFile() !== null

// ---------- shared in-memory cache, so every reader of a key stays in sync ----------

interface Entry {
  json: string
  value: unknown
}
const cache = new Map<string, Entry>()
const listeners = new Map<string, Set<() => void>>()
const vaultListeners = new Set<() => void>()

function notify(full: string): void {
  for (const fn of listeners.get(full) ?? []) fn()
}
function notifyAll(): void {
  for (const set of listeners.values()) for (const fn of set) fn()
  for (const fn of vaultListeners) fn()
}

export function load<T>(key: string, fallback: T): T {
  const full = fullKey(key)
  const hit = cache.get(full)
  if (hit) return hit.value as T
  if (usesVault(key)) {
    if (!vaultData || !(key in vaultData)) return fallback
    const value = vaultData[key]
    cache.set(full, { json: JSON.stringify(value), value })
    return value as T
  }
  const raw = ls.get(full)
  if (!raw) return fallback
  try {
    const value = JSON.parse(raw) as T
    cache.set(full, { json: raw, value })
    return value
  } catch {
    return fallback
  }
}

export function save(key: string, value: unknown): void {
  const full = fullKey(key)
  if (value === undefined || value === null) {
    const had = cache.has(full) || (usesVault(key) ? !!vaultData && key in vaultData : ls.get(full) !== null)
    cache.delete(full)
    if (!had) return
    if (usesVault(key)) {
      if (vaultData) {
        delete vaultData[key]
        persistVault()
      }
    } else ls.remove(full)
    notify(full)
    return
  }
  const json = JSON.stringify(value)
  if (cache.get(full)?.json === json) return
  cache.set(full, { json, value })
  if (usesVault(key)) {
    // Locked: nothing may be written in plain text. The app is gated, so this only guards against mistakes.
    if (!vaultData) return
    vaultData[key] = value
    persistVault()
  } else ls.set(full, json)
  notify(full)
}

function subscribe(full: string, fn: () => void): () => void {
  let set = listeners.get(full)
  if (!set) listeners.set(full, (set = new Set()))
  set.add(fn)
  return () => set.delete(fn)
}

export function useStored<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => load(key, initial))
  const initialRef = useRef(initial)
  // Another component saved this key: show its value.
  useEffect(() => subscribe(fullKey(key), () => setValue(load(key, initialRef.current))), [key])
  useEffect(() => {
    save(key, value)
  }, [key, value])
  return [value, setValue]
}

/** The keys holding data for the active profile (vault contents included), for the "your data" overview. */
export function storedKeys(): string[] {
  if (usesVault('answers')) return Object.keys(vaultData ?? {})
  const p = profile ? `${BASE}x.${profile}.` : BASE
  return ls
    .keys()
    .filter((k) => k.startsWith(p) && (profile || !k.startsWith(`${BASE}x.`)))
    .map((k) => k.slice(p.length))
    .filter((k) => !GLOBAL_KEYS.has(k))
}

/** Deletes everything: the person's data, the vault, every example, and this tab's session data. */
export function wipeAll(): void {
  for (const k of ls.keys()) if (k.startsWith(BASE)) ls.remove(k)
  try {
    sessionStorage.clear()
  } catch {
    /* ignore */
  }
  profile = null
  vaultKey = null
  vaultData = null
  cache.clear()
  notifyAll()
}

// ---------- examples ----------

/** Opens an example person in this tab, replacing any earlier copy of that example. The caller seeds it, then reloads. */
export function openExample(id: string): void {
  const p = `${BASE}x.${id}.`
  for (const k of ls.keys()) if (k.startsWith(p)) ls.remove(k)
  try {
    sessionStorage.setItem(PROFILE_KEY, id)
  } catch {
    /* ignore */
  }
  profile = id
  cache.clear()
}

/** Leaves the example and deletes its synthetic data. */
export function closeExample(): void {
  if (profile) for (const k of ls.keys()) if (k.startsWith(`${BASE}x.${profile}.`)) ls.remove(k)
  try {
    sessionStorage.removeItem(PROFILE_KEY)
  } catch {
    /* ignore */
  }
  profile = null
  cache.clear()
  notifyAll()
}

// ---------- app lock (PIN vault) ----------

async function deriveVaultKey(pin: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

async function writeVault(key: CryptoKey, salt: string, iter: number, data: Record<string, unknown>): Promise<void> {
  const iv = randomBytes(12)
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: VAULT_AAD }, key, new TextEncoder().encode(JSON.stringify(data)))
  const file: VaultFile = { v: 1, iter, salt, iv: b64u(iv), ct: b64u(new Uint8Array(ct)), at: Date.now() }
  ls.set(BASE + 'vault', JSON.stringify(file))
}

/** Writes in order, so a later change never lands before an earlier one. */
function persistVault(): void {
  const key = vaultKey
  const file = readVaultFile()
  if (!key || !file || !vaultData) return
  const snapshot = structuredClone(vaultData)
  writing = writing.then(() => writeVault(key, file.salt, file.iter, snapshot)).catch(() => {})
}

export const PIN_RE = /^\d{4,8}$/

/** Moves the person's own data into the encrypted vault and removes the plain-text copies. */
export async function enableVault(pin: string): Promise<void> {
  if (profile) throw new Error('example_profile')
  if (!PIN_RE.test(pin)) throw new Error('bad_pin')
  const data: Record<string, unknown> = {}
  for (const k of ls.keys()) {
    if (!k.startsWith(BASE) || k.startsWith(`${BASE}x.`)) continue
    const key = k.slice(BASE.length)
    if (GLOBAL_KEYS.has(key)) continue
    try {
      data[key] = JSON.parse(ls.get(k) ?? 'null')
    } catch {
      /* skip unreadable entries */
    }
  }
  const salt = randomBytes(16)
  const key = await deriveVaultKey(pin, salt, VAULT_ITERATIONS)
  await writeVault(key, b64u(salt), VAULT_ITERATIONS, data)
  for (const k of Object.keys(data)) ls.remove(BASE + k)
  vaultKey = key
  vaultData = data
  cache.clear()
  notifyAll()
}

interface Fails {
  n: number
  until: number
}

/** Seconds to wait before the next PIN attempt (after 5 wrong tries: 30 s, after 10: 5 min). */
export function vaultWaitSeconds(now = Date.now()): number {
  const f = load<Fails>('vaultFails', { n: 0, until: 0 })
  return f.until > now ? Math.ceil((f.until - now) / 1000) : 0
}

/** Unlocks with the PIN. Returns false for a wrong PIN or while a wait is running. */
export async function unlockVault(pin: string): Promise<boolean> {
  const file = readVaultFile()
  if (!file || vaultWaitSeconds() > 0) return false
  try {
    const key = await deriveVaultKey(pin, unb64u(file.salt), file.iter)
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64u(file.iv), additionalData: VAULT_AAD }, key, unb64u(file.ct))
    vaultData = JSON.parse(new TextDecoder().decode(plain)) as Record<string, unknown>
    vaultKey = key
    save('vaultFails', null)
    cache.clear()
    notifyAll()
    return true
  } catch {
    const f = load<Fails>('vaultFails', { n: 0, until: 0 })
    const n = f.n + 1
    save('vaultFails', { n, until: n >= 10 ? Date.now() + 300_000 : n >= 5 ? Date.now() + 30_000 : 0 })
    return false
  }
}

/** Locks now: finishes pending writes, then forgets the key and the decrypted data. */
export async function lockVault(): Promise<void> {
  await writing
  vaultKey = null
  vaultData = null
  cache.clear()
  notifyAll()
}

/** Turns the PIN off: the data goes back to plain browser storage on this device. Needs to be unlocked. */
export async function disableVault(): Promise<void> {
  if (!vaultUnlocked() || !vaultData) throw new Error('locked')
  await writing
  for (const [k, v] of Object.entries(vaultData)) ls.set(BASE + k, JSON.stringify(v))
  ls.remove(BASE + 'vault')
  vaultKey = null
  vaultData = null
  cache.clear()
  notifyAll()
}

/** Re-renders when the lock state changes. */
export function useVaultState(): { enabled: boolean; unlocked: boolean } {
  const [, bump] = useState(0)
  useEffect(() => {
    const fn = () => bump((n) => n + 1)
    vaultListeners.add(fn)
    return () => {
      vaultListeners.delete(fn)
    }
  }, [])
  return { enabled: vaultEnabled(), unlocked: vaultUnlocked() }
}

// ---------- small helpers used across the app ----------

/** Random id that also works on plain-http LAN testing, where crypto.randomUUID is unavailable. */
export function rid(prefix = ''): string {
  const c = globalThis.crypto
  const core = typeof c?.randomUUID === 'function' ? c.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  return prefix + core
}

export interface Consent {
  version: string
  at: string
  aiOptIn: boolean
}
export const CONSENT_VERSION = 'consent-0.1'

export interface Metrics {
  started: number
  completed: number
  durationsSec: number[]
  trust: number[]
  clarity: number[]
}
export const EMPTY_METRICS: Metrics = { started: 0, completed: 0, durationsSec: [], trust: [], clarity: [] }

export function bumpMetrics(fn: (m: Metrics) => Metrics): void {
  save('metrics', fn(load('metrics', EMPTY_METRICS)))
}

/** Tests only: re-read the tab's profile and forget everything held in memory. */
export const _internal = {
  reset(): void {
    profile = readProfile()
    vaultKey = null
    vaultData = null
    writing = Promise.resolve()
    cache.clear()
  },
  flush: () => writing,
}
