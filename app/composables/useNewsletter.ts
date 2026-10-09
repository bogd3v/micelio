import type { NewsletterResult } from '~/interfaces'
import type { SubscribeResponse } from '~/interfaces/newsletter'
import { asApiError } from '~/helpers/apiError'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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
      const e = asApiError(err)
      const statusCode = e.response?.status || e.statusCode
      if (statusCode === 429) {
        return { status: 'error', message: t('myc.newsletter.tooMany'), invalid: false }
      }
      if (statusCode === 400) {
        return { status: 'error', message: t('myc.newsletter.invalid'), invalid: true }
      }
      return { status: 'error', message: t('myc.newsletter.error'), invalid: false }
    }
  }

  return { subscribe }
}
