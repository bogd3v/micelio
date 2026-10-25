import { draftListResponseSchema, draftPageResponseSchema } from '~/schemas/drafts'
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
    description: 'Editors only, with their own session, or the admin\'s iframe with a preview grant cookie (ADR 0019), which shows only the document the grant names. Anyone else gets `notFound`. Answers `private, no-store`.',
    tag: 'Drafts',
    session: 'required',
    parameters: [
      { name: 'documentId', in: 'path', description: 'The article document id.' },
      LOCALE_PARAMETER,
    ],
    response: { status: 200, schema: draftArticleResponseSchema, description: 'The draft and, when there is one, its published version. With a preview grant there is no published version and `preview` carries the admin origin.' },
    errors: ['notFound', 'upstreamUnavailable'],
  },
  {
    file: 'server/api/drafts/pages/[documentId].get.ts',
    method: 'get',
    path: '/api/drafts/pages/{documentId}',
    summary: 'Get the draft of a page',
    description: 'Editors only, with their own session, or the admin\'s iframe with a preview grant cookie (ADR 0019), which shows only the document the grant names. Anyone else gets `notFound`. Answers `private, no-store`.',
    tag: 'Drafts',
    session: 'required',
    parameters: [
      { name: 'documentId', in: 'path', description: 'The page document id.' },
      LOCALE_PARAMETER,
    ],
    response: { status: 200, schema: draftPageResponseSchema, description: 'The draft page. With a preview grant `preview` carries the admin origin.' },
    errors: ['notFound', 'upstreamUnavailable'],
  },
]
