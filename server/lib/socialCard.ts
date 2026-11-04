import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// The social card of a draft (bogd3v/micelio#734): a PNG drawn on the server from files this process already holds. Nothing here reads the network:
// the font is the theme's own file, decoded in memory and handed to libvips, and the colours come from the theme's palette.

/** The width of the card in pixels, the one `og:image` and every social network expect. */
export const SOCIAL_CARD_WIDTH = 1200
/** The height of the card in pixels. */
export const SOCIAL_CARD_HEIGHT = 630

const MARGIN = 96
const ACCENT_BAR = 24
/** The room the title has between the margins and above the site name. */
const TITLE_WIDTH = SOCIAL_CARD_WIDTH - MARGIN * 2
const TITLE_HEIGHT = 330
const TITLE_TOP = 110
const SITE_NAME_SIZE = 34
const SITE_NAME_TOP = SOCIAL_CARD_HEIGHT - 110
/** Title sizes in pixels, largest first: the first one whose text fits in `TITLE_HEIGHT` is drawn. */
const TITLE_SIZES = [92, 78, 66, 56, 48, 42]
const TITLE_MAX_CHARS = 140
const SITE_NAME_MAX_CHARS = 60
const HEX_COLOR = /^#[0-9a-f]{6}$/i

/** What a card shows and how: the words, the theme's colours and the theme's font. */
export interface SocialCardStyle {
  title: string
  siteName: string
  /** Backdrop, title colour and the accent of the bar and the site name, each as `#rrggbb`. */
  surface: string
  ink: string
  accent: string
  /** The font file as the theme ships it (WOFF2, TrueType or OpenType). The family to draw with is one derived from the file's bytes (`renameFontFamily`), never one the caller declares. */
  fontFile: Uint8Array
}

/**
 * The words of a card text: control and format (zero-width, direction marks, soft hyphen) characters dropped, white space collapsed.
 *
 * @remarks
 * `''` means nothing is left to draw, so a caller refuses an empty title before it renders.
 */
export function cardText(text: string): string {
  // Control (Cc) and format (Cf) characters draw nothing: zero-width, direction marks, the soft hyphen, the byte order mark
  return text.replace(/[\p{Cc}\p{Cf}]+/gu, ' ').replace(/\s+/g, ' ').trim()
}

/** Pango markup treats `&`, `<` and `>` as syntax. */
function markupText(text: string, limit: number): string {
  const clean = cardText(text)
  const cut = Array.from(clean).length > limit ? `${Array.from(clean).slice(0, limit - 1).join('').trimEnd()}…` : clean
  return cut.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** The part of `wawoff2` this file calls: it unpacks a WOFF2 file to the TrueType or OpenType file it holds. */
interface Wawoff2 {
  decompress: (woff2: Uint8Array) => Promise<Uint8Array>
}

/** The TrueType or OpenType bytes of a font file: a WOFF2 is unpacked in memory (libvips' FreeType has no Brotli), anything else is used as it is. */
async function sfntOf(file: Uint8Array): Promise<Uint8Array> {
  const isWoff2 = file.length > 4 && file[0] === 0x77 && file[1] === 0x4F && file[2] === 0x46 && file[3] === 0x32
  if (!isWoff2) return file
  // @ts-expect-error -- wawoff2 ships no types; its one function is described by `Wawoff2`
  const { decompress } = (await import('wawoff2')) as Wawoff2
  return decompress(file)
}

/** The name ids that say which family a face belongs to: the family and the typographic family. */
const FAMILY_NAME_IDS = new Set([1, 16])

/**
 * The TrueType or OpenType file with its family renamed to `family`, in a `name` table written anew at the end of the file.
 *
 * @remarks
 * libvips registers every font file it is given for the life of the process and picks one by family name, so two files that share a name (the same family in two themes, or in two versions)
 * draw as whichever came first, and a name that matches no file draws as the first family by name. Each file therefore gets a family of its own, derived from its bytes, and the card asks
 * for that one: the font drawn is the file given and nothing else. Every other name record is kept; the table directory points to the new table, whose checksum is left at 0, which
 * FreeType does not check.
 *
 * @throws `TypeError` when the file is not a single sfnt with a `name` table.
 * @internal
 */
export function renameFontFamily(sfnt: Uint8Array, family: string): Uint8Array {
  const file = Buffer.from(sfnt.buffer, sfnt.byteOffset, sfnt.byteLength)
  const fail = (): never => {
    throw new TypeError('The font file has no name table to rename')
  }
  if (file.length < 12 || file.toString('latin1', 0, 4) === 'ttcf') return fail()
  let directory = -1
  for (let record = 0; record < file.readUInt16BE(4) && 12 + record * 16 + 16 <= file.length; record++) {
    if (file.toString('latin1', 12 + record * 16, 16 + record * 16) === 'name') directory = 12 + record * 16
  }
  if (directory < 0) return fail()
  const table = file.readUInt32BE(directory + 8)
  if (table + 6 > file.length) return fail()
  const count = file.readUInt16BE(table + 2)
  const strings = table + file.readUInt16BE(table + 4)
  const encode = (platform: number, text: string): Buffer => platform === 1 ? Buffer.from(text, 'latin1') : Buffer.from(text, 'utf16le').swap16()
  const records: Array<{ platform: number, encoding: number, language: number, id: number, text: Buffer }> = []
  for (let i = 0; i < count && table + 6 + i * 12 + 12 <= file.length; i++) {
    const at = table + 6 + i * 12
    const [platform, encoding, language, id, length, offset] = [0, 2, 4, 6, 8, 10].map(field => file.readUInt16BE(at + field)) as [number, number, number, number, number, number]
    // A record in a language tag (format 1) is dropped with the tags; the rest is kept as it was
    if (language >= 0x8000 || strings + offset + length > file.length) continue
    records.push({ platform, encoding, language, id, text: FAMILY_NAME_IDS.has(id) ? encode(platform, family) : file.subarray(strings + offset, strings + offset + length) })
  }
  if (!records.some(record => record.id === 1)) records.push({ platform: 3, encoding: 1, language: 0x409, id: 1, text: encode(3, family) })
  records.sort((one, other) => one.platform - other.platform || one.encoding - other.encoding || one.language - other.language || one.id - other.id)
  const header = Buffer.alloc(6 + records.length * 12)
  header.writeUInt16BE(records.length, 2)
  header.writeUInt16BE(header.length, 4)
  let offset = 0
  records.forEach((record, index) => {
    const at = 6 + index * 12
    ;[record.platform, record.encoding, record.language, record.id, record.text.length, offset].forEach((value, field) => header.writeUInt16BE(value, at + field * 2))
    offset += record.text.length
  })
  const renamed = Buffer.concat([header, ...records.map(record => record.text)])
  const padding = Buffer.alloc((4 - file.length % 4) % 4)
  const out = Buffer.concat([file, padding, renamed])
  out.writeUInt32BE(0, directory + 4)
  out.writeUInt32BE(file.length + padding.length, directory + 8)
  out.writeUInt32BE(renamed.length, directory + 12)
  return out
}

/** A font written to disk, and the family it was renamed to. */
interface FontOnDisk {
  path: string
  family: string
}

let fontDirectory: string | undefined
const fontPaths = new Map<string, Promise<FontOnDisk>>()

async function writeFont(key: string, file: Uint8Array): Promise<FontOnDisk> {
  // The family is the digest of the bytes: the same file is the same family, two files never share one
  const family = `micelio${key.slice(0, 16)}`
  const bytes = renameFontFamily(await sfntOf(file), family)
  if (!fontDirectory) {
    const directory = mkdtempSync(join(tmpdir(), 'micelio-card-'))
    fontDirectory = directory
    process.once('exit', () => rmSync(directory, { recursive: true, force: true }))
    // No system font and no config to look for: libvips draws with the file it is given, and says nothing about a missing default config
    if (!process.env.FONTCONFIG_FILE) {
      writeFileSync(join(directory, 'fonts.conf'), '<?xml version="1.0"?><fontconfig><cachedir>' + directory + '/cache</cachedir></fontconfig>\n')
      process.env.FONTCONFIG_FILE = join(directory, 'fonts.conf')
    }
  }
  const path = join(fontDirectory, `${key}.ttf`)
  writeFileSync(path, bytes, { mode: 0o600 })
  return { path, family }
}

/**
 * The path of a font file on disk and its family, written once per distinct font: libvips loads a font by path only.
 *
 * @remarks
 * The folder is private to this process and removed when it exits. The name is the digest of the bytes, so two themes never share a file and a changed font is a new one.
 */
async function fontPathOf(file: Uint8Array): Promise<FontOnDisk> {
  const key = createHash('sha256').update(file).digest('hex').slice(0, 32)
  const known = fontPaths.get(key)
  if (known) return known
  const written = writeFont(key, file)
  fontPaths.set(key, written)
  try {
    return await written
  } catch (error: unknown) {
    // A failed decode is not kept: the next request tries again
    fontPaths.delete(key)
    throw error
  }
}

/**
 * Renders the social card of a title as a 1200×630 PNG.
 *
 * @remarks
 * A bar of the accent colour at the left edge, the title in the theme's font and the ink colour on the surface, and the site name in the accent at the foot. The title takes the largest size
 * of `TITLE_SIZES` that fits in its box; a longer one is cut at `TITLE_MAX_CHARS` characters. The font is the theme's single file, drawn at its default weight (a variable font is not
 * instanced). The result depends on the style alone, so it can be kept per document version.
 *
 * @throws When a colour is not `#rrggbb` or the font file cannot be read, so a card never falls back to a font the theme does not have.
 */
export async function renderSocialCard(style: SocialCardStyle): Promise<Buffer> {
  for (const color of [style.surface, style.ink, style.accent]) {
    if (!HEX_COLOR.test(color)) throw new TypeError('A card colour must be #rrggbb')
  }
  const { default: sharp } = await import('sharp')
  const { path: fontfile, family } = await fontPathOf(style.fontFile)
  // The family is the one this file was given on disk (letters and digits only); the comma after it keeps Pango from reading a style word at its end as a weight
  const font = `${family},`
  const text = async (markup: string, size: number, width: number) => sharp({
    text: { text: markup, font: `${font} ${size}`, fontfile, width, rgba: true, wrap: 'word-char', align: 'left' },
  }).png().toBuffer({ resolveWithObject: true })

  const title = markupText(style.title, TITLE_MAX_CHARS)
  const titleMarkup = `<span foreground="${style.ink}">${title}</span>`
  let drawn = await text(titleMarkup, TITLE_SIZES[0]!, TITLE_WIDTH)
  for (const size of TITLE_SIZES.slice(1)) {
    if (drawn.info.height <= TITLE_HEIGHT) break
    drawn = await text(titleMarkup, size, TITLE_WIDTH)
  }
  const titleImage = drawn.info.height > TITLE_HEIGHT
    ? await sharp(drawn.data).extract({ left: 0, top: 0, width: drawn.info.width, height: TITLE_HEIGHT }).png().toBuffer()
    : drawn.data
  const siteName = await text(`<span foreground="${style.accent}">${markupText(style.siteName, SITE_NAME_MAX_CHARS)}</span>`, SITE_NAME_SIZE, TITLE_WIDTH)

  return sharp({ create: { width: SOCIAL_CARD_WIDTH, height: SOCIAL_CARD_HEIGHT, channels: 3, background: style.surface } })
    .composite([
      { input: { create: { width: ACCENT_BAR, height: SOCIAL_CARD_HEIGHT, channels: 3, background: style.accent } }, left: 0, top: 0 },
      { input: titleImage, left: MARGIN, top: TITLE_TOP },
      { input: siteName.data, left: MARGIN, top: SITE_NAME_TOP },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer()
}

/** What `createCardCache` needs from the clock and the renderer; tests give their own. */
interface CardCacheOptions {
  /** How long a card is kept, in milliseconds. */
  ttlMs: number
  /** The most cards kept at once; the oldest goes first. */
  max: number
  render?: (style: SocialCardStyle) => Promise<Buffer>
  now?: () => number
}

/**
 * A memory of the cards drawn, by key: the same key within `ttlMs` gets the card already drawn, or the one in progress.
 *
 * @remarks
 * The key names a document version and a look (`previewSocialCard`), so a card that is kept is always the one a new request would draw. A render that fails is forgotten, and the caller sees the error.
 */
export function createCardCache({ ttlMs, max, render = renderSocialCard, now = Date.now }: CardCacheOptions): (key: string, style: SocialCardStyle) => Promise<Buffer> {
  const kept = new Map<string, { expires: number, card: Promise<Buffer> }>()
  return async (key, style) => {
    const time = now()
    for (const [id, entry] of kept) {
      if (entry.expires <= time) kept.delete(id)
    }
    const known = kept.get(key)
    if (known) return known.card
    const card = render(style)
    kept.set(key, { expires: time + ttlMs, card })
    if (kept.size > max) kept.delete(kept.keys().next().value!)
    try {
      return await card
    } catch (error: unknown) {
      kept.delete(key)
      throw error
    }
  }
}
