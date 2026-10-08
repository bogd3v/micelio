import type { StrapiPlayground } from '~/interfaces'

/** Display names of the runtimes the CMS allows; any other value is shown as-is, as a plain code block */
const RUNTIMES: Readonly<Record<string, string>> = {
  sql: 'SQL',
  python: 'Python',
  javascript: 'JavaScript',
}

export function playgroundLanguage(runtime: string): string {
  return RUNTIMES[runtime] ?? runtime
}

/** Only a known runtime can be run by the island (PR 5); unknown ones stay static */
export function isRunnable(block: Pick<StrapiPlayground, 'runtime'>): boolean {
  return Object.hasOwn(RUNTIMES, block.runtime)
}

/** Empty or whitespace-only text is absent; trailing newlines are dropped */
export function playgroundText(value: string | null | undefined): string {
  return value?.trim() ? value.replace(/\n+$/, '') : ''
}
