import type { OkResponse } from '~/interfaces/auth'

export default defineEventHandler((event): OkResponse => {
  preventCaching(event)
  assertSameOrigin(event)
  clearSessionCookie(event)
  logInfo('auth.logout', 'Signed out', { event })
  return { ok: true }
})
