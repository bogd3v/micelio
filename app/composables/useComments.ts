import type { Comment, CommentFormData, CommentsResponse, GuestCommentInput } from '~/interfaces/comment'
import { isFediverseComment } from '~/helpers/comments'
import { asApiError } from '~/helpers/apiError'

function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message
  return fallback
}

/**
 * Loads, posts and groups the comments of one article in the current locale.
 *
 * @remarks
 * The comments are shared state keyed by locale and article. The article is identified by `articleDocumentId` when it is given, and by `articleSlug` otherwise. `fetchComments` reads `/api/comments/flat` and keeps a failure in `error` without throwing. `postComment` sends a guest comment with trimmed fields, refetches the list and sets `submitSuccess` until 3 seconds after the list is refetched. A failed post sets `submitError` (a rate-limit message on HTTP 429) and rethrows the error, so the caller must catch it. Call it in setup, because it reads `useI18n` and `useState`.
 */
export function useComments(articleSlug: string, articleDocumentId?: string) {
  const { t, locale } = useI18n()

  const relation = computed(() => {
    if (articleDocumentId) {
      return `api::article.article:${articleDocumentId}`
    }
    return `api::article.article:${articleSlug}`
  })

  const allComments = useState<Comment[]>(`comments:${locale.value}:${relation.value}`, () => [])
  const loaded = useState<boolean>(`comments-loaded:${locale.value}:${relation.value}`, () => false)
  const pending = ref(false)
  const error = ref<string | null>(null)
  const submitting = ref(false)
  const submitError = ref<string | null>(null)
  const submitSuccess = ref(false)

  async function fetchComments() {
    pending.value = true
    error.value = null

    try {
      const response = await $fetch<CommentsResponse>('/api/comments/flat', {
        query: { relation: relation.value, locale: locale.value },
      })

      allComments.value = response.data || []
      loaded.value = true
    } catch (err: unknown) {
      error.value = getErrorMessage(err, 'Failed to load comments')
      console.error('Error fetching comments:', err)
    } finally {
      pending.value = false
    }
  }

  async function postComment(data: CommentFormData) {
    submitting.value = true
    submitError.value = null
    submitSuccess.value = false

    const cleanData: GuestCommentInput = {
      author: {
        name: data.author.name.trim(),
        email: data.author.email.trim(),
      },
      content: data.content.trim(),
      locale: locale.value,
    }

    if (data.author.avatar && data.author.avatar.trim()) {
      cleanData.author.avatar = data.author.avatar.trim()
    }

    if (data.threadOf) {
      cleanData.threadOf = data.threadOf
    }

    try {
      const response = await $fetch('/api/comments', {
        method: 'POST',
        query: { relation: relation.value },
        body: cleanData,
      })

      submitSuccess.value = true
      await fetchComments()

      setTimeout(() => {
        submitSuccess.value = false
      }, 3000)

      return response
    } catch (err: unknown) {
      const e = asApiError(err)
      submitError.value = (e.response?.status || e.statusCode) === 429
        ? t('comments.tooMany')
        : getErrorMessage(err, 'Failed to post comment')
      console.error('Error posting comment:', err)
      throw err
    } finally {
      submitting.value = false
    }
  }

  const comments = computed<Comment[]>(() => allComments.value.filter(comment => !comment.threadOf))
  const totalComments = computed<number>(() => allComments.value.length)
  const fediverseReplies = computed<number>(() => allComments.value.filter(isFediverseComment).length)

  function repliesOf(commentId: number): Comment[] {
    return allComments.value.filter(comment => comment.threadOf?.id === commentId)
  }

  return {
    comments,
    pending,
    error,
    totalComments,
    fediverseReplies,
    loaded,
    repliesOf,
    submitting,
    submitError,
    submitSuccess,
    fetchComments,
    postComment,
  }
}
