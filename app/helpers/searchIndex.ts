interface IndexablePage {
  /** The page marks content with `data-pagefind-body`. */
  body: boolean
  /** `<html lang>`, if any. */
  lang: string | undefined
}

const HTML_TAG = /<html\b[^>]*>/i
const LANG = /\slang\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i

/**
 * What Pagefind needs to know of a generated page. Without a `data-pagefind-body` anywhere Pagefind indexes whole pages
 * (header, menus, footer), so the build checks before it indexes.
 */
export function indexablePage(html: string): IndexablePage {
  const tag = HTML_TAG.exec(html)?.[0] ?? ''
  const match = LANG.exec(tag)
  return { body: /\sdata-pagefind-body[\s=>]/i.test(html), lang: (match?.[1] ?? match?.[2] ?? match?.[3])?.trim() || undefined }
}

interface IndexedLanguages {
  languages?: Record<string, { page_count?: number }>
}

/** Pages per language from Pagefind's `pagefind-entry.json`. */
export function indexedPages(entry: IndexedLanguages): Record<string, number> {
  return Object.fromEntries(Object.entries(entry.languages ?? {}).map(([language, { page_count: count }]) => [language, count ?? 0]))
}
