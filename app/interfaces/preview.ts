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

/** The share of one block of a draft in its weight report. */
export interface WeightBlock {
  /** The block's catalogue id (ADR 0018): its component name without the namespace, such as `hero` or `rich-text`. */
  id: string
  /** What the page weighs more with the block than without it, in KB as sent. */
  kb: number
  /** The script its island loads only once it is used; 0 for a block that has none. */
  onDemandKb: number
}

/**
 * The weight of a draft in one rendering mode (`GET /api/preview/{uid}/{documentId}/weight`).
 *
 * @remarks
 * KB are 1024 bytes as the server sends them, rounded to 0.1, measured on the rendered page and never estimated. The HTML, CSS and fonts are those of the draft route; the scripts are the public route's where the document is published (`docs/performance.md`, "Weight of a draft").
 */
export interface WeightReport {
  mode: PreviewMode
  htmlKb: number
  /** The stylesheets the page declares. */
  cssKb: number
  /** The scripts the published page declares plus any the draft route adds, `modulepreload` links included. */
  jsKb: number
  /** The fonts the page preloads and its stylesheets reference. */
  fontKb: number
  /** The images the page loads without scrolling: those not marked `loading="lazy"`. */
  imagesKb: number
  /** HTML, CSS, JS, fonts and images; never `onDemandKb`. */
  totalKb: number
  /** The script the islands of the page load only once one is used, apart from `totalKb`. */
  onDemandKb: number
  /** One entry per block of the draft's zone, in order. */
  blocks: WeightBlock[]
}

/** The answer of the weight route. */
export interface WeightReportResponse {
  data: WeightReport
}
