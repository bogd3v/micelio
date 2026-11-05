import { createHash } from 'node:crypto'
import { relative, sep } from 'node:path'
import { defineNuxtModule } from 'nuxt/kit'

// What Nuxt appends to a keyed composable (`useFetch`, `useAsyncData`, `useState`...) call that has no key of its own: `'$<10 characters>' /* nuxt-injected */`
const INJECTED_KEY = /'\$[\w-]{10}'( \/\* nuxt-injected \*\/)/g

/**
 * Nuxt derives the auto key of a data call from the absolute path of the module, so two checkouts of one commit at other paths
 * ship other 10-character strings (and, through the chunk names that hash them, other bytes): the dynamic article measured 163.4
 * KB under `/__w/micelio/micelio` and 163.5 KB under `/__w/micelio-themes/micelio-themes` (docs/performance.md, #314).
 * This derives each key from the path relative to the project root and the call's position in the module, which the server and
 * client builds agree on without depending on where the repository sits.
 *
 * @param code - The module as Nuxt's keyed-functions transform left it
 * @param id - The module's id: an absolute path, with a query perhaps
 * @param rootDir - The project root
 * @returns The code with each injected key derived again, or `undefined` when it holds none
 */
export function stableKeys(code: string, id: string, rootDir: string): string | undefined {
  if (!code.includes('nuxt-injected')) return undefined
  const [path = id, ...query] = id.split('?')
  const file = path.startsWith(rootDir + sep) ? [relative(rootDir, path), ...query].join('?') : id
  let count = 0
  return code.replace(INJECTED_KEY, (_match, marker: string) => `'$${createHash('sha256').update(`${file}-${++count}`).digest('base64url').slice(0, 10)}'${marker}`)
}

/** Makes the auto keys of the data calls independent of the directory the repository is built in. */
export default defineNuxtModule({
  meta: { name: 'micelio-stable-keys' },
  setup(_options, nuxt): void {
    const rootDir = nuxt.options.rootDir
    const plugin = {
      name: 'micelio:stable-keys',
      enforce: 'post' as const,
      transform: {
        filter: { code: { include: 'nuxt-injected' } },
        handler(code: string, id: string): { code: string, map: null } | undefined {
          const next = stableKeys(code, id, rootDir)
          return next === undefined ? undefined : { code: next, map: null }
        },
      },
    }
    // Nuxt adds its keyed-functions transform from a hook that runs after this module's setup, so an `addVitePlugin` here would sit
    // before it in the list and see no key yet. `vite:extendConfig` is the last word on the list.
    nuxt.hook('vite:extendConfig', (config): void => {
      // The list is typed read-only; Vite and Nuxt both extend it in place
      const target = config as { plugins?: unknown[] }
      target.plugins ||= []
      if (!target.plugins.some(entry => (entry as { name?: string } | null)?.name === plugin.name)) target.plugins.push(plugin)
    })
  },
})
