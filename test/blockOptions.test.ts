import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ARTICLE_BLOCK_UIDS } from '../app/constants/block-options'
import { BLOCK_EXPOSES, BLOCK_OPTIONS, BLOCK_OPTION_NAMES } from '../app/interfaces/block-options'
import { exposedOptions, optionAttributes, optionValues, parseOption } from '../app/helpers/blockOptions'
import { PAGE_SECTION_COMPONENTS } from '../app/interfaces'
import { pageSectionSchema } from '../app/schemas/pages'
import { publicAbout, publicArticle } from '../server/lib/publicShapes'
import type { RawStrapiArticle, StrapiAbout } from '../app/interfaces'
import { parseSection } from '../server/schemas/page'
import { CONTRACT_ADDITIONS, CONTRACT_VERSION } from '../modules/theme/constants'
import hooks from '../app/theme/hooks.json'

const read = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const context = { render: (markdown: string): string => `<p>${markdown}</p>`, siteUrl: 'https://site.test/', mediaOrigins: [] }
const image = { url: '/uploads/a.png', width: 800, height: 600, mime: 'image/png' }

describe('the vocabulary', () => {
  // The copy of contract/options.ts of micelio-plugin-core (docs/blocks.md there): names, values, order and defaults
  it('is the plugin\'s: eight names, their values in order and their defaults', () => {
    expect(Object.fromEntries(BLOCK_OPTION_NAMES.map(name => [name, [BLOCK_OPTIONS[name].values, BLOCK_OPTIONS[name].default]]))).toEqual({
      layout: [['centered', 'split', 'stacked'], 'centered'],
      width: [['prose', 'wide', 'full'], 'prose'],
      columns: [['2', '3', '4', '6'], '3'],
      density: [['comfortable', 'compact'], 'comfortable'],
      align: [['start', 'center'], 'start'],
      tone: [['default', 'raised', 'accent'], 'default'],
      ratio: [['16:9', '4:3', '1:1', 'auto'], '16:9'],
      height: [['s', 'm', 'l', 'full'], 'm'],
    })
  })

  it('has every default among its values', () => {
    for (const name of BLOCK_OPTION_NAMES) expect(BLOCK_OPTIONS[name].values).toContain(BLOCK_OPTIONS[name].default)
  })

  it('assigns options to every section of the catalog and to the four article blocks', () => {
    expect(Object.keys(BLOCK_EXPOSES)).toEqual([...PAGE_SECTION_COMPONENTS.map(name => `section.${name}`), ...ARTICLE_BLOCK_UIDS])
  })

  it('offers align and tone on all fourteen page sections', () => {
    expect(PAGE_SECTION_COMPONENTS).toHaveLength(14)
    for (const name of PAGE_SECTION_COMPONENTS) expect(exposedOptions(`section.${name}`), name).toEqual(expect.arrayContaining(['align', 'tone']))
    for (const name of PAGE_SECTION_COMPONENTS) {
      expect([parseOption(`section.${name}`, 'align', 'center'), parseOption(`section.${name}`, 'tone', 'raised'), parseOption(`section.${name}`, 'tone', 'accent')], name).toEqual(['center', 'raised', 'accent'])
      // Strapi answers null for an option a stored section never saved: the default, so nothing
      expect([parseOption(`section.${name}`, 'align', null), parseOption(`section.${name}`, 'tone', null)], name).toEqual([undefined, undefined])
    }
  })

  it('withholds `width: full` from the article blocks and `columns: 6` from all but logo-cloud', () => {
    expect(optionValues('shared.media', 'width')).toEqual(['prose', 'wide'])
    expect(optionValues('shared.quote', 'width')).toEqual(['prose', 'wide'])
    expect(optionValues('section.gallery', 'width')).toEqual(['prose', 'wide', 'full'])
    expect(optionValues('section.logo-cloud', 'columns')).toEqual(['2', '3', '4', '6'])
    expect(optionValues('section.feature-grid', 'columns')).toEqual(['2', '3', '4'])
  })
})

describe('optionAttributes', () => {
  it('writes the options a block carries as data-<name>', () => {
    expect(optionAttributes({ __component: 'section.hero', layout: 'split', tone: 'accent', height: 'l', title: 'x' })).toEqual({ 'data-layout': 'split', 'data-tone': 'accent', 'data-height': 'l' })
  })

  it('writes nothing for an absent, null or non-string option', () => {
    expect(optionAttributes({ __component: 'section.feature-grid' })).toEqual({})
    expect(optionAttributes({ __component: 'section.feature-grid', columns: null, density: undefined, tone: 3 })).toEqual({})
  })

  it('reads the eight names of the vocabulary, in its order', () => {
    expect(BLOCK_OPTION_NAMES).toEqual(Object.keys(BLOCK_OPTIONS))
  })
})

describe('parseOption', () => {
  it('reads a number as its string', () => {
    expect(parseOption('section.feature-grid', 'columns', 2)).toBe('2')
    expect(parseOption('section.feature-grid', 'columns', '3')).toBe('3')
  })

  it('refuses a value the block does not offer', () => {
    expect(parseOption('section.feature-grid', 'columns', '6')).toBeUndefined()
    expect(parseOption('section.feature-grid', 'density', 'tight')).toBeUndefined()
    expect(parseOption('shared.media', 'width', 'full')).toBeUndefined()
    expect(parseOption('section.feature-grid', 'columns', 3.5)).toBeUndefined()
    expect(parseOption('section.feature-grid', 'columns', null)).toBeUndefined()
  })

  it('refuses an option the block does not expose', () => {
    expect(parseOption('section.faq', 'columns', '3')).toBeUndefined()
    expect(parseOption('shared.rich-text', 'width', 'wide')).toBeUndefined()
  })

  it('knows nothing of a component outside the catalog, even for an inherited key', () => {
    expect(exposedOptions('about.profile')).toEqual([])
    expect(exposedOptions('constructor')).toEqual([])
    expect(parseOption('toString', 'width', 'wide')).toBeUndefined()
  })

  it('cannot carry markup through a value', () => {
    expect(parseOption('section.hero', 'layout', '"><script>')).toBeUndefined()
  })
})

describe('the page route', () => {
  it('keeps the options a section exposes, as strings, and drops the rest', () => {
    const parsed = parseSection({ __component: 'section.feature-grid', variant: 'grid', columns: 2, density: 'tight', ratio: '4:3', items: [{ title: 'One' }] }, context)
    expect(parsed).toMatchObject({ columns: '2' })
    expect(parsed).not.toHaveProperty('ratio')
    expect(parsed).not.toHaveProperty('density', 'tight')
    expect(parseSection({ __component: 'section.feature-grid', variant: 'grid', columns: '6', items: [{ title: 'One' }] }, context)).not.toHaveProperty('columns', '6')
    expect(parseSection({ __component: 'section.logo-cloud', variant: 'row', columns: '6', logos: [{ image, name: 'Seeds' }] }, context)).toMatchObject({ columns: '6' })
  })

  it('keeps them through the sections that rebuild their data', () => {
    expect(parseSection({ __component: 'section.rich-text', body: 'Hi', width: 'wide' }, context)).toEqual({ __component: 'section.rich-text', width: 'wide', html: '<p>Hi</p>' })
    expect(parseSection({ __component: 'section.media-showcase', variant: 'left', ratio: '1:1', media: image }, context)).toMatchObject({ ratio: '1:1' })
    expect(parseSection({ __component: 'section.post-list', variant: 'cards', density: 'compact', count: 3 }, context)).toMatchObject({ density: 'compact' })
  })

  it('treats null, which Strapi sends for an option never set, as absent', () => {
    expect(parseSection({ __component: 'section.cta', variant: 'card', title: 'Go', layout: null, align: null, tone: null }, context)).toMatchObject({ title: 'Go' })
  })

  it('answers with the options inside the published response schema', () => {
    const section = parseSection({ __component: 'section.stats', variant: 'row', columns: '4', align: 'center', items: [{ value: '1', label: 'a' }] }, context)
    expect(pageSectionSchema.safeParse(section).success).toBe(true)
    expect(pageSectionSchema.safeParse({ ...section, columns: '5' }).success).toBe(false)
    expect(pageSectionSchema.safeParse({ ...section, columns: undefined }).success).toBe(true)
  })
})

describe('the article and About routes', () => {
  const blocks = [
    { id: 1, __component: 'shared.quote', body: 'q', width: 'wide', align: 'center', tone: 'accent' },
    { id: 2, __component: 'shared.media', file: null, ratio: '4:3', width: null },
    { id: 3, __component: 'shared.slider', ratio: '1:1' },
    { id: 4, __component: 'shared.playground', runtime: 'sql', code: 'select 1', height: 's' },
    { id: 5, __component: 'shared.media', file: null, width: 'full', ratio: 2 },
  ]

  it('lets through the options of an article block, as valid strings, and nothing else', () => {
    expect((publicArticle({ id: 1, blocks } as unknown as RawStrapiArticle)).blocks).toEqual([
      { id: 1, __component: 'shared.quote', body: 'q', width: 'wide', align: 'center' },
      { id: 2, __component: 'shared.media', file: null, ratio: '4:3' },
      { id: 3, __component: 'shared.slider', ratio: '1:1' },
      { id: 4, __component: 'shared.playground', runtime: 'sql', code: 'select 1', height: 's' },
      { id: 5, __component: 'shared.media', file: null },
    ])
  })

  it('does the same for the blocks of the About page', () => {
    expect(publicAbout({ id: 1, blocks: blocks.slice(0, 2) } as unknown as StrapiAbout).blocks).toEqual([
      { id: 1, __component: 'shared.quote', body: 'q', width: 'wide', align: 'center' },
      { id: 2, __component: 'shared.media', file: null, ratio: '4:3' },
    ])
  })
})

describe('the instance ids of the article and About blocks', () => {
  const blocks = [
    { id: 1, __component: 'shared.rich-text', blockId: 'b-1', body: 'x' },
    { id: 2, __component: 'shared.quote', blockId: 'b-2', body: 'q' },
    { id: 3, __component: 'shared.media', blockId: 'b-3', file: null },
    { id: 4, __component: 'shared.slider', blockId: 'b-4', items: [{ id: 1, itemId: 'i-1', file: { url: '/uploads/a.png' }, secret: 'x' }] },
    { id: 5, __component: 'shared.playground', blockId: null, runtime: 'sql', code: 'select 1' },
  ]

  it('lets through the blockId of a block and the itemId of a slide', () => {
    const kept = publicArticle({ id: 1, blocks } as unknown as RawStrapiArticle).blocks as unknown as Array<Record<string, unknown>>
    expect(kept.map(block => block.blockId)).toEqual(['b-1', 'b-2', 'b-3', 'b-4', null])
    expect((kept[3]!.items as Array<Record<string, unknown>>)[0]).toEqual({ id: 1, itemId: 'i-1', file: { url: '/uploads/a.png' } })
    expect((publicAbout({ id: 1, blocks: blocks.slice(0, 2) } as unknown as StrapiAbout).blocks as unknown as Array<Record<string, unknown>>).map(block => block.blockId)).toEqual(['b-1', 'b-2'])
  })
})

describe('the theme contract', () => {
  const attributes = hooks.attributes as unknown as Record<string, { values: string[] }>

  it('implements 2.2 and names the seven new hooks as the additions of 2.1', () => {
    expect(CONTRACT_VERSION).toEqual({ major: 2, minor: 2 })
    expect(CONTRACT_ADDITIONS.filter(addition => addition.minor === 1 && addition.kind === 'hook').map(addition => addition.name).sort())
      .toEqual(BLOCK_OPTION_NAMES.filter(name => name !== 'layout').map(name => `data-${name}`).sort())
  })

  it('lists every value of every option under its data attribute', () => {
    for (const name of BLOCK_OPTION_NAMES) {
      const listed = attributes[`data-${name}`]!.values
      for (const value of BLOCK_OPTIONS[name].values) expect(listed, `data-${name}`).toContain(value)
    }
  })

  // An option value without a rule renders as nothing, and the default value must have none: Strapi stores it on a new entry and that
  // block looks as it does today (the browser specs compare a stored default with an absent attribute)
  it('gives each non-default value a rule in the core CSS unless it keeps the block\'s own look, and the default none', () => {
    const css = [read('app/assets/css/components/section-options.css'), read('app/assets/css/components/block-options.css')].join('\n')
    const selectors = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/:not\([^)]*\)/g, '')
    // Values that render the block's own look: no rule, on purpose or not yet (the follow-up of #731): stacked, and height on a hero and a scene
    // (a playground's `l` and `full` have one)
    const NO_RULE: Record<string, string[]> = { layout: ['stacked'], height: ['s'], width: [] }
    // `data-height` has no rule on a section: the only ones are the playground's
    expect(read('app/assets/css/components/section-options.css').replace(/\/\*[\s\S]*?\*\//g, ''), 'data-height in section-options.css').not.toContain('data-height')
    for (const name of BLOCK_OPTION_NAMES) {
      for (const value of BLOCK_OPTIONS[name].values) {
        if (value === BLOCK_OPTIONS[name].default) expect(selectors, `[data-${name}="${value}"]`).not.toContain(`[data-${name}="${value}"]`)
        else if (NO_RULE[name]?.includes(value)) expect(selectors, `[data-${name}="${value}"]`).not.toContain(`[data-${name}="${value}"]`)
        else expect(css, `[data-${name}="${value}"]`).toContain(`[data-${name}="${value}"]`)
      }
    }
  })

  // `blockquote.myc-quote` is the quote's own rule (0,1,1); the option must out-rank it, because the inlined rules come before it in the entry
  it('out-ranks the quote\'s own rule and scopes the playground\'s height to its block', () => {
    const css = read('app/assets/css/components/block-options.css')
    expect(css).toContain('blockquote.myc-quote[data-align="center"]')
    for (const value of ['l', 'full']) expect(css).toContain(`.myc-playground[data-height="${value}"]`)
    // `s` has no rule: a playground is as tall as its code, so a floor under it would never make it smaller
    expect(css).not.toContain('.myc-playground[data-height="s"]')
  })

  it('loads the rules of the article blocks with their renderer, not on every page', () => {
    expect(read('app/components/strapi/BlocksRenderer.vue')).toContain('@import "~/assets/css/components/block-options.css" layer(myc.components);')
    expect(read('app/assets/css/main.css')).not.toContain('block-options.css')
  })

  // An inlined style that names a layer before the entry's order statement would put that layer first (the sections' renderer does the same)
  it.each(['app/components/strapi/BlocksRenderer.vue', 'app/components/section/SectionRenderer.vue'])('declares the layer order before the first @import in %s', (path) => {
    const order = read('app/assets/css/main.css').split('\n')[0]!
    const style = read(path).slice(read(path).indexOf('<style>'))
    expect(style.indexOf(order)).toBeGreaterThan(-1)
    expect(style.indexOf(order)).toBeLessThan(style.indexOf('@import'))
  })

  it('loads the sections\' option rules after the rules they override', () => {
    const renderer = read('app/components/section/SectionRenderer.vue')
    const imports = [...renderer.matchAll(/@import "~\/assets\/css\/components\/([a-z-]+)\.css"/g)].map(match => match[1])
    expect(imports.at(-1)).toBe('section-options')
  })
})
