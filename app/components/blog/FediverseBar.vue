<script setup lang="ts">
import type { FediverseStats } from '~/interfaces'

const COPIED_MS = 1600

const props = defineProps<{
  slug: string
  documentId: string
}>()

const { t } = useI18n()
const config = useRuntimeConfig()
const commentsOn = useModule('comments')
const { copy, copied } = useClipboard({ copiedDuring: COPIED_MS, legacy: true })
const { fediverseReplies, loaded } = useComments(props.slug, props.documentId)
const { data: stats } = useFetch<FediverseStats>(() => `/api/fediverse/stats/${props.documentId}`, {
  server: false,
  lazy: true,
})
const articleUrl = computed<string>(() => `${config.public.fediverseArticlesUrl}/${props.documentId}`)
const { instance, error, preview, open } = useFediverseInstance(() => articleUrl.value)
const { replyOpen, toggleReply } = useFediverseReply(props.documentId)

const hint = computed<string>(() => {
  if (error.value === 'empty') return t('post.fediverse.errorEmpty')
  if (error.value === 'invalid') return t('post.fediverse.errorInvalid')
  if (preview.value) return t('post.fediverse.willOpen', { instance: preview.value })
  return t('post.fediverse.hint')
})

function copyArticleUrl(): void {
  copy(articleUrl.value)
}
</script>

<template>
  <section class="myc-fedi-bar" :aria-label="t('post.fediverse.label')">
    <div class="myc-fedi-bar-head">
      <p class="myc-meta myc-fedi-bar-stats">
        <span class="myc-fedi-accent" aria-hidden="true">◆ {{ t('post.fediverse.label') }}</span>
        <template v-if="stats">
          <span>
            <span class="myc-fedi-bar-count">{{ stats.likes }}</span>
            {{ t('post.fediverse.likes', stats.likes) }}
          </span>
          <span>
            <span class="myc-fedi-bar-count">{{ stats.boosts }}</span>
            {{ t('post.fediverse.boosts', stats.boosts) }}
          </span>
          <a v-if="loaded && commentsOn" class="myc-fedi-bar-link" href="#comments">
            <span class="myc-fedi-bar-count">{{ fediverseReplies }}</span>
            {{ t('post.fediverse.replies', fediverseReplies) }}
          </a>
        </template>
      </p>
      <button
        type="button"
        class="myc-chip"
        :aria-expanded="replyOpen ? 'true' : 'false'"
        aria-controls="myc-fedi-reply"
        @click="toggleReply"
      >
        {{ t('post.fediverse.reply') }}
      </button>
    </div>

    <div v-show="replyOpen" id="myc-fedi-reply" class="myc-fedi-reply">
      <p class="myc-fedi-reply-text">{{ t('post.fediverse.instructions') }}</p>
      <div class="font-mono myc-fedi-reply-url">
        <span class="myc-fedi-reply-address">{{ articleUrl }}</span>
        <button type="button" class="myc-chip" :aria-label="t('post.fediverse.copyAria')" @click="copyArticleUrl">
          {{ copied ? t('post.fediverse.copied') : t('post.fediverse.copy') }}
        </button>
        <span class="myc-sr" aria-live="polite">{{ copied ? t('post.fediverse.copiedAnnounce') : '' }}</span>
      </div>
      <form class="myc-fedi-form" novalidate @submit.prevent="open">
        <label for="myc-fedi-article-instance" class="myc-eyebrow myc-home-eyebrow">{{ t('post.fediverse.instanceLabel') }}</label>
        <div class="myc-fedi-row">
          <input
            id="myc-fedi-article-instance"
            v-model="instance"
            class="myc-input"
            type="text"
            inputmode="url"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            placeholder="mastodon.social"
            :aria-invalid="error ? 'true' : undefined"
            aria-describedby="myc-fedi-article-hint"
          >
          <MycButton type="submit" arrow>{{ t('post.fediverse.open') }}</MycButton>
        </div>
        <p id="myc-fedi-article-hint" :class="['myc-meta myc-fedi-hint', { 'myc-fedi-hint-error': error }]" role="status">{{ hint }}</p>
      </form>
      <p class="myc-meta myc-fedi-note">{{ t('post.fediverse.moderation') }}</p>
    </div>
  </section>
</template>
