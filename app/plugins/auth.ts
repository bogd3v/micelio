import { LEGACY_SESSION_COOKIE, PREVIOUS_SESSION_COOKIE, SESSION_COOKIE } from '~/constants/auth'

export default defineNuxtPlugin(async () => {
  const { resolved, refresh } = useAuth()
  if (import.meta.server) {
    // TODO(#422): remove the micelio_session and bd_session fallbacks
    if ([SESSION_COOKIE, PREVIOUS_SESSION_COOKIE, LEGACY_SESSION_COOKIE].some(name => useCookie(name).value)) await refresh()
    return
  }
  if (!resolved.value) onNuxtReady(() => refresh())
})
