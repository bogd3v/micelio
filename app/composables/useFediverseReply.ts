import type { Ref } from 'vue'

const INSTANCE_INPUT_ID = 'myc-fedi-article-instance'

interface FediverseReply {
  replyOpen: Ref<boolean>
  toggleReply: () => void
  openReply: () => Promise<void>
}

/**
 * Holds the open state of the Fediverse reply box of one article, and opens it on demand.
 *
 * @remarks
 * The open state is shared app state keyed by `documentId`, so each article has its own box. `openReply` opens the box, waits for it to render and focuses its instance field. Call it in setup, because it uses `useState`.
 *
 * @param documentId - The article's document id, or its slug when it has none; it is the state key.
 */
export function useFediverseReply(documentId: string): FediverseReply {
  const replyOpen = useState<boolean>(`fediverse-reply-open:${documentId}`, () => false)

  function toggleReply(): void {
    replyOpen.value = !replyOpen.value
  }

  async function openReply(): Promise<void> {
    replyOpen.value = true
    await nextTick()
    document.getElementById(INSTANCE_INPUT_ID)?.focus()
  }

  return { replyOpen, toggleReply, openReply }
}
