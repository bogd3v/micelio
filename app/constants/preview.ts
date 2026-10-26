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
