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
  /** Milligrams of CO2e of one view of the page, the Sustainable Web Design estimate of `npm run perf` from the bytes of `totalKb`; an estimate, never a measurement. */
  co2Mg: number
  /** One entry per block of the draft's zone, in order. */
  blocks: WeightBlock[]
}

/** The answer of the weight route. */
export interface WeightReportResponse {
  data: WeightReport
}

/** The dynamic zone of a draft whose blocks the preview reports; articles have none yet (ADR 0019, section 4). */
export type PreviewZone = 'sections'

/**
 * Where a block is, as ADR 0019 addresses it: by position and catalogue id, never by Strapi's component id.
 *
 * @remarks
 * A message whose `version` is not the `updatedAt` of the draft the frame shows is dropped, so a reorder that crosses a reload cannot move the wrong block.
 */
export interface BlockAddress {
  zone: PreviewZone
  /** The position among the blocks the frontend renders, which is the `data-myc-index` of the block's root. */
  index: number
  /** The block's catalogue id: its component name without the namespace, such as `hero`. */
  block: string
  version: string
}

/** A rectangle in CSS pixels, from the top left corner of the document (scroll included). */
export interface PreviewBox {
  x: number
  y: number
  width: number
  height: number
}

/** A repeatable item of a block, such as one feature of a feature grid. */
export interface ItemBox {
  /** The item's position among the items of its block. */
  index: number
  box: PreviewBox
}

/** One block of the zone and the items inside it. */
export interface BlockBox {
  address: BlockAddress
  box: PreviewBox
  items: ItemBox[]
}

/** A scalar the patch of a block may write: the preview renders it through Vue's escaping, never as HTML. */
export type PatchScalar = string | null

/** The new plain-text values of a block or of one of its items, by field name. */
export type PatchContent = Record<string, PatchScalar>

/** Admin → frame: new values for a block, shown without a reload and never saved by the frame. */
export interface BlockPatch {
  address: BlockAddress
  content: PatchContent
  /** New values for items of the block, by position. */
  items: Array<{ index: number, content: PatchContent }>
}

/** Admin → frame: a gap of `height` pixels after the block at `after`, or at the top of the zone when `after` is `null`. */
export interface InsertGap {
  version: string
  zone: PreviewZone
  after: number | null
  /** At most `PREVIEW_GAP_MAX_HEIGHT`; 0 removes the gap. */
  height: number
}

/** How the frame shows a block with an island: `dynamic` as the page renders it, `static` as its static alternative (ADR 0019, amendment of 2026-11-04). */
export type RenderMode = 'dynamic' | 'static'

/** Admin → frame: show one block in a render mode. It is state of the frame, never saved. */
export interface RenderModeRequest {
  address: BlockAddress
  mode: RenderMode
}

/** Admin → frame: outline this block, or an item of it, or nothing (`address: null`). */
export interface SelectRequest {
  address: BlockAddress | null
  item: number | null
  /** Bring the block into view if it is outside the window, with no animation. */
  reveal: boolean
}

/** Admin → frame: the block or item the admin's list is pointing at, or nothing. */
export interface HoverRequest {
  address: BlockAddress | null
  item: number | null
}

/** Frame → admin: the selection or hover the frame found, with the box to draw (`null` with no address). */
export interface PointedBlock {
  address: BlockAddress | null
  item: number | null
  box: PreviewBox | null
}

/** Frame → admin: every block and item with its box, on each reflow and scroll. */
export interface BlocksReport {
  version: string
  scroll: { x: number, y: number }
  viewport: { width: number, height: number }
  blocks: BlockBox[]
}

/** The dynamic zones a block can be run in: the sections of a page draft and the blocks of an article draft (ADR 0019, amendment of 2026-11-06). */
export type RunZone = 'sections' | 'blocks'

/** Where the block to run is: a `BlockAddress` that also names the zone of an article. */
export interface RunAddress {
  zone: RunZone
  index: number
  /** The block's catalogue id: `playground` for the only block that runs. */
  block: string
  version: string
}

/** Admin → frame: run the saved Playground block at `address` and answer its output. Never carries code, a language or a setup. */
export interface RunRequest {
  /** Unique among the requests the admin has open; the answer carries it back. */
  requestId: string
  address: RunAddress
}

/** Why a run did not end well: the closed list of `micelio:runResult` (ADR 0019, amendment of 2026-11-06). */
export type RunFailure = 'codeError' | 'timeout' | 'runtimeUnavailable' | 'notRunnable'

/** Frame → admin: how the run ended. `output` holds the message of a `codeError`, as plain text. */
export type RunResultPayload
  = | { requestId: string, address: RunAddress, ok: true, output: string, truncated: boolean }
    | { requestId: string, address: RunAddress, ok: false, reason: RunFailure, output?: string }

/** What the frame runs for a request: the saved language, code and hidden setup of the block it found. */
export interface RunnableBlock {
  runtime: string
  code: string
  setup: string
}

/** How a run of the Worker ended: `started` says the runtime had loaded when it did. */
export interface PreviewRunOutcome {
  status: 'done' | 'error' | 'timeout' | 'stopped'
  output: string
  truncated: boolean
  started: boolean
}

/**
 * What the frame uses of the playground island's entry (`app/islands/playground.ts`), the file a reader's page imports when Run is pressed: the page's pool of Workers.
 *
 * @remarks
 * The frame imports the same file and no other, so the preview adds no chunk, request or byte to what a reader loads.
 */
export interface PlaygroundEntry {
  workers: () => {
    run: (options: { runtime: string, code: string, setup: string, onStarted?: () => void }) => { result: Promise<{ status: PreviewRunOutcome['status'], output: string, truncated: boolean }> }
  }
  /** Whether the playground has a runtime for a language. */
  canRun: (runtime: string) => boolean
  disposeWorkers: () => void
}

/** What the bridge needs to answer `micelio:run`. */
export interface PreviewRunOptions {
  /** The zone of the draft that `blocks` lists. */
  zone: RunZone
  /** The blocks of the draft the page loaded, in the CMS's order, as the route sent them. */
  blocks: () => ReadonlyArray<unknown> | null | undefined
  /** The CMS place of each Playground block of `blocks`, in order, for a draft whose route does not set it on the blocks (an article's: `playgroundPositions`). */
  positions?: () => ReadonlyArray<number> | undefined
  /** Imports the playground island's entry; called on each run, so a failed import is tried again. */
  load: () => Promise<PlaygroundEntry>
}
