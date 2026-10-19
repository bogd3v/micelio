import { SESSION_COOKIE } from '~/constants/auth'

export default defineNuxtPlugin(async () => {
  const { resolved, refresh } = useAuth()
  if (import.meta.server) {
    if (useCookie(SESSION_COOKIE).value) await refresh()
    return
  }
  if (!resolved.value) onNuxtReady(() => refresh())
})
