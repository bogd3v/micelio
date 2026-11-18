import { describe, expect, it, vi } from 'vitest'
import { iconRequestsIn, iconSprite, iconSymbol, iconSymbolId, iconSymbolIdOf, MAX_RESPONSE_ICONS, resolveIcon } from '../app/helpers/icons'
import type { IconSources } from '../app/helpers/icons'

const LEAF = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21c.5 -4.5 2.5 -8 7 -10"/></svg>'
const THEME_LEAF = '<svg viewBox="0 0 24 24"><path d="M1 1"/></svg>'

function sources(theme: Record<string, string>, core: Record<string, string>, filled: Record<string, string> = {}): IconSources {
  return {
    theme: name => theme[name],
    core: (name, style) => style === 'filled' ? filled[name] : core[name],
  }
}

describe('resolveIcon', () => {
  it('resolves a name in the active theme first, then in the core', async () => {
    const both = sources({ leaf: THEME_LEAF }, { leaf: LEAF, heart: '<svg>heart</svg>' })
    expect(await resolveIcon('leaf', 'outline', both)).toBe(THEME_LEAF)
    // A name the theme does not draw is the core's
    expect(await resolveIcon('heart', 'outline', both)).toBe('<svg>heart</svg>')
    // A theme with no icons/ renders the core's set
    expect(await resolveIcon('leaf', 'outline', { core: both.core })).toBe(LEAF)
  })

  it('filled falls back to outline for a name without a filled alternate', async () => {
    const set = sources({}, { leaf: LEAF, heart: '<svg>heart</svg>' }, { heart: '<svg>heart-filled</svg>' })
    expect(await resolveIcon('heart', 'filled', set)).toBe('<svg>heart-filled</svg>')
    expect(await resolveIcon('leaf', 'filled', set)).toBe(LEAF)
    // Outline is the default drawing and never asks for the filled one
    expect(await resolveIcon('heart', 'outline', set)).toBe('<svg>heart</svg>')
  })

  it('an unknown name resolves to nothing', async () => {
    const set = sources({}, { leaf: LEAF })
    expect(await resolveIcon('no-such-icon', 'outline', set)).toBeUndefined()
    expect(await resolveIcon('no-such-icon', 'filled', set)).toBeUndefined()
  })

  it('does not look up a value that is not a name of the catalogue', async () => {
    const core = vi.fn(() => LEAF)
    const theme = vi.fn(() => THEME_LEAF)
    for (const name of ['../leaf', 'Leaf', 'leaf.svg', 'leaf/x', '', '-leaf', 'a--b']) {
      expect(await resolveIcon(name, 'outline', { theme, core }), name).toBeUndefined()
    }
    expect(core).not.toHaveBeenCalled()
    expect(theme).not.toHaveBeenCalled()
  })
})

describe('iconSymbolId', () => {
  it('names the outline symbol myc-i-<name> and the filled one with a suffix', () => {
    expect(iconSymbolId('leaf')).toBe('myc-i-leaf')
    expect(iconSymbolId('leaf', 'outline')).toBe('myc-i-leaf')
    expect(iconSymbolId('leaf', 'filled')).toBe('myc-i-leaf-filled')
  })
})

describe('iconSymbol', () => {
  it('turns a glyph into a symbol, keeping the presentation attributes on it', () => {
    expect(iconSymbol('myc-i-leaf', LEAF)).toBe('<symbol id="myc-i-leaf" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21c.5 -4.5 2.5 -8 7 -10"/></symbol>')
    expect(iconSymbol('myc-i-x-filled', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M1 1"/><path d="M2 2"/></svg>\n'))
      .toBe('<symbol id="myc-i-x-filled" viewBox="0 0 24 24" fill="currentColor"><path d="M1 1"/><path d="M2 2"/></symbol>')
  })

  it('accepts the other shapes of an SVG icon, grouped', () => {
    const glyph = '<svg viewBox="0 0 24 24" stroke-width="2"><g fill="none" opacity="1"><circle cx="1" cy="1" r="1"/><rect x="1" y="1" width="2" height="2" rx="1"/><line x1="0" y1="0" x2="1" y2="1"/></g></svg>'
    expect(iconSymbol('i', glyph)).toContain('<g fill="none" opacity="1"><circle cx="1" cy="1" r="1"/>')
  })

  it.each([
    ['a script', '<svg viewBox="0 0 24 24"><script>alert(1)</script></svg>'],
    ['an empty script element', '<svg viewBox="0 0 24 24"><script/></svg>'],
    ['an element with no attribute that is not a shape', '<svg viewBox="0 0 24 24"><foreignObject></foreignObject></svg>'],
    ['a style element', '<svg viewBox="0 0 24 24"><style>a{}</style></svg>'],
    ['a link', '<svg viewBox="0 0 24 24"><a href="x"><path d="M1 1"/></a></svg>'],
    ['an external use', '<svg viewBox="0 0 24 24"><use href="https://example.com/x.svg#a"/></svg>'],
    ['an image', '<svg viewBox="0 0 24 24"><image href="data:image/png;base64,AAAA"/></svg>'],
    ['an event attribute', '<svg viewBox="0 0 24 24"><path d="M1 1" onload="alert(1)"/></svg>'],
    ['an event attribute on the root', '<svg viewBox="0 0 24 24" onload="alert(1)"><path d="M1 1"/></svg>'],
    ['an id', '<svg viewBox="0 0 24 24"><path id="a" d="M1 1"/></svg>'],
    ['a style attribute', '<svg viewBox="0 0 24 24"><path style="fill:red" d="M1 1"/></svg>'],
    ['a colour literal', '<svg viewBox="0 0 24 24"><path fill="#ff0000" d="M1 1"/></svg>'],
    ['a colour literal on the root', '<svg viewBox="0 0 24 24" stroke="red"><path d="M1 1"/></svg>'],
    ['a paint reference', '<svg viewBox="0 0 24 24"><path fill="url(#x)" d="M1 1"/></svg>'],
    ['text inside', '<svg viewBox="0 0 24 24">hi<path d="M1 1"/></svg>'],
    ['text after it', '<svg viewBox="0 0 24 24"><path d="M1 1"/></svg><script>alert(1)</script>'],
    ['a second svg', '<svg viewBox="0 0 24 24"><svg viewBox="0 0 1 1"/></svg>'],
    ['no viewBox', '<svg><path d="M1 1"/></svg>'],
    ['no closing tag', '<svg viewBox="0 0 24 24"><path d="M1 1"/>'],
    ['a self-closing root', '<svg viewBox="0 0 24 24"/>'],
    ['a root that is not an svg', '<path d="M1 1"/>'],
    ['markup in an attribute', '<svg viewBox="0 0 24 24"><path d="M1 1&quot;><script>"/></svg>'],
    ['an empty text', ''],
  ])('refuses %s', (_label, glyph) => {
    expect(iconSymbol('myc-i-x', glyph)).toBeUndefined()
  })
})

describe('iconSprite', () => {
  it('is empty for no symbols, so a page without icons is not touched', () => {
    expect(iconSprite(new Map())).toBe('')
  })

  it('holds the symbols in one hidden svg', () => {
    const sprite = iconSprite(new Map([['myc-i-a', '<symbol id="myc-i-a"/>'], ['myc-i-b', '<symbol id="myc-i-b"/>']]))
    expect(sprite.startsWith('<svg ')).toBe(true)
    expect(sprite).toContain('aria-hidden="true"')
    expect(sprite).toContain('<symbol id="myc-i-a"/><symbol id="myc-i-b"/></svg>')
    expect(sprite.match(/<svg /g)).toHaveLength(1)
  })
})

describe('iconRequestsIn', () => {
  it('finds the string `icon` of a block, in nested lists, with the style it asks for', () => {
    const body = { title: 'x', sections: [{ __component: 'section.cta', links: [{ label: 'a', icon: 'map-pin' }, { label: 'b', icon: 'heart', iconStyle: 'filled' }] }, { icon: 'map-pin', iconStyle: 'outline' }, { icon: 'leaf', iconStyle: 'bogus' }] }
    expect(iconRequestsIn(body)).toEqual([
      { name: 'map-pin', style: 'outline' },
      { name: 'heart', style: 'filled' },
      { name: 'leaf', style: 'outline' },
    ])
  })

  it('ignores an `icon` that is not a catalogue name, such as an uploaded image or a path', () => {
    expect(iconRequestsIn({ icon: { url: '/a.svg' }, items: [{ icon: '../x' }, { icon: 'Leaf' }, { icon: 7 }, { icon: null }] })).toEqual([])
    expect(iconRequestsIn(null)).toEqual([])
    expect(iconRequestsIn('leaf')).toEqual([])
  })

  it('is bounded: by the number of icons and by depth', () => {
    const many = Array.from({ length: MAX_RESPONSE_ICONS + 20 }, (_, index) => ({ icon: `name-${index}` }))
    expect(iconRequestsIn(many)).toHaveLength(MAX_RESPONSE_ICONS)
    let deep: unknown = { icon: 'leaf' }
    for (let level = 0; level < 20; level++) deep = { child: deep }
    expect(iconRequestsIn(deep)).toEqual([])
  })
})

describe('iconSymbolIdOf', () => {
  it('answers the id of a symbol iconSymbol wrote, and nothing for any other text', () => {
    const symbol = iconSymbol('myc-i-leaf', LEAF)!
    expect(iconSymbolIdOf(symbol)).toBe('myc-i-leaf')
    expect(iconSymbolIdOf(iconSymbol('myc-i-x-filled', '<svg viewBox="0 0 24 24"><g fill="none"><circle cx="1" cy="1" r="1"/></g></svg>')!)).toBe('myc-i-x-filled')
  })

  it.each([
    ['a script', '<symbol id="myc-i-a"><script>alert(1)</script></symbol>'],
    ['an event attribute', '<symbol id="myc-i-a" viewBox="0 0 24 24"><path d="M1 1" onload="alert(1)"/></symbol>'],
    ['an event attribute in capitals', '<symbol id="myc-i-a" ONCLICK="alert(1)"></symbol>'],
    ['an event attribute on the symbol', '<symbol id="myc-i-a" onclick="alert(1)"></symbol>'],
    ['a link', '<symbol id="myc-i-a"><path href="javascript:alert(1)"/></symbol>'],
    ['a style attribute', '<symbol id="myc-i-a" style="x:y"></symbol>'],
    ['an id outside the sprite\'s', '<symbol id="other"><path d="M1 1"/></symbol>'],
    ['text after it', '<symbol id="myc-i-a"></symbol><script>alert(1)</script>'],
    ['text inside', '<symbol id="myc-i-a">hi</symbol>'],
    ['markup in an attribute', '<symbol id="myc-i-a" viewBox="0 0 24 24"><path d="M1 1"><script>"/></symbol>'],
  ])('refuses %s', (_label, markup) => {
    expect(iconSymbolIdOf(markup)).toBeUndefined()
  })
})
