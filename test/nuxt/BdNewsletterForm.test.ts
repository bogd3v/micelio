import { describe, it, expect, afterEach, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { createError, readBody } from 'h3'
import { hiddenFields, providerHost } from '~/helpers/newsletterForm'
import BdNewsletterForm from '~/components/bd/BdNewsletterForm.vue'

let response: () => unknown = () => ({ success: true, message: 'ok' })
const received: unknown[] = []

registerEndpoint('/api/newsletter/subscribe', {
  method: 'POST',
  handler: async (event) => {
    received.push(await readBody(event))
    return response()
  },
})

async function submit(email: string) {
  const wrapper = await mountSuspended(BdNewsletterForm)
  await wrapper.get('input').setValue(email)
  await wrapper.get('form').trigger('submit')
  await vi.waitFor(() => expect(wrapper.get('[role="status"]').text()).not.toBe(''))
  return wrapper
}

describe('BdNewsletterForm', () => {
  afterEach(() => {
    response = () => ({ success: true, message: 'ok' })
    received.length = 0
  })

  it('hides its eyebrow and title when the page heads it, keeping a given description', async () => {
    const wrapper = await mountSuspended(BdNewsletterForm, { props: { hideHeading: true, description: 'Once a season.' } })
    expect(wrapper.find('h3').exists()).toBe(false)
    expect(wrapper.find('.bd-news-eyebrow').exists()).toBe(false)
    expect(wrapper.get('p').text()).toBe('Once a season.')
    const bare = await mountSuspended(BdNewsletterForm, { props: { hideHeading: true } })
    expect(bare.find('form > p:not(.bd-news-msg)').exists()).toBe(false)
  })

  it('renders the default copy with an associated label and a live region', async () => {
    const wrapper = await mountSuspended(BdNewsletterForm)
    expect(wrapper.get('h3').text()).toBe('Get the latest articles in your inbox')
    const input = wrapper.get('input')
    expect(input.attributes('id')).toBe('bd-news-email')
    expect(input.attributes('type')).toBe('email')
    expect(input.attributes('placeholder')).toBe('you@email.com')
    expect(wrapper.get('label').attributes('for')).toBe('bd-news-email')
    expect(wrapper.get('label').text()).toBe('Email address')
    const status = wrapper.get('[role="status"]')
    expect(status.attributes('aria-live')).toBe('polite')
    expect(status.text()).toBe('')
    const button = wrapper.get('button[type="submit"]')
    expect(button.classes()).toContain('bd-btn-accent')
    expect(button.text()).toContain('Subscribe')
  })

  it('accepts custom copy and id', async () => {
    const wrapper = await mountSuspended(BdNewsletterForm, {
      props: { id: 'nl-home', title: 'Señales', eyebrow: 'Boletín', placeholder: 'tu@correo.co', buttonLabel: 'Suscribirme', description: 'Un correo al mes.' },
    })
    expect(wrapper.get('h3').text()).toBe('Señales')
    expect(wrapper.get('.bd-news-eyebrow').text()).toBe('Boletín')
    expect(wrapper.get('p').text()).toBe('Un correo al mes.')
    expect(wrapper.get('input').attributes('id')).toBe('nl-home')
    expect(wrapper.get('label').attributes('for')).toBe('nl-home')
    expect(wrapper.get('button').text()).toContain('Suscribirme')
  })

  it('reflects controlled status and message', async () => {
    const wrapper = await mountSuspended(BdNewsletterForm, { props: { status: 'error', message: 'Falló' } })
    const status = wrapper.get('[role="status"]')
    expect(status.text()).toBe('Falló')
    expect(status.classes()).toContain('bd-news-msg-error')
    expect(wrapper.get('input').attributes('aria-invalid')).toBe('true')
    expect(wrapper.get('input').attributes('aria-describedby')).toBe('bd-news-email-msg')

    await wrapper.setProps({ status: 'success', message: 'Listo' })
    expect(status.text()).toBe('Listo')
    expect(status.classes()).toContain('bd-news-msg-success')
    expect(wrapper.get('input').attributes('aria-invalid')).toBeUndefined()
  })

  it('rejects an invalid email without calling the API', async () => {
    const wrapper = await submit('no-es-correo')
    expect(received).toHaveLength(0)
    const status = wrapper.get('[role="status"]')
    expect(status.text()).toBe('✕ That email does not look valid.')
    expect(status.classes()).toContain('bd-news-msg-error')
    expect(wrapper.get('input').attributes('aria-invalid')).toBe('true')
  })

  it('subscribes and asks to confirm from the inbox', async () => {
    const wrapper = await submit(' lector@bogdev.com.co ')
    expect(received).toEqual([{ email: 'lector@bogdev.com.co', locale: 'en' }])
    const status = wrapper.get('[role="status"]')
    expect(status.text()).toBe('✓ Check your email to confirm the subscription.')
    expect(status.classes()).toContain('bd-news-msg-success')
    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('')
    expect(wrapper.emitted('subscribed')).toEqual([['lector@bogdev.com.co']])
  })

  it('asks the reader to wait after too many attempts', async () => {
    response = () => {
      throw createError({ statusCode: 429, statusMessage: 'Too Many Requests' })
    }
    const wrapper = await submit('lector@bogdev.com.co')
    const status = wrapper.get('[role="status"]')
    expect(status.text()).toBe('✕ Too many attempts. Try again later.')
    expect(status.classes()).toContain('bd-news-msg-error')
    expect(wrapper.emitted('subscribed')).toBeUndefined()
  })

  it('shows a generic error when the API fails', async () => {
    response = () => {
      throw createError({ statusCode: 500, statusMessage: 'Boom' })
    }
    const wrapper = await submit('lector@bogdev.com.co')
    const status = wrapper.get('[role="status"]')
    expect(status.text()).toBe('✕ We could not subscribe you. Try again in a moment.')
    expect(status.classes()).toContain('bd-news-msg-error')
    expect(wrapper.get('input').attributes('aria-invalid')).toBeUndefined()
    expect(wrapper.emitted('subscribed')).toBeUndefined()
  })

  describe('static build', () => {
    const original = { siteMode: 'dynamic', newsletterProvider: { action: '', field: 'email', host: '', hidden: [] } }
    afterEach(() => Object.assign(useRuntimeConfig().public, original))

    function configure(action: string, field = 'email'): void {
      // What modules/site-mode.ts resolves at build
      Object.assign(useRuntimeConfig().public, { siteMode: 'static', newsletterProvider: { action, field, host: providerHost(action), hidden: hiddenFields(action) } })
    }

    it('renders a plain form post to the provider, with no Vue handlers or state', async () => {
      configure('https://buttondown.com/api/emails/embed-subscribe/micelio')
      const wrapper = await mountSuspended(BdNewsletterForm, { props: { id: 'nl-test' } })
      const form = wrapper.get('form')
      expect(form.attributes('method')).toBe('post')
      expect(form.attributes('action')).toBe('https://buttondown.com/api/emails/embed-subscribe/micelio')
      expect(form.attributes('novalidate')).toBeUndefined()
      expect(form.attributes('target')).toBeUndefined()
      expect(form.attributes('aria-busy')).toBeUndefined()
      const email = wrapper.get('input[type="email"]')
      expect(email.attributes()).toMatchObject({ id: 'nl-test', name: 'email', autocomplete: 'email', required: '' })
      expect(wrapper.get('label').attributes('for')).toBe('nl-test')
      expect(wrapper.get('input[name="embed"]').attributes()).toMatchObject({ type: 'hidden', value: '1' })
      expect(wrapper.get('button').attributes('type')).toBe('submit')
      expect(wrapper.find('[role="status"]').exists()).toBe(false)
      expect(wrapper.get('.bd-news-note').text()).toContain('buttondown.com')
      expect(wrapper.get('.bd-news-note a').attributes('href')).toBe('/privacy')
      // Submitting does not call the API
      await form.trigger('submit')
      expect(received).toEqual([])
    })

    it('uses the provider field name and no hidden field for other providers', async () => {
      configure('https://lists.example.org/subscription/form', 'EMAIL_ADDRESS')
      const wrapper = await mountSuspended(BdNewsletterForm)
      expect(wrapper.get('input[type="email"]').attributes('name')).toBe('EMAIL_ADDRESS')
      expect(wrapper.find('input[type="hidden"]').exists()).toBe(false)
    })

    it('keeps the dynamic form in dynamic builds', async () => {
      const wrapper = await mountSuspended(BdNewsletterForm)
      expect(wrapper.get('form').attributes('novalidate')).toBeDefined()
      expect(wrapper.get('form').attributes('action')).toBeUndefined()
      expect(wrapper.find('.bd-news-note').exists()).toBe(false)
    })
  })
})
