import type { Ref } from 'vue'

const INSTANCE_INPUT_ID = 'myc-fedi-article-instance'

interface FediverseReply {
  replyOpen: Ref<boolean>
  toggleReply: () => void
  openReply: () => Promise<void>
}

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
