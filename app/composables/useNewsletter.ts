import type { NewsletterResult } from '~/interfaces'
import type { SubscribeResponse } from '~/interfaces/newsletter'
import { problemCodeOf, statusOf } from '~/helpers/apiError'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Returns the newsletter function that validates an address and subscribes it.
 *
 * @remarks
 * `subscribe` trims the address, checks its shape on the client and posts it with the current locale to `/api/newsletter/subscribe`. Request failures do not throw: every outcome is a `NewsletterResult`. A malformed address, or an `invalidInput` from the server (HTTP 400 when the error has no code), sets `invalid` to true; `tooManyRequests` (HTTP 429 when the error has no code) gives the rate-limit message; any other failure gives a generic error. Call it in setup, because it reads `useI18n`.
 */
export function useNewsletter(): { subscribe: (email: string) => Promise<NewsletterResult> } {
  const { t, locale } = useI18n()

  async function subscribe(email: string): Promise<NewsletterResult> {
    const value = email.trim()
    if (!EMAIL_PATTERN.test(value)) {
      return { status: 'error', message: t('myc.newsletter.invalid'), invalid: true }
    }

    try {
      await $fetch<SubscribeResponse>('/api/newsletter/subscribe', {
        method: 'POST',
        body: { email: value, locale: locale.value },
      })
      return { status: 'success', message: t('myc.newsletter.success'), invalid: false }
    } catch (err) {
      const code = problemCodeOf(err)
      const statusCode = code === undefined ? statusOf(err) : undefined
      if (code === 'tooManyRequests' || statusCode === 429) {
        return { status: 'error', message: t('myc.newsletter.tooMany'), invalid: false }
      }
      if (code === 'invalidInput' || statusCode === 400) {
        return { status: 'error', message: t('myc.newsletter.invalid'), invalid: true }
      }
      return { status: 'error', message: t('myc.newsletter.error'), invalid: false }
    }
  }

  return { subscribe }
}
