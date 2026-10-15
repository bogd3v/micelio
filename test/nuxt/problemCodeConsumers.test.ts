import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { createError, setResponseStatus } from 'h3'
import type { H3Event } from 'h3'
import { defineComponent } from 'vue'
import ConfirmPage from '~/pages/confirm.vue'

type Failure = (event: H3Event) => unknown

let subscribeFailure: Failure = () => {
  throw createError({ statusCode: 500 })
}
let commentFailure: Failure = subscribeFailure
let confirmFailure: Failure = subscribeFailure

registerEndpoint('/api/newsletter/subscribe', { method: 'POST', handler: event => subscribeFailure(event) })
registerEndpoint('/api/comments', { method: 'POST', handler: event => commentFailure(event) })
registerEndpoint('/api/newsletter/confirm', { method: 'POST', handler: event => confirmFailure(event) })

// A status that disagrees with the code proves the code decides; no code proves the status fallback
function fail(statusCode: number, code?: string): Failure {
  return () => {
    throw createError({ statusCode, statusMessage: 'Failure', data: code ? { code } : undefined })
  }
}

function localeRoute(locale: 'en' | 'es'): string {
  return locale === 'es' ? '/es' : '/'
}

// A problem detail whose `code` is only at the top level, as the server sends it
function failWithTopLevelCode(status: number, code: string): Failure {
  return (event) => {
    setResponseStatus(event, status)
    return { type: 'about:blank', title: 'Failure', status, detail: 'Failure', code }
  }
}

async function setLocale(locale: 'en' | 'es'): Promise<void> {
  await useNuxtApp().$i18n.setLocale(locale)
}

const TEXT = {
  en: {
    newsletter: { tooMany: '✕ Too many attempts. Try again later.', invalid: '✕ That email does not look valid.', error: '✕ We could not subscribe you. Try again in a moment.' },
    commentTooMany: 'Too many comments in a short time. Try again in a few minutes.',
    confirm: { invalidToken: 'The confirmation link is invalid or has expired.', serverError: 'We could not confirm your subscription right now.' },
  },
  es: {
    newsletter: { tooMany: '✕ Demasiados intentos. Intenta más tarde.', invalid: '✕ Ese correo no parece válido.', error: '✕ No pudimos suscribirte. Intenta de nuevo en un momento.' },
    commentTooMany: 'Demasiados comentarios en poco tiempo. Intenta de nuevo en unos minutos.',
    confirm: { invalidToken: 'El enlace de confirmación es inválido o ha expirado.', serverError: 'No pudimos confirmar tu suscripción en este momento.' },
  },
}

async function subscribeMessage(locale: 'en' | 'es' = 'en'): Promise<{ message: string, invalid: boolean }> {
  let result!: Awaited<ReturnType<ReturnType<typeof useNewsletter>['subscribe']>>
  await mountSuspended(defineComponent({
    setup() {
      const { subscribe } = useNewsletter()
      void (async () => {
        result = await subscribe('lector@example.com')
      })()
      return () => null
    },
  }), { route: localeRoute(locale) })
  await vi.waitFor(() => expect(result).toBeDefined())
  return result
}

async function postCommentError(locale: 'en' | 'es' = 'en'): Promise<string | null> {
  let comments!: ReturnType<typeof useComments>
  await mountSuspended(defineComponent({
    setup() {
      comments = useComments('post-code')
      return () => null
    },
  }), { route: localeRoute(locale) })
  try {
    await comments.postComment({ author: { name: 'Nora', email: 'nora@example.com' }, content: 'Hello' })
  } catch {
    // The composable rethrows; the message under test is in submitError
  }
  return comments.submitError.value
}

afterEach(async () => {
  await setLocale('en')
})

describe('useNewsletter reads the problem code', () => {
  for (const locale of ['en', 'es'] as const) {
    it(`answers tooManyRequests and invalidInput by code in ${locale}`, async () => {
      await setLocale(locale)
      const expected = TEXT[locale].newsletter

      subscribeFailure = fail(500, 'tooManyRequests')
      expect(await subscribeMessage(locale)).toEqual({ status: 'error', message: expected.tooMany, invalid: false })

      subscribeFailure = fail(500, 'invalidInput')
      expect(await subscribeMessage(locale)).toEqual({ status: 'error', message: expected.invalid, invalid: true })

      subscribeFailure = fail(500, 'internalError')
      expect(await subscribeMessage(locale)).toEqual({ status: 'error', message: expected.error, invalid: false })
    })
  }

  it('reads a code that is only at the top level of the body', async () => {
    subscribeFailure = failWithTopLevelCode(500, 'tooManyRequests')
    expect(await subscribeMessage()).toMatchObject({ message: TEXT.en.newsletter.tooMany, invalid: false })
    subscribeFailure = failWithTopLevelCode(500, 'invalidInput')
    expect(await subscribeMessage()).toMatchObject({ message: TEXT.en.newsletter.invalid, invalid: true })
  })

  it('falls back to the status when the error has no code', async () => {
    subscribeFailure = fail(429)
    expect(await subscribeMessage()).toMatchObject({ message: TEXT.en.newsletter.tooMany, invalid: false })
    subscribeFailure = fail(400)
    expect(await subscribeMessage()).toMatchObject({ message: TEXT.en.newsletter.invalid, invalid: true })
  })
})

describe('useComments reads the problem code', () => {
  for (const locale of ['en', 'es'] as const) {
    it(`shows the rate-limit message by code in ${locale}`, async () => {
      await setLocale(locale)
      const expected = TEXT[locale].commentTooMany
      commentFailure = fail(500, 'tooManyRequests')
      expect(await postCommentError(locale)).toBe(expected)
    })
  }

  it('reads a code that is only at the top level of the body', async () => {
    commentFailure = failWithTopLevelCode(500, 'tooManyRequests')
    expect(await postCommentError()).toBe(TEXT.en.commentTooMany)
  })

  it('falls back to the status when the error has no code, and ignores another code', async () => {
    const expected = TEXT.en.commentTooMany
    commentFailure = fail(429)
    expect(await postCommentError()).toBe(expected)
    commentFailure = fail(429, 'internalError')
    expect(await postCommentError()).not.toBe(expected)
  })
})

describe('confirm page reads the problem code', () => {
  async function confirmMessage(locale: 'en' | 'es'): Promise<string> {
    await setLocale(locale)
    const wrapper = await mountSuspended(ConfirmPage, { route: `${locale === 'es' ? '/es' : ''}/confirm?token=token-code-00000001` })
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.find('[data-status="error"]').exists()).toBe(true))
    return wrapper.text()
  }

  for (const locale of ['en', 'es'] as const) {
    it(`treats notFound as an invalid link and any other code as a server failure in ${locale}`, async () => {
      const messages = TEXT[locale].confirm
      confirmFailure = fail(500, 'notFound')
      expect(await confirmMessage(locale)).toContain(messages.invalidToken)
      confirmFailure = fail(404, 'upstreamUnavailable')
      expect(await confirmMessage(locale)).toContain(messages.serverError)
    })
  }

  it('reads a code that is only at the top level of the body', async () => {
    confirmFailure = failWithTopLevelCode(500, 'notFound')
    expect(await confirmMessage('en')).toContain(TEXT.en.confirm.invalidToken)
  })

  it('falls back to the status when the error has no code', async () => {
    const messages = TEXT.en.confirm
    confirmFailure = fail(404)
    expect(await confirmMessage('en')).toContain(messages.invalidToken)
  })
})
