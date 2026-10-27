import { afterEach, describe, expect, it } from 'vitest'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { CORE_SOURCE_DIRS, coreBuildOf } from '../modules/theme/core-build'
import type { LayoutCss } from '../modules/theme/install/types'

const ROOT = resolve(__dirname, '..')
const LAYOUT: LayoutCss = { header: { bar: 'header{}' } }
const temporary: string[] = []

/** A copy of the folders the core build hashes, with a folder to edit. */
function copyOfSources(): string[] {
  const scratch = mkdtempSync(join(tmpdir(), 'micelio-core-build-'))
  temporary.push(scratch)
  return CORE_SOURCE_DIRS.map((dir, position) => {
    const copy = join(scratch, String(position))
    cpSync(dir, copy, { recursive: true })
    return copy
  })
}

/** The files that `entry` imports with a relative path, of any extension, followed recursively through `.ts` and `.mjs`. */
function reachedFrom(entry: string, seen = new Set<string>()): Set<string> {
  if (seen.has(entry)) return seen
  seen.add(entry)
  for (const [, specifier] of readFileSync(entry, 'utf8').matchAll(/(?:from|import)\s*\(?\s*['"](\.[^'"]+)['"]/g)) {
    const base = resolve(dirname(entry), specifier!)
    const file = ['', '.ts', '.mjs', '/index.ts'].map(extension => base + extension).find(path => existsSync(path) && statSync(path).isFile())
    if (!file) continue
    if (/\.(ts|mjs)$/.test(file)) reachedFrom(file, seen)
    else seen.add(file)
  }
  return seen
}

afterEach(() => {
  for (const dir of temporary.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('coreBuildOf', () => {
  it('gives the same id to two copies of the same sources, wherever they are', () => {
    const [first, second] = [copyOfSources(), copyOfSources()]
    expect(coreBuildOf(LAYOUT, first)).toBe(coreBuildOf(LAYOUT, second))
    expect(coreBuildOf(LAYOUT, first)).toMatch(/^[0-9a-f]{16}$/)
    expect(coreBuildOf(LAYOUT, first)).toBe(coreBuildOf(LAYOUT))
  })

  it('changes when a source is edited or added', () => {
    const dirs = copyOfSources()
    const before = coreBuildOf(LAYOUT, dirs)
    writeFileSync(join(dirs[0]!, 'install/constants.ts'), '// edited\n', { flag: 'a' })
    const edited = coreBuildOf(LAYOUT, dirs)
    expect(edited).not.toBe(before)
    writeFileSync(join(dirs[1]!, 'color.ts'), '// edited\n', { flag: 'a' })
    const helperEdited = coreBuildOf(LAYOUT, dirs)
    expect(helperEdited).not.toBe(edited)
    mkdirSync(join(dirs[0]!, 'extra'))
    writeFileSync(join(dirs[0]!, 'extra/new.ts'), 'export {}\n')
    expect(coreBuildOf(LAYOUT, dirs)).not.toBe(helperEdited)
  })

  it('changes when the variant CSS changes', () => {
    const dirs = copyOfSources()
    expect(coreBuildOf({ header: { bar: 'header{color:red}' } }, dirs)).not.toBe(coreBuildOf(LAYOUT, dirs))
  })

  it('changes when a file is renamed and its bytes stay the same', () => {
    const [first, second] = [copyOfSources(), copyOfSources()]
    cpSync(join(second[0]!, 'palette.ts'), join(second[0]!, 'palette-copy.ts'))
    rmSync(join(second[0]!, 'palette.ts'))
    expect(coreBuildOf(LAYOUT, second)).not.toBe(coreBuildOf(LAYOUT, first))
  })

  it('covers every file the theme compiler imports', () => {
    const reached = [...reachedFrom(join(ROOT, 'modules/theme/install/compile.ts')), ...reachedFrom(join(ROOT, 'modules/theme/install/worker.ts'))]
    const outside = reached.filter(file => !CORE_SOURCE_DIRS.some(dir => !relative(dir, file).startsWith('..')))
    expect(outside.map(file => relative(ROOT, file))).toEqual([])
    expect(reached.some(file => relative(ROOT, file) === 'app/helpers/color.ts')).toBe(true)
  })
})
