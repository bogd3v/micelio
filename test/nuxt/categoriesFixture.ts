import { registerEndpoint } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { expect, vi } from 'vitest'
import { clearNuxtData } from '#imports'
import type { CategoryEntry } from '~/interfaces'

function entry(id: number, slug: string, name: string, order: number, count: number, featured = false): CategoryEntry {
  return { id, slug, name, description: `About ${name}`, order, featured, count }
}

/** Categories no site constant knows, in the CMS order: `shed` is empty and `loft` is the sixth, so its color wraps to the first role. */
export const GARDEN_CATEGORIES: CategoryEntry[] = [
  entry(1, 'garden', 'Garden', 1, 3, true),
  entry(2, 'kitchen', 'Kitchen', 2, 2, true),
  entry(3, 'shed', 'Shed', 3, 0),
  entry(4, 'workshop', 'Workshop', 4, 1),
  entry(5, 'cellar', 'Cellar', 5, 4),
  entry(6, 'loft', 'Loft', 6, 5),
]

let served: CategoryEntry[] = GARDEN_CATEGORIES
let requests = 0
let requestsBefore = 0

registerEndpoint('/api/categories', () => {
  requests++
  return served
})

/** Makes `/api/categories` answer with `list` and drops the data the app cached, so the next mount asks again. Call it in `beforeEach` to start from the garden list. */
export function serveCategories(list: CategoryEntry[] = GARDEN_CATEGORIES): void {
  served = list
  requestsBefore = requests
  clearNuxtData()
}

/** Resolves once the app has asked for the list after the last `serveCategories` and applied the answer; use it before asserting that something is absent. */
export async function categoriesSettled(): Promise<void> {
  await vi.waitFor(() => expect(requests).toBeGreaterThan(requestsBefore))
  await flushPromises()
}

/** How many times the app has asked for `/api/categories` in this file. */
export function categoryRequestCount(): number {
  return requests
}
