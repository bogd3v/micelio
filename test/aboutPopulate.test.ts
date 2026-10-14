import qs from 'qs'
import { describe, expect, it } from 'vitest'
import { ABOUT_POPULATE } from '../server/lib/constants'

const image = { fields: ['url', 'alternativeText', 'caption', 'width', 'height'] }

describe('ABOUT_POPULATE', () => {
  it('never asks Strapi to populate everything', () => {
    expect(qs.stringify({ populate: ABOUT_POPULATE })).not.toContain('*')
    expect(JSON.stringify(ABOUT_POPULATE)).not.toContain('"*"')
  })

  it('names the nested components of every about block', () => {
    const on = ABOUT_POPULATE.blocks.on
    expect(on['about.profile']).toEqual({ populate: { facts: true, links: true, photo: image } })
    expect(on['about.topics']).toEqual({ populate: { topics: true } })
    expect(on['about.projects']).toEqual({ populate: { projects: { populate: { facts: true, stack: true, links: true } } } })
    expect(on['about.principles']).toEqual({ populate: { principles: true } })
    expect(on['about.open-source']).toEqual({ populate: { guide: true } })
    expect(on['about.contact']).toEqual({ populate: { fediverseLink: true, extraLink: true, socials: true } })
  })

  it('asks only for the image fields a page reads and for the credit of every figure', () => {
    const on = ABOUT_POPULATE.blocks.on
    expect(on['shared.media']).toEqual({ populate: { file: image, credit: true } })
    expect(on['shared.slider']).toEqual({ populate: { items: { populate: { file: image, credit: true } }, files: image } })
    expect(ABOUT_POPULATE.seo).toEqual({ populate: { metaImage: image } })
  })
})
