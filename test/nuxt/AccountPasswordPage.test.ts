import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { createError, readBody } from 'h3'
import type { AuthUser } from '~/interfaces'
import PasswordPage from '~/pages/account/password.vue'

const reader: AuthUser = { username: 'lectora', email: 'lectora@example.com', role: 'reader', createdAt: null }
const bodies: unknown[] = []

registerEndpoint('/api/auth/change-password', {
  method: 'POST',
  handler: async (event) => {
    const body = await readBody<{ currentPassword: string }>(event)
    bodies.push(body)
    if (body.currentPassword === 'la-actual-es-esta-1') return { ok: true }
    if (body.currentPassword === 'servidor-caido-1') throw createError({ statusCode: 502, data: { code: 'unknown' } })
    throw createError({ statusCode: 400, data: { code: 'wrongPassword' } })
  },
})

async function open() {
  useState<AuthUser | null>('auth-user').value = reader
  useState<boolean>('auth-resolved').value = true
  bodies.length = 0
  return mountSuspended(PasswordPage, { route: '/account/password' })
}

async function fill(wrapper: Awaited<ReturnType<typeof open>>, current: string, next: string, again = next) {
  await wrapper.get('#myc-current-pw').setValue(current)
  await wrapper.get('#myc-new-pw').setValue(next)
  await wrapper.get('#myc-new-pw2').setValue(again)
  await wrapper.get('form').trigger('submit')
}

describe('change password page', () => {
  afterEach(() => {
    useState<AuthUser | null>('auth-user').value = null
  })

  it('asks for the current password and the new one twice', async () => {
    const wrapper = await open()
    expect(wrapper.get('h1').text()).toBe('Change your password')
    expect(wrapper.findAll('input[type="password"]').length).toBe(3)
  })

  it('saves the new password, shows it and empties the fields', async () => {
    const wrapper = await open()
    await fill(wrapper, 'la-actual-es-esta-1', 'una-frase-larga-y-nueva-2')
    await vi.waitFor(() => expect(wrapper.text()).toContain('We saved your new password.'))
    expect(bodies).toEqual([{ currentPassword: 'la-actual-es-esta-1', password: 'una-frase-larga-y-nueva-2', passwordConfirmation: 'una-frase-larga-y-nueva-2' }])
    expect((wrapper.get('#myc-current-pw').element as HTMLInputElement).value).toBe('')
  })

  it('checks the form before it asks the server', async () => {
    const wrapper = await open()
    await fill(wrapper, '', 'una-frase-larga-y-nueva-2')
    expect(wrapper.text()).toContain('Type your current password.')
    await fill(wrapper, 'la-actual-es-esta-1', 'corta')
    expect(wrapper.text()).toContain('The password needs at least 10 characters.')
    await fill(wrapper, 'la-actual-es-esta-1', 'una-frase-larga-y-nueva-2', 'otra-frase-larga-3')
    expect(wrapper.text()).toContain('The passwords don\'t match.')
    await fill(wrapper, 'la-actual-es-esta-1', 'la-actual-es-esta-1')
    expect(wrapper.text()).toContain('The new password must be different from the current one.')
    expect(bodies).toEqual([])
  })

  it('says the current password is wrong on its own field', async () => {
    const wrapper = await open()
    await fill(wrapper, 'no-es-esta-1', 'una-frase-larga-y-nueva-2')
    await vi.waitFor(() => expect(wrapper.text()).toContain('The password is not correct.'))
    expect(wrapper.text()).not.toContain('We saved your new password.')
  })

  it('reports a server failure without blaming the password', async () => {
    const wrapper = await open()
    await fill(wrapper, 'servidor-caido-1', 'una-frase-larga-y-nueva-2')
    await vi.waitFor(() => expect(wrapper.find('[role="alert"]').exists()).toBe(true))
    expect(wrapper.text()).not.toContain('The password is not correct.')
  })
})
