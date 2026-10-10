import type { AuthUser, AuthUserResponse, DeleteAccountInput, LoginInput, RegisterInput, ResetPasswordInput } from '~/interfaces'

interface UseAuth {
  user: Ref<AuthUser | null>
  resolved: Ref<boolean>
  isEditor: ComputedRef<boolean>
  refresh: () => Promise<AuthUser | null>
  ensure: () => Promise<AuthUser | null>
  login: (input: LoginInput) => Promise<AuthUser>
  logout: () => Promise<void>
  register: (input: RegisterInput) => Promise<void>
  resendConfirmation: (email: string) => Promise<void>
  forgotPassword: (email: string) => Promise<void>
  resetPassword: (input: ResetPasswordInput) => Promise<void>
  deleteAccount: (input: DeleteAccountInput) => Promise<void>
}

let pendingRefresh: Promise<AuthUser | null> | null = null

/**
 * Holds the signed-in user and the account actions of the auth API routes.
 *
 * @remarks
 * The user and the `resolved` flag are shared app state (`auth-user` and `auth-resolved`), so every component sees the same session. `refresh` reads `/api/auth/me`: on the server it always reads, on the client concurrent calls share one request. A failed read keeps the current user and does not throw; `resolved` stays false until a read or an account action sets the user. `ensure` returns the known user once the session is resolved and calls `refresh` otherwise. Every action lets its request error propagate, and callers turn it into a message with `useAuthErrorMessage`; `login`, `logout` and `deleteAccount` also update the user. Call it in setup, because it reads `useRequestFetch` and `useState`.
 */
export function useAuth(): UseAuth {
  const requestFetch = useRequestFetch()
  const user = useState<AuthUser | null>('auth-user', () => null)
  const resolved = useState<boolean>('auth-resolved', () => false)

  const isEditor = computed<boolean>(() => user.value?.role === 'editor')

  async function load(): Promise<AuthUser | null> {
    try {
      const response = await requestFetch<AuthUserResponse>('/api/auth/me')
      setUser(response.user)
    } catch {
      return user.value
    }
    return user.value
  }

  function refresh(): Promise<AuthUser | null> {
    if (import.meta.server) return load()
    pendingRefresh ??= loadOnce()
    return pendingRefresh
  }

  async function loadOnce(): Promise<AuthUser | null> {
    try {
      return await load()
    } finally {
      pendingRefresh = null
    }
  }

  function ensure(): Promise<AuthUser | null> {
    return resolved.value ? Promise.resolve(user.value) : refresh()
  }

  function setUser(next: AuthUser | null): void {
    user.value = next
    resolved.value = true
  }

  async function login(input: LoginInput): Promise<AuthUser> {
    const response = await $fetch<{ user: AuthUser }>('/api/auth/login', { method: 'POST', body: input })
    setUser(response.user)
    return response.user
  }

  async function logout(): Promise<void> {
    await $fetch('/api/auth/logout', { method: 'POST' })
    setUser(null)
  }

  async function register(input: RegisterInput): Promise<void> {
    await $fetch('/api/auth/register', { method: 'POST', body: input })
  }

  async function resendConfirmation(email: string): Promise<void> {
    await $fetch('/api/auth/resend-confirmation', { method: 'POST', body: { email } })
  }

  async function forgotPassword(email: string): Promise<void> {
    await $fetch('/api/auth/forgot-password', { method: 'POST', body: { email } })
  }

  async function resetPassword(input: ResetPasswordInput): Promise<void> {
    await $fetch('/api/auth/reset-password', { method: 'POST', body: input })
  }

  async function deleteAccount(input: DeleteAccountInput): Promise<void> {
    await $fetch('/api/auth/me', { method: 'DELETE', body: input })
    setUser(null)
  }

  return { user, resolved, isEditor, refresh, ensure, login, logout, register, resendConfirmation, forgotPassword, resetPassword, deleteAccount }
}
