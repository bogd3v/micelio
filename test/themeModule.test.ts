import { describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { discoverThemes, selectTheme, themeRoots } from '../modules/theme/themes'
import { REGION_VARIANTS, alternateVariants, registerAlternates, registerVariants } from '../modules/theme/layout/variants'
import { LAYOUT_REGIONS } from '../modules/theme/constants'
import type { LayoutRegion, ThemeContext } from '../modules/theme/types'
import { themeMismatch } from '../app/helpers/runtimeConfig'

function theme(root: string, folder: string, manifest: object = { id: folder }): void {
  mkdirSync(join(root, folder), { recursive: true })
  writeFileSync(join(root, folder, 'theme.json'), JSON.stringify(manifest))
}

function tmp(): string {
  return mkdtempSync(join(tmpdir(), 'myc-themes-'))
}

describe('theme validation at discovery', () => {
  it('rejects an id that is not lowercase letters, digits and dashes', () => {
    const root = tmp()
    theme(root, 'Bad_Id')
    expect(() => discoverThemes([root])).toThrow(/"id" must match/)
  })

  it.each(['myc', 'micelio', 'bd'])('rejects the reserved id "%s"', (id) => {
    const root = tmp()
    theme(root, id)
    expect(() => discoverThemes([root])).toThrow(/is reserved/)
  })

  it('rejects an id different from the folder name', () => {
    const root = tmp()
    theme(root, 'folder', { id: 'other' })
    expect(() => discoverThemes([root])).toThrow(/"other".*"folder"/)
  })

  it('rejects the same id in two roots, naming both paths', () => {
    const a = tmp()
    const b = tmp()
    theme(a, 'twin')
    theme(b, 'twin')
    expect(() => discoverThemes([a, b])).toThrow(`twice: ${join(a, 'twin')} and ${join(b, 'twin')}`)
  })

  it('names the file when theme.json is not valid JSON', () => {
    const root = tmp()
    mkdirSync(join(root, 'broken'))
    writeFileSync(join(root, 'broken', 'theme.json'), '{ nope')
    expect(() => discoverThemes([root])).toThrow(`Cannot read ${join(root, 'broken', 'theme.json')}`)
  })

  it('rejects font files that are not plain .woff2 names', () => {
    const root = tmp()
    theme(root, 'fonty', { id: 'fonty', fonts: [{ family: 'X', file: '../x.woff2' }] })
    expect(() => discoverThemes([root])).toThrow('font file "../x.woff2"')
    const other = tmp()
    theme(other, 'fonty2', { id: 'fonty2', fonts: [{ family: 'X', file: 'x.woff' }] })
    expect(() => discoverThemes([other])).toThrow(/must match/)
  })
})

describe('theme discovery', () => {
  it('finds the themes of the repository and of MICELIO_THEME_DIRS', () => {
    const extra = mkdtempSync(join(tmpdir(), 'myc-themes-'))
    theme(extra, 'minimal')
    const ids = discoverThemes(themeRoots(process.cwd(), extra)).map(found => found.id)
    expect(ids).toEqual(['bogota', 'starter', 'minimal'])
  })

  it('accepts a directory that is itself a theme, and skips missing ones', () => {
    const extra = mkdtempSync(join(tmpdir(), 'myc-themes-'))
    theme(extra, 'inner')
    expect(discoverThemes([join(extra, 'inner'), join(extra, 'missing')]).map(found => found.id)).toEqual(['inner'])
  })

  it('selects an installed theme', () => {
    expect(selectTheme(discoverThemes(themeRoots(process.cwd(), '')), 'bogota').id).toBe('bogota')
  })

  it('fails naming the missing theme and the installed ones', () => {
    const installed = discoverThemes(themeRoots(process.cwd(), ''))
    expect(() => selectTheme(installed, 'nope')).toThrow(/"nope".*not installed.*bogota/)
  })
})

describe('themeMismatch', () => {
  it('is null when the runtime theme is the one of the build', () => {
    expect(themeMismatch({ public: { theme: 'bogota' } }, 'bogota')).toBeNull()
  })

  it('names both themes when they differ or the runtime has none', () => {
    expect(themeMismatch({ public: { theme: 'other' } }, 'bogota')).toMatch(/"other".*"bogota"/)
    expect(themeMismatch({}, 'bogota')).toMatch(/"undefined"/)
    expect(themeMismatch({ public: { theme: '  ' } }, 'bogota')).toMatch(/"undefined"/)
    expect(themeMismatch({ public: { theme: ' bogota ' } }, 'bogota')).toBeNull()
  })
})

describe('registerVariants', () => {
  function setup(layout: Record<string, string> | undefined, regions?: LayoutRegion[]): ThemeContext {
    const ctx = {
      nuxt: { options: { srcDir: '/app' } },
      load: () => ({ manifest: { id: 'x', layout } }),
      layoutCss: Object.fromEntries(LAYOUT_REGIONS.map(region => [region, []])),
      components: [],
    } as unknown as ThemeContext
    registerVariants(ctx, regions)
    return ctx
  }

  it('registers the component and CSS of each region\'s first variant when the theme names none', () => {
    const { components, layoutCss } = setup(undefined)
    expect(components).toEqual([
      { name: 'RegionHeader', filePath: join('/app', 'theme/layout/header/Bar.vue') },
      { name: 'RegionHome', filePath: join('/app', 'theme/layout/home/Showcase.vue') },
      { name: 'RegionPostList', filePath: join('/app', 'theme/layout/postList/Grid.vue') },
      { name: 'RegionArticle', filePath: join('/app', 'theme/layout/article/Aside.vue') },
      { name: 'RegionFooter', filePath: join('/app', 'theme/layout/footer/Columns.vue') },
    ])
    expect(layoutCss.header[0]!()).toBe(`@import "${join('/app', 'theme/layout/header/bar.css')}";`)
    expect(layoutCss.footer[0]!()).toBe(`@import "${join('/app', 'theme/layout/footer/columns.css')}";`)
    expect(layoutCss.home[0]!()).toBe(`@import "${join('/app', 'theme/layout/home/showcase.css')}";`)
  })

  it('registers only the regions it is given, with the variant the theme chose', () => {
    const { components } = setup({ home: 'showcase' }, ['home'])
    expect(components).toEqual([{ name: 'RegionHome', filePath: join('/app', 'theme/layout/home/Showcase.vue') }])
  })

  it('has a component name and at least one variant for every region', () => {
    for (const region of LAYOUT_REGIONS) {
      expect(REGION_VARIANTS[region].component).toMatch(/^Region[A-Z]/)
      expect(REGION_VARIANTS[region].variants.length).toBeGreaterThan(0)
    }
  })
})

describe('registerAlternates', () => {
  function setup(layout: Record<string, string> | undefined): ThemeContext {
    const ctx = {
      nuxt: { options: { srcDir: '/app' } },
      load: () => ({ manifest: { id: 'x', layout } }),
      layoutCss: Object.fromEntries(LAYOUT_REGIONS.map(region => [region, []])),
      components: [],
    } as unknown as ThemeContext
    registerVariants(ctx)
    registerAlternates(ctx)
    return ctx
  }

  it('registers every variant the theme does not use as a global component under its own name', () => {
    const { components } = setup(undefined)
    expect(components.filter(component => component.global)).toEqual([
      { name: 'RegionHeaderCentered', filePath: join('/app', 'theme/layout/header/Centered.vue'), global: true },
      { name: 'RegionHomeIndex', filePath: join('/app', 'theme/layout/home/Index.vue'), global: true },
      { name: 'RegionPostListList', filePath: join('/app', 'theme/layout/postList/List.vue'), global: true },
      { name: 'RegionArticleCentered', filePath: join('/app', 'theme/layout/article/Centered.vue'), global: true },
      { name: 'RegionFooterMinimal', filePath: join('/app', 'theme/layout/footer/Minimal.vue'), global: true },
    ])
    expect(components.filter(component => !component.global).map(component => component.name)).toEqual(['RegionHeader', 'RegionHome', 'RegionPostList', 'RegionArticle', 'RegionFooter'])
  })

  it('registers the default variant as the alternate when the theme uses the other one', () => {
    const { components } = setup({ header: 'centered', footer: 'minimal' })
    expect(components.filter(component => component.global).map(component => component.name)).toEqual(['RegionHeaderBar', 'RegionHomeIndex', 'RegionPostListList', 'RegionArticleCentered', 'RegionFooterColumns'])
    expect(components.find(component => component.name === 'RegionHeader')!.filePath).toBe(join('/app', 'theme/layout/header/Centered.vue'))
  })

  it('imports the alternates before the active variant, so the active :root and html rules win', () => {
    const { layoutCss } = setup(undefined)
    expect(layoutCss.header.map(source => source())).toEqual([
      `@import "${join('/app', 'theme/layout/header/centered.css')}";`,
      `@import "${join('/app', 'theme/layout/header/bar.css')}";`,
    ])
    expect(layoutCss.footer.map(source => source())).toEqual([
      `@import "${join('/app', 'theme/layout/footer/minimal.css')}";`,
      `@import "${join('/app', 'theme/layout/footer/columns.css')}";`,
    ])
  })

  it('lists the alternates for the specimen', () => {
    const ctx = { load: () => ({ manifest: { id: 'x', layout: { header: 'centered' } } }) } as unknown as ThemeContext
    expect(alternateVariants(ctx)).toEqual([
      { region: 'header', variant: 'bar', component: 'RegionHeaderBar' },
      { region: 'home', variant: 'index', component: 'RegionHomeIndex' },
      { region: 'postList', variant: 'list', component: 'RegionPostListList' },
      { region: 'article', variant: 'centered', component: 'RegionArticleCentered' },
      { region: 'footer', variant: 'minimal', component: 'RegionFooterMinimal' },
    ])
  })

  it('registers nothing without the specimen flag (setupLayout)', async () => {
    const { setupLayout } = await import('../modules/theme/layout')
    const make = (dev: boolean): ThemeContext => ({
      nuxt: { options: { srcDir: '/app', dev } },
      load: () => ({ manifest: { id: 'x' } }),
      layoutCss: Object.fromEntries(LAYOUT_REGIONS.map(region => [region, []])),
      components: [],
    }) as unknown as ThemeContext
    const previous = process.env.MICELIO_SPECIMEN
    delete process.env.MICELIO_SPECIMEN
    try {
      const plain = make(false)
      setupLayout(plain)
      expect(plain.components.some(component => component.global)).toBe(false)
      expect(plain.layoutCss.header).toHaveLength(1)
      process.env.MICELIO_SPECIMEN = '1'
      const specimen = make(false)
      setupLayout(specimen)
      expect(specimen.components.filter(component => component.global)).toHaveLength(5)
    } finally {
      if (previous === undefined) delete process.env.MICELIO_SPECIMEN
      else process.env.MICELIO_SPECIMEN = previous
    }
  })
})
