<script setup lang="ts">
import type { StrapiAuthorRef } from '~/interfaces'

defineProps<{
  author?: StrapiAuthorRef | null
}>()

const { t } = useI18n()
const { localizePath } = useLocaleUtils()
const themeMessage = useThemeMessage()
</script>

<template>
  <section class="myc-author-card" aria-labelledby="myc-author-name">
    <BlogAuthorBadge :author="author" size="lg" />
    <div class="myc-author-card-body">
      <p class="myc-eyebrow myc-home-eyebrow">{{ t('post.writtenBy') }}</p>
      <h2 id="myc-author-name" class="myc-author-card-name">{{ author?.name || t('post.anonymous') }}</h2>
      <p class="myc-author-card-bio">{{ themeMessage('author.bio', 'post.authorBio') }}</p>
      <NuxtLink :to="localizePath('/about')" class="myc-author-card-link">{{ t('nav.about') }} <span aria-hidden="true">→</span></NuxtLink>
    </div>
  </section>
</template>
