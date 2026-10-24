import { describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Plugin } from 'vite'
import { servedImages } from '../modules/theme/assets'
import { themeIdProblem } from '../modules/theme/contract'
import { rewriteSlotImages, slotImagesPlugin } from '../modules/theme/slot-images'

/** Runs the plugin's transform hook, which Vite calls with the module's code and id. */
function transform(plugin: Plugin, code: string, file: string): string | null {
  const hook = plugin.transform as (code: string, id: string) => { code: string } | null
  return hook(code, file)?.code ?? null
}

describe('rewriteSlotImages', () => {
  it('rewrites the prefix where it opens a quoted string, an attribute or a template literal', () => {
    expect(rewriteSlotImages(`const A = '/theme/images/a.jpg'; const B = "/theme/images/b.png"; const C = \`/theme/images/\${x}\``, 'bogota'))
      .toBe(`const A = '/theme/bogota/images/a.jpg'; const B = "/theme/bogota/images/b.png"; const C = \`/theme/bogota/images/\${x}\``)
    expect(rewriteSlotImages('<img src="/theme/images/copeton.png">', 'bogota')).toBe('<img src="/theme/bogota/images/copeton.png">')
  })

  it('leaves a URL that does not open a string, and other prefixes, as they are', () => {
    const code = `const a = base + '/theme/imagesX/a.jpg'; const b = '/fonts/x.woff2'; const c = 'x/theme/images/y.jpg'`
    expect(rewriteSlotImages(code, 'bogota')).toBe(code)
  })

  it('refuses an id that is not a theme id', () => {
    expect(() => rewriteSlotImages('\'/theme/images/a.jpg\'', '../x')).toThrow(/not valid/)
  })
})

describe('slotImagesPlugin', () => {
  const plugin = slotImagesPlugin([{ id: 'bogota', dir: '/t/bogota' }, { id: 'starter', dir: '/t/starter' }], 'starter')
  const code = '<img src="/theme/images/copeton.png">'

  it('rewrites the slots of a theme other than the build\'s, query included', () => {
    expect(transform(plugin, code, '/t/bogota/slots/ThemeDivider.vue?vue&type=template')).toBe('<img src="/theme/bogota/images/copeton.png">')
  })

  it('leaves the build theme\'s slots and every file outside slots/ untouched', () => {
    expect(transform(plugin, code, '/t/starter/slots/ThemeMark.vue')).toBeNull()
    expect(transform(plugin, code, '/t/bogota/theme.css')).toBeNull()
    expect(transform(plugin, code, '/app/components/X.vue')).toBeNull()
  })
})

describe('servedImages', () => {
  function theme(id: string, folders: string[]): { id: string, dir: string } {
    const dir = mkdtempSync(join(tmpdir(), `myc-images-${id}-`))
    for (const folder of folders) mkdirSync(join(dir, folder))
    return { id, dir }
  }

  it('serves the build theme at /theme/images/ and every other theme with slots at /theme/<id>/images/', () => {
    const build = theme('starter', ['images', 'slots'])
    const code = theme('bogota', ['images', 'slots'])
    const dataOnly = theme('calm', ['images'])
    const noImages = theme('plain', ['slots'])
    expect(servedImages(build, [build, code, dataOnly, noImages])).toEqual([
      { id: 'starter', source: join(build.dir, 'images'), url: 'theme/images' },
      { id: 'bogota', source: join(code.dir, 'images'), url: 'theme/bogota/images' },
    ])
  })
})

describe('the reserved theme id "images"', () => {
  it('is refused, since /theme/images/ is the build theme\'s folder', () => {
    expect(themeIdProblem('images')).toMatch(/reserved.*\/theme\/<id>\/images\//)
    expect(themeIdProblem('images-plus')).toBeNull()
  })
})
