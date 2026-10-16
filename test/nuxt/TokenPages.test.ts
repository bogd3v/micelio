import { describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import ConfirmedPage from '~/pages/account/confirmed.vue'
import ConfirmPage from '~/pages/confirm.vue'
import ResetPasswordPage from '~/pages/account/reset-password.vue'
import UnsubscribePage from '~/pages/newsletter/unsubscribe.vue'

const posted: Record<string, unknown>[] = []
for (const path of ['/api/newsletter/confirm', '/api/newsletter/unsubscribe', '/api/auth/reset-password', '/api/auth/confirm-email']) {
  registerEndpoint(path, { method: 'POST', handler: async (event) => {
    posted.push({ path, body: await readBody(event) })
    return { ok: true, success: true }
  } })
}

describe('pages that open from an emailed link', () => {
  it('take the reset code out of the address bar once they have it, and still use it', async () => {
    posted.length = 0
    const wrapper = await mountSuspended(ResetPasswordPage, { route: '/account/reset-password?code=PROBECODE0123456789' })
    await vi.waitFor(() => expect(useRoute().query.code).toBeUndefined())
    await wrapper.get('#myc-new-pw').setValue('una-frase-larga-y-nueva-2')
    await wrapper.get('#myc-new-pw2').setValue('una-frase-larga-y-nueva-2')
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(posted).toHaveLength(1))
    expect(posted[0]).toMatchObject({ path: '/api/auth/reset-password', body: { code: 'PROBECODE0123456789' } })
  })

  it('take the confirmation token out of the address bar once they have it, and still use it', async () => {
    posted.length = 0
    const wrapper = await mountSuspended(ConfirmPage, { route: '/confirm?token=confirmation-token-0000001' })
    await vi.waitFor(() => expect(useRoute().query.token).toBeUndefined())
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(posted).toHaveLength(1))
    expect(posted[0]).toMatchObject({ path: '/api/newsletter/confirm', body: { token: 'confirmation-token-0000001' } })
  })

  it('show the email confirmation button without calling the CMS, take the token out of the address bar and confirm on submit', async () => {
    posted.length = 0
    const token = 'ab'.repeat(20)
    const wrapper = await mountSuspended(ConfirmedPage, { route: `/account/confirmed?confirmation=${token}` })
    await vi.waitFor(() => expect(useRoute().query.confirmation).toBeUndefined())
    expect(posted).toEqual([])
    expect(wrapper.get('form').text()).toContain('Confirm my email')
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(posted).toHaveLength(1))
    expect(posted[0]).toMatchObject({ path: '/api/auth/confirm-email', body: { confirmation: token } })
    await vi.waitFor(() => expect(wrapper.find('[data-status="confirmed"]').exists()).toBe(true))
  })

  it('show the confirmed view without a token and an error for a malformed one, and never post', async () => {
    posted.length = 0
    const confirmed = await mountSuspended(ConfirmedPage, { route: '/account/confirmed' })
    expect(confirmed.find('[data-status="confirmed"]').exists()).toBe(true)
    const malformed = await mountSuspended(ConfirmedPage, { route: '/account/confirmed?confirmation=nope' })
    expect(malformed.find('[data-status="error"] [role="alert"]').exists()).toBe(true)
    expect(malformed.find('form').exists()).toBe(false)
    expect(posted).toEqual([])
  })

  it('take the unsubscribe token out of the address bar once they have it, and still use it', async () => {
    posted.length = 0
    const wrapper = await mountSuspended(UnsubscribePage, { route: '/newsletter/unsubscribe?token=unsubscribe-token-0000001' })
    await vi.waitFor(() => expect(useRoute().query.token).toBeUndefined())
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(posted).toHaveLength(1))
    expect(posted[0]).toMatchObject({ path: '/api/newsletter/unsubscribe', body: { token: 'unsubscribe-token-0000001' } })
  })
})
