import { describe, it, expect, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { createError, readBody } from 'h3'
import ConfirmPage from '~/pages/confirm.vue'

const requests: string[] = []

registerEndpoint('/api/newsletter/confirm', {
  method: 'POST',
  handler: async (event) => {
    const { token } = await readBody<{ token?: string }>(event)
    requests.push(String(token))
    if (token === 'token-new-000000001') return { success: true, alreadyConfirmed: false, message: 'ok' }
    if (token === 'token-used-00000001') return { success: true, alreadyConfirmed: true, message: 'ok' }
    if (token === 'token-down-00000001') throw createError({ statusCode: 500, statusMessage: 'Error confirming subscription' })
    throw createError({ statusCode: 404, statusMessage: 'Invalid confirmation token' })
  },
})

async function openLink(token: string) {
  return mountSuspended(ConfirmPage, { route: `/confirm?token=${token}` })
}

async function confirm(token: string) {
  const wrapper = await openLink(token)
  await wrapper.get('form').trigger('submit')
  await vi.waitFor(() => expect(wrapper.find('[data-status="success"], [data-status="error"]').exists()).toBe(true))
  return wrapper
}

describe('confirm page', () => {
  it('only shows the button when the link is opened, and confirms nothing', async () => {
    requests.length = 0
    const wrapper = await openLink('token-new-000000001')
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(wrapper.get('h1').text()).toBe('Confirm your subscription')
    expect(wrapper.get('button[type="submit"]').text()).toBe('Confirm subscription')
    expect(requests).toEqual([])
  })

  it('welcomes a new subscriber once the button is pressed', async () => {
    const wrapper = await confirm('token-new-000000001')
    expect(wrapper.get('h1').text()).toBe('Subscription Confirmed!')
    expect(wrapper.text()).toContain('Welcome to Micelio! You\'re now subscribed')
    expect(requests.at(-1)).toBe('token-new-000000001')
  })

  it('treats a reopened link as a success', async () => {
    const wrapper = await confirm('token-used-00000001')
    expect(wrapper.get('h1').text()).toBe('Subscription Confirmed!')
    expect(wrapper.text()).toContain('This subscription was already confirmed. Nothing else to do.')
  })

  it('reports an unknown link as invalid', async () => {
    const wrapper = await confirm('token-gone-00000001')
    expect(wrapper.get('h1').text()).toBe('Confirmation Failed')
    expect(wrapper.text()).toContain('The confirmation link is invalid or has expired.')
  })

  it('reports a link without a valid token at once, with no button and no request', async () => {
    requests.length = 0
    for (const token of ['bad', '']) {
      const wrapper = await openLink(token)
      expect(wrapper.get('h1').text()).toBe('Confirmation Failed')
      expect(wrapper.find('button[type="submit"]').exists()).toBe(false)
    }
    expect(requests).toEqual([])
  })

  it('asks to retry when the server fails instead of blaming the link', async () => {
    const wrapper = await confirm('token-down-00000001')
    expect(wrapper.get('h1').text()).toBe('Confirmation Failed')
    expect(wrapper.text()).toContain('We could not confirm your subscription right now.')
  })
})
