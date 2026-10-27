import { draftListResponseSchema, draftPageResponseSchema } from '~/schemas/drafts'
import { draftArticleResponseSchema } from '~/schemas/posts'
import { weightReportResponseSchema } from '~/schemas/preview'
import type { ParameterSpec, RouteEntry } from '../types'

const WITHOUT_PARAMETER: ParameterSpec = {
  name: 'without',
  in: 'query',
  description: 'The position of one block to leave out of the render, for the weight report. Read only with a preview grant; ignored otherwise. Optional.',
  schema: { type: 'integer', minimum: 0, maximum: 999 },
}

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
      WITHOUT_PARAMETER,
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
      WITHOUT_PARAMETER,
    ],
    response: { status: 200, schema: draftPageResponseSchema, description: 'The draft page. With a preview grant `preview` carries the admin origin.' },
    errors: ['notFound', 'upstreamUnavailable'],
  },
  {
    file: 'server/api/preview/[uid]/[documentId]/weight.get.ts',
    method: 'get',
    path: '/api/preview/{uid}/{documentId}/weight',
    summary: 'Get the weight of a draft',
    description: 'The weight of the draft as a visitor would download it, measured on the rendered page and never estimated: the draft is rendered in the requested mode and once more without each of its blocks, so a block\'s share is the difference. KB are 1024 bytes as this server sends them (HTML, the scripts, stylesheets and fonts it declares, and the images not marked `loading="lazy"`). `onDemandKb` is the script its islands load only once one is used, apart from `totalKb`. Authorised by a preview grant of ADR 0019, which shows only the document it names: the editor\'s, in the `__Host-micelio_preview` cookie, or the CMS\'s own system grant, in the `X-Micelio-Preview-Grant` header, which works with the preview off, is used once and names one version of the draft. Anyone else gets `notFound`, as does a content type that is not an article or a page. Kept 5 minutes per version of the draft. Answers `private, no-store`. To a request whose `Origin` is exactly `NUXT_PREVIEW_ADMIN_ORIGIN` it also sends `Access-Control-Allow-Origin` (that origin), `Access-Control-Allow-Credentials: true` and `Vary: Origin`, so the admin page can read the report with a credentialed `fetch`; to any other origin, or with the preview off, no `Access-Control-*` header.',
    tag: 'Drafts',
    parameters: [
      { name: 'uid', in: 'path', description: 'The content type of the document: `api::article.article` or `api::page.page`, URL-encoded as the client sees fit.', schema: { type: 'string', enum: ['api::article.article', 'api::page.page'] } },
      { name: 'documentId', in: 'path', description: 'The document id the grant names.' },
      LOCALE_PARAMETER,
      { name: 'X-Micelio-Preview-Grant', in: 'header', description: 'The system grant the CMS mints to measure a draft at publish (at most 256 characters). Optional: without it the editor\'s grant cookie is read. It is never sent to a browser.', schema: { type: 'string', maxLength: 256 } },
      { name: 'mode', in: 'query', description: 'The mode to render in: `dynamic` (default) or `static`, which leaves every island on its static alternative, as the preview does.', schema: { type: 'string', enum: ['dynamic', 'static'] } },
    ],
    response: { status: 200, schema: weightReportResponseSchema, description: 'The weight report of the draft in the requested mode.' },
    errors: ['invalidRequest', 'notFound', 'tooManyRequests', 'upstreamUnavailable'],
  },
]
