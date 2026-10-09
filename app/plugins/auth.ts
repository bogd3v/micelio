import { LEGACY_SESSION_COOKIE, SESSION_COOKIE } from '~/helpers/auth'

export default defineNuxtPlugin(async () => {
  const { resolved, refresh } = useAuth()
  if (import.meta.server) {
    // TODO(#422): remove the bd_session fallback
    if (useCookie(SESSION_COOKIE).value || useCookie(LEGACY_SESSION_COOKIE).value) await refresh()
    return
  }
  if (!resolved.value) onNuxtReady(() => refresh())
})
