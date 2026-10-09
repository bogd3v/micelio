import { describe, expect, it } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FONT_FILE, copyServed } from '../modules/theme/assets'
import type { ThemeContext } from '../modules/theme/context'

const ctx = { id: 'sample' } as unknown as ThemeContext

function fonts(files: string[]): { source: string, target: string } {
  const root = mkdtempSync(join(tmpdir(), 'myc-fonts-'))
  const source = join(root, 'fonts')
  mkdirSync(source)
  for (const file of files) writeFileSync(join(source, file), 'x')
  return { source, target: join(root, 'out', 'fonts') }
}

describe('serving a theme\'s fonts', () => {
  it('copies woff, woff2 and license (.txt) files only', () => {
    const { source, target } = fonts(['a.woff2', 'b.woff', 'OFL.txt', 'c.ttf', 'd.woff2.map', 'e.html', 'f.svg'])
    copyServed(ctx, source, target, 'fonts', FONT_FILE, 'a font')
    expect(readdirSync(target).sort()).toEqual(['OFL.txt', 'a.woff2', 'b.woff'])
  })

  it('rejects a symlink, even to a font', () => {
    const { source, target } = fonts(['a.woff2'])
    symlinkSync(join(source, 'a.woff2'), join(source, 'link.woff2'))
    expect(() => copyServed(ctx, source, target, 'fonts', FONT_FILE, 'a font')).toThrow('Theme "sample": sample/fonts/link.woff2 is a symlink; copy the file instead')
  })

  it('clears a previous copy, and serves nothing when the theme has no fonts folder', () => {
    const { source, target } = fonts(['a.woff2'])
    copyServed(ctx, source, target, 'fonts', FONT_FILE, 'a font')
    copyServed(ctx, join(source, 'missing'), target, 'fonts', FONT_FILE, 'a font')
    expect(existsSync(target)).toBe(false)
  })
})
