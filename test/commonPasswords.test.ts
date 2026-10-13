import { describe, expect, it } from 'vitest'
import { isCommonPassword } from '../server/lib/commonPasswords'
import { COMMON_PASSWORDS } from '../server/lib/commonPasswords.data'

describe('the common passwords list', () => {
  const entries = COMMON_PASSWORDS.split('\n')

  it('holds the 3000 most common passwords that meet the password policy, once each, in lower case', () => {
    expect(entries).toHaveLength(3000)
    expect(new Set(entries).size).toBe(3000)
    for (const entry of entries) {
      expect(entry.length, entry).toBeGreaterThanOrEqual(10)
      expect(entry, entry).toBe(entry.toLowerCase())
    }
  })

  it('starts with the most used ones', () => {
    expect(entries.slice(0, 3)).toEqual(['1234567890', '1q2w3e4r5t', 'q1w2e3r4t5y6'])
  })
})

describe('isCommonPassword', () => {
  it('knows a listed password whatever its case', () => {
    expect(isCommonPassword('1234567890')).toBe(true)
    expect(isCommonPassword('QwertyUiop')).toBe(true)
  })

  it('does not know a long phrase or a made-up one', () => {
    expect(isCommonPassword('una-frase-larga-y-segura')).toBe(false)
    expect(isCommonPassword('correcto caballo bateria grapa')).toBe(false)
    expect(isCommonPassword('')).toBe(false)
  })

  it('does not match part of a listed password', () => {
    expect(isCommonPassword('1234567890-y-algo-mas-largo')).toBe(false)
  })
})
