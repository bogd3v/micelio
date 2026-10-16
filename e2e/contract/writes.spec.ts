import { randomUUID } from 'node:crypto'
import { test, expect } from '@playwright/test'
import { commentSchema, commentsResponseSchema, commentTreeSchema } from '../../app/schemas/comments'
import { DEMO, cmsFetch, expectShape } from './support'

// What the frontend writes to a real CMS, and what it must not be given.

test('a guest comment is stored, shown back and never carries the email', async ({ request, baseURL }) => {
  const list = await (await request.get('/api/posts?locale=en')).json()
  const article = list.data.find((entry: { slug: string }) => entry.slug === DEMO.firstArticle)
  const relation = `api::article.article:${article.documentId}`
  const content = `Contract comment ${randomUUID()}`

  const posted = await request.post(`/api/comments?relation=${encodeURIComponent(relation)}`, {
    headers: { origin: baseURL! },
    data: { author: { name: 'Contract Test', email: 'contract@example.com' }, content, locale: 'en' },
  })
  expect(posted.status()).toBe(200)
  const comment = await posted.json()
  expect(commentSchema.safeParse(comment).error?.issues ?? []).toEqual([])
  expectShape(comment, { id: 'number', content: 'string', author: 'object', createdAt: 'string' })
  expect(comment.content).toBe(content)
  expect(JSON.stringify(comment)).not.toContain('contract@example.com')

  const tree = await (await request.get(`/api/comments?relation=${encodeURIComponent(relation)}&locale=en`)).json()
  expect(commentTreeSchema.safeParse(tree).error?.issues ?? []).toEqual([])
  expect(tree.map((entry: { content: string }) => entry.content)).toContain(content)
  expect(JSON.stringify(tree)).not.toContain('contract@example.com')

  const flat = await (await request.get(`/api/comments/flat?relation=${encodeURIComponent(relation)}&locale=en`)).json()
  expectShape(flat, { data: 'array', pagination: 'object' })
  expect(commentsResponseSchema.safeParse(flat).error?.issues ?? []).toEqual([])
  expect(flat.data.map((entry: { content: string }) => entry.content)).toContain(content)
})

// The newsletter module is off on the contract server (no SMTP), so the route is not served: the contract is the CMS calls of server/utils/subscribers.ts,
// made with the same token (create, find by email, update, delete)
test('the subscriber write: create, find by email, confirm and delete', async () => {
  const email = `contract-${randomUUID()}@example.com`
  const created = await cmsFetch('/api/subscribers', {
    method: 'POST',
    body: { data: { email, confirmationToken: randomUUID(), unsubscribeToken: randomUUID(), confirmed: false, language: 'en' } },
  })
  expect(created.status).toBe(201)
  const { data } = await created.json()
  expectShape(data, { documentId: 'string', email: 'string', confirmed: 'boolean', language: 'string' })

  const found = await (await cmsFetch(`/api/subscribers?${new URLSearchParams({ 'filters[email][$eq]': email })}`)).json()
  expect(found.data).toHaveLength(1)
  expect(found.data[0].documentId).toBe(data.documentId)

  const updated = await cmsFetch(`/api/subscribers/${data.documentId}`, { method: 'PUT', body: { data: { confirmed: true } } })
  expect(updated.status).toBe(200)
  expect((await updated.json()).data.confirmed).toBe(true)

  expect((await cmsFetch(`/api/subscribers/${data.documentId}`, { method: 'DELETE' })).status).toBe(204)
})

// The drafts routes need an editor session, which the demo does not seed, so their response schemas (app/schemas/drafts.ts) are parsed in test/integration/api.test.ts only
test('drafts are refused to a caller that is not an editor', async ({ request }) => {
  expect((await request.get('/api/drafts?locale=en')).status()).toBe(404)
  expect((await request.get('/api/drafts/does-not-matter?locale=en')).status()).toBe(404)
})
