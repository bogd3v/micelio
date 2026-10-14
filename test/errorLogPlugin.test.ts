import { afterEach, describe, expect, it, vi } from 'vitest'
import { createError } from 'h3'
import { unexpectedErrorCause } from '../server/lib/log'

describe('unexpectedErrorCause', () => {
  it('says the kind of error and its code, never its message', () => {
    expect(unexpectedErrorCause(new TypeError('cannot read /reset?code=abc of reader@example.com'))).toBe('TypeError')
    expect(unexpectedErrorCause(Object.assign(new Error('connect to reader@example.com failed'), { code: 'ECONNRESET' }))).toBe('Error (ECONNRESET)')
    expect(unexpectedErrorCause('a string')).toBe('unknown error')
  })
})

describe('error log plugin', () => {
  afterEach(() => vi.unstubAllGlobals())

  async function run(error: unknown, context: Record<string, unknown> = {}): Promise<ReturnType<typeof vi.fn>> {
    const logError = vi.fn()
    let hook: ((error: unknown, context?: { event?: unknown }) => void) | undefined
    vi.stubGlobal('logError', logError)
    vi.stubGlobal('defineNitroPlugin', (plugin: (app: unknown) => void) => plugin)
    vi.resetModules()
    const plugin = (await import('../server/plugins/errorLog')).default as unknown as (app: unknown) => void
    plugin({
      hooks: {
        hook: (_name: string, callback: typeof hook) => {
          hook = callback
        },
      },
    })
    hook!(error, { event: 'the-event', ...context })
    return logError
  }

  it('logs an unhandled error by the name of the original error, without its message', async () => {
    const original = new TypeError('failed for reader@example.com')
    const logError = await run(Object.assign(new Error('Server Error'), { unhandled: true, cause: original }))
    expect(logError).toHaveBeenCalledWith('server.unhandled', expect.any(String), { event: 'the-event', cause: 'TypeError' })
  })

  it('logs an error raised outside a request or that crashed the process, which carry no flag', async () => {
    const logError = await run(new TypeError('boom'), { event: undefined, tags: ['uncaughtException'] })
    expect(logError).toHaveBeenCalledWith('server.unhandled', expect.any(String), { event: undefined, cause: 'TypeError' })
    expect(await run(new RangeError('from a hook'), { tags: ['request'] })).toHaveBeenCalledWith('server.unhandled', expect.any(String), { event: 'the-event', cause: 'RangeError' })
  })

  it('logs a fatal error and leaves handled ones to the code that threw them', async () => {
    expect(await run(Object.assign(new Error('x'), { fatal: true }))).toHaveBeenCalledTimes(1)
    expect(await run(createError({ statusCode: 502 }))).not.toHaveBeenCalled()
  })
})
