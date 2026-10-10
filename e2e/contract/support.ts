import { expect } from '@playwright/test'

/** The CMS the suite runs against and the frontend's API token, set by `npm run test:contract` (scripts/contract/run.mjs) */
export const CMS_URL = process.env.CONTRACT_CMS_URL!
export const STRAPI_TOKEN = process.env.CONTRACT_STRAPI_TOKEN!

/** The seeded demo content (`MICELIO_DEMO`, src/migrations/demo/content.ts of micelio-cms): the same on every run */
export const DEMO = {
  siteName: 'Field Notes',
  articles: { en: 3, es: 3 },
  firstArticle: 'starting-a-balcony-garden',
  categories: { garden: 2, kitchen: 1 },
  tags: { beginners: 2, compost: 1, seasonal: 1 },
  page: { en: 'showcase', es: 'muestra' },
} as const

type Kind = 'string' | 'number' | 'boolean' | 'array' | 'object' | 'null'

function kindOf(value: unknown): Kind {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value as Kind
}

/** Asserts that `value` has each key with the given kind (`'string?'` also allows null): the shape of a response, not its values */
export function expectShape(value: unknown, shape: Record<string, Kind | `${Kind}?`>): void {
  expect(kindOf(value), 'an object').toBe('object')
  const record = value as Record<string, unknown>
  for (const [key, expected] of Object.entries(shape)) {
    const allowed = expected.endsWith('?') ? [expected.slice(0, -1), 'null'] : [expected]
    expect(allowed, `${key} is ${kindOf(record[key])}`).toContain(kindOf(record[key]))
  }
}

/** A request to the CMS with the frontend's API token, as `strapiFetch()` makes it (server/utils/strapi.ts) */
export async function cmsFetch(path: string, init: { method?: string, body?: unknown } = {}): Promise<Response> {
  return fetch(`${CMS_URL}${path}`, {
    method: init.method ?? 'GET',
    headers: { Authorization: `Bearer ${STRAPI_TOKEN}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
  })
}
