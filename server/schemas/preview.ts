import { z } from 'zod'
import { PREVIEW_TOKEN_MAX_LENGTH } from '~/constants/preview'

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
