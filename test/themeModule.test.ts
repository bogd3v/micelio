import { describe, expect, it, vi } from 'vitest'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createContext } from '../modules/theme/context'
import { DEFAULT_THEME, activeTheme, discoverThemes, selectTheme } from '../modules/theme/themes'
import { REGION_VARIANTS, readLayoutCss, regionVariantsModule, registerSpecimenVariants, registerVariants, specimenVariants, variantsWithoutPrefetch } from '../modules/theme/layout/variants'
import type { ManifestEntries } from '../modules/theme/prefetch'
import { LAYOUT_REGIONS } from '../modules/theme/constants'
import type { InstalledTheme, LayoutRegion, ThemeContext } from '../modules/theme/types'

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

  it.each(['myc', 'micelio'])('rejects the reserved id "%s"', (id) => {
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
    const ids = discoverThemes([join(process.cwd(), 'themes'), extra]).map(found => found.id)
    expect(ids).toEqual(['starter', 'minimal'])
  })

  it('accepts a directory that is itself a theme, and skips missing ones', () => {
    const extra = mkdtempSync(join(tmpdir(), 'myc-themes-'))
    theme(extra, 'inner')
    expect(discoverThemes([join(extra, 'inner'), join(extra, 'missing')]).map(found => found.id)).toEqual(['inner'])
  })

  it('selects an installed theme', () => {
    expect(selectTheme(discoverThemes([join(process.cwd(), 'themes')]), 'starter').id).toBe('starter')
  })

  it('fails naming the missing theme and the installed ones', () => {
    const installed = discoverThemes([join(process.cwd(), 'themes')])
    expect(() => selectTheme(installed, 'nope')).toThrow(/"nope".*not installed.*starter/)
  })
})

describe('the theme a build uses', () => {
  const installed = (...ids: string[]): InstalledTheme[] => ids.map(id => ({ id, dir: `/themes/${id}`, manifest: { id } }) as unknown as InstalledTheme)
  const build = { named: false, prepare: false, locked: [DEFAULT_THEME] }

  it('is bogota unless a theme is named, and the lock pins it', () => {
    expect(DEFAULT_THEME).toBe('bogota')
    expect(Object.keys(JSON.parse(readFileSync(join(process.cwd(), 'themes.lock.json'), 'utf8')) as object)).toContain(DEFAULT_THEME)
  })

  it('is the theme that was asked for when it is installed', () => {
    expect(activeTheme(installed('bogota', 'starter'), 'bogota', build).id).toBe('bogota')
    expect(activeTheme(installed('starter'), 'starter', { ...build, named: true }).id).toBe('starter')
  })

  it('tells a build whose locked default is not pulled to run theme:pull or to use the starter', () => {
    expect(() => activeTheme(installed('starter'), DEFAULT_THEME, build)).toThrow(
      'NUXT_PUBLIC_THEME is "bogota" but that theme is not installed (installed: starter). Add it to themes/ or to a directory in MICELIO_THEME_DIRS, or themes.lock.json pins it: run npm run theme:pull. Or work with the theme the core ships: NUXT_PUBLIC_THEME=starter.',
    )
  })

  it('tells a build whose default is not locked to run theme:add and then theme:pull', () => {
    expect(() => activeTheme(installed('starter'), DEFAULT_THEME, { ...build, locked: [] })).toThrow(/install it from the registry: npm run theme:add -- bogota, then npm run theme:pull\. Or work with .*NUXT_PUBLIC_THEME=starter/)
  })

  it('does not offer the starter when it is not installed', () => {
    expect(() => activeTheme(installed('minimal'), DEFAULT_THEME, build)).toThrow(/\(installed: minimal\)\..*theme:pull\.$/)
    expect(() => selectTheme([], 'x')).toThrow(/\(installed: none\)/)
  })

  it('lets nuxt prepare and type checks take the starter when nobody named a theme', () => {
    expect(activeTheme(installed('starter', 'minimal'), DEFAULT_THEME, { ...build, prepare: true }).id).toBe('starter')
    expect(activeTheme(installed('bogota', 'starter'), DEFAULT_THEME, { ...build, prepare: true }).id).toBe('bogota')
  })

  it('does not let a prepare replace a theme that was named, or one that no starter can stand in for', () => {
    expect(() => activeTheme(installed('starter'), 'bogota', { ...build, named: true, prepare: true })).toThrow(/"bogota" but that theme is not installed/)
    expect(() => activeTheme(installed('minimal'), DEFAULT_THEME, { ...build, prepare: true })).toThrow(/not installed/)
  })
})

describe('the context of a build without the default theme pulled', () => {
  // A checkout with the starter and the lock of this repository, which pins bogota, but no .micelio/themes/
  function checkout(): string {
    const root = tmp()
    cpSync(join(process.cwd(), 'themes/starter'), join(root, 'themes/starter'), { recursive: true })
    cpSync(join(process.cwd(), 'themes.lock.json'), join(root, 'themes.lock.json'))
    return root
  }
  const nuxtOf = (rootDir: string, options: { prepare: boolean, theme?: string }): Parameters<typeof createContext>[0] =>
    ({ options: { rootDir, srcDir: join(process.cwd(), 'app'), _prepare: options.prepare, runtimeConfig: { public: { theme: options.theme ?? '' } }, watch: [] } }) as unknown as Parameters<typeof createContext>[0]

  it('stops nuxt dev and nuxt build, and says to run theme:pull or to use the starter', () => {
    expect(() => createContext(nuxtOf(checkout(), { prepare: false }))).toThrow(
      'NUXT_PUBLIC_THEME is "bogota" but that theme is not installed (installed: starter). Add it to themes/ or to a directory in MICELIO_THEME_DIRS, or themes.lock.json pins it: run npm run theme:pull. Or work with the theme the core ships: NUXT_PUBLIC_THEME=starter.',
    )
  })

  it('lets nuxt prepare, which npm ci runs, use the starter', () => {
    expect(createContext(nuxtOf(checkout(), { prepare: true })).id).toBe('starter')
  })

  it('uses the starter when it is the theme asked for, and still stops nuxt prepare for another missing one', () => {
    expect(createContext(nuxtOf(checkout(), { prepare: false, theme: 'starter' })).id).toBe('starter')
    expect(() => createContext(nuxtOf(checkout(), { prepare: true, theme: 'bogota' }))).toThrow(/theme:pull/)
  })

  it('uses the pulled theme once theme:pull has installed it', () => {
    const root = checkout()
    const pulled = join(root, '.micelio/themes/bogota')
    cpSync(join(process.cwd(), 'test/fixtures/themes/minimal'), pulled, { recursive: true })
    writeFileSync(join(pulled, 'theme.json'), readFileSync(join(pulled, 'theme.json'), 'utf8').replace('"id": "minimal"', '"id": "bogota"'))
    expect(createContext(nuxtOf(root, { prepare: false })).id).toBe('bogota')
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

  it('registers one component per region, which chooses the variant at runtime, whatever the theme names, and no CSS', () => {
    for (const layout of [undefined, { header: 'centered', home: 'index', postList: 'list', article: 'centered', footer: 'minimal' }]) {
      const { components, layoutCss } = setup(layout)
      expect(components).toEqual([
        { name: 'RegionHeader', filePath: join('/app', 'theme/layout/header/RegionHeader.ts') },
        { name: 'RegionHome', filePath: join('/app', 'theme/layout/home/RegionHome.ts') },
        { name: 'RegionPostList', filePath: join('/app', 'theme/layout/postList/RegionPostList.ts') },
        { name: 'RegionArticle', filePath: join('/app', 'theme/layout/article/RegionArticle.ts') },
        { name: 'RegionFooter', filePath: join('/app', 'theme/layout/footer/RegionFooter.ts') },
      ])
      for (const region of LAYOUT_REGIONS) expect(layoutCss[region]).toEqual([])
    }
  })

  it('registers only the regions it is given', () => {
    const { components } = setup({ home: 'showcase' }, ['home'])
    expect(components).toEqual([{ name: 'RegionHome', filePath: join('/app', 'theme/layout/home/RegionHome.ts') }])
  })

  it('has a region file typed as the region\'s first variant, reading the generated list of its variants', () => {
    for (const region of LAYOUT_REGIONS) {
      const { component, variants } = REGION_VARIANTS[region]
      const first = variants[0]![0]!.toUpperCase() + variants[0]!.slice(1)
      const source = readFileSync(join(process.cwd(), 'app/theme/layout', region, `${component}.ts`), 'utf8')
      expect(source, region).toContain(`import type ${first} from './${first}.vue'`)
      expect(source, region).toContain(`import variants from '#micelio/regions/${region}.mjs'`)
      expect(source, region).toContain(`defineRegion<typeof ${first}>('${region}', '${component}', variants)`)
    }
  })

  it('has a component name and at least one variant for every region', () => {
    for (const region of LAYOUT_REGIONS) {
      expect(REGION_VARIANTS[region].component).toMatch(/^Region[A-Z]/)
      expect(REGION_VARIANTS[region].variants.length).toBeGreaterThan(0)
    }
  })
})

describe('readLayoutCss', () => {
  it('reads the CSS file of every variant of every region, and nothing else', () => {
    const css = readLayoutCss(join(process.cwd(), 'app/theme/layout'))
    for (const region of LAYOUT_REGIONS) {
      expect(Object.keys(css[region]!).sort()).toEqual([...REGION_VARIANTS[region].variants].sort())
    }
    expect(css.header!.bar).toContain('html:not([data-layout-header]:not([data-layout-header="bar"]))')
    expect(css.header!.centered).toContain('html:not([data-layout-header]:not([data-layout-header="centered"]))')
  })
})

describe('registerSpecimenVariants', () => {
  function setup(): ThemeContext {
    const ctx = {
      nuxt: { options: { srcDir: '/app' } },
      layoutCss: Object.fromEntries(LAYOUT_REGIONS.map(region => [region, []])),
      components: [],
    } as unknown as ThemeContext
    registerVariants(ctx)
    registerSpecimenVariants(ctx)
    return ctx
  }

  it('registers every variant as a global component under its own name, whatever the build\'s theme uses', () => {
    const { components } = setup()
    expect(components.filter(component => component.global).map(component => component.name)).toEqual([
      'RegionHeaderBar', 'RegionHeaderCentered', 'RegionHomeShowcase', 'RegionHomeIndex', 'RegionPostListGrid', 'RegionPostListList',
      'RegionArticleAside', 'RegionArticleCentered', 'RegionFooterColumns', 'RegionFooterMinimal',
    ])
    expect(components.find(component => component.name === 'RegionHeaderCentered')!.filePath).toBe(join('/app', 'theme/layout/header/Centered.vue'))
    expect(components.filter(component => !component.global).map(component => component.name)).toEqual(['RegionHeader', 'RegionHome', 'RegionPostList', 'RegionArticle', 'RegionFooter'])
  })

  it('imports the CSS of every variant, in the order of REGION_VARIANTS, before the region\'s other CSS', () => {
    const ctx = {
      nuxt: { options: { srcDir: '/app' } },
      layoutCss: Object.fromEntries(LAYOUT_REGIONS.map(region => [region, [() => '/* region */']])),
      components: [],
    } as unknown as ThemeContext
    registerSpecimenVariants(ctx)
    expect(ctx.layoutCss.header.map(source => source())).toEqual([
      `@import "${join('/app', 'theme/layout/header/bar.css')}";`,
      `@import "${join('/app', 'theme/layout/header/centered.css')}";`,
      '/* region */',
    ])
  })

  it('lists every variant for the specimen, which leaves out the active theme\'s at runtime', () => {
    expect(specimenVariants(['header', 'footer'])).toEqual([
      { region: 'header', variant: 'bar', component: 'RegionHeaderBar' },
      { region: 'header', variant: 'centered', component: 'RegionHeaderCentered' },
      { region: 'footer', variant: 'columns', component: 'RegionFooterColumns' },
      { region: 'footer', variant: 'minimal', component: 'RegionFooterMinimal' },
    ])
    expect(specimenVariants()).toHaveLength(10)
  })

  it('registers nothing without the specimen flag (setupLayout)', async () => {
    const addTemplate = vi.fn()
    vi.doMock('nuxt/kit', () => ({ addTemplate, addTypeTemplate: vi.fn(), extendPages: vi.fn() }))
    const { setupLayout } = await import('../modules/theme/layout')
    const make = (dev: boolean): ThemeContext => ({
      nuxt: { options: { srcDir: '/app', buildDir: '/build', alias: {}, dev }, hook: () => {} },
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
      expect(plain.layoutCss.header).toHaveLength(0)
      expect(addTemplate.mock.calls.map(([template]) => template.filename)).toEqual(LAYOUT_REGIONS.map(region => `micelio/regions/${region}.mjs`))
      process.env.MICELIO_SPECIMEN = '1'
      const specimen = make(false)
      setupLayout(specimen)
      expect(specimen.components.filter(component => component.global)).toHaveLength(10)
      expect(specimen.layoutCss.header).toHaveLength(2)
    } finally {
      vi.doUnmock('nuxt/kit')
      if (previous === undefined) delete process.env.MICELIO_SPECIMEN
      else process.env.MICELIO_SPECIMEN = previous
    }
  })
})

describe('variantsWithoutPrefetch', () => {
  it('turns prefetch off for the core\'s layout variants only', () => {
    const manifest: ManifestEntries = {
      'theme/layout/header/Centered.vue': { src: 'theme/layout/header/Centered.vue', prefetch: true },
      'theme/layout/postList/List.vue': { src: 'theme/layout/postList/List.vue', prefetch: true },
      'theme/layout/header/RegionHeader.ts': { src: 'theme/layout/header/RegionHeader.ts', prefetch: true },
      'components/myc/MycSearchIsland.vue': { src: 'components/myc/MycSearchIsland.vue', prefetch: true },
      '_chunk.js': { prefetch: true },
    }
    variantsWithoutPrefetch(manifest, '/app')
    expect(Object.fromEntries(Object.entries(manifest).map(([key, entry]) => [key, entry.prefetch]))).toEqual({
      'theme/layout/header/Centered.vue': false,
      'theme/layout/postList/List.vue': false,
      'theme/layout/header/RegionHeader.ts': true,
      'components/myc/MycSearchIsland.vue': true,
      '_chunk.js': true,
    })
  })
})

describe('regionVariantsModule', () => {
  it('imports the chosen variant statically and every other one on demand, in the order of REGION_VARIANTS', () => {
    expect(regionVariantsModule('header', 'centered')).toBe(`// Generated by modules/theme/layout/variants.ts (regionVariantsModule)
import Chosen from '~/theme/layout/header/Centered.vue'

export default {
  bar: { load: () => import('~/theme/layout/header/Bar.vue') },
  centered: { component: Chosen },
}
`)
  })

  it('bundles the region\'s first variant for a name the core does not have, and never writes that name', () => {
    const source = regionVariantsModule('header', '"); alert(1); ("')
    expect(source).toContain('import Chosen from \'~/theme/layout/header/Bar.vue\'')
    expect(source).not.toContain('alert')
  })

  it('bundles the region\'s first variant when the theme names none', () => {
    const source = regionVariantsModule('footer')
    expect(source).toContain('import Chosen from \'~/theme/layout/footer/Columns.vue\'')
    expect(source).toContain('  minimal: { load: () => import(\'~/theme/layout/footer/Minimal.vue\') },')
  })
})
