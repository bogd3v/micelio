export default defineEventHandler((event): { ok: true } => {
  preventCaching(event)
  assertSameOrigin(event)
  clearSessionCookie(event)
  logInfo('auth.logout', 'Signed out', { event })
  return { ok: true }
})
