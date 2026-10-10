import type {
  StrapiBlock,
  StrapiImageCredit,
  StrapiImageLicense,
  StrapiMedia,
  StrapiSlide,
  StrapiSlider,
} from '../interfaces/strapi-blocks'
import type { CreditPart, LicenseInfo } from '../interfaces/figure'

const CREATIVE_COMMONS = 'https://creativecommons.org'

const LICENSES: Readonly<Record<StrapiImageLicense, { key: string, path?: string, url?: string }>> = {
  'own-work': { key: 'ownWork' },
  'cc0': { key: 'cc0', path: '/publicdomain/zero/1.0/' },
  'public-domain': { key: 'publicDomain' },
  'cc-by-4.0': { key: 'ccBy4', path: '/licenses/by/4.0/' },
  'cc-by-sa-4.0': { key: 'ccBySa4', path: '/licenses/by-sa/4.0/' },
  'cc-by-nc-4.0': { key: 'ccByNc4', path: '/licenses/by-nc/4.0/' },
  'unsplash': { key: 'unsplash', url: 'https://unsplash.com/license' },
  'permission': { key: 'permission' },
  'other': { key: 'other' },
}

/**
 * The i18n key and the link of the license of a figure credit.
 *
 * @remarks
 * Creative Commons licenses link to their deed page. Licenses with a fixed link use it. Other licenses use the credit's own license URL, and own work has no link.
 *
 * @param language - The language of the Creative Commons deed page, such as `en` or `es`.
 */
export function licenseInfo(credit: StrapiImageCredit, language: string): LicenseInfo {
  const license = LICENSES[credit.license] ?? LICENSES.other
  const ownUrl = credit.licenseUrl?.trim() || undefined
  const href = license.path
    ? `${CREATIVE_COMMONS}${license.path}deed.${language}`
    : license.url ?? (credit.license === 'own-work' ? undefined : ownUrl)
  return { labelKey: license.key, href }
}

function text(value: string | null | undefined): string {
  return value?.trim() ?? ''
}

/**
 * The parts of a figure credit in display order: author, source, license and modifications.
 *
 * @remarks
 * Empty texts are left out, but the license is always present.
 *
 * @param language - The language of the license link, as in `licenseInfo`.
 */
export function creditParts(credit: StrapiImageCredit, language: string): CreditPart[] {
  const parts: CreditPart[] = []
  const author = text(credit.author)
  const source = text(credit.source)
  const modifications = text(credit.modifications)
  if (author) parts.push({ role: 'author', text: author, href: text(credit.authorUrl) || undefined })
  if (source) parts.push({ role: 'source', text: source, href: text(credit.sourceUrl) || undefined })
  const license = licenseInfo(credit, language)
  parts.push({ role: 'license', labelKey: license.labelKey, href: license.href })
  if (modifications) parts.push({ role: 'modifications', text: modifications })
  return parts
}

/** The slides of a slider block: its items that have a file or, when it has no items, its library files without a caption or credit. */
export function slidesOf(block: StrapiSlider): StrapiSlide[] {
  if (block.items?.length) return block.items.filter(item => Boolean(item.file))
  return (block.files ?? []).map(file => ({ file, caption: file.caption ?? null, credit: null }))
}

/** The caption of a media block, from the block or else from its library file, trimmed. Empty when there is none. */
export function mediaCaption(block: StrapiMedia): string {
  return text(block.caption) || text(block.file?.caption)
}

function hasFigcaption(block: StrapiBlock): boolean {
  if (block.__component === 'shared.media') return Boolean(mediaCaption(block) || block.credit)
  if (block.__component === 'shared.slider') return slidesOf(block).some(slide => Boolean(text(slide.caption) || slide.credit))
  return false
}

/** The key of a block in the map of `figureNumbers`, in the same form as `citationBlockKey`. */
export function figureBlockKey(block: StrapiBlock): string {
  return `${block.__component}-${block.id}`
}

/**
 * The figure number of each block that has a caption or a credit, keyed by `figureBlockKey`.
 *
 * @remarks
 * Numbers count from 1 in the order of the blocks. Blocks without a caption or a credit are not in the map.
 */
export function figureNumbers(blocks: StrapiBlock[] | null | undefined): Record<string, number> {
  const numbers: Record<string, number> = {}
  let count = 0
  for (const block of blocks ?? []) {
    if (hasFigcaption(block)) numbers[figureBlockKey(block)] = ++count
  }
  return numbers
}

/** A figure number with two digits, such as `02`. Larger numbers keep all their digits. */
export function formatFigureNumber(number: number): string {
  return String(number).padStart(2, '0')
}
