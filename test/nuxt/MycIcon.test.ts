import { describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import MycIcon from '~/components/myc/MycIcon.vue'
import { iconSprite, iconSymbol } from '~/helpers/icons'
import type { IconRequest } from '~/interfaces/icons'

// What a server render has: the request's context, which the composable writes the used names into
const { context } = vi.hoisted(() => ({ context: { value: {} as Record<string, unknown> } }))
mockNuxtImport('useRequestEvent', () => () => ({ context: context.value }))

describe('MycIcon', () => {
  it('renders a use of the sprite, aria-hidden without a label and named with one', async () => {
    const decorative = await mountSuspended(MycIcon, { props: { name: 'map-pin' } })
    expect(decorative.element.tagName.toLowerCase()).toBe('svg')
    expect(decorative.get('use').attributes('href')).toBe('#myc-i-map-pin')
    expect(decorative.attributes('aria-hidden')).toBe('true')
    expect(decorative.attributes('role')).toBeUndefined()
    // Sized by its own attributes, so the icon needs no rule in the bundle's CSS (a theme's CSS can still set the stroke width)
    expect(decorative.attributes('width')).toBe('1em')
    expect(decorative.attributes('stroke-width')).toBe('1.5')
    expect(decorative.attributes('aria-label')).toBeUndefined()

    const named = await mountSuspended(MycIcon, { props: { name: 'map-pin', label: 'Our address' } })
    expect(named.get('use').attributes('href')).toBe('#myc-i-map-pin')
    expect(named.attributes('aria-hidden')).toBeUndefined()
    expect(named.attributes('role')).toBe('img')
    expect(named.attributes('aria-label')).toBe('Our address')

    const filled = await mountSuspended(MycIcon, { props: { name: 'map-pin', iconStyle: 'filled' } })
    expect(filled.get('use').attributes('href')).toBe('#myc-i-map-pin-filled')
  })

  it('the sprite holds each used name once and no other', async () => {
    context.value = {}
    await mountSuspended(MycIcon, { props: { name: 'leaf' } })
    await mountSuspended(MycIcon, { props: { name: 'heart' } })
    // The same name again, and a labelled one: still one symbol
    await mountSuspended(MycIcon, { props: { name: 'leaf', label: 'Leaf' } })
    await mountSuspended(MycIcon, { props: { name: 'leaf', iconStyle: 'filled' } })

    const used = context.value.iconSprite as Map<string, IconRequest>
    expect([...used.keys()].sort()).toEqual(['myc-i-heart', 'myc-i-leaf', 'myc-i-leaf-filled'])
    // The sprite built from what the page used has a symbol for each of those and for nothing else
    const symbols = new Map([...used.keys()].map(id => [id, iconSymbol(id, '<svg viewBox="0 0 24 24"><path d="M1 1"/></svg>')!]))
    const ids = [...iconSprite(symbols).matchAll(/<symbol id="([^"]+)"/g)].map(match => match[1])
    expect(ids.sort()).toEqual(['myc-i-heart', 'myc-i-leaf', 'myc-i-leaf-filled'])
  })
})
