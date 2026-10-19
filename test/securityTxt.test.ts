import { describe, expect, it } from 'vitest'
import { securityTxt, validSecurityContact } from '../app/helpers/securityTxt'
import { parseSiteSettings } from '../server/schemas/site'

const NOW = new Date('2026-10-19T12:00:00.000Z')
const LOCALES = ['en', 'es']

describe('securityTxt', () => {
  it('renders the four fields with a contact', () => {
    expect(securityTxt('mailto:security@example.com', 'https://example.com', LOCALES, NOW)).toBe([
      'Contact: mailto:security@example.com',
      'Expires: 2027-04-17T12:00:00.000Z',
      'Preferred-Languages: en, es',
      'Canonical: https://example.com/.well-known/security.txt',
      '',
    ].join('\n'))
  })

  it('keeps the site URL free of a trailing slash in Canonical', () => {
    expect(securityTxt('https://example.com/security', 'https://example.com/', LOCALES, NOW)).toContain('Canonical: https://example.com/.well-known/security.txt\n')
  })

  it.each([undefined, null, '', '   '])('renders nothing without a contact (%j)', (contact) => {
    expect(securityTxt(contact, 'https://example.com', LOCALES, NOW)).toBeNull()
  })

  it.each([
    'security@example.com',
    'http://example.com/security',
    'javascript:alert(1)',
    'mailto:a@example.com\nContact: mailto:b@example.com',
    'mailto:a@example.com\r\nExpires: 2099-01-01T00:00:00Z',
    'mailto:a@example.com b',
    'mailto:a@exámple.com',
    'mailto:a@example.com\u0000',
    'mailto:a@example.com?body=%0D%0ABcc:x@evil.test',
    'mailto:a@example.com?subject=hi&cc=b@example.com',
    'mailto:a@x.test,b@y.test',
    'mailto:nobody',
    'https:///',
    'https://user:pass@example.com/security',
    `https://example.com/${'a'.repeat(512)}`,
    42,
  ])('refuses an invalid contact (%j)', (contact) => {
    expect(validSecurityContact(contact)).toBeUndefined()
    expect(securityTxt(contact, 'https://example.com', LOCALES, NOW)).toBeNull()
  })

  it.each([
    'mailto:security@example.com?subject=Vulnerability%20report',
    'https://example.com/.well-known/report?lang=es',
  ])('keeps a valid contact (%s)', (contact) => {
    expect(validSecurityContact(contact)).toBe(contact)
  })

  it('trims the value it keeps', () => {
    expect(validSecurityContact('  mailto:security@example.com ')).toBe('mailto:security@example.com')
  })
})

describe('securityContact in the site settings', () => {
  it('is read when valid and dropped alone when not', () => {
    expect(parseSiteSettings({ name: 'Micelio', securityContact: 'mailto:security@example.com' })).toMatchObject({ securityContact: 'mailto:security@example.com' })
    expect(parseSiteSettings({ name: 'Micelio', securityContact: 'tel:123' })).toMatchObject({ name: 'Micelio', securityContact: undefined })
    expect(parseSiteSettings({ name: 'Micelio', securityContact: null })).toMatchObject({ securityContact: undefined })
    expect(parseSiteSettings({ name: 'Micelio' })?.securityContact).toBeUndefined()
  })
})
