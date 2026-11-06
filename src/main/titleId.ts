import { createHash } from 'node:crypto'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const PREFIX = 'AV'

export function makeTitleId(key: string, salt = 0): string {
  const digest = createHash('sha1')
    .update(salt ? `${key}#${salt}` : key)
    .digest()
  let id = PREFIX
  for (let i = 0; i < 9 - PREFIX.length; i++) id += ALPHABET[digest[i] % ALPHABET.length]
  return id
}

export function isArchVitaTitleId(titleId: string): boolean {
  return /^AV[A-Z0-9]{7}$/.test(titleId)
}
