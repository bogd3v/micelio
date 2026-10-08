import { afterEach, describe, expect, it } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { createError } from 'h3'
import type { AuthUser } from '~/interfaces'
import BdAccountMenu from '~/components/bd/BdAccountMenu.vue'
import BdMenuSheet from '~/components/bd/BdMenuSheet.vue'

function signInAs(user: AuthUser | null, draftCount: number | null = null): void {
  useState<AuthUser | null>('auth-user').value = user
  useState<boolean>('auth-resolved').value = true
  useState<number | null>('draft-count').value = draftCount
  registerEndpoint('/api/drafts', () => {
    if (draftCount === null) throw createError({ statusCode: 404 })
    return { data: [], meta: { count: draftCount } }
  })
}

const reader: AuthUser = { username: 'lectora', email: 'lectora@example.com', role: 'reader', createdAt: null }
const editor: AuthUser = { username: 'alejandro', email: 'alejandro@example.com', role: 'editor', createdAt: null }

describe('BdAccountMenu', () => {
  afterEach(() => signInAs(null))

  it('links to sign in without a session, keeping the current page as redirect', async () => {
    signInAs(null)
    const wrapper = await mountSuspended(BdAccountMenu, { route: '/blog?tag=vue' })
    const link = wrapper.get('a.bd-chip')
    expect(link.text()).toBe('Sign in')
    expect(link.attributes('href')).toBe('/account/sign-in?redirect=/blog?tag=vue')
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('shows an icon link with a label in the compact variant', async () => {
    signInAs(null)
    const wrapper = await mountSuspended(BdAccountMenu, { props: { compact: true } })
    expect(wrapper.get('a.bd-iconbtn').attributes('aria-label')).toBe('Sign in to your account')
  })

  it('opens a menu with the account and sign out for a reader', async () => {
    signInAs(reader)
    const wrapper = await mountSuspended(BdAccountMenu)
    const toggle = wrapper.get('button.bd-account-toggle')
    expect(toggle.attributes('aria-label')).toBe('Your account menu, lectora')
    expect(toggle.attributes('aria-expanded')).toBeUndefined()
    expect(toggle.get('.bd-account-avatar').text()).toBe('L')
    // The browser opens the popover and exposes the expanded state from popovertarget: no authored aria-expanded
    const panel = wrapper.get(`#${toggle.attributes('aria-controls')}`)
    expect(toggle.attributes('popovertarget')).toBe(panel.attributes('id'))
    expect(panel.attributes('popover')).toBe('auto')
    expect(panel.findAll('a').map(a => [a.text(), a.attributes('href')])).toEqual([['My account', '/account']])
    expect(panel.get('button').text()).toBe('Sign out')
  })

  it('adds drafts for editors', async () => {
    signInAs(editor)
    const wrapper = await mountSuspended(BdAccountMenu)
    expect(wrapper.classes()).toContain('bd-account-editor')
    expect(wrapper.findAll('.bd-account-panel a').map(a => a.attributes('href'))).toEqual(['/account', '/drafts'])
    expect(wrapper.get('.bd-account-item-drafts').attributes('aria-label')).toBe('Drafts')
    expect(wrapper.find('.bd-account-item-drafts .bd-count').exists()).toBe(false)
  })

  it('shows how many drafts are pending in the menu and on the compact avatar', async () => {
    signInAs(editor, 3)
    const wrapper = await mountSuspended(BdAccountMenu)
    const drafts = wrapper.get('.bd-account-item-drafts')
    expect(drafts.attributes('aria-label')).toBe('Drafts, 3 to review')
    expect(drafts.get('.bd-count').text()).toBe('3')
    expect(wrapper.find('.bd-account-badge').exists()).toBe(false)

    const compact = await mountSuspended(BdAccountMenu, { props: { compact: true } })
    expect(compact.get('.bd-account-badge').text()).toBe('3')
    expect(compact.get('.bd-account-badge').attributes('aria-hidden')).toBe('true')
  })

  it('hides the compact badge when there are no drafts', async () => {
    signInAs(editor, 0)
    const wrapper = await mountSuspended(BdAccountMenu, { props: { compact: true } })
    expect(wrapper.find('.bd-account-badge').exists()).toBe(false)
    expect(wrapper.get('.bd-account-item-drafts').attributes('aria-label')).toBe('Drafts, none to review')
  })
})

describe('BdMenuSheet account link', () => {
  afterEach(() => signInAs(null))

  it('offers sign in without a session and the account with one', async () => {
    signInAs(null)
    const anonymous = await mountSuspended(BdMenuSheet, { props: { open: false } })
    expect(anonymous.get('.bd-sheet-account').attributes('href')).toBe('/account/sign-in')
    expect(anonymous.get('.bd-sheet-account').text()).toContain('Sign in')

    signInAs(reader)
    const signedIn = await mountSuspended(BdMenuSheet, { props: { open: false } })
    expect(signedIn.get('.bd-sheet-account').attributes('href')).toBe('/account')
    expect(signedIn.get('.bd-sheet-account').text()).toContain('My account')
    expect(signedIn.find('.bd-sheet-drafts').exists()).toBe(false)

    signInAs(editor)
    const asEditor = await mountSuspended(BdMenuSheet, { props: { open: false } })
    expect(asEditor.get('.bd-sheet-drafts').attributes('href')).toBe('/drafts')
  })
})
