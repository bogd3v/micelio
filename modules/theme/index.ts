import { existsSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { addTemplate, addTypeTemplate, defineNuxtModule, updateTemplates } from 'nuxt/kit'
import { buildTokensCss } from './tokens.mjs'
import { DEFAULT_THEME, discoverThemes, selectTheme, themeRoots } from './themes'

declare module '@nuxt/schema' {
  interface PublicRuntimeConfig {
    theme: string
  }
}

// Active theme's id at build time; the server plugin compares it with the runtime value
const BUILD_THEME_MODULE = '#micelio/build-theme'

// ADR 0005, section 4: themes live in themes/<id>/ and reach the page through generated files
export default defineNuxtModule({
  meta: { name: 'micelio-theme', configKey: 'micelioTheme' },
  setup(_options, nuxt) {
    const id = process.env.NUXT_PUBLIC_THEME || nuxt.options.runtimeConfig.public.theme || DEFAULT_THEME
    const roots = themeRoots(nuxt.options.rootDir)
    // Discovery runs again on every regeneration, so editing a theme in dev needs no restart
    const load = () => selectTheme(discoverThemes(roots), id)
    const active = load()
    const { manifest: initial, dir } = active
    const fontsDir = join(dir, 'fonts')

    nuxt.options.runtimeConfig.public.theme = active.id

    // The theme's fonts/ is served at /fonts/; its preloaded files get a <link rel="preload">
    if (existsSync(fontsDir)) {
      const publicAssets = (nuxt.options.nitro.publicAssets ||= [])
      publicAssets.push({ dir: fontsDir, baseURL: '/fonts' })
    }
    const links = (nuxt.options.app.head.link ||= [])
    for (const font of initial.fonts.filter(font => font.preload)) {
      links.push({ rel: 'preload', href: `/fonts/${font.file}`, as: 'font', type: 'font/woff2', crossorigin: '' })
    }

    // main.css imports these at fixed positions (ADR 0005, section 3); never nuxt.options.css
    addTemplate({
      filename: 'micelio/settings.css',
      write: true,
      getContents: () => [
        ...['fonts.css', 'font-fallbacks.css'].filter(file => existsSync(join(dir, file))).map(file => `@import "${join(dir, file)}";`),
        buildTokensCss(load().manifest),
      ].join('\n'),
    })
    addTemplate({
      filename: 'micelio/theme.css',
      write: true,
      getContents: () => existsSync(join(dir, 'theme.css')) ? `@import "${join(dir, 'theme.css')}";\n` : '',
    })

    function themeData(): object {
      const { id: themeId, modes, fonts, layout, slots } = load().manifest
      return { id: themeId, modes: modes.map(({ id, scheme, name }) => ({ id, scheme, name })), fonts, layout, slots }
    }
    nuxt.options.alias['#micelio/theme'] = join(nuxt.options.buildDir, 'micelio/theme.mjs')
    addTemplate({
      filename: 'micelio/theme.mjs',
      write: true,
      getContents: () => `const theme = ${JSON.stringify(themeData(), null, 2)}\nexport const { id, modes, fonts, layout, slots } = theme\nexport default theme\n`,
    })
    addTypeTemplate({
      filename: 'types/micelio-theme.d.ts',
      getContents: () => `declare module '#micelio/theme' {
  export interface ThemeMode {
    id: string
    scheme: 'dark' | 'light'
    name?: string
  }
  export interface ThemeFont {
    family: string
    file: string
    preload?: boolean
  }
  export interface ActiveTheme {
    id: string
    modes: ThemeMode[]
    fonts: ThemeFont[]
    layout: Record<string, string>
    slots: Record<string, unknown>
  }
  export const id: string
  export const modes: ThemeMode[]
  export const fonts: ThemeFont[]
  export const layout: Record<string, string>
  export const slots: Record<string, unknown>
  const theme: ActiveTheme
  export default theme
}

declare module '${BUILD_THEME_MODULE}' {
  export const buildTheme: string
}
`,
    }, { nitro: true, nuxt: true })

    // A change under a theme directory regenerates the files above
    nuxt.options.watch.push(...roots)
    nuxt.hook('builder:watch', async (_event, path) => {
      const absolute = [resolve(nuxt.options.srcDir, path), resolve(nuxt.options.rootDir, path)]
      if (!roots.some(root => absolute.some(file => file === root || file.startsWith(root + sep)))) return
      await updateTemplates({ filter: template => template.filename.startsWith('micelio/') })
    })

    nuxt.hook('nitro:config', (config) => {
      config.virtual ||= {}
      config.virtual[BUILD_THEME_MODULE] = `export const buildTheme = ${JSON.stringify(active.id)}`
    })
  },
})
