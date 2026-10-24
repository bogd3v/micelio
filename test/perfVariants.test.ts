import { describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { storeLayouts, variantAllowance, variantBudgetErrors } from '../scripts/perf/variants.mjs'
import { REGION_VARIANTS } from '../modules/theme/layout/variants'

const BOGOTA = { header: 'bar', home: 'showcase', postList: 'grid', article: 'aside', footer: 'columns' }
const SECOND = { header: 'centered', home: 'index', postList: 'list', article: 'centered', footer: 'minimal' }
const BUDGETS = JSON.parse(readFileSync(join(process.cwd(), 'scripts/perf/budgets.json'), 'utf8'))
const ALLOWANCES = BUDGETS.variants.jsKb

describe('variantAllowance', () => {
  it('allows nothing when the theme under test is the build\'s, or when there is no store', () => {
    expect(variantAllowance({ build: BOGOTA, active: BOGOTA }, 'home', ALLOWANCES)).toEqual({ kb: 0, variants: [] })
    expect(variantAllowance(undefined, 'home', ALLOWANCES)).toEqual({ kb: 0, variants: [] })
  })

  it('adds the header and footer on every page, and the content region on its own pages', () => {
    const layouts = { build: BOGOTA, active: SECOND }
    expect(variantAllowance(layouts, 'about', ALLOWANCES)).toEqual({ kb: 3, variants: ['header:centered', 'footer:minimal'] })
    expect(variantAllowance(layouts, 'home', ALLOWANCES)).toEqual({ kb: 3.6, variants: ['header:centered', 'footer:minimal', 'home:index'] })
    expect(variantAllowance(layouts, 'home-es', ALLOWANCES).variants).toContain('home:index')
    expect(variantAllowance(layouts, 'blog', ALLOWANCES).variants).toEqual(['header:centered', 'footer:minimal', 'postList:list'])
    expect(variantAllowance(layouts, 'article', ALLOWANCES)).toEqual({ kb: 4.9, variants: ['header:centered', 'footer:minimal', 'article:centered'] })
  })

  it('counts only the regions whose variant differs', () => {
    expect(variantAllowance({ build: BOGOTA, active: { ...BOGOTA, footer: 'minimal' } }, 'article', ALLOWANCES)).toEqual({ kb: 1.2, variants: ['footer:minimal'] })
  })
})

describe('variantBudgetErrors', () => {
  it('accepts the budgets of this repository', () => {
    expect(variantBudgetErrors(REGION_VARIANTS, BUDGETS.variants)).toEqual([])
  })

  it('needs a reason, an allowance for every variant and no unknown one', () => {
    expect(variantBudgetErrors(REGION_VARIANTS, { jsKb: ALLOWANCES })).toEqual(['variants needs a "reason"'])
    const { list: _list, ...postList } = ALLOWANCES.postList
    expect(variantBudgetErrors(REGION_VARIANTS, { reason: 'x', jsKb: { ...ALLOWANCES, postList: { ...postList, cards: 1 } } })).toEqual([
      'variants.jsKb.postList.list must be a positive number of KB',
      'variants.jsKb.postList.cards is not a layout variant of the core',
    ])
  })
})

describe('storeLayouts', () => {
  it('reads the build\'s theme and the theme under test from the built-in store', () => {
    const dir = mkdtempSync(join(tmpdir(), 'perf-store-'))
    try {
      writeFileSync(join(dir, 'index.json'), JSON.stringify({ buildTheme: 'bogota', themes: { bogota: { digest: 'a1' }, alternates: { digest: 'b2' } } }))
      for (const [digest, layout] of [['a1', BOGOTA], ['b2', SECOND]] as const) {
        mkdirSync(join(dir, 'v1/entries', digest), { recursive: true })
        writeFileSync(join(dir, 'v1/entries', digest, 'runtime.json'), JSON.stringify({ layout }))
      }
      expect(storeLayouts(dir, join(dir, 'v1/entries'), 'alternates')).toEqual({ build: BOGOTA, active: SECOND })
      expect(() => storeLayouts(dir, join(dir, 'v1/entries'), 'missing')).toThrow('theme "missing" is not in the built-in store of this build; it holds: bogota, alternates')
      expect(storeLayouts(join(dir, 'none'), join(dir, 'v1/entries'), 'bogota')).toBeUndefined()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
