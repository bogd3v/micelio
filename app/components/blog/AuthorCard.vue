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
  <section class="bd-author-card" aria-labelledby="bd-author-name">
    <BlogAuthorBadge :author="author" size="lg" />
    <div class="bd-author-card-body">
      <p class="bd-eyebrow bd-home-eyebrow">{{ t('post.writtenBy') }}</p>
      <h2 id="bd-author-name" class="bd-author-card-name">{{ author?.name || t('post.anonymous') }}</h2>
      <p class="bd-author-card-bio">{{ themeMessage('author.bio', 'post.authorBio') }}</p>
      <NuxtLink :to="localizePath('/about')" class="bd-author-card-link">{{ t('nav.about') }} <span aria-hidden="true">→</span></NuxtLink>
    </div>
  </section>
</template>
