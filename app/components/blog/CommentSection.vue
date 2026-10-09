<script setup lang="ts">
import type { Comment, CommentFilter, CommentFormData } from '~/interfaces/comment'
import { COMMENT_LIMITS, matchesCommentFilter } from '~/helpers/comments'

const FILTERS: CommentFilter[] = ['all', 'blog', 'fediverse']
const MODERATION_RULES: string[] = ['approval', 'edited', 'deleted', 'plainText']

const props = defineProps<{
  slug: string
  documentId?: string
  federated?: boolean
}>()

const { t } = useI18n()

const {
  comments,
  pending,
  error,
  totalComments,
  repliesOf,
  submitting,
  submitError,
  submitSuccess,
  fetchComments,
  postComment,
} = useComments(props.slug, props.documentId)
const { openReply } = useFediverseReply(props.documentId ?? props.slug)

const formData = reactive<CommentFormData>({
  author: {
    name: '',
    email: '',
    avatar: '',
  },
  content: '',
  threadOf: undefined,
})

const filter = ref<CommentFilter>('all')
const replyingTo = ref<number | null>(null)
const replyingToName = ref<string>('')
const formErrors = reactive({
  name: '',
  email: '',
  content: '',
})

function validateForm(): boolean {
  let isValid = true
  formErrors.name = ''
  formErrors.email = ''
  formErrors.content = ''

  if (!formData.author.name.trim()) {
    formErrors.name = t('comments.validationName')
    isValid = false
  }

  if (!formData.author.email.trim()) {
    formErrors.email = t('comments.validationEmail')
    isValid = false
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.author.email)) {
    formErrors.email = t('comments.validationInvalidEmail')
    isValid = false
  }

  if (!formData.content.trim()) {
    formErrors.content = t('comments.validationComment')
    isValid = false
  }

  return isValid
}

async function handleSubmit() {
  if (!validateForm()) return

  try {
    await postComment({ ...formData })
    resetForm()
  } catch {
    return
  }
}

function resetForm() {
  formData.content = ''
  formData.threadOf = undefined
  replyingTo.value = null
  replyingToName.value = ''
}

const countLabel = computed<string>(() => t('comments.count', { count: totalComments.value }, totalComments.value))
const visibleComments = computed<Comment[]>(() => comments.value.filter(comment => matchesCommentFilter(comment, filter.value)))
const emptyLabel = computed<string>(() => {
  if (filter.value === 'fediverse') return t('comments.noFediverseComments')
  if (filter.value === 'blog') return t('comments.noBlogComments')
  return t('comments.noComments')
})

function startReply(comment: Comment) {
  replyingTo.value = comment.id
  replyingToName.value = comment.author?.name || t('post.anonymous')
  formData.threadOf = comment.id
  nextTick(() => {
    const textarea = document.querySelector<HTMLTextAreaElement>('#comment-content')
    textarea?.focus()
  })
}

function selectFilter(value: CommentFilter) {
  filter.value = value
}

function cancelReply() {
  replyingTo.value = null
  replyingToName.value = ''
  formData.threadOf = undefined
}

onMounted(() => {
  fetchComments()
})
</script>

<template>
  <section id="comments" class="myc-comments myc-reveal" aria-labelledby="myc-comments-title">
    <div class="myc-comments-main">
      <div class="myc-home-heading">
        <p class="myc-eyebrow myc-home-eyebrow">{{ countLabel }}</p>
        <h2 id="myc-comments-title" class="myc-home-title myc-stretch">{{ t('comments.title') }}</h2>
        <p class="myc-comments-intro">{{ federated ? t('comments.introFediverse') : t('comments.intro') }}</p>
      </div>

      <div v-if="federated" class="myc-comments-filters" role="group" :aria-label="t('comments.filterLabel')">
        <button
          v-for="option in FILTERS"
          :key="option"
          type="button"
          class="myc-chip"
          :aria-pressed="filter === option ? 'true' : 'false'"
          @click="selectFilter(option)"
        >
          {{ t(`comments.filters.${option}`) }}
        </button>
      </div>

      <p v-if="pending" class="myc-meta myc-home-eyebrow" role="status">{{ t('common.loading') }}</p>

      <div v-else-if="error" class="myc-comments-error" role="alert">
        <p>{{ error }}</p>
        <button type="button" class="myc-blog-textbtn" @click="fetchComments">{{ t('common.retry') }}</button>
      </div>

      <p v-else-if="visibleComments.length === 0" class="myc-meta myc-comments-empty">{{ emptyLabel }}</p>

      <div v-else class="myc-comment-list">
        <div v-for="comment in visibleComments" :key="comment.id" class="myc-comment-group">
          <BlogCommentItem :comment="comment" can-reply @reply="startReply" />
          <div v-if="repliesOf(comment.id).length" class="myc-comment-thread">
            <BlogCommentItem v-for="reply in repliesOf(comment.id)" :key="reply.id" :comment="reply" />
          </div>
        </div>
      </div>

      <form class="myc-comment-form" novalidate @submit.prevent="handleSubmit">
        <div class="myc-comment-form-head">
          <p class="myc-eyebrow myc-home-eyebrow">
            {{ replyingTo ? `${t('comments.replyingTo')} ${replyingToName}` : t('comments.leave') }}
          </p>
          <button v-if="replyingTo" type="button" class="myc-blog-textbtn" @click="cancelReply">{{ t('comments.cancel') }}</button>
        </div>

        <p v-if="submitSuccess" class="myc-comment-status myc-comment-status-success" role="status">{{ t('comments.successMessage') }}</p>
        <p v-if="submitError" class="myc-comment-status myc-comment-status-error" role="alert">{{ submitError }}</p>

        <div class="myc-comment-fields">
          <div class="myc-comment-field">
            <label for="author-name">{{ t('comments.name') }}</label>
            <input
              id="author-name"
              v-model="formData.author.name"
              type="text"
              class="myc-comment-input"
              autocomplete="name"
              :maxlength="COMMENT_LIMITS.name"
              :placeholder="t('comments.namePlaceholder')"
              :aria-invalid="formErrors.name ? 'true' : undefined"
              :aria-describedby="formErrors.name ? 'author-name-error' : undefined"
            >
            <p v-if="formErrors.name" id="author-name-error" class="myc-comment-error" role="alert">{{ formErrors.name }}</p>
          </div>
          <div class="myc-comment-field">
            <label for="author-email">{{ t('comments.email') }}</label>
            <input
              id="author-email"
              v-model="formData.author.email"
              type="email"
              class="myc-comment-input"
              autocomplete="email"
              :maxlength="COMMENT_LIMITS.email"
              :placeholder="t('comments.emailPlaceholder')"
              :aria-invalid="formErrors.email ? 'true' : undefined"
              :aria-describedby="formErrors.email ? 'author-email-error author-email-hint' : 'author-email-hint'"
            >
            <p v-if="formErrors.email" id="author-email-error" class="myc-comment-error" role="alert">{{ formErrors.email }}</p>
            <p id="author-email-hint" class="myc-meta myc-comment-hint">{{ t('comments.emailRequired') }}</p>
          </div>
        </div>

        <div class="myc-comment-field">
          <label for="comment-content">{{ t('comments.comment') }}</label>
          <textarea
            id="comment-content"
            v-model="formData.content"
            rows="5"
            :maxlength="COMMENT_LIMITS.content"
            class="myc-comment-input myc-comment-textarea"
            :placeholder="t('comments.placeholder')"
            :aria-invalid="formErrors.content ? 'true' : undefined"
            :aria-describedby="formErrors.content ? 'comment-content-error' : undefined"
          />
          <p v-if="formErrors.content" id="comment-content-error" class="myc-comment-error" role="alert">{{ formErrors.content }}</p>
        </div>

        <div :class="['myc-comment-submit', { 'myc-comment-submit-split': federated }]">
          <button v-if="federated" type="button" class="myc-blog-textbtn" aria-controls="myc-fedi-reply" @click="openReply">
            {{ t('comments.replyFromFediverse') }} <span aria-hidden="true">↗</span>
          </button>
          <BdButton type="submit" arrow :disabled="submitting">
            {{ submitting ? t('comments.posting') : (replyingTo ? t('comments.postReply') : t('comments.postComment')) }}
          </BdButton>
        </div>
      </form>
    </div>

    <aside v-if="federated" class="myc-comments-moderation" aria-labelledby="myc-comments-moderation-title">
      <p id="myc-comments-moderation-title" class="myc-eyebrow myc-home-eyebrow">{{ t('comments.moderation.title') }}</p>
      <ul class="myc-meta myc-comments-moderation-list">
        <li v-for="rule in MODERATION_RULES" :key="rule">
          <span class="myc-comments-moderation-check" aria-hidden="true">✓</span>
          {{ t(`comments.moderation.${rule}`) }}
        </li>
      </ul>
    </aside>
  </section>
</template>
