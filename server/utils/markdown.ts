import type { CalloutTone, Locale } from '~/interfaces'
import { defaultLocale } from '~/interfaces'
import { createMarkdownRenderer } from '~/helpers/markdown'
import type { MarkdownRenderer } from '~/helpers/markdown'
import en from '../../i18n/locales/en.json'
import es from '../../i18n/locales/es.json'

const MESSAGES: Record<string, typeof en> = { en, es }
const renderers = new Map<string, MarkdownRenderer>()

/**
 * The Markdown renderer of one locale, built on first use and cached for the life of the process.
 *
 * @remarks
 * Callout titles and citation labels come from the locale messages. An unknown or missing locale uses the default locale.
 */
export function markdownRenderer(locale: Locale | string | undefined): MarkdownRenderer {
  const key = locale && locale in MESSAGES ? locale : defaultLocale
  let renderer = renderers.get(key)
  if (!renderer) {
    const messages = MESSAGES[key]!
    renderer = createMarkdownRenderer({
      callout: (tone: CalloutTone) => messages.myc.callout[tone],
      cite: (n: number) => messages.post.references.citeLabel.replace('{n}', String(n)),
    })
    renderers.set(key, renderer)
  }
  return renderer
}
