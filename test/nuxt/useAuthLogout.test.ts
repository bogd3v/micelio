import { afterEach, describe, expect, it } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { createError } from 'h3'
import { defineComponent } from 'vue'
import type { AuthUser } from '~/interfaces'

const editor: AuthUser = { username: 'alejandro', email: 'alejandro@example.com', role: 'editor', createdAt: null }

async function mountAuth(): Promise<ReturnType<typeof useAuth>> {
  let auth!: ReturnType<typeof useAuth>
  await mountSuspended(defineComponent({
    setup() {
      auth = useAuth()
      return () => null
    },
  }))
  return auth
}

function signIn(): void {
  useState<AuthUser | null>('auth-user').value = editor
  useState<boolean>('auth-resolved').value = true
}

describe('useAuth logout', () => {
  afterEach(() => {
    useState<AuthUser | null>('auth-user').value = null
  })

  it('clears the user once the server has ended the session', async () => {
    registerEndpoint('/api/auth/logout', { method: 'POST', handler: () => ({ ok: true }) })
    signIn()
    const auth = await mountAuth()
    await auth.logout()
    expect(auth.user.value).toBeNull()
  })

  it('clears the user even when the request fails, and still reports the failure', async () => {
    registerEndpoint('/api/auth/logout', { method: 'POST', handler: () => {
      throw createError({ statusCode: 502 })
    } })
    signIn()
    const auth = await mountAuth()
    await expect(auth.logout()).rejects.toBeDefined()
    expect(auth.user.value).toBeNull()
  })
})
