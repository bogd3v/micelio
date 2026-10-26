import { z } from 'zod'
import { PREVIEW_CONTENT_TYPES, PREVIEW_TOKEN_MAX_LENGTH } from '~/constants/preview'
import { previewMode } from '~/helpers/preview'
import { Locale } from '~/interfaces/locale'

/** The query of `/_preview`: the token, and optionally the mode the draft route opens in. Anything else is ignored. */
export const previewQuerySchema = z.object({
  token: z.string().min(1).max(PREVIEW_TOKEN_MAX_LENGTH),
  mode: z.string().optional(),
})

/** What the CMS answers to the exchange of a preview token (`POST /api/micelio/preview/exchange`, docs/operate/preview.md of the plugin). */
export const previewGrantSchema = z.object({
  data: z.object({
    grant: z.string().min(1),
    expiresAt: z.string().min(1),
    adminOrigin: z.string().min(1),
    contentType: z.string().min(1),
    documentId: z.string().min(1),
    locale: z.string().min(1).nullable(),
  }),
})

/** The grant of an exchange, with what it is bound to. */
export type PreviewGrant = z.infer<typeof previewGrantSchema>['data']

/** The `meta` of the CMS's answer to a draft read: who the grant acts for (ADR 0019, amendment of 2026-10-25). An answer without it, or with another actor, does not parse. */
export const previewDraftMetaSchema = z.object({ actor: z.enum(['admin', 'system']) })

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
