import type { Ref } from 'vue'

/**
 * Adds a copy button behaviour to the code blocks inside `target`.
 *
 * @remarks
 * On mount, each `[data-myc-copy]` button in the target gets its label and an `aria-live` attribute, and is hidden when the browser has no clipboard API. A click copies the text of the block without its `.myc-prompt` lines and shows the copied label for 1.6 seconds. The click listener is removed when the component unmounts. Call it in setup, because it registers lifecycle hooks and reads `useI18n`.
 */
export function useCodeBlockCopy(target: Ref<HTMLElement | null>): void {
  const { t } = useI18n()

  function setLabel(button: HTMLButtonElement, copied: boolean): void {
    button.textContent = copied ? t('myc.code.copied') : t('myc.code.copy')
    button.setAttribute('aria-label', copied ? t('myc.code.copied') : t('myc.code.copyAria'))
  }

  function prepare(): void {
    const canCopy = !!navigator.clipboard
    target.value?.querySelectorAll<HTMLButtonElement>('[data-myc-copy]').forEach((button) => {
      setLabel(button, false)
      button.setAttribute('aria-live', 'polite')
      button.hidden = !canCopy
    })
  }

  async function onClick(event: MouseEvent): Promise<void> {
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>('[data-myc-copy]')
    const code = button?.closest('.myc-code')?.querySelector('code')
    if (!button || !code) return

    const clone = code.cloneNode(true) as HTMLElement
    clone.querySelectorAll('.myc-prompt').forEach(prompt => prompt.remove())

    try {
      await navigator.clipboard.writeText(clone.textContent ?? '')
      setLabel(button, true)
      setTimeout(() => setLabel(button, false), 1600)
    } catch {
      setLabel(button, false)
    }
  }

  useEventListener(target, 'click', onClick)
  onMounted(prepare)
}
