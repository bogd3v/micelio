import { legacyBlogRedirect } from '~/helpers/blog'

// Old query-string filter URLs move to paths (ADR 0006, section 7). It runs before the ISR handler.
export default defineEventHandler((event) => {
  const [pathname = '', ...rest] = event.path.split('?')
  const target = legacyBlogRedirect(pathname, rest.join('?'))
  if (target) return sendRedirect(event, target, 301)
})
