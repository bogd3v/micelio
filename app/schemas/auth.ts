import { z } from 'zod'
import type { AuthUser, AuthUserResponse, OkResponse } from '~/interfaces/auth'
import { responseSchema } from './response'

/** The empty acknowledgement of the auth routes that only change state. */
export const okResponseSchema = responseSchema<OkResponse>()(
  z.strictObject({ ok: z.literal(true) }).meta({ id: 'OkResponse', description: 'The request was accepted.' }),
)

/** A signed-in account as the client receives it. */
export const authUserSchema = responseSchema<AuthUser>()(
  z.strictObject({
    username: z.string(),
    email: z.string(),
    role: z.enum(['reader', 'editor']),
    createdAt: z.string().nullable(),
  }).meta({ id: 'AuthUser', description: 'A signed-in account. `createdAt` is an ISO 8601 date, or null when the CMS returned none.' }),
)

/** The answer of sign-in, sign-up and the session check. */
export const authUserResponseSchema = responseSchema<AuthUserResponse>()(
  z.strictObject({ user: authUserSchema.nullable() }).meta({ id: 'AuthUserResponse', description: 'The account, or `user: null` when the visitor is signed out.' }),
)
