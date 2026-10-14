import { describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import ConfirmPage from '~/pages/confirm.vue'
import ResetPasswordPage from '~/pages/account/reset-password.vue'
import UnsubscribePage from '~/pages/newsletter/unsubscribe.vue'

const posted: Record<string, unknown>[] = []
for (const path of ['/api/newsletter/confirm', '/api/newsletter/unsubscribe', '/api/auth/reset-password']) {
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

  it('take the unsubscribe token out of the address bar once they have it, and still use it', async () => {
    posted.length = 0
    const wrapper = await mountSuspended(UnsubscribePage, { route: '/newsletter/unsubscribe?token=unsubscribe-token-0000001' })
    await vi.waitFor(() => expect(useRoute().query.token).toBeUndefined())
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(posted).toHaveLength(1))
    expect(posted[0]).toMatchObject({ path: '/api/newsletter/unsubscribe', body: { token: 'unsubscribe-token-0000001' } })
  })
})
