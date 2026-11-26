import { z } from 'zod'
import { PREVIEW_CONTENT_TYPES, PREVIEW_TOKEN_MAX_LENGTH } from '~/constants/preview'
import { previewMode } from '~/helpers/preview'
import { Locale } from '~/interfaces/locale'
import { THEME_ID, THEME_VERSION, VERSION_MAX_LENGTH } from '../../modules/theme/constants'

/** The value of `measure` that names a measurement of a page with a reusable block's draft (ADR 0019, amendment of 2026-11-23): the weight request's marker and the `meta.measure` of the CMS's answer. */
const MEASURE_REFERENCE = 'reference'

/** The query of `/_preview`: the token, and optionally the mode the draft route opens in. Anything else is ignored. */
export const previewQuerySchema = z.object({
  token: z.string().min(1).max(PREVIEW_TOKEN_MAX_LENGTH),
  mode: z.string().optional(),
})

/** A mode id, as the site's `accentOverrides` names it. */
const MODE_SLUG = /^[a-z][a-z0-9-]*$/
/** The most accent overrides a token binds (ADR 0019, amendment of 2026-11-25). */
const MAX_ACCENT_OVERRIDES = 16

/**
 * Candidate accents, one per mode, in the shape of the site's `accentOverrides` (ADR 0005, section 8): `mode` a slug unique in the list, `color` `#RRGGBB`, at most 16.
 *
 * @remarks
 * A list outside that grammar does not parse. Whether the theme has the mode, and whether the color reaches contrast, is decided when it is resolved (`resolveTheme`).
 */
export const accentOverridesSchema = z.array(z.object({ mode: z.string().max(64).regex(MODE_SLUG), color: z.string().regex(/^#[\da-f]{6}$/i) }))
  .max(MAX_ACCENT_OVERRIDES)
  .refine(items => new Set(items.map(item => item.mode)).size === items.length, 'a mode is named twice')

/**
 * The overrides the CMS bound to a preview token and answers on the exchange (`data.overrides`) and the draft read (`meta.overrides`), ADR 0019, amendment of 2026-11-25.
 *
 * @remarks
 * `theme` is an installed theme, by id and exact version, to render the draft with instead of the active one; its grammar is the pin's (ADR 0009, section 2).
 * `accentOverrides` replace the site's saved accents for the draft response. Both are checked again whatever the CMS checked; any other member is dropped.
 */
export const previewOverridesSchema = z.object({
  theme: z.object({
    id: z.string().regex(THEME_ID),
    version: z.string().max(VERSION_MAX_LENGTH).regex(THEME_VERSION),
  }).optional(),
  accentOverrides: accentOverridesSchema.optional(),
})

/** The overrides of a preview grant. */
export type PreviewOverrides = z.infer<typeof previewOverridesSchema>

/** What the CMS answers to the exchange of a preview token (`POST /api/micelio/preview/exchange`, docs/operate/preview.md of the plugin); `overrides` only when the token has one. */
export const previewGrantSchema = z.object({
  data: z.object({
    grant: z.string().min(1),
    expiresAt: z.string().min(1),
    adminOrigin: z.string().min(1),
    contentType: z.string().min(1),
    documentId: z.string().min(1),
    locale: z.string().min(1).nullable(),
    overrides: previewOverridesSchema.optional(),
  }),
})

/** The grant of an exchange, with what it is bound to. */
export type PreviewGrant = z.infer<typeof previewGrantSchema>['data']

/**
 * The `meta` of the CMS's answer to a draft read: who the grant acts for (ADR 0019, amendment of 2026-10-25), the overrides bound to an admin grant (amendment of 2026-11-25), and for a system grant bound to a reference, `measure` and the reusable block and version it resolved (amendment of 2026-11-23).
 *
 * @remarks
 * An answer without a known actor, with an override outside its grammar, with a `measure` other than `reference`, or with `measure` and `reusableBlock` not both present on a `system` answer does not parse. A reader uses `overrides` only when `actor` is `admin`.
 */
export const previewDraftMetaSchema = z.object({
  actor: z.enum(['admin', 'system']),
  overrides: previewOverridesSchema.optional(),
  measure: z.literal(MEASURE_REFERENCE).optional(),
  reusableBlock: z.object({ documentId: z.string().min(1), version: z.string().min(1) }).optional(),
}).refine(({ actor, measure, reusableBlock }) => (measure === undefined && reusableBlock === undefined) || (actor === 'system' && measure !== undefined && reusableBlock !== undefined))

/** A document id as the CMS writes it. */
const DOCUMENT_ID = /^[A-Za-z0-9_-]{1,64}$/

/** The route parameters of the weight report: the content type of the preview kinds and the document, checked before any CMS call. */
export const weightParamsSchema = z.object({
  uid: z.string().refine(uid => Object.hasOwn(PREVIEW_CONTENT_TYPES, uid)),
  documentId: z.string().regex(DOCUMENT_ID),
})

/**
 * The query of `GET /_micelio/contrast`: the document the editor's grant names, and the candidate accents as `accent=<mode>:<#RRGGBB>`, repeated once per mode.
 *
 * @remarks
 * The candidates follow `accentOverridesSchema`; a query outside it does not parse, and the route answers its 404.
 */
export const contrastQuerySchema = z.object({
  documentId: z.string().regex(DOCUMENT_ID),
  accent: z.union([z.string(), z.array(z.string())]).optional()
    .transform(value => (value === undefined ? [] : [value].flat()).map((item) => {
      const separator = item.indexOf(':')
      return separator < 0 ? { mode: item, color: '' } : { mode: item.slice(0, separator), color: item.slice(separator + 1) }
    }))
    .pipe(accentOverridesSchema),
})

/**
 * The query of the weight report: the language the draft is rendered in (default `en`), the mode (default `dynamic`; anything but `static` is `dynamic`, as for `/_preview`) and `measure`.
 *
 * @remarks
 * `measure` is absent, or `reference` on the request of a system grant bound to a reference (ADR 0019, amendment of 2026-11-23; bogd3v/micelio-plugin-core#267). It is no credential: it only selects the `populate` of the draft read, and the CMS's answer must agree with it. Any other value fails, which the route answers with the draft 404.
 */
export const weightQuerySchema = z.object({
  locale: z.preprocess(value => value === '' ? undefined : value, z.enum(Object.values(Locale) as [Locale, ...Locale[]], { error: 'Unsupported locale' }).optional()),
  mode: z.unknown().optional().transform(previewMode),
  measure: z.literal(MEASURE_REFERENCE).optional(),
})
