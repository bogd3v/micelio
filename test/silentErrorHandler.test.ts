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
})
