import { describe, expect, it } from 'vitest'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MAX_MODES, contractProblems, themeJsonSchema, validateContract } from '../modules/theme/contract'
import { loadHooks } from '../modules/theme/hooks'
import { discoverThemes, themeRoots } from '../modules/theme/themes'
import { themeProblems, validateThemes } from '../modules/theme/validate'

const FIXTURES = join(process.cwd(), 'test/fixtures/themes')
const hooks = loadHooks(join(process.cwd(), 'app'))

interface Group {
  tokens: Array<{ name: string, value: unknown }>
}

interface Manifest {
  [key: string]: unknown
  id: string
  contract: number
  modes: unknown
  color: Group
  type: { families: Record<string, string>, groups: Array<{ styles: Array<{ name: string }> }> }
}

function minimal(): Manifest {
  return JSON.parse(readFileSync(join(FIXTURES, 'minimal/theme.json'), 'utf8'))
}

/** An installed copy of the minimal theme under a fresh root, changed by `change` and `files`. */
function install(id: string, change: (manifest: Manifest) => void = () => {}, files: Record<string, string> = {}): string {
  const root = mkdtempSync(join(tmpdir(), 'bd-contract-'))
  const dir = join(root, id)
  cpSync(join(FIXTURES, 'minimal'), dir, { recursive: true })
  const manifest = minimal()
  manifest.id = id
  change(manifest)
  writeFileSync(join(dir, 'theme.json'), JSON.stringify(manifest))
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(join(dir, file, '..'), { recursive: true })
    writeFileSync(join(dir, file), content)
  }
  return root
}

/** The problems the validator reports for the theme installed by install(). */
function problemsOf(root: string): string[] {
  return discoverThemes([root]).flatMap(theme => themeProblems(theme, hooks))
}

function setRole(manifest: Manifest, group: string, name: string, value: unknown): void {
  manifest[group].tokens.find((token: { name: string }) => token.name === name).value = value
}

describe('the fixture themes', () => {
  it('the minimal theme and Bogota satisfy the contract', () => {
    const ids = discoverThemes(themeRoots(process.cwd(), FIXTURES)).map(theme => theme.id)
    expect(ids).toContain('minimal')
    const themes = discoverThemes(themeRoots(process.cwd(), join(FIXTURES, 'minimal')))
    expect(() => validateThemes(themes, hooks)).not.toThrow()
  })

  it('the minimal theme has one light mode, no slots and no layout', () => {
    const manifest = minimal()
    expect(manifest.modes).toEqual([{ id: 'day', scheme: 'light', name: 'Day' }])
    expect(manifest.slots).toBeUndefined()
    expect(manifest.layout).toBeUndefined()
  })
})

describe('contract validation', () => {
  it('rejects an unknown contract version', () => {
    const problems = problemsOf(install('future', m => (m.contract = 2)))
    expect(problems.join('\n')).toMatch(/contract: declares contract 2, this build implements contract 1/)
  })

  it('names the theme and the problem in the error that fails the build', () => {
    const root = install('broken', m => (m.contract = 2))
    expect(() => validateThemes(discoverThemes([root]), hooks)).toThrow(/Theme "broken": contract: declares contract 2/)
  })

  it('lists every problem of every invalid theme', () => {
    const root = install('first', m => (m.contract = 2))
    const other = install('second', m => (m.modes = []))
    expect(() => validateThemes(discoverThemes([root, other]), hooks)).toThrow(/Theme "first".*\n.*Theme "second"/)
  })

  it('rejects a missing role, naming it', () => {
    const problems = problemsOf(install('norole', (m) => {
      m.color.tokens = m.color.tokens.filter((token: { name: string }) => token.name !== 'ink-muted')
    }))
    expect(problems).toContain('misses the role "ink-muted" in "color"')
  })

  it('rejects a per-mode role without a value for a mode, and a value for an unknown mode', () => {
    const problems = problemsOf(install('modevalue', (m) => {
      setRole(m, 'color', 'surface', { night: '#000' })
    }))
    expect(problems).toContain('role "surface" has no value for the mode "day"')
    expect(problems).toContain('role "surface" has a value for the mode "night", which the theme does not declare')
  })

  it('rejects per-mode values outside the color and shadow groups', () => {
    const problems = problemsOf(install('flat', m => setRole(m, 'radius', 'radius-card', { day: '4px' })))
    expect(problems.join('\n')).toMatch(/radius role "radius-card" has per-mode values/)
  })

  it('rejects a value that could open a rule or load a URL', () => {
    const problems = problemsOf(install('unsafe', m => setRole(m, 'color', 'ink', 'red; } body { display: none')))
    expect(problems.join('\n')).toMatch(/unsafe value/)
    expect(problemsOf(install('unsafe2', m => setRole(m, 'color', 'ink', 'url(https://x.test/a.png)'))).join('\n')).toMatch(/unsafe value/)
  })

  it.each([
    ['image-set(', 'image-set("a.png" 1x)'],
    ['src(', 'src("a.png")'],
    ['a backslash escape', 'red\\3b color: blue'],
    ['a quote', '"red"'],
    ['a comment', 'red /* x */'],
    ['!important', 'red !important'],
  ])('rejects %s in a role value', (_name, value) => {
    expect(problemsOf(install('rolevalue', m => setRole(m, 'color', 'ink', value))).join('\n')).toMatch(/unsafe value|quoted value/)
  })

  it('accepts quotes in a font stack, and still rejects an unsafe one', () => {
    expect(problemsOf(install('stack', m => (m.type.families.mono = '"Mono", ui-monospace, monospace')))).toEqual([])
    expect(problemsOf(install('stack2', m => (m.type.families.mono = '"Mono", url(https://x.test/a.woff2)'))).join('\n')).toMatch(/unsafe value/)
  })

  it('runs the generated role CSS through the CSS checks', () => {
    const problems = problemsOf(install('generated', m => setRole(m, 'color', 'ink', 'red)')))
    expect(problems.length).toBeGreaterThan(0)
    expect(problems.join('\n')).toMatch(/theme\.json \(generated role CSS\)|unsafe|cannot parse/)
  })

  it('rejects an unknown top-level key', () => {
    expect(problemsOf(install('typo', m => (m.layouts = {}))).join('\n')).toMatch(/Unrecognized key: "layouts"/)
  })

  it('misses a font family or a type step', () => {
    const problems = problemsOf(install('type', (m) => {
      delete m.type.families.mono
      m.type.groups[0].styles = m.type.groups[0].styles.filter((style: { name: string }) => style.name !== 'display-xl')
    }))
    expect(problems).toContain('misses the font family "mono" in "type.families"')
    expect(problems).toContain('misses the type step "display-xl" in "type.groups"')
  })

  it('rejects an image role whose file is not in images/, and a name that is not an image', () => {
    expect(problemsOf(install('noimage', m => (m.images = { ogImage: 'og.png' })))).toContain('images.ogImage: "og.png" is not in images/')
    expect(problemsOf(install('badimage', m => (m.images = { favicon: '../x.svg' }))).join('\n')).toMatch(/images\.favicon: image "..\/x.svg" must be/)
    expect(problemsOf(install('goodimage', m => (m.images = { favicon: 'f.svg' }), { 'images/f.svg': '<svg />' }))).toEqual([])
  })

  it('accepts the reserved sections key and optional roles', () => {
    expect(problemsOf(install('reserved', m => (m.sections = { hero: {} })))).toEqual([])
  })
})

describe('modes', () => {
  const withModes = (modes: unknown): string[] => {
    const manifest = minimal()
    manifest.modes = modes
    return contractProblems(manifest)
  }

  it('rejects a scheme that is not dark or light', () => {
    expect(withModes([{ id: 'day', scheme: 'sepia' }]).join('\n')).toContain('scheme "sepia"')
  })

  it('rejects a repeated mode id', () => {
    expect(withModes([{ id: 'a', scheme: 'dark' }, { id: 'a', scheme: 'light' }]).join('\n')).toContain('mode "a" is declared twice')
  })

  it('rejects no modes and ids outside [\\w-]', () => {
    expect(withModes([]).join('\n')).toContain('declares no modes')
    for (const bad of ['a b', 'a"]{', 'a<b', '']) {
      expect(withModes([{ id: bad, scheme: 'dark' }]).join('\n')).toContain('must match')
    }
  })

  it('rejects more modes than the init script budget allows', () => {
    const many = Array.from({ length: MAX_MODES + 1 }, (_, i) => ({ id: `m${i}`, scheme: 'dark' }))
    expect(withModes(many).join('\n')).toContain(`at most ${MAX_MODES}`)
  })
})

describe('the island rule', () => {
  const slot = (template: string, script = ''): Record<string, string> => ({
    'slots/ThemeMark.vue': `${script ? `<script setup lang="ts">\n${script}\n</script>\n` : ''}<template>${template}</template>`,
  })
  const problems = (files: Record<string, string>, change: (m: Manifest) => void = () => {}): string => problemsOf(install('isle', change, files)).join('\n')

  it('accepts a static slot', () => {
    expect(problems(slot('<span :title="site.name">{{ site.name }}</span>', 'const site = useSite()'))).toBe('')
  })

  it.each([
    ['an event handler', '<button @click="go">x</button>', '', '@click'],
    ['v-on', '<button v-on="handlers">x</button>', '', 'v-on'],
    ['v-model', '<input v-model="value">', 'const value = ref(\'\')', 'v-model'],
    ['onMounted', '<i />', 'onMounted(() => {})', 'onMounted'],
    ['onBeforeMount', '<i />', 'onBeforeMount(() => {})', 'onBeforeMount'],
    ['onUpdated', '<i />', 'onUpdated(() => {})', 'onUpdated'],
    ['onUnmounted', '<i />', 'onUnmounted(() => {})', 'onUnmounted'],
    ['useState', '<i />', 'const open = useState(\'open\')', 'useState'],
  ])('rejects %s in a slot that is not an island', (_name, template, script, what) => {
    expect(problems(slot(template, script))).toBe(`slots/ThemeMark.vue: uses ${what}, which is interactive; a slot that needs JavaScript declares "island": true in theme.json (ADR 0005, section 12)`)
  })

  it.each([
    [':onClick', '<button :onClick="go">x</button>', '', ':onClick'],
    ['v-bind:onX', '<button v-bind:onFocus="go">x</button>', '', ':onFocus'],
    ['an object v-bind', '<button v-bind="handlers">x</button>', '', 'v-bind with an object'],
    ['a dynamic v-bind argument', '<button :[name]="go">x</button>', '', 'v-bind with a dynamic argument'],
    ['an inline handler attribute', '<button onclick="go()">x</button>', '', 'onclick'],
    ['Options API mounted()', '<i />', 'export default { mounted() {} }', 'mounted()'],
    ['Options API beforeMount as a function value', '<i />', 'export default { beforeMount: () => {} }', 'beforeMount()'],
    ['watch', '<i />', 'watch(() => 1, () => {})', 'watch'],
    ['watchEffect', '<i />', 'watchEffect(() => {})', 'watchEffect'],
    ['setInterval', '<i />', 'setInterval(() => {}, 1000)', 'setInterval'],
    ['setTimeout through window', '<i />', 'window.setTimeout(() => {}, 1000)', 'setTimeout'],
    ['addEventListener', '<i />', 'document.addEventListener(\'click\', () => {})', 'addEventListener'],
    ['a hook after a // inside a string', '<i />', 'const url = \'https://example.org\'\nonMounted(() => {})', 'onMounted'],
    ['a hook in TypeScript', '<i />', 'const n: number = 1\nonMounted((): void => {})', 'onMounted'],
  ])('rejects %s', (_name, template, script, what) => {
    expect(problems(slot(template, script))).toContain(`slots/ThemeMark.vue: uses ${what}, which is interactive`)
  })

  it('does not take a plain property named mounted for a hook', () => {
    expect(problems(slot('<i />', 'const state = { mounted: true, updated: 1 }'))).toBe('')
  })

  it('rejects a <style> block in every slot, island or not, because it would bypass the bd.theme layer', () => {
    const files = { 'slots/ThemeMark.vue': '<template><i /></template><style>i { top: 0 }</style>' }
    expect(problems(files)).toMatch(/slots\/ThemeMark\.vue: has a <style> block/)
    expect(problems(files, (m) => {
      m.slots = { ThemeMark: { island: true } }
    })).toMatch(/has a <style> block/)
  })

  it('rejects a symlinked slot component', () => {
    const root = install('linked', () => {}, { 'real/ThemeMark.vue': '<template><i /></template>' })
    mkdirSync(join(root, 'linked', 'slots'))
    symlinkSync(join(root, 'linked', 'real', 'ThemeMark.vue'), join(root, 'linked', 'slots', 'ThemeMark.vue'))
    expect(problemsOf(root)).toContain('slots/ThemeMark.vue is a symlink; copy the file instead')
  })

  it('finds a handler nested in v-if and v-for', () => {
    expect(problems(slot('<ul v-if="ok"><li v-for="n in 3" :key="n" @mouseenter="x">{{ n }}</li></ul>'))).toContain('uses @mouseenter')
  })

  it('ignores a hook named in a comment', () => {
    expect(problems(slot('<i />', '// onMounted is not used here\n/* useState either */'))).toBe('')
  })

  it('lets a declared island use all of them', () => {
    const island = (m: Manifest): void => {
      m.slots = { ThemeMark: { island: true } }
    }
    expect(problems(slot('<button @click="go">x</button>', 'onMounted(() => {})'), island)).toBe('')
  })

  it('reports a component that does not parse', () => {
    expect(problems({ 'slots/ThemeMark.vue': '<template><div></template>' })).toMatch(/cannot parse the component/)
  })
})

describe('slots and layout', () => {
  it('rejects a slot outside the list', () => {
    expect(problemsOf(install('slot', m => (m.slots = { ThemeFooter: {} }))).join('\n')).toMatch(/slots: declares the slot "ThemeFooter", which is not one of/)
  })

  it('accepts the known slots with a boolean island', () => {
    expect(problemsOf(install('slotok', m => (m.slots = { ThemeDivider: { island: true }, ThemeMark: {} })))).toEqual([])
  })

  it('rejects slot options that are not a plain object', () => {
    for (const options of [true, null, 'island', ['island']]) {
      expect(problemsOf(install('slotobj', m => (m.slots = { ThemeDivider: options }))).join('\n')).toMatch(/slots\.ThemeDivider: must be an object/)
    }
  })

  it('rejects an island that is not a boolean', () => {
    expect(problemsOf(install('island', m => (m.slots = { ThemeDivider: { island: 'yes' } }))).join('\n')).toMatch(/slots\.ThemeDivider\.island: must be true or false/)
  })

  it('rejects a slots/ file that is not a slot', () => {
    expect(problemsOf(install('slotfile', () => {}, { 'slots/ThemeFooter.vue': '<template><p /></template>' }))).toContain('slots/ThemeFooter.vue is not a slot; the slots are ThemeMark, ThemeHero, ThemeDivider, ThemeEmptyState, ThemeIllustration, ThemeProgressMarker, ThemeSupportArt')
  })

  it('rejects a variant the core does not implement and a region that does not exist', () => {
    expect(problemsOf(install('variant', m => (m.layout = { postList: 'masonry' })))).toContain('layout.postList: "masonry" is not a known variant; expected one of: grid, list')
    expect(problemsOf(install('variant2', m => (m.layout = { header: 'sidebar' })))).toContain('layout.header: "sidebar" is not a known variant; expected one of: bar, centered')
    expect(problemsOf(install('variant4', m => (m.layout = { home: 'hero' })))).toContain('layout.home: "hero" is not a known variant; expected one of: showcase, index')
    expect(problemsOf(install('variant5', m => (m.layout = { article: 'wide' })))).toContain('layout.article: "wide" is not a known variant; expected one of: aside, centered')
    expect(problemsOf(install('variant3', m => (m.layout = { footer: 'mega' })))).toContain('layout.footer: "mega" is not a known variant; expected one of: columns, minimal')
    expect(problemsOf(install('region', m => (m.layout = { sidebar: 'left' }))).join('\n')).toMatch(/layout: names the region "sidebar"/)
  })

  it('accepts the second variant of every region', () => {
    expect(problemsOf(install('variantalt', m => (m.layout = { header: 'centered', home: 'index', postList: 'list', article: 'centered', footer: 'minimal' })))).toEqual([])
  })

  it('accepts every variant the core implements', () => {
    expect(problemsOf(install('variantok', m => (m.layout = { header: 'bar', home: 'showcase', postList: 'grid', article: 'aside', footer: 'columns' })))).toEqual([])
  })
})

describe('package files', () => {
  it('rejects a font that is not in fonts/', () => {
    const problems = problemsOf(install('nofont', m => (m.fonts = [{ family: 'X', file: 'x.woff2' }])))
    expect(problems).toContain('font file "x.woff2" is not in fonts/')
  })

  it('accepts a font that is in fonts/', () => {
    expect(problemsOf(install('font', m => (m.fonts = [{ family: 'X', file: 'x.woff2' }]), { 'fonts/x.woff2': '' }))).toEqual([])
  })

  it('reports CSS problems with the file name', () => {
    const problems = problemsOf(install('css', () => {}, { 'theme.css': '.bd-made-up { color: red }' }))
    expect(problems).toEqual(['theme.css: ".bd-made-up" is not a public hook (internal bd-* classes can change in any release)'])
  })

  it('checks slot CSS and the files theme.css imports', () => {
    const slot = problemsOf(install('slotcss', () => {}, { 'slots/mark.css': '.x { color: red !important }' }))
    expect(slot.join('\n')).toMatch(/slots\/mark\.css: !important on "color"/)
    const imported = problemsOf(install('imported', () => {}, { 'theme.css': '@import "./more.css";', 'more.css': '.bd-nope { top: 0 }' }))
    expect(imported.join('\n')).toMatch(/more\.css: ".bd-nope"/)
    expect(problemsOf(install('escape', () => {}, { 'theme.css': '@import "../other.css";' })).join('\n')).toMatch(/leaves the theme folder/)
  })
})

describe('theme.schema.json', () => {
  it('is generated from the contract and reserves sections', () => {
    const schema = themeJsonSchema() as { properties: Record<string, unknown>, required: string[] }
    expect(Object.keys(schema.properties)).toEqual(expect.arrayContaining(['contract', 'modes', 'layout', 'slots', 'color', 'type', 'sections']))
    expect(schema.required).toEqual(expect.arrayContaining(['contract', 'id', 'modes', 'color']))
  })

  it('is validated by validateContract with the theme name', () => {
    const manifest = minimal()
    manifest.modes = []
    expect(() => validateContract(manifest)).toThrow('Theme "minimal": modes: declares no modes')
    expect(() => validateContract({ contract: 1 }, 'folder')).toThrow(/Theme "folder"/)
  })
})
