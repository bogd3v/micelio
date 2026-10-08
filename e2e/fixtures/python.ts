import type { Page } from '@playwright/test'
import { resultOf, runButton } from './playground'

// The Python playgrounds of the mock Strapi's article (e2e/mock-strapi.mjs), after the SQL and JavaScript ones: a program over hidden setup, and a loop that never ends
export const PYTHON = 5
export const PYTHON_LOOP = 6

/** Replaces the code of a playground, as a reader editing it would. */
export async function setCode(page: Page, index: number, code: string): Promise<void> {
  await page.evaluate(([position, source]) => {
    document.querySelectorAll('micelio-playground')[Number(position)]!.querySelector('[data-playground-code]')!.textContent = String(source)
  }, [index, code])
}

export interface PythonRun {
  state: string
  text: string
}

/** Runs `code` in the first Python playground and waits for it to end. */
export async function runPython(page: Page, code: string, index: number = PYTHON): Promise<PythonRun> {
  await setCode(page, index, code)
  await runButton(page, index).click()
  const result = resultOf(page, index)
  await result.and(page.locator('[data-state=done], [data-state=error], [data-state=stopped]')).waitFor({ timeout: 90_000 })
  return { state: (await result.getAttribute('data-state')) ?? '', text: (await result.textContent()) ?? '' }
}

/** Paths of the app's own requests (not the page's assets) a run makes: `/api/…` is what a Worker with a stray `fetch` would reach. */
export function trackApiRequests(page: Page): string[] {
  const paths: string[] = []
  page.context().on('request', (request) => {
    const { pathname } = new URL(request.url())
    if (pathname.startsWith('/api/')) paths.push(pathname)
  })
  return paths
}
