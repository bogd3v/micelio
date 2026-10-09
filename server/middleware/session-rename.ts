// Moves a session held under the pre-rename cookie to its new name (ADR 0003, amendment of 2026-10-08).
// Only the routes that read the session: they are `private, no-store` by route rule, so a Set-Cookie never reaches a shared cache.
const SESSION_PATHS = ['/api/auth/', '/api/drafts/']

export default defineEventHandler((event) => {
  const pathname = event.path.split('?')[0] ?? ''
  if (pathname === '/api/drafts' || SESSION_PATHS.some(prefix => pathname.startsWith(prefix))) migrateLegacySession(event)
})
