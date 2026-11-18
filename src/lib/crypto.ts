/**
 * Encryption for the doctor hand-off, done on the person's own device with the browser's built-in WebCrypto.
 *
 * One random secret lives only in the link (after the #, which browsers never send to a server). From it we derive:
 *   - the AES-256-GCM key that locks and unlocks the summary, and
 *   - a "read token" that proves to the server that the caller holds the link, without revealing the key.
 * The server receives ciphertext and the hash of the token. It cannot read the summary.
 */

const te = new TextEncoder()
const td = new TextDecoder()

/** WebCrypto needs https (or localhost). On a plain-http address the hand-off falls back to the on-device demo. */
export const cryptoReady = (): boolean => typeof globalThis.crypto?.subtle?.encrypt === 'function'

export function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(n))
}

export function b64u(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function unb64u(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export async function sha256Hex(text: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', te.encode(text)))
  return [...d].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export interface LinkKeys {
  key: CryptoKey
  readToken: string
}

const SALT = te.encode('wiqaya-handoff-v1')

/** Derives the encryption key and the read token from the secret in the link. */
export async function deriveKeys(secret: Uint8Array<ArrayBuffer>): Promise<LinkKeys> {
  const base = await crypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveKey', 'deriveBits'])
  const key = await crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: SALT, info: te.encode('enc') }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
  const bits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: SALT, info: te.encode('read') }, base, 192)
  return { key, readToken: b64u(new Uint8Array(bits)) }
}

export interface Sealed {
  ct: string
  iv: string
}

/** Encrypts any JSON value. A fresh random nonce is used every time. */
export async function seal(key: CryptoKey, value: unknown): Promise<Sealed> {
  const iv = randomBytes(12)
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, te.encode(JSON.stringify(value)))
  return { ct: b64u(new Uint8Array(ct)), iv: b64u(iv) }
}

/** Decrypts, and fails (throws) if the key is wrong or a single bit was changed on the way. */
export async function unseal<T>(key: CryptoKey, box: Sealed): Promise<T> {
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64u(box.iv) }, key, unb64u(box.ct))
  return JSON.parse(td.decode(plain)) as T
}
