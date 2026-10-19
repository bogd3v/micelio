import { defaultLocale, Locale } from '~/interfaces/locale'
import { legacyBlogRedirect } from '~/helpers/blog'

// Old query-string filter URLs move to paths (ADR 0006, section 7). It runs before the ISR handler.
export default defineEventHandler(async (event) => {
  const [pathname = '', ...rest] = event.path.split('?')
  const search = rest.join('?')
  // Only blog list URLs need the category list: a path that does not redirect for any answer skips it
  if (!legacyBlogRedirect(pathname, search, () => true) && !legacyBlogRedirect(pathname, search, () => false)) return
  const locale = pathname.startsWith('/es/') || pathname === '/es' ? Locale.SpanishColombia : defaultLocale
  let known: ReadonlySet<string>
  try {
    known = new Set((await loadCategories(locale)).map(category => category.slug))
  } catch {
    // Without the list a category cannot be told from a tag: leave the URL to the route instead of guessing a redirect (the cause is logged where the list is read)
    return
  }
  const target = legacyBlogRedirect(pathname, search, slug => known.has(slug))
  if (target) return sendRedirect(event, target, 301)
})
