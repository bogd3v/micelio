import { beforeAll, describe, expect, it, vi } from 'vitest'
import { createError } from 'h3'
import type { H3Error } from 'h3'

const AUTH_ERROR_CODES = ['invalidCredentials', 'emailNotConfirmed', 'emailTaken', 'tooManyRequests', 'invalidCode', 'wrongPassword', 'weakPassword', 'commonPassword', 'invalidInput', 'unauthorized', 'forbiddenOrigin', 'unknown']

type ProblemModule = typeof import('../server/utils/problem')
let mod: ProblemModule

beforeAll(async () => {
  vi.stubGlobal('createError', createError)
  mod = await import('../server/utils/problem')
})

describe('PROBLEM_CODES', () => {
  it('covers every auth code and gives each entry a status of 4xx or 5xx, a title and a detail', () => {
    for (const code of AUTH_ERROR_CODES) expect(mod.PROBLEM_CODES, code).toHaveProperty(code)
    for (const [code, entry] of Object.entries(mod.PROBLEM_CODES)) {
      expect(entry.status, code).toBeGreaterThanOrEqual(400)
      expect(entry.title, code).not.toBe('')
      expect(entry.detail, code).not.toMatch(/https?:\/\//)
    }
  })
})

/** The statuses the auth routes have always answered; the catalog must not drift from them. */
const AUTH_STATUS: Record<string, number> = {
  invalidCredentials: 400,
  emailNotConfirmed: 400,
  emailTaken: 409,
  tooManyRequests: 429,
  invalidCode: 400,
  wrongPassword: 400,
  weakPassword: 400,
  commonPassword: 400,
  invalidInput: 400,
  unauthorized: 401,
  forbiddenOrigin: 403,
  unknown: 502,
}

describe('auth statuses', () => {
  it('authFailure answers the historical status, with the code as status message and in data.code', async () => {
    vi.stubGlobal('createError', createError)
    vi.stubGlobal('problem', mod.problem)
    const auth = await import('../server/utils/auth')
    expect(Object.keys(AUTH_STATUS).sort()).toEqual([...AUTH_ERROR_CODES].sort())
    for (const code of AUTH_ERROR_CODES) {
      const error = auth.authFailure(code as never)
      expect([error.statusCode, error.statusMessage, error.data], code).toEqual([AUTH_STATUS[code], code, { code }])
    }
  })
})

describe('problem legacy members', () => {
  it('keeps the status phrase of an auth code as statusMessage unless the caller passes the code', () => {
    expect(mod.problem('tooManyRequests').statusMessage).toBe('Too Many Requests')
    expect(mod.problem('invalidInput').statusMessage).toBe('Bad Request')
    expect(mod.problem('invalidInput', { statusMessage: 'invalidInput' }).statusMessage).toBe('invalidInput')
  })

  it('sends the status phrase as statusMessage and message for a code that is not an auth code', () => {
    const error = mod.problem('notFound')
    expect([error.statusCode, error.statusMessage, error.message, error.data]).toEqual([404, 'Not Found', 'Not Found', { code: 'notFound' }])
  })

  it('keeps the message and statusMessage a route chooses, and leaves the detail to the catalog', () => {
    const error = mod.problem('notFound', { message: 'Post not found' })
    expect([error.statusMessage, error.message]).toEqual(['Not Found', 'Post not found'])
    const body = mod.problemFromError(error as H3Error)
    expect([body.message, body.detail]).toEqual(['Post not found', mod.PROBLEM_CODES.notFound.detail])
    expect(mod.problem('invalidRequest', { statusMessage: 'Invalid slug' }).message).toBe('Invalid slug')
  })
})

describe('upstreamFailure', () => {
  const failure = async (status: number, keep?: readonly (400 | 404)[]): Promise<string | undefined> => {
    vi.stubGlobal('problem', mod.problem)
    const { upstreamFailure } = await import('../server/utils/upstreamError')
    const error = upstreamFailure({ response: { status }, message: 'Strapi said https://cms.example.com/x' }, 'Failed to fetch', keep) as { data?: { code?: string }, message: string }
    expect(error.message).toBe('Failed to fetch')
    return error.data?.code
  }

  it('keeps a 404 as notFound and a 400 as invalidRequest only when the route keeps it', async () => {
    expect(await failure(404)).toBe('notFound')
    expect(await failure(400, [400, 404])).toBe('invalidRequest')
    expect(await failure(400)).toBe('upstreamUnavailable')
  })

  it('answers any other status, 401 and 403 included, as upstreamUnavailable', async () => {
    for (const status of [401, 403, 500]) expect(await failure(status, [400, 404]), String(status)).toBe('upstreamUnavailable')
  })
})

describe('problem', () => {
  it('keeps the legacy shape: status, the status phrase as status message and data.code', () => {
    const error = mod.problem('emailTaken', { data: { field: 'email' } })
    expect([error.statusCode, error.statusMessage, error.data]).toEqual([409, 'Conflict', { code: 'emailTaken', field: 'email' }])
  })
})

describe('problemFromError', () => {
  it('describes a thrown problem from the catalog', () => {
    expect(mod.problemFromError(mod.problem('notFound') as H3Error)).toMatchObject({ type: 'about:blank', title: 'Not Found', status: 404, code: 'notFound', detail: 'The resource does not exist.', statusCode: 404, statusMessage: 'Not Found' })
  })

  it('uses the detail the caller gave, not the error message', () => {
    const error = mod.problem('invalidRequest', { detail: 'The slug is not a uid.' })
    expect(mod.problemFromError(error as H3Error).detail).toBe('The slug is not a uid.')
  })

  it.each([[400, 'invalidRequest'], [404, 'notFound'], [405, 'methodNotAllowed'], [413, 'payloadTooLarge'], [429, 'tooManyRequests'], [502, 'upstreamUnavailable'], [500, 'internalError'], [503, 'internalError']])('derives the code of a plain %s', (statusCode, code) => {
    expect(mod.problemFromError(createError({ statusCode, message: 'Strapi said https://cms.example.com/x' }))).toMatchObject({ code, status: statusCode })
  })

  it('never puts the error message in detail, and hides an unhandled error', () => {
    const plain = mod.problemFromError(createError({ statusCode: 502, message: 'Strapi said https://cms.example.com/x' }))
    expect(plain.detail).not.toContain('cms.example.com')
    const unhandled = mod.problemFromError(createError({ statusCode: 500, message: 'secret', unhandled: true }))
    expect(unhandled).toMatchObject({ code: 'internalError', message: 'Server Error', data: undefined, detail: 'The server failed to handle the request.' })
  })

  it('turns an unhandled error into a 500, whatever status it carries', () => {
    for (const statusCode of [403, 401]) {
      expect(mod.problemFromError(createError({ statusCode, unhandled: true })), String(statusCode)).toMatchObject({ status: 500, code: 'internalError', title: 'Internal Server Error' })
    }
  })

  it('keeps the status of a plain 4xx with a neutral code and its RFC 9110 phrase', () => {
    expect(mod.problemFromError(createError({ statusCode: 403 }))).toMatchObject({ status: 403, code: 'requestRejected', title: 'Forbidden' })
    expect(mod.problemFromError(createError({ statusCode: 409 }))).toMatchObject({ status: 409, code: 'requestRejected', title: 'Conflict' })
  })

  it('ignores an unknown data.code and a status outside 4xx and 5xx', () => {
    expect(mod.problemFromError(createError({ statusCode: 418, data: { code: 'madeUp' } })).code).toBe('requestRejected')
    expect(mod.problemFromError(createError({ statusCode: 200 })).status).toBe(500)
  })
})
