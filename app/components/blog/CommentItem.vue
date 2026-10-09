<script setup lang="ts">
import type { Comment } from '~/interfaces/comment'
import { formatDotDate } from '~/helpers/formatDate'
import { isFediverseComment } from '~/helpers/comments'

const props = defineProps<{
  comment: Comment
  canReply?: boolean
}>()

const emit = defineEmits<{
  reply: [comment: Comment]
}>()

const { t } = useI18n()

const name = computed<string>(() => props.comment.author?.name || t('post.anonymous'))
const fediverse = computed<boolean>(() => isFediverseComment(props.comment))
const fediverseLabel = computed<string>(() => {
  const handle = props.comment.fediverseActorHandle
  return handle ? `${t('comments.fediverseBadge')} · ${handle}` : t('comments.fediverseBadge')
})
const showActions = computed<boolean>(() => Boolean((props.canReply && !props.comment.blockedThread) || props.comment.fediverseUri))
</script>

<template>
  <article :class="['myc-comment', { 'myc-comment-fediverse': fediverse }]">
    <BlogAuthorBadge :author="{ name }" />
    <div class="myc-comment-body">
      <header class="myc-comment-head">
        <span class="myc-comment-name">{{ name }}</span>
        <span v-if="fediverse" class="myc-comment-badge myc-comment-badge-fediverse">
          <span aria-hidden="true">◆</span> {{ fediverseLabel }}
        </span>
        <span v-if="comment.isAdminComment" class="myc-comment-badge myc-comment-badge-author">{{ t('comments.authorBadge') }}</span>
        <time class="myc-meta myc-comment-date" :datetime="comment.createdAt">{{ formatDotDate(comment.createdAt) }}</time>
      </header>
      <p v-if="comment.removed" class="myc-comment-text myc-comment-removed">{{ t('comments.removed') }}</p>
      <p v-else class="myc-comment-text">{{ comment.content }}</p>
      <div v-if="showActions" class="myc-comment-actions">
        <button v-if="canReply && !comment.blockedThread" type="button" class="myc-blog-textbtn" @click="emit('reply', comment)">{{ t('comments.reply') }}</button>
        <a
          v-if="comment.fediverseUri"
          class="myc-meta myc-comment-instance-link"
          :href="comment.fediverseUri"
          target="_blank"
          rel="noopener noreferrer nofollow ugc"
          :aria-label="t('comments.viewOnInstanceAria', { name })"
        >
          {{ t('comments.viewOnInstance') }} <span aria-hidden="true">↗</span>
        </a>
      </div>
    </div>
  </article>
</template>
