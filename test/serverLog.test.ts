import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatLogLine, visitorHash } from '../server/lib/log'

const TIME = new Date('2026-10-14T10:20:30.456Z')

describe('formatLogLine', () => {
  it('is one JSON line with the time in UTC first', () => {
    const line = formatLogLine({ time: TIME, level: 'error', event: 'cms.search', message: 'Search failed', route: '/api/search', requestId: 'r1', visitor: 'abc', cause: 'upstream 500' })
    expect(line).not.toContain('\n')
    expect(Object.keys(JSON.parse(line))).toEqual(['time', 'level', 'event', 'message', 'route', 'requestId', 'visitor', 'cause'])
    expect(JSON.parse(line)).toMatchObject({ time: '2026-10-14T10:20:30.456Z', level: 'error', cause: 'upstream 500' })
  })

  it('leaves out what a boot line does not have', () => {
    expect(JSON.parse(formatLogLine({ time: TIME, level: 'warn', event: 'config.missing', message: 'x' }))).toEqual({ time: TIME.toISOString(), level: 'warn', event: 'config.missing', message: 'x' })
  })

  it('cannot be split by a value that holds line breaks, and cuts a long one', () => {
    const line = formatLogLine({ time: TIME, level: 'error', event: 'e', message: 'a\n{"level":"forged"}', cause: `b\r\n${'x'.repeat(500)}` })
    expect(line.split('\n')).toHaveLength(1)
    const parsed = JSON.parse(line)
    expect(parsed.message).toBe('a {"level":"forged"}')
    expect(parsed.cause.length).toBeLessThanOrEqual(301)
  })
})

describe('visitorHash', () => {
  it('is stable for one key, differs by address and by key, and holds no address', () => {
    const key = Buffer.from('key-one')
    const hash = visitorHash('203.0.113.7', key)
    expect(hash).toMatch(/^[0-9a-f]{12}$/)
    expect(visitorHash('203.0.113.7', key)).toBe(hash)
    expect(visitorHash('203.0.113.8', key)).not.toBe(hash)
    expect(visitorHash('203.0.113.7', Buffer.from('key-two'))).not.toBe(hash)
  })
})

describe('logError with a request', () => {
  afterEach(() => vi.restoreAllMocks())

  async function logged(address: string, context: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    vi.resetModules()
    vi.doMock('../server/utils/rateLimit', () => ({ clientIp: () => address }))
    const { logError } = await import('../server/utils/log')
    const write = vi.spyOn(console, 'error').mockImplementation(() => {})
    const event = { path: '/api/search?email=reader%40example.com', context } as never
    logError('cms.search', 'Search failed', { event, error: Object.assign(new Error('boom'), { name: 'FetchError', response: { status: 500 } }) })
    return JSON.parse(String(write.mock.calls[0]![0])) as Record<string, unknown>
  }

  it('adds the route, a request id and a hashed visitor, and never the address, the query or the error object', async () => {
    const line = await logged('203.0.113.7', { matchedRoute: { path: '/api/search' } })
    expect(line).toMatchObject({ event: 'cms.search', route: '/api/search', cause: 'upstream 500' })
    expect(line.requestId).toMatch(/^[0-9a-f-]{36}$/)
    expect(line.visitor).toMatch(/^[0-9a-f]{12}$/)
    expect(JSON.stringify(line)).not.toMatch(/203\.0\.113\.7|example\.com|boom/)
  })

  it('falls back to the path without its query, and leaves the visitor out when the address is unknown', async () => {
    const line = await logged('unknown')
    expect(line.route).toBe('/api/search')
    expect(line).not.toHaveProperty('visitor')
  })
})
