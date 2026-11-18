import { beforeEach, describe, expect, it } from 'vitest'

/** Minimal stand-in for the browser's Web Storage. */
class MemStorage {
  private m = new Map<string, string>()
  get length() {
    return this.m.size
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null
  }
  getItem(k: string) {
    return this.m.has(k) ? (this.m.get(k) as string) : null
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v))
  }
  removeItem(k: string) {
    this.m.delete(k)
  }
  clear() {
    this.m.clear()
  }
  dump() {
    return [...this.m.entries()].map(([k, v]) => `${k}=${v}`).join('\n')
  }
}
const local = new MemStorage()
const session = new MemStorage()
Object.assign(globalThis, { localStorage: local, sessionStorage: session })
const S = await import('./storage')

beforeEach(() => {
  local.clear()
  session.clear()
  S._internal.reset()
})

describe('storage', () => {
  it('keeps the person’s data and an example person apart', () => {
    S.save('answers', { age: 34 })
    S.openExample('omar')
    expect(S.activeExample()).toBe('omar')
    expect(S.load('answers', null)).toBeNull()
    S.save('answers', { age: 45 })
    S.save('lang', 'ar') // interface language is shared
    S.closeExample()
    expect(S.load('answers', null)).toEqual({ age: 34 })
    expect(S.load('lang', 'en')).toBe('ar')
    expect(local.dump()).not.toContain('"age":45')
  })

  it('lists the stored keys of the active profile only', () => {
    S.save('answers', { age: 34 })
    S.save('labs', [])
    S.save('lang', 'en')
    expect(S.storedKeys().sort()).toEqual(['answers', 'labs'])
  })

  it('locks data behind a PIN: no plain text stays behind, the right PIN opens it, a wrong one does not', async () => {
    S.save('answers', { age: 34, smoking: 'daily' })
    S.save('lang', 'ar')
    await S.enableVault('2468')
    expect(local.dump()).not.toContain('daily')
    expect(local.getItem('wiqaya.answers')).toBeNull()
    expect(S.load('answers', null)).toEqual({ age: 34, smoking: 'daily' })

    S.save('labs', [{ kind: 'bp', sys: 128 }])
    await S.lockVault()
    expect(S.vaultEnabled()).toBe(true)
    expect(S.vaultUnlocked()).toBe(false)
    expect(S.load('answers', null)).toBeNull()
    expect(S.load('lang', 'en')).toBe('ar') // the lock screen can still show in Arabic

    expect(await S.unlockVault('1111')).toBe(false)
    expect(await S.unlockVault('2468')).toBe(true)
    expect(S.load('labs', [])).toEqual([{ kind: 'bp', sys: 128 }])
  })

  it('makes the person wait after repeated wrong PINs', async () => {
    S.save('answers', { age: 34 })
    await S.enableVault('2468')
    await S.lockVault()
    S.save('vaultFails', { n: 5, until: Date.now() + 30_000 })
    expect(S.vaultWaitSeconds()).toBeGreaterThan(20)
    expect(await S.unlockVault('2468')).toBe(false) // even the right PIN waits
  })

  it('turns the PIN off and puts the data back', async () => {
    S.save('answers', { age: 34 })
    await S.enableVault('2468')
    await S.disableVault()
    expect(S.vaultEnabled()).toBe(false)
    expect(JSON.parse(local.getItem('wiqaya.answers') ?? 'null')).toEqual({ age: 34 })
  })

  it('deletes everything, vault and examples included', async () => {
    S.save('answers', { age: 34 })
    await S.enableVault('2468')
    S.openExample('yousef')
    S.save('answers', { age: 45 })
    S.wipeAll()
    expect(local.length).toBe(0)
    expect(S.activeExample()).toBeNull()
  })
})
