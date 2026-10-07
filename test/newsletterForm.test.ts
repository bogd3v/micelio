import { describe, expect, it } from 'vitest'
import { formActionOrigin, formFieldName, hiddenFields, providerHost, validFormAction } from '../app/helpers/newsletterForm'

const BUTTONDOWN = 'https://buttondown.com/api/emails/embed-subscribe/micelio'

describe('validFormAction', () => {
  it('accepts https URLs, trimmed', () => {
    expect(validFormAction(` ${BUTTONDOWN} `)).toBe(BUTTONDOWN)
  })

  it('accepts http only for loopback hosts', () => {
    expect(validFormAction('http://127.0.0.1:3270/subscribe')).toBe('http://127.0.0.1:3270/subscribe')
    expect(validFormAction('http://localhost/x')).toBe('http://localhost/x')
    expect(validFormAction('http://buttondown.com/x')).toBe('')
  })

  it('rejects anything else as unset', () => {
    for (const value of [undefined, null, 42, '', '  ', 'buttondown.com/x', '/subscribe', 'javascript:alert(1)', 'ftp://x.test/a', 'https://user:pw@x.test/a']) {
      expect(validFormAction(value), String(value)).toBe('')
    }
  })
})

describe('form helpers', () => {
  it('derives the origin and the host from the action', () => {
    expect(formActionOrigin(BUTTONDOWN)).toBe('https://buttondown.com')
    expect(formActionOrigin('http://localhost:8080/a')).toBe('http://localhost:8080')
    expect(formActionOrigin('nope')).toBe('')
    expect(providerHost(BUTTONDOWN)).toBe('buttondown.com')
    expect(providerHost('')).toBe('')
  })

  it('defaults the field name to email', () => {
    expect(formFieldName(undefined)).toBe('email')
    expect(formFieldName('  ')).toBe('email')
    expect(formFieldName(' EMAIL_ADDRESS ')).toBe('EMAIL_ADDRESS')
  })

  it('adds embed=1 for Buttondown only', () => {
    expect(hiddenFields(BUTTONDOWN)).toEqual([{ name: 'embed', value: '1' }])
    expect(hiddenFields('https://listmonk.example.org/subscription/form')).toEqual([])
    expect(hiddenFields('')).toEqual([])
  })
})

describe('hostile actions', () => {
  it('rejects hosts that would change a CSP source list', () => {
    for (const value of ['https://*/x', 'https://*.evil.com/x', 'https://a.com%2a/x', 'https://a;b.com/x', 'https://a b.com/x', 'https://:@buttondown.com/x', 'https://u@buttondown.com/x', 'https://buttondown.com/x\r\nX: y', 'https://localhost/x']) {
      expect(validFormAction(value), value).toBe('')
    }
  })

  it('strips a trailing dot from the origin and returns the normalized href', () => {
    expect(formActionOrigin('https://buttondown.com./x')).toBe('https://buttondown.com')
    expect(validFormAction('https://BUTTONDOWN.com/a%20b')).toBe('https://buttondown.com/a%20b')
  })

  it('shows IDN hosts decoded', () => {
    expect(providerHost('https://xn--bcher-kva.example/x')).toBe('bücher.example')
    expect(providerHost('https://xn--mnchen-3ya.de/x')).toBe('münchen.de')
  })
})
