import { describe, it, expect } from 'vitest'
import { creditParts, figureNumbers, formatFigureNumber, licenseInfo, mediaCaption, slidesOf } from '../app/helpers/figures'
import type { StrapiBlock, StrapiImageCredit, StrapiMedia, StrapiSlider } from '../app/interfaces/strapi-blocks'

const sumapaz: StrapiImageCredit = {
  kind: 'photo',
  author: 'Danielfjio',
  authorUrl: 'https://commons.wikimedia.org/wiki/User:Danielfjio',
  source: 'Wikimedia Commons',
  sourceUrl: 'https://commons.wikimedia.org/wiki/File:Paisaje_Sumapaz,_Colombia.jpg',
  license: 'cc-by-sa-4.0',
  modifications: 'recortada',
}

const ownWork: StrapiImageCredit = { kind: 'illustration', author: 'Alejandro Ramírez', source: 'BogDev', license: 'own-work' }

describe('licenseInfo', () => {
  it('links Creative Commons licenses to the deed in the reader language', () => {
    expect(licenseInfo(sumapaz, 'es')).toEqual({ labelKey: 'ccBySa4', href: 'https://creativecommons.org/licenses/by-sa/4.0/deed.es' })
    expect(licenseInfo({ ...sumapaz, license: 'cc-by-4.0' }, 'en')).toEqual({ labelKey: 'ccBy4', href: 'https://creativecommons.org/licenses/by/4.0/deed.en' })
    expect(licenseInfo({ ...sumapaz, license: 'cc-by-nc-4.0' }, 'en').href).toBe('https://creativecommons.org/licenses/by-nc/4.0/deed.en')
    expect(licenseInfo({ ...sumapaz, license: 'cc0' }, 'es').href).toBe('https://creativecommons.org/publicdomain/zero/1.0/deed.es')
  })

  it('leaves own work unlinked even with a license URL', () => {
    expect(licenseInfo({ ...ownWork, licenseUrl: 'https://example.com/terms' }, 'es')).toEqual({ labelKey: 'ownWork', href: undefined })
  })

  it('uses the license URL for other licenses and Unsplash its own page', () => {
    expect(licenseInfo({ ...sumapaz, license: 'other', licenseUrl: 'https://example.com/terms' }, 'es')).toEqual({ labelKey: 'other', href: 'https://example.com/terms' })
    expect(licenseInfo({ ...sumapaz, license: 'other', licenseUrl: null }, 'es').href).toBeUndefined()
    expect(licenseInfo({ ...sumapaz, license: 'unsplash' }, 'es')).toEqual({ labelKey: 'unsplash', href: 'https://unsplash.com/license' })
    expect(licenseInfo({ ...sumapaz, license: 'permission' }, 'es')).toEqual({ labelKey: 'permission', href: undefined })
  })
})

describe('creditParts', () => {
  it('lists author, source, license and modifications with their links', () => {
    expect(creditParts(sumapaz, 'es')).toEqual([
      { role: 'author', text: 'Danielfjio', href: 'https://commons.wikimedia.org/wiki/User:Danielfjio' },
      { role: 'source', text: 'Wikimedia Commons', href: 'https://commons.wikimedia.org/wiki/File:Paisaje_Sumapaz,_Colombia.jpg' },
      { role: 'license', labelKey: 'ccBySa4', href: 'https://creativecommons.org/licenses/by-sa/4.0/deed.es' },
      { role: 'modifications', text: 'recortada' },
    ])
  })

  it('skips empty parts', () => {
    expect(creditParts({ kind: 'screenshot', author: '  ', source: null, license: 'permission', modifications: '' }, 'en')).toEqual([
      { role: 'license', labelKey: 'permission', href: undefined },
    ])
  })
})

describe('slidesOf', () => {
  it('prefers items and falls back to the legacy files', () => {
    const file = { url: '/a.jpg', caption: 'Library caption' }
    expect(slidesOf({ id: 1, __component: 'shared.slider', items: [{ file, caption: 'Own', credit: ownWork }], files: [file] })).toEqual([{ file, caption: 'Own', credit: ownWork }])
    expect(slidesOf({ id: 1, __component: 'shared.slider', items: [], files: [file] })).toEqual([{ file, caption: 'Library caption', credit: null }])
    expect(slidesOf({ id: 1, __component: 'shared.slider' })).toEqual([])
  })
})

describe('mediaCaption', () => {
  it('uses the block caption and falls back to the media library one', () => {
    const block: StrapiMedia = { id: 1, __component: 'shared.media', file: { url: '/a.jpg', caption: 'Library' } }
    expect(mediaCaption({ ...block, caption: 'Block' })).toBe('Block')
    expect(mediaCaption(block)).toBe('Library')
    expect(mediaCaption({ ...block, file: { url: '/a.jpg' } })).toBe('')
  })
})

describe('figureNumbers', () => {
  it('gives no number to a media block without a file', () => {
    const blocks = [
      { id: 1, __component: 'shared.media', file: null, caption: 'Lost' },
      { id: 2, __component: 'shared.media', file: { url: '/a.jpg' }, caption: 'Kept' },
    ] as StrapiBlock[]
    expect(figureNumbers(blocks)).toEqual({ 'shared.media-2': 1 })
  })

  it('numbers captioned figures in block order and counts a slider once', () => {
    const slider: StrapiSlider = {
      id: 4,
      __component: 'shared.slider',
      items: [{ file: { url: '/b.jpg' }, caption: 'One' }, { file: { url: '/c.jpg' }, credit: ownWork }],
    }
    const blocks = [
      { id: 1, __component: 'shared.media', file: { url: '/a.jpg' }, credit: sumapaz },
      { id: 2, __component: 'shared.rich-text', body: 'Text' },
      { id: 3, __component: 'shared.media', file: { url: '/bare.jpg' } },
      slider,
      { id: 5, __component: 'shared.media', file: { url: '/d.jpg' }, caption: 'Caption only' },
    ] as StrapiBlock[]
    expect(figureNumbers(blocks)).toEqual({ 'shared.media-1': 1, 'shared.slider-4': 2, 'shared.media-5': 3 })
  })

  it('pads the figure number to two digits', () => {
    expect(formatFigureNumber(2)).toBe('02')
    expect(formatFigureNumber(12)).toBe('12')
  })
})
