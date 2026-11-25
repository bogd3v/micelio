import { describe, expect, it, vi } from 'vitest'
import { createEvent } from 'h3'
import type { H3Event } from 'h3'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { silenceDefaultReport } from '../server/lib/silentErrorHandler'
import type { NitroErrorHandlerContext } from '../server/lib/silentErrorHandler'

function newEvent(): H3Event {
  const req = new IncomingMessage(new Socket())
  return createEvent(req, new ServerResponse(req))
}

function defaultResponse(): ReturnType<NitroErrorHandlerContext['defaultHandler']> {
  return { status: 500, statusText: 'Server Error', headers: { 'x-test': '1' }, body: { error: true } }
}

describe('silenceDefaultReport', () => {
  it('makes every call of the default handler silent and keeps the other options', async () => {
    const defaultHandler = vi.fn(defaultResponse)
    const event = newEvent()
    const handler = silenceDefaultReport(async (error, ev, context) => {
      await context.defaultHandler(error, ev, { json: true })
      event.node.res.end() // answered, so no fallback
    })
    await handler('error', event, { defaultHandler })
    expect(defaultHandler).toHaveBeenCalledTimes(1)
    expect(defaultHandler).toHaveBeenCalledWith('error', event, { json: true, silent: true })
  })

  it('answers silently an error the handler left unanswered, as Nitro would', async () => {
    const defaultHandler = vi.fn(defaultResponse)
    const event = newEvent()
    await silenceDefaultReport(() => undefined)('error', event, { defaultHandler })
    expect(defaultHandler).toHaveBeenCalledWith('error', event, { silent: true })
    expect(event.node.res.statusCode).toBe(500)
    expect(event.node.res.getHeader('x-test')).toBe('1')
  })

  it('gives the handler and the fallback a default answer whose url has no query', async () => {
    const defaultHandler = vi.fn((): ReturnType<NitroErrorHandlerContext['defaultHandler']> => ({ ...defaultResponse(), body: { error: true, url: 'http://localhost:3000/_preview?token=secret-1' } }))
    const received: unknown[] = []
    const answered = newEvent()
    await silenceDefaultReport(async (error, ev, context) => {
      received.push((await context.defaultHandler(error, ev)).body)
      ev.node.res.end()
    })('error', answered, { defaultHandler })
    expect(received).toEqual([{ error: true, url: 'http://localhost:3000/_preview' }])

    const unanswered = newEvent()
    const written: string[] = []
    vi.spyOn(unanswered.node.res, 'end').mockImplementation(((chunk?: unknown) => {
      written.push(String(chunk))
      return unanswered.node.res
    }) as ServerResponse['end'])
    await silenceDefaultReport(() => undefined)('error', unanswered, { defaultHandler })
    expect(written.map(chunk => JSON.parse(chunk) as unknown)).toEqual([{ error: true, url: 'http://localhost:3000/_preview' }])
  })

  it('keeps the query out of the message, status text and data of the error and of every answer', async () => {
    const secret = 'secret-2'
    const event = newEvent()
    event.node.req.url = `/no/such-page?code=${secret}`
    const error = Object.assign(new Error(`Page not found: /no/such-page?code=${secret}`), { statusMessage: `Page not found: /no/such-page?code=${secret}`, data: { path: `/no/such-page?code=${secret}`, list: [`?code=${secret}`] } })
    const defaultHandler = vi.fn((e: unknown): ReturnType<NitroErrorHandlerContext['defaultHandler']> => {
      const { message, statusMessage, data } = e as typeof error
      return { status: 404, statusText: statusMessage, headers: {}, body: { error: true, url: `http://localhost:3000/no/such-page?code=${secret}`, statusMessage, message, data } }
    })
    const seen: unknown[] = []
    const written: string[] = []
    vi.spyOn(event.node.res, 'end').mockImplementation(((chunk?: unknown) => {
      written.push(String(chunk))
      return event.node.res
    }) as ServerResponse['end'])
    await silenceDefaultReport(async (e, ev, context) => {
      const { message, statusMessage, data } = e as typeof error
      seen.push({ message, statusMessage, data }, await context.defaultHandler(e, ev))
    })(error, event, { defaultHandler })
    const plain = { statusMessage: 'Page not found: /no/such-page', message: 'Page not found: /no/such-page', data: { path: '/no/such-page', list: [''] } }
    expect(seen).toEqual([
      { message: 'Page not found: /no/such-page', statusMessage: 'Page not found: /no/such-page', data: { path: '/no/such-page', list: [''] } },
      { status: 404, statusText: 'Page not found: /no/such-page', headers: {}, body: { error: true, url: 'http://localhost:3000/no/such-page', ...plain } },
    ])
    expect(event.node.res.statusMessage).toBe('Page not found: /no/such-page')
    expect(written.join('')).not.toContain(secret)
  })
})
