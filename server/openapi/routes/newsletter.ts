// `~/schemas/*` are the response schemas of `app/schemas/`; `../../schemas/*` are the request schemas of `server/schemas/`
import { confirmResponseSchema, subscribeResponseSchema, unsubscribeResponseSchema } from '~/schemas/newsletter'
import { subscribeSchema } from '../../schemas/newsletter'
import type { RouteEntry } from '../types'

const NEWSLETTER_TAG = 'Newsletter'
const TOKEN_PATTERN = '^[\\w-]{16,128}$'

/** Operations of the newsletter module: subscribe, confirm and unsubscribe. */
export const NEWSLETTER_ROUTES: RouteEntry[] = [
  {
    file: 'server/api/newsletter/subscribe.post.ts',
    method: 'post',
    path: '/api/newsletter/subscribe',
    summary: 'Subscribe to the newsletter',
    description: 'Sends a confirmation email. The answer is the same for a new and an already confirmed address. Answers `private, no-store`.',
    tag: NEWSLETTER_TAG,
    body: subscribeSchema,
    response: { status: 200, schema: subscribeResponseSchema, description: 'The subscription was recorded.' },
    errors: ['invalidInput', 'forbiddenOrigin', 'notFound', 'payloadTooLarge', 'tooManyRequests', 'internalError'],
  },
  {
    file: 'server/api/newsletter/confirm.post.ts',
    method: 'post',
    path: '/api/newsletter/confirm',
    summary: 'Confirm a newsletter subscription',
    description: 'Sent by the confirmation page when the visitor presses the button, never on opening the link. Same-origin only.',
    tag: NEWSLETTER_TAG,
    bodySchema: {
      type: 'object',
      properties: { token: { type: 'string', pattern: TOKEN_PATTERN, description: 'The confirmation token from the email.' } },
      required: ['token'],
    },
    response: { status: 200, schema: confirmResponseSchema, description: '`alreadyConfirmed` is true when the link was used before.' },
    errors: ['invalidToken', 'forbiddenOrigin', 'notFound', 'payloadTooLarge', 'internalError', 'tooManyRequests'],
  },
  {
    file: 'server/api/newsletter/unsubscribe.post.ts',
    method: 'post',
    path: '/api/newsletter/unsubscribe',
    summary: 'Unsubscribe from the newsletter',
    description: 'The token comes in the body (the unsubscribe page) or in the query (RFC 8058 one-click). Answers success for an unknown or used token.',
    tag: NEWSLETTER_TAG,
    parameters: [{
      name: 'token',
      in: 'query',
      description: 'The unsubscribe token from the email; alternative to the body.',
      schema: { type: 'string', pattern: TOKEN_PATTERN },
    }],
    bodySchema: {
      type: 'object',
      properties: { token: { type: 'string', pattern: TOKEN_PATTERN, description: 'The unsubscribe token from the email.' } },
    },
    bodyOptional: true,
    response: { status: 200, schema: unsubscribeResponseSchema, description: '`{ success: true }`.' },
    errors: ['invalidToken', 'notFound', 'payloadTooLarge', 'upstreamUnavailable', 'tooManyRequests'],
  },
]
