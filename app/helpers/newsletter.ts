import type { NewsletterLanguage } from '../interfaces/newsletter'

const TOKEN_PATTERN = /^[\w-]{16,128}$/

const UNSUBSCRIBE_PATH = '/newsletter/unsubscribe'
const UNSUBSCRIBE_API_PATH = '/api/newsletter/unsubscribe'

/** The language of a newsletter subscriber: `es` for Spanish, and `en` for any other value. */
export function newsletterLanguage(value: unknown): NewsletterLanguage {
  return value === 'es' ? 'es' : 'en'
}

/** Whether a value has the shape of a newsletter token: 16 to 128 letters, digits, underscores or hyphens. */
export function isNewsletterToken(value: unknown): value is string {
  return typeof value === 'string' && TOKEN_PATTERN.test(value)
}

function localizedUrl(siteUrl: string, language: NewsletterLanguage, path: string): string {
  const prefix = language === 'es' ? '/es' : ''
  return `${siteUrl.replace(/\/+$/, '')}${prefix}${path}`
}

/**
 * The absolute URL of the confirmation page for a token, in the subscriber's language.
 *
 * @remarks
 * The token is URL-encoded. Spanish links get the `/es` prefix.
 */
export function confirmUrl(siteUrl: string, language: NewsletterLanguage, token: string): string {
  return `${localizedUrl(siteUrl, language, '/confirm')}?token=${encodeURIComponent(token)}`
}

/** The absolute URL of the blog list, in the subscriber's language. */
export function blogUrl(siteUrl: string, language: NewsletterLanguage): string {
  return localizedUrl(siteUrl, language, '/blog')
}

/**
 * The absolute URL of the unsubscribe page for a token, in the subscriber's language.
 *
 * @remarks
 * The token is URL-encoded. The page is not the one-click route, see `unsubscribeHeaders`.
 */
export function unsubscribeUrl(siteUrl: string, language: NewsletterLanguage, token: string): string {
  return `${localizedUrl(siteUrl, language, UNSUBSCRIBE_PATH)}?token=${encodeURIComponent(token)}`
}

/**
 * The `List-Unsubscribe` and `List-Unsubscribe-Post` headers of a newsletter email, which point mail clients at the one-click unsubscribe route.
 *
 * @remarks
 * The route is `/api/newsletter/unsubscribe`, not the unsubscribe page.
 */
export function unsubscribeHeaders(siteUrl: string, token: string): Record<string, string> {
  const oneClickUrl = `${siteUrl.replace(/\/+$/, '')}${UNSUBSCRIBE_API_PATH}?token=${encodeURIComponent(token)}`
  return {
    'List-Unsubscribe': `<${oneClickUrl}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  }
}
