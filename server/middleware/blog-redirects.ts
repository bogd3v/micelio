import { defaultLocale, Locale } from '~/interfaces/locale'
import { legacyBlogRedirect } from '~/helpers/blog'
import { isCategory } from '~/helpers/categories'

// Old query-string filter URLs move to paths (ADR 0006, section 7). It runs before the ISR handler.
export default defineEventHandler(async (event) => {
  const [pathname = '', ...rest] = event.path.split('?')
  const search = rest.join('?')
  // Only blog list URLs need the category list: a path that does not redirect for any answer skips it
  if (!legacyBlogRedirect(pathname, search, () => true) && !legacyBlogRedirect(pathname, search, () => false)) return
  const locale = pathname.startsWith('/es/') || pathname === '/es' ? Locale.SpanishColombia : defaultLocale
  let known: ReadonlySet<string> | undefined
  try {
    known = new Set((await loadCategories(locale)).map(category => category.slug))
  } catch {
    // The list is only used to tell a category from a tag, and fetchCategories logged the cause: the built-in constant keeps the old behaviour
  }
  const target = legacyBlogRedirect(pathname, search, known ? slug => known.has(slug) : isCategory)
  if (target) return sendRedirect(event, target, 301)
})
