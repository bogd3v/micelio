/**
 * What a credit line of an image says: who made it, its source, its license, or what was changed.
 *
 * @public
 */
export type CreditRole = 'author' | 'source' | 'license' | 'modifications'

/**
 * The license of an image, as a translation key and an optional link.
 *
 * @public
 */
export interface LicenseInfo {
  /** Key of the license name in the locale messages. */
  labelKey: string
  /** Link to the license text; absent when there is none. */
  href?: string
}

/**
 * One piece of an image credit, rendered in its credit line.
 *
 * @public
 */
export interface CreditPart {
  role: CreditRole
  /** The plain text of the part; absent for a part that is only a label or a link. */
  text?: string
  /** Key of the label to translate, used by the license part. */
  labelKey?: string
  href?: string
}
