import { readFileSync } from 'node:fs'
import { Socket } from 'node:net'
import { describe, expect, it, vi } from 'vitest'
import sharp from 'sharp'
import { cardText, createCardCache, renameFontFamily, renderSocialCard, SOCIAL_CARD_HEIGHT, SOCIAL_CARD_WIDTH } from '../server/lib/socialCard'
import type { SocialCardStyle } from '../server/lib/socialCard'

// The social card of a draft (bogd3v/micelio#734). The fonts are the ones the core ships: the starter's own file and a curated display font

const FRAUNCES = readFileSync('themes/starter/fonts/fraunces-latin-var.woff2')
const ARCHIVO = readFileSync('app/assets/fonts/display/archivo-latin-wght.woff2')
const SPACE_GROTESK = readFileSync('app/assets/fonts/display/space-grotesk-latin-wght.woff2')

const STYLE: SocialCardStyle = {
  title: 'Open source, in plain words',
  siteName: 'Example Site',
  surface: '#f6f1e7',
  ink: '#1d1a16',
  accent: '#2f6f4f',
  fontFile: FRAUNCES,
}

/** The pixels of a PNG as RGB triples, row by row. */
async function pixels(png: Buffer): Promise<{ at: (x: number, y: number) => string, width: number, height: number, data: Buffer }> {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const at = (x: number, y: number): string => `#${[0, 1, 2].map(channel => data[(y * info.width + x) * 3 + channel]!.toString(16).padStart(2, '0')).join('')}`
  return { at, width: info.width, height: info.height, data }
}

/** The columns and rows between `top` and `bottom` that hold a pixel that is not the surface, right of the accent bar. */
async function inkBox(png: Buffer, surface: string, top: number, bottom: number): Promise<{ left: number, right: number, top: number, bottom: number } | null> {
  const { at, width } = await pixels(png)
  let box: { left: number, right: number, top: number, bottom: number } | null = null
  for (let y = top; y < bottom; y++) {
    for (let x = 60; x < width; x++) {
      if (at(x, y) === surface) continue
      box = box ? { left: Math.min(box.left, x), right: Math.max(box.right, x), top: Math.min(box.top, y), bottom: Math.max(box.bottom, y) } : { left: x, right: x, top: y, bottom: y }
    }
  }
  return box
}

describe('renderSocialCard', () => {
  it('draws a PNG of 1200 by 630 pixels', async () => {
    const card = await renderSocialCard(STYLE)
    expect([...card.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
    const meta = await sharp(card).metadata()
    expect([meta.format, meta.width, meta.height]).toEqual(['png', SOCIAL_CARD_WIDTH, SOCIAL_CARD_HEIGHT])
    expect([SOCIAL_CARD_WIDTH, SOCIAL_CARD_HEIGHT]).toEqual([1200, 630])
  })

  it('paints the theme\'s surface, a bar of its accent, the title in its ink and the site name in its accent', async () => {
    const card = await renderSocialCard(STYLE)
    const { at, width, height } = await pixels(card)
    expect(at(600, 5)).toBe(STYLE.surface)
    expect(at(width - 1, height - 1)).toBe(STYLE.surface)
    expect(at(5, 5)).toBe(STYLE.accent)
    expect(at(5, height - 5)).toBe(STYLE.accent)
    const title = await inkBox(card, STYLE.surface, 100, 450)
    expect(title).not.toBeNull()
    // The core of a glyph is the exact ink colour (the edges blend into the surface), and the site name's the exact accent
    const { data } = await pixels(card)
    const has = (hex: string, top: number, bottom: number): boolean => {
      const wanted = [1, 3, 5].map(index => Number.parseInt(hex.slice(index, index + 2), 16))
      for (let y = top; y < bottom; y++) for (let x = 60; x < width; x++) if ([0, 1, 2].every(channel => data[(y * width + x) * 3 + channel] === wanted[channel])) return true
      return false
    }
    expect(has(STYLE.ink, 100, 450)).toBe(true)
    expect(has(STYLE.accent, 500, 600)).toBe(true)
    expect(has(STYLE.accent, 100, 450)).toBe(false)
  })

  it('draws with the glyphs of the font file it is given: proportional, and not the same as another file\'s', async () => {
    // A font that failed to load comes out as equal boxes; a real one gives a narrow `i` and a wide `m`
    const narrow = await inkBox(await renderSocialCard({ ...STYLE, title: 'iiiiiiii' }), STYLE.surface, 100, 450)
    const wide = await inkBox(await renderSocialCard({ ...STYLE, title: 'mmmmmmmm' }), STYLE.surface, 100, 450)
    expect(wide!.right - wide!.left).toBeGreaterThan((narrow!.right - narrow!.left) * 2)
    const archivo = await renderSocialCard({ ...STYLE, fontFile: ARCHIVO })
    const fraunces = await renderSocialCard(STYLE)
    expect(Buffer.compare(archivo, fraunces)).not.toBe(0)
    const archivoBox = await inkBox(archivo, STYLE.surface, 100, 450)
    const fraunceBox = await inkBox(fraunces, STYLE.surface, 100, 450)
    expect(archivoBox!.right - archivoBox!.left).not.toBe(fraunceBox!.right - fraunceBox!.left)
  })

  it('is the same card for the same style', async () => {
    expect(Buffer.compare(await renderSocialCard(STYLE), await renderSocialCard(STYLE))).toBe(0)
  })

  it('keeps a long title inside its box, above the site name, and cuts a very long one', async () => {
    const long = Array.from({ length: 40 }, (_, index) => `word${index}`).join(' ')
    const card = await renderSocialCard({ ...STYLE, title: long })
    // Between the foot of the title box (110 + 330) and the site name (520) nothing is drawn
    expect(await inkBox(card, STYLE.surface, 445, 515)).toBeNull()
    const title = await inkBox(card, STYLE.surface, 100, 445)
    expect(title!.right).toBeLessThanOrEqual(SOCIAL_CARD_WIDTH - 96)
    const small = await inkBox(await renderSocialCard({ ...STYLE, title: 'Hi' }), STYLE.surface, 100, 445)
    // A short title does not grow to fill the box: one line at the largest size
    expect(small!.bottom - small!.top).toBeLessThan(140)
  })

  it('draws a title that holds markup, an ampersand or control characters as plain text', async () => {
    const hostile = '</span><span foreground="#ff0000">Red & <b>bold</b>\u0000\u0007 Ñandú'
    const card = await renderSocialCard({ ...STYLE, title: hostile, siteName: '<span foreground="#00ff00">x</span>' })
    const { data, width, height } = await pixels(card)
    let loud = 0
    for (let index = 0; index < width * height; index++) {
      const [r, g, b] = [data[index * 3]!, data[index * 3 + 1]!, data[index * 3 + 2]!]
      if ((r === 255 && g === 0 && b === 0) || (r === 0 && g === 255 && b === 0)) loud++
    }
    expect(loud).toBe(0)
    expect(await inkBox(card, STYLE.surface, 100, 450)).not.toBeNull()
  })

  it('refuses a colour that is not #rrggbb, so no value of a theme or a site reaches the markup', async () => {
    await expect(renderSocialCard({ ...STYLE, accent: '#f00" size="1' })).rejects.toThrow(TypeError)
    await expect(renderSocialCard({ ...STYLE, ink: 'red' })).rejects.toThrow(TypeError)
    await expect(renderSocialCard({ ...STYLE, surface: '#fff' })).rejects.toThrow(TypeError)
  })

  it('draws each file in its own face whatever was drawn before, even when two files share a family name', async () => {
    // @ts-expect-error -- wawoff2 ships no types
    const { decompress } = (await import('wawoff2')) as unknown as { decompress: (file: Uint8Array) => Promise<Uint8Array> }
    // Space Grotesk's glyphs under the name Archivo's file carries: libvips would draw both as whichever it registered first
    const twin = renameFontFamily(await decompress(SPACE_GROTESK), 'Archivo SemiBold')
    const title = 'Hamburgefonstiv'
    const archivo = await renderSocialCard({ ...STYLE, title, fontFile: ARCHIVO })
    const space = await renderSocialCard({ ...STYLE, title, fontFile: SPACE_GROTESK })
    const twinCard = await renderSocialCard({ ...STYLE, title, fontFile: twin })
    const archivoAgain = await renderSocialCard({ ...STYLE, title, fontFile: ARCHIVO })
    const frauncesAfter = await renderSocialCard({ ...STYLE, title })
    expect(Buffer.compare(twinCard, archivo)).not.toBe(0)
    expect(Buffer.compare(twinCard, space)).toBe(0)
    expect(Buffer.compare(archivoAgain, archivo)).toBe(0)
    expect(Buffer.compare(space, archivo)).not.toBe(0)
    expect(Buffer.compare(frauncesAfter, archivo)).not.toBe(0)
    expect(Buffer.compare(frauncesAfter, space)).not.toBe(0)
    const archivoBox = await inkBox(archivo, STYLE.surface, 100, 445)
    const spaceBox = await inkBox(space, STYLE.surface, 100, 445)
    expect(spaceBox!.right - spaceBox!.left).not.toBe(archivoBox!.right - archivoBox!.left)
  })

  describe('renameFontFamily', () => {
    /** A font file that holds one `name` table of the records given, and nothing else. */
    function fontWith(records: Array<[platform: number, id: number, text: string]>): Uint8Array {
      const strings = records.map(([platform, , text]) => platform === 3 ? Buffer.from(text, 'utf16le').swap16() : Buffer.from(text, 'latin1'))
      const header = Buffer.alloc(6 + records.length * 12)
      header.writeUInt16BE(records.length, 2)
      header.writeUInt16BE(header.length, 4)
      let offset = 0
      records.forEach(([platform, id], index) => {
        header.writeUInt16BE(platform, 6 + index * 12)
        header.writeUInt16BE(id, 6 + index * 12 + 6)
        header.writeUInt16BE(strings[index]!.length, 6 + index * 12 + 8)
        header.writeUInt16BE(offset, 6 + index * 12 + 10)
        offset += strings[index]!.length
      })
      const table = Buffer.concat([header, ...strings])
      const sfnt = Buffer.alloc(12 + 16)
      sfnt.writeUInt16BE(1, 4)
      sfnt.write('name', 12, 'latin1')
      sfnt.writeUInt32BE(sfnt.length, 12 + 8)
      sfnt.writeUInt32BE(table.length, 12 + 12)
      return Buffer.concat([sfnt, table])
    }

    /** The `name` records of a font as `platform:id` to text, read through the table directory. */
    function namesOf(font: Uint8Array): Record<string, string> {
      const file = Buffer.from(font)
      const table = file.readUInt32BE(12 + 8)
      const strings = table + file.readUInt16BE(table + 4)
      return Object.fromEntries(Array.from({ length: file.readUInt16BE(table + 2) }, (_, index) => {
        const at = table + 6 + index * 12
        const raw = file.subarray(strings + file.readUInt16BE(at + 10), strings + file.readUInt16BE(at + 10) + file.readUInt16BE(at + 8))
        return [`${file.readUInt16BE(at)}:${file.readUInt16BE(at + 6)}`, file.readUInt16BE(at) === 3 ? Buffer.from(raw).swap16().toString('utf16le') : raw.toString('latin1')]
      }))
    }

    it('gives the family and the typographic family the new name and keeps every other record', () => {
      const renamed = renameFontFamily(fontWith([[3, 1, 'Plain Light'], [3, 2, 'Regular'], [3, 4, 'Plain Light Regular'], [3, 16, 'Plain'], [3, 17, 'Light'], [1, 1, 'Plain Light']]), 'Unique')
      expect(namesOf(renamed)).toEqual({ '1:1': 'Unique', '3:1': 'Unique', '3:2': 'Regular', '3:4': 'Plain Light Regular', '3:16': 'Unique', '3:17': 'Light' })
    })

    it('adds a family when the file has none, and refuses a file with no name table or a collection', () => {
      expect(namesOf(renameFontFamily(fontWith([[3, 2, 'Regular']]), 'Unique'))).toEqual({ '3:1': 'Unique', '3:2': 'Regular' })
      expect(() => renameFontFamily(new Uint8Array(4), 'Unique')).toThrow('no name table')
      expect(() => renameFontFamily(Buffer.from('ttcf\0\x01\0\0\0\0\0\x01rest-of-a-collection'), 'Unique')).toThrow('no name table')
      expect(() => renameFontFamily(Buffer.alloc(40), 'Unique')).toThrow('no name table')
    })
  })

  it('refuses a font file it cannot read, rather than draw in another font', async () => {
    await expect(renderSocialCard({ ...STYLE, fontFile: new Uint8Array([0x77, 0x4F, 0x46, 0x32, 1, 2, 3, 4]) })).rejects.toThrow()
  })

  it('makes no request to the network: it opens no socket and calls no fetch', async () => {
    const connect = vi.spyOn(Socket.prototype, 'connect')
    const fetched = vi.spyOn(globalThis, 'fetch')
    try {
      // A new title and font, so nothing comes from a memory of an earlier test
      await renderSocialCard({ ...STYLE, title: 'No network at render time', fontFile: ARCHIVO })
      expect(connect).not.toHaveBeenCalled()
      expect(fetched).not.toHaveBeenCalled()
    } finally {
      connect.mockRestore()
      fetched.mockRestore()
    }
  })
})

describe('cardText', () => {
  it('drops control and zero-width characters and collapses white space, so a title of nothing is empty', () => {
    expect(cardText('  Two\u0000  words\u200B\n ')).toBe('Two words')
    for (const empty of ['', '   ', '\u0001\u0002', '\u200B\u200C\u200D', '\u2060\uFEFF', ' \t\n', '\u200E', '\u00AD', '\u202A\u202C']) expect(cardText(empty), JSON.stringify(empty)).toBe('')
  })
})

describe('createCardCache', () => {
  const png = (label: string): Buffer => Buffer.from(label)

  it('draws a card once per key within its time, and again when the key changes or the time is over', async () => {
    let clock = 1000
    const render = vi.fn(async (style: SocialCardStyle) => png(style.title))
    const draw = createCardCache({ ttlMs: 60_000, max: 10, render, now: () => clock })
    const first = await draw('page:doc:en:v1', STYLE)
    expect(await draw('page:doc:en:v1', STYLE)).toBe(first)
    expect(render).toHaveBeenCalledTimes(1)
    await draw('page:doc:en:v2', STYLE)
    expect(render).toHaveBeenCalledTimes(2)
    clock += 60_001
    await draw('page:doc:en:v1', STYLE)
    expect(render).toHaveBeenCalledTimes(3)
  })

  it('shares a card in progress between the requests that ask for it', async () => {
    const render = vi.fn(async () => png('x'))
    const draw = createCardCache({ ttlMs: 60_000, max: 10, render })
    await Promise.all([draw('k', STYLE), draw('k', STYLE), draw('k', STYLE)])
    expect(render).toHaveBeenCalledTimes(1)
  })

  it('forgets a render that failed, and tells the caller', async () => {
    const render = vi.fn<(style: SocialCardStyle) => Promise<Buffer>>().mockRejectedValueOnce(new Error('no font')).mockResolvedValue(png('ok'))
    const draw = createCardCache({ ttlMs: 60_000, max: 10, render })
    await expect(draw('k', STYLE)).rejects.toThrow('no font')
    expect((await draw('k', STYLE)).toString()).toBe('ok')
    expect(render).toHaveBeenCalledTimes(2)
  })

  it('keeps at most `max` cards, the oldest going first', async () => {
    const render = vi.fn(async () => png('x'))
    const draw = createCardCache({ ttlMs: 60_000, max: 2, render })
    await draw('a', STYLE)
    await draw('b', STYLE)
    await draw('c', STYLE)
    expect(render).toHaveBeenCalledTimes(3)
    await draw('b', STYLE)
    await draw('c', STYLE)
    expect(render).toHaveBeenCalledTimes(3)
    await draw('a', STYLE)
    expect(render).toHaveBeenCalledTimes(4)
  })
})
