/** The cookie that holds the preview grant in the admin's iframe (ADR 0019, section 3). */
export const PREVIEW_COOKIE = '__Host-micelio_preview'

/** The request header that carries the grant to the CMS's draft route. */
export const PREVIEW_GRANT_HEADER = 'X-Micelio-Preview-Grant'

/** The envelope versions the preview frame speaks (ADR 0019, section 4). */
export const PREVIEW_PROTOCOL_VERSIONS: readonly number[] = [1]

/** The content types the preview can show, by CMS UID, and the draft route each one opens. */
export const PREVIEW_CONTENT_TYPES: Readonly<Record<string, 'article' | 'page'>> = {
  'api::article.article': 'article',
  'api::page.page': 'page',
}

/** The longest preview token the frontend sends to the CMS; the tokens the plugin makes are far shorter. */
export const PREVIEW_TOKEN_MAX_LENGTH = 256

/** The key of `event.context` under which the weight route hands the draft it redeemed to the sub-requests of its report (ADR 0019, amendment of 2026-10-25). */
export const PREVIEW_DRAFT_CONTEXT_KEY = 'previewDraft'

/** The longest grant the weight route reads from `X-Micelio-Preview-Grant`; the grants of the plugin are far shorter. */
export const PREVIEW_GRANT_MAX_LENGTH = 256

/** The most a patch may write into one text field; longer text is dropped with the whole message. */
export const PREVIEW_PATCH_TEXT_MAX = 10_000

/** The fields a patch never writes: the component name, the id, and the sanitized HTML that only the server makes (ADR 0019, section 2). */
export const PREVIEW_PATCH_FORBIDDEN_FIELDS: ReadonlySet<string> = new Set(['__component', 'id', 'html'])

/** The text fields of a block and of its items that a patch may write, and which of them the server requires. */
export interface PreviewPatchFields {
  /** Fields of the section itself. */
  section: readonly string[]
  /** Fields of each of its items. */
  item: readonly string[]
  /** Fields that the server requires to be text with at least one character; a patch never clears them. */
  required?: { section?: readonly string[], item?: readonly string[] }
}

/**
 * The text fields a patch may write, by catalogue id: those of the section and those of each of its items (ADR 0019, amendment of 2026-11-02).
 *
 * @remarks
 * The rule is the contract's: a field is here when the block interface (`app/interfaces/page.ts`) types it as free text whose only server check is that it is not empty (`server/schemas/page.ts`) and the component shows it through its own escaping. A field the server requires (`required`) takes text that is not blank; an optional one also takes `null`. Links, media, URLs, MIME types, variants, counts, slugs, flags and lists are never here, and neither is a field of sanitized HTML. A block or a field that is not listed cannot be patched.
 */
export const PREVIEW_PATCH_TEXT_FIELDS: Readonly<Record<string, PreviewPatchFields>> = {
  'hero': { section: ['title', 'text'], item: [], required: { section: ['title'] } },
  'feature-grid': { section: ['title', 'text'], item: ['title', 'text'], required: { item: ['title'] } },
  'media-showcase': { section: ['title'], item: [] },
  'stats': { section: ['title'], item: ['value', 'label'], required: { item: ['value', 'label'] } },
  'logo-cloud': { section: ['title'], item: ['name'], required: { item: ['name'] } },
  'testimonials': { section: ['title'], item: ['quote', 'author', 'role'], required: { item: ['quote', 'author'] } },
  'pricing': { section: ['title', 'text'], item: ['name', 'price', 'period'], required: { item: ['name', 'price'] } },
  'faq': { section: ['title'], item: ['question'], required: { item: ['question'] } },
  'cta': { section: ['title', 'text'], item: [], required: { section: ['title'] } },
  'post-list': { section: ['title'], item: [] },
  'newsletter': { section: ['title', 'text', 'buttonLabel'], item: [] },
  'rich-text': { section: [], item: [] },
  'gallery': { section: ['title'], item: ['alternativeText'] },
  'scene': { section: ['title', 'text', 'alt'], item: [], required: { section: ['alt'] } },
}

/** The most items of one block a patch names. */
export const PREVIEW_PATCH_MAX_ITEMS = 100

/** The tallest gap the admin may open, in CSS pixels. */
export const PREVIEW_GAP_MAX_HEIGHT = 2000

/** Milliseconds between two reports of the blocks while the page reflows or scrolls. */
export const PREVIEW_REPORT_INTERVAL_MS = 100
