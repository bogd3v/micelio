import { describe, it, expect, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { createError, getQuery } from 'h3'
import ConfirmPage from '~/pages/confirm.vue'

registerEndpoint('/api/newsletter/confirm', {
  method: 'GET',
  handler: (event) => {
    const token = getQuery(event).token
    if (token === 'token-new-000000001') return { success: true, alreadyConfirmed: false, message: 'ok' }
    if (token === 'token-used-00000001') return { success: true, alreadyConfirmed: true, message: 'ok' }
    if (token === 'token-down-00000001') throw createError({ statusCode: 500, statusMessage: 'Error confirming subscription' })
    throw createError({ statusCode: 404, statusMessage: 'Invalid confirmation token' })
  },
})

async function open(token: string) {
  const wrapper = await mountSuspended(ConfirmPage, { route: `/confirm?token=${token}` })
  await vi.waitFor(() => expect(wrapper.find('h1').exists()).toBe(true))
  return wrapper
}

describe('confirm page', () => {
  it('welcomes a new subscriber', async () => {
    const wrapper = await open('token-new-000000001')
    expect(wrapper.get('h1').text()).toBe('Subscription Confirmed!')
    expect(wrapper.text()).toContain('Welcome to Micelio! You\'re now subscribed')
  })

  it('treats a reopened link as a success', async () => {
    const wrapper = await open('token-used-00000001')
    expect(wrapper.get('h1').text()).toBe('Subscription Confirmed!')
    expect(wrapper.text()).toContain('This subscription was already confirmed. Nothing else to do.')
  })

  it('reports an unknown link as invalid', async () => {
    const wrapper = await open('token-gone-00000001')
    expect(wrapper.get('h1').text()).toBe('Confirmation Failed')
    expect(wrapper.text()).toContain('The confirmation link is invalid or has expired.')
  })

  it('asks to retry when the server fails instead of blaming the link', async () => {
    const wrapper = await open('token-down-00000001')
    expect(wrapper.get('h1').text()).toBe('Confirmation Failed')
    expect(wrapper.text()).toContain('We could not confirm your subscription right now.')
  })
})
