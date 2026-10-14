import { describe, expect, it } from 'vitest'
import { logText, upstreamLogMessage } from '../server/utils/upstreamError'

function fetchError(message: string, response?: { status: number }, data?: unknown): Error {
  return Object.assign(new Error(message), { name: 'FetchError', response, data })
}

describe('upstreamLogMessage', () => {
  it('says the status and the message the CMS sent, and nothing of the request', () => {
    const error = fetchError('[GET] "http://cms.internal:1337/api/subscribers?filters[email][$eq]=reader%40example.com": 400 Bad Request', { status: 400 }, { error: { message: 'Invalid key about.profile' } })
    const text = upstreamLogMessage(error)
    expect(text).toBe('upstream 400: Invalid key about.profile')
    expect(text).not.toContain('example.com')
    expect(text).not.toContain('cms.internal')
  })

  it('leaves the URL and its query out when the CMS sent no message', () => {
    const text = upstreamLogMessage(fetchError('[GET] "http://cms.internal/api/subscribers?filters[unsubscribeToken][$eq]=secret-token-000000000": 502 Bad Gateway', { status: 502 }))
    expect(text).toBe('upstream 502')
    expect(text).not.toContain('secret-token')
  })

  it('says there was no response for a network failure', () => {
    expect(upstreamLogMessage(fetchError('[POST] "http://cms.internal/api/x": <no response> fetch failed'))).toBe('upstream, no response')
  })

  it('reads the status of an h3 error and the message of the data', () => {
    expect(upstreamLogMessage({ statusCode: 429, data: { message: 'Too many requests' } })).toBe('upstream 429: Too many requests')
  })

  it('keeps the name and message of an error of our own code', () => {
    expect(upstreamLogMessage(new TypeError('x is not a function'))).toBe('TypeError: x is not a function')
  })

  it('says only the code of a mail error, whose message holds the address', () => {
    const error = Object.assign(new Error('Recipient address rejected: reader@example.com'), { code: 'EENVELOPE' })
    expect(upstreamLogMessage(error)).toBe('Error (EENVELOPE)')
  })

  it('cannot be used to forge a log line: line breaks and control characters become spaces', () => {
    const text = upstreamLogMessage(fetchError('boom', { status: 400 }, { error: { message: 'first\nSECOND LINE\r\u0000end' } }))
    expect(text).toBe('upstream 400: first SECOND LINE end')
    expect([...text].some(char => char.charCodeAt(0) < 32)).toBe(false)
  })

  it('cuts a very long message', () => {
    expect(upstreamLogMessage(fetchError('boom', { status: 400 }, { error: { message: 'a'.repeat(1000) } })).length).toBeLessThan(400)
  })

  it('reads anything else as unknown', () => {
    expect(upstreamLogMessage(undefined)).toBe('unknown error')
    expect(upstreamLogMessage('text')).toBe('unknown error')
  })
})

describe('logText', () => {
  it('turns line breaks and control characters into spaces and cuts a long text', () => {
    expect(logText('theme "evil\nSECOND LINE"')).toBe('theme "evil SECOND LINE"')
    expect(logText('a'.repeat(1000)).length).toBeLessThan(400)
  })

  it('leaves an ordinary message alone', () => {
    expect(logText('Strapi\'s theme "x" is not installed')).toBe('Strapi\'s theme "x" is not installed')
  })
})
