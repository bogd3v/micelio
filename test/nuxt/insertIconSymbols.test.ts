import { afterEach, describe, expect, it } from 'vitest'
import { insertIconSymbols } from '~/composables/insertIconSymbols'

const LEAF = '<symbol id="myc-i-leaf" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M1 1"/></symbol>'
const HEART = '<symbol id="myc-i-heart" viewBox="0 0 24 24" fill="currentColor"><path d="M2 2"/></symbol>'

describe('insertIconSymbols', () => {
  afterEach(() => document.getElementById('myc-icons')?.remove())

  it('adds the symbols of a response to the sprite of the page, creating it when the page had none', () => {
    insertIconSymbols({ 'myc-i-leaf': LEAF })
    const sprite = document.getElementById('myc-icons')!
    expect(sprite.getAttribute('aria-hidden')).toBe('true')
    expect(document.body.firstElementChild).toBe(sprite)
    expect(sprite.querySelectorAll('symbol')).toHaveLength(1)
    expect(sprite.querySelector('#myc-i-leaf path')?.getAttribute('d')).toBe('M1 1')
  })

  it('adds only the symbols the sprite does not hold yet, once each', () => {
    insertIconSymbols({ 'myc-i-leaf': LEAF })
    insertIconSymbols({ 'myc-i-leaf': LEAF, 'myc-i-heart': HEART })
    insertIconSymbols({ 'myc-i-heart': HEART })
    expect(document.querySelectorAll('#myc-icons symbol')).toHaveLength(2)
    expect(document.querySelectorAll('svg#myc-icons')).toHaveLength(1)
  })

  it('leaves out text that is not a symbol for the id it comes under', () => {
    insertIconSymbols({ 'myc-i-leaf': '<symbol id="myc-i-leaf"><script>window.hacked = 1</script></symbol>', 'myc-i-heart': LEAF, 'other': '<img src=x onerror=alert(1)>' })
    expect(document.getElementById('myc-icons')).toBeNull()
    expect((window as unknown as { hacked?: number }).hacked).toBeUndefined()
  })

  it('does nothing for a response with no symbols', () => {
    insertIconSymbols(undefined)
    insertIconSymbols({})
    expect(document.getElementById('myc-icons')).toBeNull()
  })
})
