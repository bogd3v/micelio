import { pageFixtures } from './pages.mjs'

const draftAuthor = { id: 31, documentId: 'author-1', name: 'Alejandro Ramirez', avatar: null }

export const draftArticles = [
  {
    id: 901,
    documentId: 'doc-draft-pihole',
    title: 'Pi-hole en una Raspberry Pi',
    slug: 'pi-hole-raspberry-pi',
    description: 'Bloquea rastreadores en toda tu red.',
    content: null,
    publishedAt: null,
    updatedAt: '2026-09-28T23:42:00.000Z',
    createdAt: '2026-09-20T10:00:00.000Z',
    locale: 'es',
    readTime: 6,
    tags: [],
    cover: null,
    category: { id: 23, documentId: 'cat-privacidad', name: 'Privacidad', slug: 'privacidad' },
    author: draftAuthor,
    blocks: [{ id: 901, __component: 'shared.rich-text', body: '## Qué es Pi-hole\n\nUn servidor DNS que bloquea rastreadores.' }],
    references: [],
    localizations: [],
  },
  {
    id: 902,
    documentId: 'doc-linux',
    title: 'Linux Server Hardening Guide, second edition',
    slug: 'linux-server-hardening-guide',
    description: 'Practical steps to harden a Linux server, updated.',
    content: null,
    publishedAt: null,
    updatedAt: '2026-09-27T14:15:00.000Z',
    createdAt: '2026-01-10T10:00:00.000Z',
    locale: 'en',
    readTime: 9,
    tags: [],
    cover: null,
    category: { id: 22, documentId: 'cat-linux', name: 'Linux y código abierto', slug: 'linux' },
    author: draftAuthor,
    blocks: [{ id: 902, __component: 'shared.rich-text', body: '## Basics\n\nStart with SSH keys and a firewall.' }],
    references: [],
    localizations: [],
  },
]

/** The page draft the preview and the editor's page route show: the English showcase page, edited. It has a scene, which is a heavy island. */
export const draftPage = {
  ...pageFixtures[0],
  id: 801,
  documentId: 'doc-page-draft',
  title: 'Field Notes, draft',
  slug: 'field-notes-draft',
  updatedAt: '2026-10-24T09:30:00.000Z',
  publishedAt: null,
}

function strapiError(status, name, message) {
  return { status, body: { data: null, error: { status, name, message, details: {} } } }
}

function listRow(draft, published) {
  return {
    documentId: draft.documentId,
    title: draft.title,
    slug: draft.slug,
    locale: draft.locale,
    updatedAt: draft.updatedAt,
    publishedAt: published?.publishedAt ?? null,
    state: published ? 'modified' : 'never-published',
    category: draft.category ? { name: draft.category.name, slug: draft.category.slug } : null,
    author: draft.author ? { name: draft.author.name } : null,
  }
}

export function createDraftsMock({ userFromAuth, publishedArticles }) {
  function isEditor(headers) {
    return userFromAuth(headers)?.role === 'editor'
  }

  function publishedVersion(documentId, locale) {
    return publishedArticles.find(article => article.documentId === documentId && article.locale === locale) ?? null
  }

  function handle(method, pathname, query, headers) {
    if (method !== 'GET') return null

    if (pathname === '/api/articles/drafts') {
      if (!isEditor(headers)) return strapiError(403, 'ForbiddenError', 'Forbidden')
      const data = draftArticles
        .filter(draft => !query.locale || draft.locale === query.locale)
        .map(draft => listRow(draft, publishedVersion(draft.documentId, draft.locale)))
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      return { status: 200, body: { data, meta: { count: data.length } } }
    }

    const single = pathname.match(/^\/api\/articles\/([^/]+)$/)
    if (single && !['search', 'drafts'].includes(single[1])) {
      const documentId = decodeURIComponent(single[1])
      const locale = query.locale || 'en'
      if (query.status === 'draft') {
        if (!isEditor(headers)) return strapiError(403, 'ForbiddenError', 'Forbidden')
        const draft = draftArticles.find(article => article.documentId === documentId && article.locale === locale)
        return draft ? { status: 200, body: { data: draft, meta: {} } } : strapiError(404, 'NotFoundError', 'Not Found')
      }
      const published = publishedVersion(documentId, locale)
      return published ? { status: 200, body: { data: published, meta: {} } } : strapiError(404, 'NotFoundError', 'Not Found')
    }

    const page = pathname.match(/^\/api\/pages\/([^/]+)$/)
    if (page && query.status === 'draft') {
      if (!isEditor(headers)) return strapiError(403, 'ForbiddenError', 'Forbidden')
      return decodeURIComponent(page[1]) === draftPage.documentId && (query.locale || 'en') === draftPage.locale
        ? { status: 200, body: { data: draftPage, meta: {} } }
        : strapiError(404, 'NotFoundError', 'Not Found')
    }

    if (pathname === '/api/articles' && query.status !== undefined && query.status !== 'published' && !isEditor(headers)) {
      return strapiError(403, 'ForbiddenError', 'Forbidden')
    }

    return null
  }

  return { handle }
}
