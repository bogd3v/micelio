/**
 * How the draft route renders the page: `dynamic` as visitors get it, `static` with every island on its static alternative.
 */
export type PreviewMode = 'dynamic' | 'static'

/**
 * What a draft answer carries when the request came with a preview grant (ADR 0019).
 *
 * @public
 */
export interface DraftPreview {
  /** The origin of the admin page that frames the draft: the only origin the frame talks to. */
  adminOrigin: string
}

/** What the frame says about itself in `ready`. */
export interface PreviewFrame {
  /** The origin of the admin page the frame posts to. */
  adminOrigin: string
  documentId: string
  /** `null` for a draft that is not localised. */
  locale: string | null
  /** The `updatedAt` of the draft the frame shows. */
  version: string
}
