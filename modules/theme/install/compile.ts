import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve, sep } from 'node:path'
import { brotliCompressSync, constants as zlib } from 'node:zlib'
import { bundleAsync } from 'lightningcss'
import { CONTRACT_VERSION, DEFAULT_LAYOUT, FONT_ASSET_FILE, IMAGE_FILE, IMAGES_URL, URL_FUNCTIONS } from '../constants'
import { cssUrls } from '../css-rules'
import { themeDisplay } from '../display-family'
import { readThemeFile } from '../files'
import { buildSegmentedCss } from '../modes'
import { buildPalette } from '../palette'
import { gzipDeterministic } from '../registry/gzip'
import { buildTokensCss } from '../tokens.mjs'
import type { InstalledTheme } from '../types'
import { formatContractVersion, parseContractVersion } from '../version'
import { COMPILED_DIGEST, COMPILER_VERSION, CSS_TARGETS, ENTRY_FILES, MAX_COMPILED_CSS_BYTES, MAX_MESSAGES_BYTES, PRECOMPRESSED, SERVE_PREFIX, STORE_VERSION } from './constants'
import { InstallError } from './error'
import { compileMessages, messageProblem } from './messages'
import type { RuntimeData } from './types'

/** A theme compiled in memory: the files of its store entry, before the integrity manifest. */
export interface CompiledTheme {
  /** The digest of the entry (`COMPILED_DIGEST`). */
  digest: string
  compileKey: string
  /** Every file by path under the entry, precompressed copies included, in a stable order. */
  files: Map<string, Buffer>
  /** Files skipped for not being a font or an image. */
  warnings: string[]
}

/** What `compileTheme` needs to know about the package behind the theme. */
export interface CompileInput {
  theme: InstalledTheme
  /** The digest of the package (or file tree) the theme was read from. */
  packageDigest: string
  /** Whether the theme ships code; a code theme's `slots/*.css` join the theme stylesheet. */
  code: boolean
  coreBuild: string
}

const LIGHTNINGCSS_TARGETS = Object.fromEntries(
  Object.entries(CSS_TARGETS).map(([browser, [major, minor = 0]]) => [browser, (major << 16) | (minor << 8)]),
)
const LOCALE_FILE = /^([a-z]{2,3}(?:-[A-Za-z0-9]{2,8})?)\.json$/
const VIRTUAL = { tokens: '.micelio-tokens.css', segmented: '.micelio-segmented.css', entry: '.micelio-entry.css' }

function sha256(data: Uint8Array | string): string {
  return createHash('sha256').update(data).digest('hex')
}

function packageVersion(name: string): string {
  let dir = dirname(createRequire(import.meta.url).resolve(name))
  for (let up = dirname(dir); ; dir = up, up = dirname(dir)) {
    const file = join(dir, 'package.json')
    if (existsSync(file)) {
      const pkg = JSON.parse(readFileSync(file, 'utf8')) as { name?: string, version?: string }
      if (pkg.name === name && pkg.version) return pkg.version
    }
    if (up === dir) throw new Error(`cannot find the version of ${name}`)
  }
}

/**
 * Hash of everything besides the package that decides the compiled bytes: the compiler, the core build, Lightning CSS and the message compiler with their targets, and the contract.
 *
 * @param coreBuild - Identifies the core build; a different one gives a different key, so new URLs (ADR 0009, section 1).
 */
export function compileKey(coreBuild: string): string {
  return sha256(JSON.stringify({
    compiler: COMPILER_VERSION,
    store: STORE_VERSION,
    core: coreBuild,
    contract: CONTRACT_VERSION,
    lightningcss: packageVersion('lightningcss'),
    messageCompiler: packageVersion('@intlify/message-compiler'),
    targets: LIGHTNINGCSS_TARGETS,
  }))
}

/** The digest of a compiled entry: a hash of its inputs, so it is known before compiling and the CSS can name its own URLs. */
export function compiledDigest(packageDigest: string, key: string): string {
  return sha256(`${packageDigest}\n${key}`)
}

/** Every regular file under `dir` as a path with `/` separators, sorted; a symlink is an error and nothing is followed. */
function walk(dir: string, prefix = ''): string[] {
  const found: string[] = []
  for (const entry of readdirSync(join(dir, prefix), { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const path = `${prefix}${entry.name}`
    if (entry.isSymbolicLink()) throw new Error(`${path} is a symlink; copy the file instead`)
    if (entry.isDirectory()) found.push(...walk(dir, `${path}/`))
    else if (entry.isFile()) found.push(path)
  }
  return found
}

/** Paths of a theme folder that a package would hold: fonts and images by their allowlists, in a stable order. */
function assetFiles(theme: InstalledTheme, folder: 'fonts' | 'images', pattern: RegExp, warnings: string[]): Array<[string, Buffer]> {
  const root = join(theme.dir, folder)
  if (!existsSync(root)) return []
  const files: Array<[string, Buffer]> = []
  for (const path of walk(root)) {
    if (!pattern.test(path)) {
      warnings.push(`${folder}/${path} is not ${folder === 'fonts' ? 'a font or a license (woff, woff2, txt)' : 'an image (png, jpg, webp, avif, gif, svg)'} and is not served`)
      continue
    }
    files.push([`${folder}/${path}`, readFileSync(join(root, path))])
  }
  return files
}

/** The entry stylesheet: each part in its named layer, in the order the Nuxt build imports them (ADR 0005, section 3). */
function themeEntry(theme: InstalledTheme, code: boolean): string {
  const has = (file: string): boolean => existsSync(join(theme.dir, file))
  const slotsDir = join(theme.dir, 'slots')
  const slotFiles = code && existsSync(slotsDir) ? readdirSync(slotsDir).filter(file => file.endsWith('.css')).sort().map(file => `slots/${file}`) : []
  const layer = (file: string, name: string): string => `@import ${JSON.stringify(`./${file}`)} layer(${name});`
  return [
    ...['fonts.css', 'font-fallbacks.css'].filter(has).map(file => layer(file, 'myc.settings')),
    layer(VIRTUAL.tokens, 'myc.settings'),
    layer(VIRTUAL.segmented, 'myc.components'),
    ...['theme.css', ...slotFiles].filter(has).map(file => layer(file, 'myc.theme')),
  ].join('\n')
}

/** Bundles a stylesheet's imports, lowers it for the core's targets and rewrites the theme's own URLs under `base`. */
async function bundleCss(theme: InstalledTheme, virtual: Map<string, string>, base: string): Promise<string> {
  const dir = resolve(theme.dir)
  const unrewritten = new Set<string>()
  // Fonts and images move under the entry; fragments stay; anything else is left and fails below
  const rewrite = (url: string): string => {
    if (url.startsWith('#')) return url
    if (url.startsWith('/fonts/')) return `${base}${url}`
    if (url.startsWith(`/${IMAGES_URL}/`)) return `${base}/images/${url.slice(IMAGES_URL.length + 2)}`
    unrewritten.add(url)
    return url
  }
  const result = await bundleAsync({
    filename: join(dir, VIRTUAL.entry),
    minify: true,
    targets: LIGHTNINGCSS_TARGETS,
    errorRecovery: false,
    resolver: {
      read(file) {
        const text = virtual.get(file)
        if (text !== undefined) return text
        const read = readThemeFile(dir, file)
        if ('problem' in read) throw new Error(read.problem)
        return read.text
      },
      resolve(specifier, from) {
        const target = resolve(dirname(from), specifier)
        if (target !== dir && !target.startsWith(dir + sep)) throw new Error(`@import "${specifier}" leaves the theme folder`)
        return target
      },
    },
    visitor: {
      Url: url => ({ ...url, url: rewrite(url.url) }),
      Image(image) {
        if (image.type !== 'image-set') return undefined
        return { ...image, value: { ...image.value, options: image.value.options.map(option => (option.image.type === 'url' ? { ...option, image: { ...option.image, value: { ...option.image.value, url: rewrite(option.image.value.url) } } } : option)) } }
      },
      // image-set() and similar inside custom properties are raw tokens: their strings are the URLs
      Function(fn) {
        if (!URL_FUNCTIONS.has(fn.name.toLowerCase())) return undefined
        return { type: 'function' as const, value: { ...fn, arguments: fn.arguments.map(token => (token.type === 'token' && token.value.type === 'string' ? { ...token, value: { ...token.value, value: rewrite(token.value.value) } } : token)) } }
      },
    },
  })
  const css = result.code.toString()
  const left = [...unrewritten, ...cssUrls(css, 'theme.css').filter(url => !url.startsWith('#') && !url.startsWith(`${base}/`))]
  if (left.length) throw new Error(`url(${left[0]}) is not under the theme's fonts/ or images/`)
  if (css.length > MAX_COMPILED_CSS_BYTES) throw new Error(`the stylesheet is ${css.length} bytes; the limit is ${MAX_COMPILED_CSS_BYTES}`)
  return css
}

/** Reads `i18n/<locale>.json`, checks the namespace and compiles the messages; returns them by locale. */
function themeMessages(theme: InstalledTheme): RuntimeData['messages'] {
  const dir = join(theme.dir, 'i18n')
  if (!existsSync(dir)) return {}
  const messages: RuntimeData['messages'] = {}
  for (const file of readdirSync(dir).sort()) {
    const locale = LOCALE_FILE.exec(file)?.[1]
    if (locale === undefined) throw new Error(`i18n/${file} is not a locale file (en.json, es.json, pt-BR.json…)`)
    const read = readThemeFile(theme.dir, join(dir, file))
    if ('problem' in read) throw new Error(read.problem)
    let parsed: unknown
    try {
      parsed = JSON.parse(read.text)
    } catch {
      throw new Error(`i18n/${file} is not valid JSON`)
    }
    const problem = messageProblem(parsed)
    if (problem !== null) throw new Error(`i18n/${file}: ${problem}`)
    messages[locale] = compileMessages(parsed as Parameters<typeof compileMessages>[0])
  }
  if (JSON.stringify(messages).length > MAX_MESSAGES_BYTES) throw new Error(`the messages are larger than ${MAX_MESSAGES_BYTES} bytes once compiled`)
  return messages
}

/** Adds `<path>.gz` and `<path>.br` for each text file; gzip has no timestamp and brotli fixed parameters, so the bytes are stable. */
function precompressed(files: Map<string, Buffer>): Map<string, Buffer> {
  const all = new Map(files)
  for (const [path, data] of files) {
    if (!PRECOMPRESSED.test(path)) continue
    all.set(`${path}.gz`, gzipDeterministic(data))
    all.set(`${path}.br`, brotliCompressSync(data, { params: { [zlib.BROTLI_PARAM_QUALITY]: 11, [zlib.BROTLI_PARAM_SIZE_HINT]: data.length } }))
  }
  return new Map([...all].sort(([a], [b]) => (a < b ? -1 : 1)))
}

/**
 * Compiles a validated theme into the files of a store entry: `theme.css`, `sections.css`, `runtime.json`, `fonts/` and `images/`, with gzip and brotli copies of each text file.
 *
 * @remarks
 * Nothing from the theme is executed or imported: its CSS is parsed, its messages compiled to an AST and its fonts and images copied
 * as bytes. The result depends only on the theme's bytes, the core build and the compiler (`compileKey`), so compiling twice gives
 * the same bytes. The `url()` of the theme's CSS are rewritten under `/_t/<digest>/` on the parsed tree, and one that is left over
 * fails the compile.
 *
 * @throws `InstallError` with the rule `css`, `url`, `messages` or `assets` naming what failed.
 */
export async function compileTheme({ theme, packageDigest, code, coreBuild }: CompileInput): Promise<CompiledTheme> {
  const subject = { id: theme.id, version: theme.manifest.version, digest: packageDigest }
  const key = compileKey(coreBuild)
  const digest = compiledDigest(packageDigest, key)
  if (!COMPILED_DIGEST.test(digest)) throw new InstallError('compile', subject, 'the digest of the entry is malformed')
  const base = `${SERVE_PREFIX}/${digest}`
  const dir = resolve(theme.dir)
  const virtual = new Map([
    [join(dir, VIRTUAL.tokens), buildTokensCss(theme.manifest)],
    [join(dir, VIRTUAL.segmented), buildSegmentedCss(theme.manifest.modes)],
  ])
  const files = new Map<string, Buffer>()
  const warnings: string[] = []
  const stylesheet = async (entry: string, name: string): Promise<Buffer> => {
    virtual.set(join(dir, VIRTUAL.entry), entry)
    try {
      return Buffer.from(await bundleCss(theme, virtual, base))
    } catch (error) {
      const message = (error as Error).message
      throw new InstallError(message.startsWith('url(') ? 'url' : 'css', subject, `${name}: ${message.replaceAll(dir, '.')}`, { cause: error })
    }
  }
  files.set(ENTRY_FILES.theme, await stylesheet(themeEntry(theme, code), ENTRY_FILES.theme))
  if (existsSync(join(dir, 'sections.css'))) files.set(ENTRY_FILES.sections, await stylesheet('@import "./sections.css" layer(myc.theme);', ENTRY_FILES.sections))
  let messages: RuntimeData['messages']
  try {
    messages = themeMessages(theme)
  } catch (error) {
    throw new InstallError('messages', subject, (error as Error).message.replaceAll(dir, '.'), { cause: error })
  }
  try {
    for (const [path, data] of [...assetFiles(theme, 'fonts', FONT_ASSET_FILE, warnings), ...assetFiles(theme, 'images', IMAGE_FILE, warnings)]) files.set(path, data)
  } catch (error) {
    throw new InstallError('assets', subject, (error as Error).message, { cause: error })
  }
  const { manifest } = theme
  const palette = buildPalette(manifest)
  const runtime: RuntimeData = {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    digest,
    packageDigest,
    contract: formatContractVersion(parseContractVersion(manifest.contract)!),
    code,
    modes: manifest.modes.map(({ id, scheme, name }) => ({ id, scheme, name })),
    fonts: (manifest.fonts ?? []).map(font => ({ ...font, url: `${base}/fonts/${font.file}` })),
    images: Object.fromEntries(Object.entries(manifest.images ?? {}).map(([role, file]) => [role, `${base}/images/${file}`])),
    layout: { ...DEFAULT_LAYOUT, ...manifest.layout },
    slots: manifest.slots ?? {},
    mermaid: manifest.mermaid ?? {},
    display: themeDisplay(manifest),
    palette: { modes: palette.modes, rules: palette.rules },
    messages,
  }
  files.set(ENTRY_FILES.runtime, Buffer.from(JSON.stringify(runtime)))
  return { digest, compileKey: key, files: precompressed(files), warnings }
}
