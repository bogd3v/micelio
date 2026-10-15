import { z } from 'zod'
import type { ConfirmResponse, SubscribeResponse, UnsubscribeResponse } from '~/interfaces/newsletter'
import { responseSchema } from './response'

/** The answer to a newsletter sign-up (`POST /api/newsletter/subscribe`). */
export const subscribeResponseSchema = responseSchema<SubscribeResponse>()(
  z.strictObject({ success: z.boolean(), message: z.string() }).meta({ id: 'SubscribeResponse', description: 'Whether the sign-up worked, and the message to show in the visitor\'s language.' }),
)

/** The answer to a confirmation link (`POST /api/newsletter/confirm`). */
export const confirmResponseSchema = responseSchema<ConfirmResponse>()(
  z.strictObject({ success: z.boolean(), alreadyConfirmed: z.boolean(), message: z.string() }).meta({ id: 'ConfirmResponse', description: 'Whether the confirmation worked; `alreadyConfirmed` is true when the address was confirmed before.' }),
)

/** The answer to an unsubscribe request (`POST /api/newsletter/unsubscribe`). */
export const unsubscribeResponseSchema = responseSchema<UnsubscribeResponse>()(
  z.strictObject({ success: z.boolean() }).meta({ id: 'UnsubscribeResponse', description: 'The request was handled; an unknown or used token answers the same.' }),
)
