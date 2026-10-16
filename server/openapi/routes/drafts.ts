import { draftListResponseSchema } from '~/schemas/drafts'
import { draftArticleResponseSchema } from '~/schemas/posts'
import type { ParameterSpec, RouteEntry } from '../types'

const LOCALE_PARAMETER: ParameterSpec = { name: 'locale', in: 'query', description: 'The language of the draft: `en` or `es`. Optional.' }

/** Operations of the drafts module: unpublished articles, for editors only. */
export const DRAFT_ROUTES: RouteEntry[] = [
  {
    file: 'server/api/drafts/index.get.ts',
    method: 'get',
    path: '/api/drafts',
    summary: 'List the drafts of the editor',
    description: 'Editors only, with their own session. Anyone else, with no session or without the editor role, gets `notFound`. Answers `private, no-store`.',
    tag: 'Drafts',
    session: 'required',
    parameters: [LOCALE_PARAMETER],
    response: { status: 200, schema: draftListResponseSchema, description: 'The drafts, newest edit first.' },
    errors: ['notFound', 'upstreamUnavailable'],
  },
  {
    file: 'server/api/drafts/[documentId].get.ts',
    method: 'get',
    path: '/api/drafts/{documentId}',
    summary: 'Get a draft and its published version',
    description: 'Editors only; anyone else gets `notFound`. Answers `private, no-store`.',
    tag: 'Drafts',
    session: 'required',
    parameters: [
      { name: 'documentId', in: 'path', description: 'The article document id.' },
      LOCALE_PARAMETER,
    ],
    response: { status: 200, schema: draftArticleResponseSchema, description: 'The draft and, when there is one, its published version.' },
    errors: ['notFound', 'upstreamUnavailable'],
  },
]
