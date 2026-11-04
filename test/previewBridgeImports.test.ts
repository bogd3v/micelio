import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const BRIDGE = fileURLToPath(new URL('../app/helpers/previewBridge.ts', import.meta.url))
const APP = fileURLToPath(new URL('../app/', import.meta.url))
// Common calls Nuxt resolves without an import line: Vue's (`nextTick`, `ref`…) and Nuxt's own (`useNuxtApp`, `useRuntimeConfig`). A short list, not every export of `vue`
const AUTO_IMPORTED = /(?<![\w.])(nextTick|ref|shallowRef|reactive|computed|watch|watchEffect|onMounted|onBeforeUnmount|onUnmounted|useNuxtApp|useRuntimeConfig)\(/

/** The specifiers a module imports at runtime through `from '…'`, `import '…'` or `import('…')`, on one line or several; type-only imports and type re-exports are dropped. */
function runtimeSpecifiers(source: string): string[] {
  const withoutTypes = source.replace(/\b(?:import|export) type\s+(?:\{[^}]*\}|\*(?:\s+as\s+\w+)?|\w+)\s*from\s*['"][^'"]+['"]/g, '')
  return [...withoutTypes.matchAll(/\b(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map(match => match[1] ?? '')
}

/** Every module the bridge reaches through its own imports, with the specifiers that are neither relative nor `~/`. */
function reach(file: string, seen = new Map<string, string>()): Map<string, string> {
  if (seen.has(file)) return seen
  const source = readFileSync(file, 'utf8')
  seen.set(file, source)
  for (const specifier of runtimeSpecifiers(source)) {
    const base = specifier.startsWith('~/') ? resolve(APP, specifier.slice(2)) : specifier.startsWith('.') ? resolve(dirname(file), specifier) : undefined
    // Only `.ts` modules are followed and a JSON file is a leaf; a package, a `.vue` or `.mjs` file or a path that does not resolve is reported
    const target = base && [`${base}.ts`, `${base}/index.ts`, base].find(candidate => existsSync(candidate))
    if (target?.endsWith('.ts')) reach(target, seen)
    else if (!target?.endsWith('.json')) seen.set(`${file} -> ${specifier}`, '')
  }
  return seen
}

describe('the preview bridge', () => {
  // An `import 'vue'` in a lazily loaded module made the build split the shared Vue runtime chunk and added a modulepreload and ~0.7 KB of script to every public page (bogd3v/micelio#732; `npm run perf -- --check` is the real guard)
  it('reaches, through its `.ts` imports, no package, no other kind of file and none of the common auto-imported calls', () => {
    const modules = reach(BRIDGE)
    const packages = [...modules.keys()].filter(key => key.includes(' -> ')).map(key => key.replace(`${APP}`, 'app/'))
    expect(packages).toEqual([])
    const calls = [...modules].filter(([key, source]) => !key.includes(' -> ') && AUTO_IMPORTED.test(source)).map(([key]) => key.replace(APP, 'app/'))
    expect(calls).toEqual([])
  })

  it('finds the forms of import it guards against', () => {
    expect(runtimeSpecifiers(`import {\n  nextTick,\n} from 'vue'`)).toEqual(['vue'])
    expect(runtimeSpecifiers(`import 'vue'\nexport { x } from 'vue'\nconst m = await import('vue')`)).toEqual(['vue', 'vue', 'vue'])
    expect(runtimeSpecifiers(`import type { A } from 'vue'\nimport { b } from './b'`)).toEqual(['./b'])
    expect(runtimeSpecifiers(`import type {\n  A,\n} from 'vue'\nimport type * as T from 'vue'\nimport type D from 'vue'`)).toEqual([])
    expect(runtimeSpecifiers(`export type X = { a: string }\nexport { nextTick } from 'vue'`)).toEqual(['vue'])
    expect(runtimeSpecifiers(`export type { X } from './x'\nexport * from './y'`)).toEqual(['./y'])
  })
})
