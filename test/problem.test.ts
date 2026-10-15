import { beforeAll, describe, expect, it, vi } from 'vitest'
import { createError } from 'h3'

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

describe('auth statuses', () => {
  it('match the status of authFailure for every auth code', async () => {
    vi.stubGlobal('createError', createError)
    const auth = await import('../server/utils/auth')
    for (const code of AUTH_ERROR_CODES) expect(auth.authFailure(code as never).statusCode, code).toBe(mod.PROBLEM_CODES[code as keyof typeof mod.PROBLEM_CODES].status)
  })
})

describe('problem', () => {
  it('keeps the legacy shape: status, the code as status message and data.code', () => {
    const error = mod.problem('emailTaken', { data: { field: 'email' } })
    expect([error.statusCode, error.statusMessage, error.data]).toEqual([409, 'emailTaken', { code: 'emailTaken', field: 'email' }])
  })
})

describe('problemFromError', () => {
  it('describes a thrown problem from the catalog', () => {
    expect(mod.problemFromError(mod.problem('notFound'))).toMatchObject({ type: 'about:blank', title: 'Not Found', status: 404, code: 'notFound', detail: 'The resource does not exist.', statusCode: 404, statusMessage: 'notFound' })
  })

  it('uses the detail the caller gave, not the error message', () => {
    const error = mod.problem('invalidRequest', { detail: 'The slug is not a uid.' })
    expect(mod.problemFromError(error).detail).toBe('The slug is not a uid.')
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
