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
  <section class="bd-fedi-bar" :aria-label="t('post.fediverse.label')">
    <div class="bd-fedi-bar-head">
      <p class="bd-meta bd-fedi-bar-stats">
        <span class="bd-fedi-accent" aria-hidden="true">◆ {{ t('post.fediverse.label') }}</span>
        <template v-if="stats">
          <span>
            <span class="bd-fedi-bar-count">{{ stats.likes }}</span>
            {{ t('post.fediverse.likes', stats.likes) }}
          </span>
          <span>
            <span class="bd-fedi-bar-count">{{ stats.boosts }}</span>
            {{ t('post.fediverse.boosts', stats.boosts) }}
          </span>
          <a v-if="loaded && commentsOn" class="bd-fedi-bar-link" href="#comments">
            <span class="bd-fedi-bar-count">{{ fediverseReplies }}</span>
            {{ t('post.fediverse.replies', fediverseReplies) }}
          </a>
        </template>
      </p>
      <button
        type="button"
        class="bd-chip"
        :aria-expanded="replyOpen ? 'true' : 'false'"
        aria-controls="bd-fedi-reply"
        @click="toggleReply"
      >
        {{ t('post.fediverse.reply') }}
      </button>
    </div>

    <div v-show="replyOpen" id="bd-fedi-reply" class="bd-fedi-reply">
      <p class="bd-fedi-reply-text">{{ t('post.fediverse.instructions') }}</p>
      <div class="font-mono bd-fedi-reply-url">
        <span class="bd-fedi-reply-address">{{ articleUrl }}</span>
        <button type="button" class="bd-chip" :aria-label="t('post.fediverse.copyAria')" @click="copyArticleUrl">
          {{ copied ? t('post.fediverse.copied') : t('post.fediverse.copy') }}
        </button>
        <span class="bd-sr" aria-live="polite">{{ copied ? t('post.fediverse.copiedAnnounce') : '' }}</span>
      </div>
      <form class="bd-fedi-form" novalidate @submit.prevent="open">
        <label for="bd-fedi-article-instance" class="bd-eyebrow bd-home-eyebrow">{{ t('post.fediverse.instanceLabel') }}</label>
        <div class="bd-fedi-row">
          <input
            id="bd-fedi-article-instance"
            v-model="instance"
            class="bd-input"
            type="text"
            inputmode="url"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            placeholder="mastodon.social"
            :aria-invalid="error ? 'true' : undefined"
            aria-describedby="bd-fedi-article-hint"
          >
          <BdButton type="submit" arrow>{{ t('post.fediverse.open') }}</BdButton>
        </div>
        <p id="bd-fedi-article-hint" :class="['bd-meta bd-fedi-hint', { 'bd-fedi-hint-error': error }]" role="status">{{ hint }}</p>
      </form>
      <p class="bd-meta bd-fedi-note">{{ t('post.fediverse.moderation') }}</p>
    </div>
  </section>
</template>
