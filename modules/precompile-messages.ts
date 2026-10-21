import { readFileSync } from 'node:fs'
import { resolve, sep } from 'node:path'
import { defineNuxtModule } from 'nuxt/kit'
import { compileMessages } from './theme/install/messages'

interface ResolveContext {
  resolve: (source: string, importer?: string, options?: { skipSelf: boolean }) => Promise<{ id: string } | null>
}

interface MessagesPlugin {
  name: string
  resolveId: (this: ResolveContext, source: string, importer?: string) => Promise<string | null>
  load: (id: string) => string | null
}

// How @nuxtjs/i18n imports locale files; other imports of them keep the raw JSON
const I18N_IMPORT_PREFIX = '#nuxt-i18n/'
const VIRTUAL_PREFIX = '\0micelio-messages:'

/** True for a .json file inside one of the directories (not inside a sibling like `themes-foo/`). */
export function isMessageFile(path: string, dirs: string[]): boolean {
  return path.endsWith('.json') && dirs.some(dir => path.startsWith(dir + sep))
}

/**
 * Nitro imports the locale files as raw JSON and serves them to the client, which then needs
 * the message compiler. This hands `@nuxtjs/i18n` the compiled AST instead (docs/performance.md).
 */
export default defineNuxtModule({
  meta: { name: 'precompile-messages' },
  setup(_options, nuxt): void {
    // The core locales and the /_theme messages (modules/theme/specimen/setup.ts); a theme's messages are compiled when it is installed
    const messageDirs = [
      resolve(nuxt.options.rootDir, 'i18n/locales'),
      resolve(nuxt.options.rootDir, 'modules/theme/specimen/locales'),
    ]
    const plugin: MessagesPlugin = {
      name: 'micelio:precompile-messages',
      async resolveId(this: ResolveContext, source: string, importer?: string): Promise<string | null> {
        if (!source.startsWith(I18N_IMPORT_PREFIX)) return null
        const resolved = await this.resolve(source, importer, { skipSelf: true })
        const path = resolved?.id.split('?')[0]
        return path && isMessageFile(path, messageDirs) ? `${VIRTUAL_PREFIX}${path}` : null
      },
      load(id: string): string | null {
        if (!id.startsWith(VIRTUAL_PREFIX)) return null
        const messages = JSON.parse(readFileSync(id.slice(VIRTUAL_PREFIX.length), 'utf8'))
        return `export default ${JSON.stringify(compileMessages(messages))}`
      },
    }

    nuxt.hook('nitro:config', (config): void => {
      config.rollupConfig ??= {}
      config.rollupConfig.plugins = [plugin, ...[config.rollupConfig.plugins ?? []].flat()]
    })
  },
})
