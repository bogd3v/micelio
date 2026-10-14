import { describe, expect, it } from 'vitest'
import { hashToken, isHashedToken, newConfirmationToken } from '../server/utils/subscribers'

describe('hashToken', () => {
  it('is the SHA-256 of the token as 64 hex characters, and differs from the token', () => {
    const token = newConfirmationToken()
    const hashed = hashToken(token)
    expect(hashed).toMatch(/^[0-9a-f]{64}$/)
    expect(hashed).not.toBe(token)
    expect(hashToken('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
})

describe('isHashedToken', () => {
  it('tells a stored hash from a token stored in the clear', () => {
    expect(isHashedToken(hashToken('x'))).toBe(true)
    for (const stored of [newConfirmationToken(), '3f2504e0-4f89-41d3-9a0c-0305e82c3301', '', null, undefined]) {
      expect(isHashedToken(stored)).toBe(false)
    }
  })
})
