import type { RouteEntry } from '../types'
import { ACCOUNT_ROUTES } from './account'
import { CONTENT_ROUTES } from './content'
import { DRAFT_ROUTES } from './drafts'
import { NEWSLETTER_ROUTES } from './newsletter'
import { SITE_FILE_ROUTES } from './site-files'

/**
 * Every route file of `server/api` and `server/routes`, one entry each, described for the OpenAPI document.
 *
 * @remarks
 * Add an entry when a route file is added and remove it when one goes; `npm run lint:openapi` fails otherwise. Run `npm run openapi` after any change here or to a schema it uses.
 */
export const ROUTES: RouteEntry[] = [...CONTENT_ROUTES, ...ACCOUNT_ROUTES, ...DRAFT_ROUTES, ...NEWSLETTER_ROUTES, ...SITE_FILE_ROUTES]
