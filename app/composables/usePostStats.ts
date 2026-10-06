import type { Ref } from 'vue'
import type { FediverseStats, PostListItem } from '~/interfaces'

/** Fediverse likes and boosts of a list of posts, fetched on the client only when the list is federated. */
export function usePostStats(posts: Ref<PostListItem[]>, federated: Ref<boolean | undefined>): (post: PostListItem) => FediverseStats | undefined {
  const documentIds = computed<string>(() =>
    posts.value.map(post => post.documentId).filter(Boolean).join(','),
  )
  const { data: stats } = useFetch<Record<string, FediverseStats>>('/api/fediverse/stats', {
    query: { documentIds },
    server: false,
    lazy: true,
    immediate: Boolean(federated.value && documentIds.value),
    watch: federated.value ? [documentIds] : false,
  })

  function statsOf(post: PostListItem): FediverseStats | undefined {
    if (!federated.value || !post.documentId) return undefined
    return stats.value?.[post.documentId]
  }

  return statsOf
}
