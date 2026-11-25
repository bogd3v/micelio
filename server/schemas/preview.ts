import { z } from 'zod'
import { PREVIEW_CONTENT_TYPES, PREVIEW_TOKEN_MAX_LENGTH } from '~/constants/preview'
import { previewMode } from '~/helpers/preview'
import { Locale } from '~/interfaces/locale'
import { THEME_ID, THEME_VERSION, VERSION_MAX_LENGTH } from '../../modules/theme/constants'

/** The query of `/_preview`: the token, and optionally the mode the draft route opens in. Anything else is ignored. */
export const previewQuerySchema = z.object({
  token: z.string().min(1).max(PREVIEW_TOKEN_MAX_LENGTH),
  mode: z.string().optional(),
})

/**
 * The overrides the CMS bound to a preview token and answers on the exchange (`data.overrides`) and the draft read (`meta.overrides`), ADR 0019, amendment of 2026-11-25.
 *
 * @remarks
 * Only `theme` is read here: an installed theme, by id and exact version, to render the draft with instead of the active one. Its grammar is the pin's (ADR 0009, section 2), checked again whatever the CMS checked. Other members (`accentOverrides`) are dropped.
 */
export const previewOverridesSchema = z.object({
  theme: z.object({
    id: z.string().regex(THEME_ID),
    version: z.string().max(VERSION_MAX_LENGTH).regex(THEME_VERSION),
  }).optional(),
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
 * The `meta` of the CMS's answer to a draft read: who the grant acts for (ADR 0019, amendment of 2026-10-25), and the overrides bound to an admin grant (amendment of 2026-11-25).
 *
 * @remarks
 * An answer without a known actor, or with an override outside its grammar, does not parse. A reader uses `overrides` only when `actor` is `admin`.
 */
export const previewDraftMetaSchema = z.object({ actor: z.enum(['admin', 'system']), overrides: previewOverridesSchema.optional() })

/** The route parameters of the weight report: the content type of the preview kinds and the document, checked before any CMS call. */
export const weightParamsSchema = z.object({
  uid: z.string().refine(uid => Object.hasOwn(PREVIEW_CONTENT_TYPES, uid)),
  documentId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
})

/** The query of the weight report: the language the draft is rendered in (default `en`) and the mode (default `dynamic`; anything but `static` is `dynamic`, as for `/_preview`). */
export const weightQuerySchema = z.object({
  locale: z.preprocess(value => value === '' ? undefined : value, z.enum(Object.values(Locale) as [Locale, ...Locale[]], { error: 'Unsupported locale' }).optional()),
  mode: z.unknown().optional().transform(previewMode),
})
