import { describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { budgetProblems, pageLimits } from '../scripts/perf/limits.mjs'
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

// The carbon budget (#847; docs/performance.md, "Carbon estimate"): an error limit of the modes CI measures, grown by the bytes the other allowances add
describe('the carbon budget', () => {
  const dynamic = BUDGETS.modes.dynamic.limits
  const errorsOf = (metrics: Record<string, number>, limits: Record<string, number>) => budgetProblems('home', metrics, limits, 'error')

  it('--check fails a page over its carbon budget', () => {
    const limits = pageLimits({ modeLimits: dynamic, page: 'home', level: 'error' })
    expect(limits.co2Mg).toBe(40)
    expect(errorsOf({ co2Mg: 40.01 }, limits).filter(problem => problem.metric === 'co2Mg')).toEqual([{ level: 'error', page: 'home', metric: 'co2Mg', value: 40.01, limit: 40 }])
    expect(errorsOf({ co2Mg: 40 }, limits).filter(problem => problem.metric === 'co2Mg')).toEqual([])
  })

  it('limits every page of the modes CI measures, and none of the landing, which has no CI baseline', () => {
    for (const mode of ['dynamic', 'static']) {
      for (const { name } of BUDGETS.modes[mode].pages) expect(BUDGETS.modes[mode].limits[name].error.co2Mg, `${mode} ${name}`).toBeGreaterThan(0)
    }
    for (const { name } of BUDGETS.modes.landing.pages) expect(BUDGETS.modes.landing.limits[name].error.co2Mg, name).toBeUndefined()
  })

  it('grows by the estimate of the display font and variant allowances, and only at the error level', () => {
    // 60 KB of font: 61 440 bytes x 111.891 g per GB a view = 6.87 mg; 3.6 KB of variants (home, BOGOTA to SECOND): 0.41 mg
    const variantKb = variantAllowance({ build: BOGOTA, active: SECOND }, 'home', ALLOWANCES).kb
    expect(pageLimits({ modeLimits: dynamic, page: 'home', level: 'error', extraFontKb: 60 })).toMatchObject({ fontKb: 210.8, co2Mg: 46.87 })
    expect(pageLimits({ modeLimits: dynamic, page: 'home', level: 'error', variantKb })).toMatchObject({ jsKb: 155.4, co2Mg: 40.41 })
    expect(pageLimits({ modeLimits: dynamic, page: 'home', level: 'warn', extraFontKb: 60 }).co2Mg).toBeUndefined()
  })

  it('lets a theme exception replace the carbon limit of a page', () => {
    expect(pageLimits({ modeLimits: dynamic, exceptionLimits: { home: { error: { co2Mg: 50 } } }, page: 'home', level: 'error' }).co2Mg).toBe(50)
  })

  // The static carbon of two themes of micelio-themes, from its Admission run 44628122325 on core 93b9459 (docs/performance.md, "Carbon budget", "Recorded exceptions")
  const EXCEPTIONS = {
    cartel: { blog: 10, article: 10.4, privacy: 10 },
    espora: { 'home': 12.4, 'blog': 12.3, 'article': 12.7, 'privacy': 12.3, 'home-es': 12.4 },
  } as Record<string, Record<string, number>>
  const MEASURED = {
    cartel: { 'home': 9.58, 'blog': 9.47, 'article': 9.86, 'about': 9.75, 'privacy': 9.43, 'home-es': 9.56 },
    espora: { 'home': 11.78, 'blog': 11.68, 'article': 12.07, 'about': 11.95, 'privacy': 11.64, 'home-es': 11.76 },
  } as Record<string, Record<string, number>>

  it('records the static carbon exceptions of cartel and espora', () => {
    for (const [id, pages] of Object.entries(EXCEPTIONS)) {
      const entry = BUDGETS.themes[id]
      expect(entry.mode, id).toEqual(['static'])
      expect(entry.reason, id).toEqual(expect.stringMatching(/\S/))
      expect(entry.limits, id).toEqual(Object.fromEntries(Object.entries(pages).map(([page, co2Mg]) => [page, { error: { co2Mg } }])))
    }
  })

  it('admits the static carbon cartel and espora measured on core 93b9459 only with their exception', () => {
    const static_ = BUDGETS.modes.static.limits
    const co2Of = (page: string, value: number, exceptionLimits?: Record<string, unknown>) =>
      budgetProblems(page, { co2Mg: value }, pageLimits({ modeLimits: static_, exceptionLimits, page, level: 'error' }), 'error').filter(problem => problem.metric === 'co2Mg')
    for (const [id, measured] of Object.entries(MEASURED)) {
      for (const [page, value] of Object.entries(measured)) {
        const excepted = page in (EXCEPTIONS[id] ?? {})
        const alone = co2Of(page, value)
        if (excepted) expect(alone, `${id} ${page}`).toEqual([{ level: 'error', page, metric: 'co2Mg', value, limit: static_[page].error.co2Mg }])
        else expect(alone, `${id} ${page}`).toEqual([])
        expect(co2Of(page, value, BUDGETS.themes[id].limits), `${id} ${page} with its exception`).toEqual([])
      }
    }
  })

  it('has one exception entry per theme', () => {
    const text = readFileSync(join(process.cwd(), 'scripts/perf/budgets.json'), 'utf8')
    const themes = text.slice(text.indexOf('"themes"'), text.indexOf('"modes"'))
    const keys = [...themes.matchAll(/^ {4}"([^"]+)": \{/gm)].map(match => match[1])
    expect(keys.length).toBeGreaterThan(0)
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys.sort()).toEqual(Object.keys(BUDGETS.themes).sort())
  })
})
