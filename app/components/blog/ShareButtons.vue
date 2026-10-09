<script setup lang="ts">
import { mastodonShareUrl } from '~/helpers/share'

const props = defineProps<{
  title: string
  url: string
}>()

const { t } = useI18n()

const mastodonUrl = computed<string>(() => mastodonShareUrl(props.title, props.url))
const linkedinUrl = computed<string>(() => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(props.url)}`)
</script>

<template>
  <aside class="myc-share" :aria-label="t('post.share')">
    <p class="myc-eyebrow myc-home-eyebrow">{{ t('post.share') }}</p>
    <a :href="mastodonUrl" class="myc-share-link" target="_blank" rel="noopener noreferrer" :aria-label="t('post.shareOn', { network: 'Mastodon' })">
      Mastodon <span aria-hidden="true">↗</span>
    </a>
    <a :href="linkedinUrl" class="myc-share-link" target="_blank" rel="noopener noreferrer" :aria-label="t('post.shareOn', { network: 'LinkedIn' })">
      LinkedIn <span aria-hidden="true">↗</span>
    </a>
    <BlogCopyLinkButton :url="url" variant="link" />
  </aside>
</template>
