import type { Ref } from 'vue'

/**
 * Returns the shared label of the section the header shows, empty when no page sets it.
 *
 * @remarks
 * Pages write the label and the default layout reads it, so the header reflects the page on screen. The state key is `myc-header-section`. Call it in setup or a plugin, because it uses `useState`.
 */
export function useHeaderSection(): Ref<string> {
  return useState<string>('myc-header-section', () => '')
}
