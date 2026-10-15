import { describe, expect, it } from 'vitest'
import { problemCodeOf, statusOf } from '~/helpers/apiError'

describe('problemCodeOf', () => {
  it('reads the code of a problem detail body', () => {
    expect(problemCodeOf({ data: { code: 'tooManyRequests', status: 429 } })).toBe('tooManyRequests')
  })

  it('falls back to the code repeated in data', () => {
    expect(problemCodeOf({ data: { data: { code: 'wrongPassword' } } })).toBe('wrongPassword')
  })

  it('prefers the top-level code', () => {
    expect(problemCodeOf({ data: { code: 'notFound', data: { code: 'internalError' } } })).toBe('notFound')
  })

  it('is undefined without a body or with a non-string code', () => {
    expect(problemCodeOf(new Error('network'))).toBeUndefined()
    expect(problemCodeOf(null)).toBeUndefined()
    expect(problemCodeOf({ data: { code: 7 } })).toBeUndefined()
  })
})

describe('statusOf', () => {
  it('reads the response status, then the Nitro statusCode', () => {
    expect(statusOf({ response: { status: 429 }, statusCode: 500 })).toBe(429)
    expect(statusOf({ statusCode: 404 })).toBe(404)
    expect(statusOf(new Error('network'))).toBeUndefined()
  })
})
