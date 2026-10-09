import type { Ref } from 'vue'

export function useHeaderSection(): Ref<string> {
  return useState<string>('myc-header-section', () => '')
}
