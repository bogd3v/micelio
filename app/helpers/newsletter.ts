import type { NewsletterLanguage } from '../interfaces/newsletter'

const TOKEN_PATTERN = /^[\w-]{16,128}$/

const UNSUBSCRIBE_PATH = '/newsletter/unsubscribe'
const UNSUBSCRIBE_API_PATH = '/api/newsletter/unsubscribe'

export function newsletterLanguage(value: unknown): NewsletterLanguage {
  return value === 'es' ? 'es' : 'en'
}

export function isNewsletterToken(value: unknown): value is string {
  return typeof value === 'string' && TOKEN_PATTERN.test(value)
}

function localizedUrl(siteUrl: string, language: NewsletterLanguage, path: string): string {
  const prefix = language === 'es' ? '/es' : ''
  return `${siteUrl.replace(/\/+$/, '')}${prefix}${path}`
}

export function confirmUrl(siteUrl: string, language: NewsletterLanguage, token: string): string {
  return `${localizedUrl(siteUrl, language, '/confirm')}?token=${encodeURIComponent(token)}`
}

export function blogUrl(siteUrl: string, language: NewsletterLanguage): string {
  return localizedUrl(siteUrl, language, '/blog')
}

export function unsubscribeUrl(siteUrl: string, language: NewsletterLanguage, token: string): string {
  return `${localizedUrl(siteUrl, language, UNSUBSCRIBE_PATH)}?token=${encodeURIComponent(token)}`
}

export function unsubscribeHeaders(siteUrl: string, token: string): Record<string, string> {
  const oneClickUrl = `${siteUrl.replace(/\/+$/, '')}${UNSUBSCRIBE_API_PATH}?token=${encodeURIComponent(token)}`
  return {
    'List-Unsubscribe': `<${oneClickUrl}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  }
}
