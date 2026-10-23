/**
 * Registers a global Cmd/Ctrl + key shortcut inside `onMounted` and
 * automatically cleans up the listener on `onUnmounted`.
 *
 * Constraints:
 * - Must be called synchronously within a component (or composable) setup
 *   context; it relies on `onMounted`/`onUnmounted` lifecycle hooks.
 * - The shortcut is client-only: the listener is attached after hydration,
 *   so key presses on the SSR'd page before hydration have no effect.
 *
 * @example
 * ```ts
 * useKeyboardShortcut('k', () => { isSearchOpen.value = true })
 * ```
 */
export function useKeyboardShortcut(key: string, handler: () => void): void {
  if (getCurrentInstance() === null) {
    console.warn(
      '[useKeyboardShortcut] must be called inside a component setup context; shortcut was not registered.',
    )
    return
  }

  onMounted(() => {
    const onKeydown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === key) {
        e.preventDefault()
        handler()
      }
    }
    window.addEventListener('keydown', onKeydown)
    onUnmounted(() => window.removeEventListener('keydown', onKeydown))
  })
}
